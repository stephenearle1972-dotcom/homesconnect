// HomesConnect — public "Report listing" endpoint.
// Emails the operator so a human can review a listing a visitor flagged.
//
// Deliberately does NOT modify the sheet / auto-hide the listing: a single
// anonymous report must never be able to unpublish a paid listing (takedown-abuse
// risk). The admin reviews and decides via the moderation cell.

import { sendEmail } from './_lib/email.js';

const NOTIFY_EMAIL = process.env.HOMESCONNECT_NOTIFY_EMAIL || 'hello@townconnect.co.za';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function bad(status, body) { return { statusCode: status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }; }
function ok(body) { return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }; }

// Light, best-effort rate limit — keyed by IP, kept in lambda memory. Lambdas are
// ephemeral so this is not bulletproof; it just blunts trivial mash-the-button spam.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map(); // ip -> number[] (timestamps)

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) { hits.set(ip, recent); return true; }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return bad(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return bad(400, { error: 'Bad JSON' }); }

  const ref = String(body.ref || body.listing_id || '').trim().slice(0, 40);
  if (!ref) return bad(400, { error: 'Missing listing reference' });
  const reason = String(body.reason || '').trim().slice(0, 1000);
  const title = String(body.title || '').trim().slice(0, 160);

  const ip = (event.headers['x-nf-client-connection-ip']
    || event.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) {
    // Soft-success: don't reveal the limit, don't error the user out.
    console.warn('[report-listing] rate-limited', ip, ref);
    return ok({ ok: true });
  }

  const lines = [
    `A visitor reported a HomesConnect listing for review.`,
    ``,
    `Listing reference: ${ref}`,
    title ? `Listing title:     ${title}` : ``,
    `Reason given:      ${reason || '(none provided)'}`,
    ``,
    `Reported from IP:  ${ip}`,
    ``,
    `This is a report only — the listing has NOT been hidden. Review it and, if`,
    `appropriate, set the listing's "moderation" cell to "rejected" in the sheet,`,
    `or otherwise unpublish it. A single report never auto-hides a paid listing.`,
  ].filter((l) => l !== undefined);

  const res = await sendEmail({
    to: NOTIFY_EMAIL,
    subject: `Reported listing — ${ref}`,
    text: lines.join('\n'),
  });
  if (!res.ok) {
    console.error('[report-listing] email failed:', res.error);
    // Still 200 to the visitor — their report is logged in our function logs and a
    // mail hiccup shouldn't surface as a scary error on a public page.
  }

  return ok({ ok: true });
};
