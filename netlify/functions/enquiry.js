// HomesConnect — buyer enquiry form handler.
//   POST { ref, title?, name, phone, message?, consent:true, sid? }
// 1. Logs an `enquiry` event row (best-effort but the primary record).
// 2. Emails the listing agent an instant alert via the shared agentAlert helper
//    (falls back to hello@townconnect.co.za with a [NO AGENT EMAIL] prefix when
//    the listing has no agent_email).
// Email is best-effort: the request never fails if the event row was written.

import { getListingByRef } from './_lib/listings.js';
import { logHcEvent } from './_lib/hcEvents.js';
import { sendAgentAlertEmail } from './_lib/agentAlert.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function bad(status, body) { return { statusCode: status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }; }
function ok(body) { return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }; }

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return bad(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return bad(400, { error: 'Bad JSON' }); }

  const ref = String(body.ref || '').trim().slice(0, 40);
  const name = String(body.name || '').trim().slice(0, 120);
  const phone = String(body.phone || '').trim().slice(0, 40);
  const message = String(body.message || '').trim().slice(0, 1000);
  const consent = body.consent === true;
  const sid = String(body.sid || '').trim() || 'anon';

  if (!ref) return bad(400, { error: 'Missing listing reference' });
  if (!phone) return bad(400, { error: 'Phone number is required' });
  if (!consent) return bad(400, { error: 'Consent is required' });

  const listing = await getListingByRef(ref);
  const title = listing?.title || body.title || ref;

  // 1. Primary record — the event row.
  await logHcEvent({
    event_type: 'enquiry',
    channel: 'web',
    listing_ref: listing ? listing.id : ref,
    agent_id: listing?.agent_id || '',
    query_text: message || `(no message) from ${name || 'buyer'}`,
    session_hash: sid,
    meta: { name, phone },
  });

  // 2. Instant agent email (best-effort — never fails the request).
  try {
    await sendAgentAlertEmail({
      agentEmail: listing?.agent_email,
      agentName: listing?.agent_name,
      subject: `New enquiry — ${title} (Ref ${listing ? listing.id : ref})`,
      lines: [
        `A buyer enquired about this listing on HomesConnect:`,
        ``,
        `Listing: ${title}`,
        `Reference: ${listing ? listing.id : ref}`,
        ``,
        `Buyer name: ${name || '(not given)'}`,
        `Buyer phone: ${phone}`,
        `Message: ${message || '(none)'}`,
        ``,
        `The buyer agreed that their details may be shared with you so you can contact them directly.`,
      ],
    });
  } catch (err) {
    console.error('[alert-email-fail] enquiry -', err.message);
  }

  return ok({ ok: true });
};
