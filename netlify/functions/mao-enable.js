// Make an Offer — seller enables the paid add-on on a private listing they own.
// Stores the property-condition disclosure + a tokenised-link token on the listing,
// then returns signed PayFast params (custom_str1='mao_enable'). The add-on is only
// switched on by the ITN after a valid payment. (A demo listing can be enabled
// without payment via scripts/enable-mao.mjs.)
import crypto from 'node:crypto';
import {
  getListingById, getMaoListing, upsertMaoListing, genToken, nowIso, json, CORS, ADDON_AMOUNT, SITE_URL, maoAllowed,
} from './_lib/mao.js';

const PAYFAST_URL = 'https://www.payfast.co.za/eng/process';

// PayFast urlencode: spaces -> '+', PHP-style. (Same as list-property.js.)
function pfEnc(v) {
  return encodeURIComponent(String(v)).replace(/%20/g, '+').replace(/!/g, '%21')
    .replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\*/g, '%2A');
}
// Sign in INSERTION order (the order fields are posted) — NOT sorted. See list-property.js.
function signPayfast(params, passphrase) {
  const parts = [];
  for (const k of Object.keys(params)) {
    if (k === 'signature') continue;
    const v = params[k];
    if (v === undefined || v === null || v === '') continue;
    parts.push(`${k}=${pfEnc(v)}`);
  }
  let s = parts.join('&');
  if (passphrase) s += `&passphrase=${pfEnc(passphrase)}`;
  return crypto.createHash('md5').update(s).digest('hex');
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let b; try { b = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Bad JSON' }); }

  const found = await getListingById(b.listing_id);
  if (!found) return json(404, { error: 'Listing not found' });
  const listing = found.listing;
  if (listing.seller_type !== 'private') return json(400, { error: 'Make an Offer is only available on private (FSBO) listings.' });
  // Public gate: refuse to enable/charge on a real listing while gated.
  if (!maoAllowed(listing.id)) {
    return json(403, { error: 'Make an Offer is not yet available to the public. It is coming soon — no payment can be taken at this time.' });
  }

  // Required pre-enable gates (STEP 3 + legal review #1, #3, #5)
  const errors = {};
  if (b.confirm_authority !== true) errors.confirm_authority = 'Confirm you are entitled to sell this property';
  if (b.ack_nonbinding !== true) errors.ack_nonbinding = 'Acknowledge that no online action creates a binding sale';
  if (b.ack_nominate_later !== true) errors.ack_nominate_later = 'Acknowledge you will nominate a conveyancer later';
  // #3 authority / mandate declarations
  if (b.decl_owner_or_authorised !== true) errors.decl_owner_or_authorised = 'Confirm you are the owner or duly authorised';
  if (b.decl_mandate_disclosed !== true) errors.decl_mandate_disclosed = 'Confirm you have disclosed any mandate/restriction';
  // #1 disclosure completeness declaration
  if (b.decl_disclosure_complete !== true) errors.decl_disclosure_complete = 'Confirm the disclosure record is complete and may be shared with buyers';
  // #5 immediate-activation consent (ECTA)
  if (b.consent_immediate_activation !== true) errors.consent_immediate_activation = 'Consent to immediate activation is required to begin the service';
  const sellerEmail = String(b.seller_email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sellerEmail)) errors.seller_email = 'Enter a valid email for proposal notifications';
  if (Object.keys(errors).length) return json(400, { error: 'Please complete the required items', errors });

  // Persist disclosure + token to the PRIVATE MaoListings tab (token reused if present).
  const existingMao = await getMaoListing(listing.id);
  const token = (existingMao && existingMao.token) || genToken();
  const sellerName = String(b.seller_name || listing.agent_name || '').trim();
  const disclosure = {
    sellerName,
    sellerEmail,
    condition: {
      occupancy: String(b.cond_occupancy || '').trim(),
      known_defects: String(b.cond_known_defects || '').trim(),
      additions_approved: String(b.cond_additions_approved || '').trim(),
      notes: String(b.cond_notes || '').trim(),
    },
    acks: { authority: true, nonbinding: true, nominate_later: true },
    // Legal-review declarations, each accepted at this timestamp.
    declarations: {
      owner_or_authorised: true,
      mandate_disclosed: true,
      disclosure_complete: true,
      immediate_activation: true,
      at: nowIso(),
    },
    at: nowIso(),
  };
  try {
    await upsertMaoListing(listing.id, {
      seller_name: sellerName,
      seller_email: sellerEmail,
      token,
      disclosure_json: JSON.stringify(disclosure),
    });
  } catch (err) {
    console.error('[mao-enable] persist failed:', err.message);
    return json(500, { error: 'Could not save. Please try again.' });
  }

  // Build signed PayFast params for the once-off add-on fee.
  const params = {
    merchant_id: process.env.PAYFAST_MERCHANT_ID,
    merchant_key: process.env.PAYFAST_MERCHANT_KEY,
    return_url: `${SITE_URL}/seller?listing=${encodeURIComponent(listing.id)}&token=${encodeURIComponent(token)}&enabled=1`,
    cancel_url: `${SITE_URL}/seller?listing=${encodeURIComponent(listing.id)}&token=${encodeURIComponent(token)}&enable_cancelled=1`,
    notify_url: `${SITE_URL}/.netlify/functions/payfast-itn`,
    name_first: (disclosure.sellerName.split(' ')[0] || 'Seller'),
    name_last: (disclosure.sellerName.split(' ').slice(1).join(' ') || ''),
    email_address: sellerEmail,
    m_payment_id: listing.id,
    amount: ADDON_AMOUNT,
    item_name: `Make an Offer add-on — ${listing.title}`.slice(0, 100),
    item_description: `Enables non-binding proposed terms on listing ${listing.id}`.slice(0, 254),
    custom_str1: 'mao_enable',
  };
  params.signature = signPayfast(params, process.env.PAYFAST_PASSPHRASE || '');

  return json(200, { payfast_url: PAYFAST_URL, params, token });
};
