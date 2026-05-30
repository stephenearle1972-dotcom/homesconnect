// Make an Offer — buyer's one-click consent to share data with the seller's chosen
// conveyancer (POPIA: consent captured at the point the seller proceeds). On consent,
// the structured handoff pack is emailed to the conveyancer. No banking details ever.
import {
  getOfferById, getListingById, getMaoListing, saveOffer, parseActionLog, nowIso, json, CORS,
  consentToken, NONBINDING_NOTICE, FRAUD_NOTICE,
} from './_lib/mao.js';
import { sendEmail } from './_lib/email.js';

function money(n) { return 'R ' + (Number(n) || 0).toLocaleString('en-ZA'); }

function handoffPack(offer, listing, disclosure, conv) {
  const seller = disclosure || {};
  const cond = (seller.condition) || {};
  const lines = [];
  lines.push(NONBINDING_NOTICE);
  lines.push('');
  lines.push('=== HomesConnect — Offer to Purchase handoff pack ===');
  lines.push('Both the buyer and the seller have consented to share the following with you to draw a formal Offer to Purchase.');
  lines.push('');
  lines.push(`PROPERTY: ${listing.title} (${listing.id})`);
  lines.push(`  ${listing.suburb}, ${listing.city}, ${listing.province} — listed at ${listing.price_display} (${listing.type})`);
  lines.push('');
  lines.push('SELLER:');
  lines.push(`  ${seller.sellerName || '(name on file)'} — ${seller.sellerEmail || ''}`);
  lines.push('');
  lines.push('BUYER:');
  lines.push(`  ${offer.buyer_name} (${offer.buyer_entity_type}) — ${offer.buyer_phone_verified} / ${offer.buyer_email}`);
  lines.push('');
  lines.push('CURRENT PROPOSED TERMS:');
  lines.push(`  Proposed price: ${money(offer.proposed_price)}`);
  lines.push(`  Funding: ${offer.funding_method}` + (offer.funding_method === 'mixed' ? ` (bond ${money(offer.bond_amount)} + cash ${money(offer.cash_contribution)})` : ''));
  if (offer.deposit_amount) lines.push(`  Deposit: ${money(offer.deposit_amount)}`);
  lines.push(`  Subject to sale of another property: ${offer.subject_to_sale === 'yes' ? `Yes — ${offer.subject_to_sale_note}` : 'No'}`);
  if (offer.occupation_date) lines.push(`  Preferred occupation date: ${offer.occupation_date}`);
  lines.push(`  Proposal expiry: ${offer.proposal_expiry}`);
  if (offer.note_for_conveyancer) lines.push(`  Note for conveyancer: ${offer.note_for_conveyancer}`);
  if (offer.note_to_seller) lines.push(`  Note to seller: ${offer.note_to_seller}`);
  lines.push('');
  lines.push("SELLER'S PROPERTY-CONDITION DISCLOSURE:");
  lines.push(`  Occupancy: ${cond.occupancy || '-'}`);
  lines.push(`  Known defects: ${cond.known_defects || '-'}`);
  lines.push(`  Additions approved: ${cond.additions_approved || '-'}`);
  lines.push(`  Notes: ${cond.notes || '-'}`);
  lines.push('');
  lines.push('PROPOSAL & CONSENT AUDIT LOG:');
  for (const e of parseActionLog(offer.seller_action_log)) {
    lines.push(`  [${e.t}] ${e.actor}: ${e.event}` + (e.note ? ` — ${e.note}` : '') + (e.consents ? ` — consents: ${JSON.stringify(e.consents)}` : ''));
  }
  lines.push('');
  lines.push(`CHOSEN CONVEYANCER: ${conv.name}${conv.firm ? `, ${conv.firm}` : ''} (${conv.email}) — nominated by the seller (${conv.mode}).`);
  lines.push('');
  lines.push(FRAUD_NOTICE);
  return lines.join('\n');
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  const params = event.queryStringParameters || {};
  let offerId = params.offer, t = params.t;
  if (event.httpMethod === 'POST') {
    try { const b = JSON.parse(event.body || '{}'); offerId = b.offer || offerId; t = b.t || t; } catch {}
  }
  if (!offerId || !t) return json(400, { error: 'Invalid link' });

  const offer = await getOfferById(offerId);
  if (!offer) return json(404, { error: 'Proposal not found' });
  if (t !== consentToken(offer.id, offer.buyer_email)) return json(403, { error: 'Invalid or expired link' });

  const found = await getListingById(offer.listing_id);
  const listing = found ? found.listing : {};
  const mao = await getMaoListing(offer.listing_id);
  let disclosure = null; try { disclosure = JSON.parse((mao && mao.disclosure_json) || 'null'); } catch {}
  let conv = null; try { conv = JSON.parse(offer.selected_conveyancer || 'null'); } catch {}

  if (event.httpMethod === 'GET') {
    return json(200, {
      offer: {
        id: offer.id, listing_title: listing.title, listing_id: offer.listing_id,
        proposed_price: Number(offer.proposed_price) || 0, status: offer.status,
        already_consented: offer.consent_share_conveyancer === 'yes',
      },
      conveyancer: conv && conv.mode !== 'later' ? { name: conv.name, firm: conv.firm, email: conv.email } : null,
      nonbinding_notice: NONBINDING_NOTICE,
      fraud_notice: FRAUD_NOTICE,
    });
  }

  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!conv || conv.mode === 'later' || !conv.email) {
    return json(400, { error: 'No conveyancer has been nominated yet.' });
  }

  // Record buyer consent + send the handoff pack (idempotent-ish: safe to re-send).
  const log = parseActionLog(offer.seller_action_log);
  if (offer.consent_share_conveyancer !== 'yes') {
    offer.consent_share_conveyancer = 'yes';
    log.push({ t: nowIso(), actor: 'buyer', event: 'consent_share_conveyancer', conveyancer: conv.email });
    offer.seller_action_log = JSON.stringify(log);
    offer.updated_at = nowIso();
    await saveOffer(offer);
  }

  const pack = handoffPack(offer, listing, disclosure, conv);
  const sent = await sendEmail({
    to: conv.email,
    subject: `OTP handoff — ${listing.title} (${listing.id})`,
    text: pack,
  });
  // Confirm to buyer + seller, with the fraud-control message.
  const sellerEmail = disclosure?.sellerEmail;
  await sendEmail({ to: offer.buyer_email, subject: `Your details have been shared with the conveyancer — ${listing.title}`, text: `${NONBINDING_NOTICE}\n\nYou consented to share your proposed terms and contact details with ${conv.name} (${conv.email}) to draw the formal Offer to Purchase.\n\n${FRAUD_NOTICE}` });
  if (sellerEmail) await sendEmail({ to: sellerEmail, subject: `Conveyancer handoff sent — ${listing.title}`, text: `${NONBINDING_NOTICE}\n\nThe buyer has consented. The handoff pack has been sent to ${conv.name} (${conv.email}).\n\n${FRAUD_NOTICE}` });

  return json(200, { ok: true, handoff_emailed: sent.ok, conveyancer: { name: conv.name, email: conv.email }, fraud_notice: FRAUD_NOTICE });
};
