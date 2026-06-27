// HomesConnect — tracked contact redirect.
//   GET /.netlify/functions/go?ref=<id>&src=<web|bot>&to=<agent|hc>&sid=<hc_sid>
// Logs a contact_click event (with the listing's agent_id resolved) then 302s to
// the appropriate wa.me URL carrying the same pre-filled enquiry text the site
// used to link to directly. Logging is best-effort and never blocks the redirect.

import { getListingByRef } from './_lib/listings.js';
import { logHcEvent } from './_lib/hcEvents.js';

const HC_WA_NUMBER = '27767959872'; // HomesConnect WhatsApp number (see src/lib/constants.ts)

function normalize(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('27') && d.length === 11) return d;
  if (d.startsWith('0') && d.length === 10) return '27' + d.slice(1);
  return d;
}

function redirect(url) {
  return { statusCode: 302, headers: { Location: url, 'Cache-Control': 'no-store' }, body: '' };
}

export const handler = async (event) => {
  const p = event.queryStringParameters || {};
  const ref = String(p.ref || '').trim();
  const src = p.src === 'bot' ? 'bot' : 'web';
  const to = p.to === 'hc' ? 'hc' : 'agent';
  const sid = String(p.sid || '').trim() || 'anon';

  const listing = await getListingByRef(ref);

  // Pre-filled enquiry text — mirrors ListingDetailPage's original message.
  const title = listing?.title || 'a HomesConnect property';
  const place = [listing?.suburb, listing?.city].filter(Boolean).join(', ');
  const msg = encodeURIComponent(
    `Hi! I'm interested in ${title}${ref ? ` (${ref})` : ''}${place ? ` — ${place}` : ''}. Is it still available?`
  );

  // Resolve the destination number.
  let number = HC_WA_NUMBER;
  if (to === 'agent' && listing) {
    const direct = listing.whatsapp || listing.agent_phone;
    if (direct) number = normalize(direct);
  }

  // Best-effort log — must not block or break the redirect.
  try {
    await logHcEvent({
      event_type: 'contact_click',
      channel: src,
      listing_ref: listing ? listing.id : ref,
      agent_id: listing?.agent_id || '',
      query_text: '',
      session_hash: sid,
      meta: { src, to, found: !!listing },
    });
  } catch (_) { /* best-effort */ }

  return redirect(`https://wa.me/${number}?text=${msg}`);
};
