// Make an Offer — buyer submits non-binding proposed terms.
// Re-verifies the OTP, validates consents + arithmetic server-side, writes the
// Offer row (status=submitted), emails the seller (tokenised link) and the buyer.
import {
  getListingById, isPrivateEnabled, getOtpById, appendOffer, genId, genToken,
  nowIso, json, CORS, NONBINDING_NOTICE, SITE_URL, getMaoListing, upsertMaoListing,
} from './_lib/mao.js';
import { sendEmail } from './_lib/email.js';

const ENTITY_TYPES = ['individual', 'company', 'trust', 'other'];
const FUNDING = ['cash', 'bond', 'mixed'];

function money(n) { return 'R ' + (Number(n) || 0).toLocaleString('en-ZA'); }

function summaryLines(o, listing) {
  const L = [];
  L.push(`Property: ${listing.title} (${listing.id}) — ${listing.suburb}, ${listing.city}`);
  L.push(`Proposed price: ${money(o.proposed_price)}`);
  L.push(`Funding: ${o.funding_method}${o.funding_method === 'mixed' ? ` (bond ${money(o.bond_amount)} + cash ${money(o.cash_contribution)})` : ''}`);
  if (o.deposit_amount) L.push(`Deposit: ${money(o.deposit_amount)}`);
  L.push(`Subject to sale of another property: ${o.subject_to_sale === 'yes' ? 'Yes' : 'No'}${o.subject_to_sale_note ? ` — ${o.subject_to_sale_note}` : ''}`);
  if (o.occupation_date) L.push(`Preferred occupation date: ${o.occupation_date}`);
  L.push(`Proposal expires: ${o.proposal_expiry}`);
  if (o.note_to_seller) L.push(`Note to seller: ${o.note_to_seller}`);
  return L.join('\n');
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let b; try { b = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Bad JSON' }); }

  // 1. Listing must be a private listing with the add-on enabled.
  const found = await getListingById(b.listing_id);
  if (!found || !isPrivateEnabled(found.listing)) {
    return json(400, { error: 'This listing is not accepting proposals.' });
  }
  const listing = found.listing;

  // 2. OTP must be verified and match the submitted phone.
  const otp = b.challengeId ? await getOtpById(b.challengeId) : null;
  if (!otp || otp.verified !== 'yes' || otp.verify_token !== b.verifyToken) {
    return json(400, { error: 'Mobile number not verified. Please complete OTP verification.' });
  }
  if (new Date(otp.expires_at).getTime() < Date.now() - 60 * 60 * 1000) {
    return json(400, { error: 'Verification expired — please verify again.' });
  }

  // 3. Field validation
  const errors = {};
  if (!String(b.buyer_name || '').trim()) errors.buyer_name = 'Your name is required';
  if (!ENTITY_TYPES.includes(b.buyer_entity_type)) errors.buyer_entity_type = 'Select who is buying';
  const price = Math.round(Number(b.proposed_price) || 0);
  if (!(price > 0)) errors.proposed_price = 'Enter a proposed price';
  if (!FUNDING.includes(b.funding_method)) errors.funding_method = 'Select a funding method';
  const bond = Math.round(Number(b.bond_amount) || 0);
  const cash = Math.round(Number(b.cash_contribution) || 0);
  // 4. Arithmetic (also enforced client-side): mixed funding must add up.
  if (b.funding_method === 'mixed' && bond + cash !== price) {
    errors.arithmetic = `Bond (${money(bond)}) + cash contribution (${money(cash)}) must equal the proposed price (${money(price)}).`;
  }
  if (b.subject_to_sale === 'yes' && !String(b.subject_to_sale_note || '').trim()) {
    errors.subject_to_sale_note = 'Add a short note about the property you must sell first';
  }
  // 5. Required, unbundled consent gates (STEP 4)
  if (b.ack_nonbinding !== true) errors.ack_nonbinding = 'You must acknowledge this is non-binding';
  if (b.consent_share_seller !== true) errors.consent_share_seller = 'Consent to share terms with the seller is required';
  if (b.ack_conveyancer_later !== true) errors.ack_conveyancer_later = 'Please acknowledge how your details may be shared with a conveyancer';
  if (b.ack_privacy !== true) errors.ack_privacy = 'Please confirm you have read the privacy notice';
  // Legal review #1 — buyer must confirm receipt of the seller's disclosure record.
  if (b.ack_disclosure_received !== true) errors.ack_disclosure_received = "Please confirm you received the seller's property-condition disclosure record";
  if (Object.keys(errors).length) return json(400, { error: 'Please fix the highlighted items', errors });

  // 6. Build the Offer row
  const id = genId('OF');
  const expiry = String(b.proposal_expiry || '').trim() ||
    new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const auditLog = [{
    t: nowIso(), actor: 'buyer', event: 'submitted',
    consents: { ack_nonbinding: true, share_seller: true, ack_conveyancer_later: true, privacy: true, disclosure_received: true, marketing: b.marketing_consent === true },
  }];
  const offer = {
    id, listing_id: listing.id,
    buyer_name: String(b.buyer_name).trim(),
    buyer_phone_verified: otp.phone,
    buyer_email: otp.email,
    buyer_entity_type: b.buyer_entity_type,
    proposed_price: String(price),
    funding_method: b.funding_method,
    bond_amount: b.funding_method === 'cash' ? '' : String(bond),
    cash_contribution: b.funding_method === 'bond' ? '' : String(cash),
    deposit_amount: b.deposit_amount ? String(Math.round(Number(b.deposit_amount) || 0)) : '',
    subject_to_sale: b.subject_to_sale === 'yes' ? 'yes' : 'no',
    subject_to_sale_note: String(b.subject_to_sale_note || '').trim(),
    occupation_date: String(b.occupation_date || '').trim(),
    proposal_expiry: expiry,
    note_to_seller: String(b.note_to_seller || '').trim(),
    note_for_conveyancer: String(b.note_for_conveyancer || '').trim(),
    ack_nonbinding: 'yes',
    consent_share_seller: 'yes',
    consent_share_conveyancer: '', // captured later, only if the seller proceeds
    status: 'submitted',
    selected_conveyancer: '',
    seller_action_log: JSON.stringify(auditLog),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  try { await appendOffer(offer); }
  catch (err) { console.error('[mao-submit] append failed:', err.message); return json(500, { error: 'Could not record your proposal. Please try again.' }); }

  // 7. Seller's private link token + email come from the PRIVATE MaoListings tab.
  const mao = await getMaoListing(listing.id);
  let token = mao && mao.token;
  if (!token) { token = genToken(); try { await upsertMaoListing(listing.id, { token }); } catch {} }
  const sellerEmail = (mao && mao.seller_email || '').trim();

  // 8. Notify seller + buyer (email = reliable channel; never include banking details)
  const sellerLink = `${SITE_URL}/seller?listing=${encodeURIComponent(listing.id)}&token=${encodeURIComponent(token)}`;
  const summary = summaryLines(offer, listing);

  if (sellerEmail) {
    await sendEmail({
      to: sellerEmail,
      subject: `New proposed terms for ${listing.title}`,
      text: `${NONBINDING_NOTICE}\n\nYou have received non-binding proposed terms for your listing.\n\n${summary}\n\n` +
        `Review and compare all proposals here (private link — do not share):\n${sellerLink}\n`,
    });
  }
  await sendEmail({
    to: offer.buyer_email,
    subject: `We've sent your proposed terms — ${listing.title}`,
    text: `${NONBINDING_NOTICE}\n\nThank you. Your non-binding proposed terms have been sent to the seller for consideration.\n\n${summary}\n\n` +
      `Reference: ${id}. The seller may request clarification, invite revised terms, proceed to a formal Offer to Purchase, or decline.`,
  });

  return json(200, { offer_id: id, status: 'submitted', nonbinding_notice: NONBINDING_NOTICE });
};
