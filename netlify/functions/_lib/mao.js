// Shared core for the "Make an Offer" add-on (non-binding proposed terms).
// All Offers/OTP access is server-side only — these tabs are NEVER published as CSV.
import crypto from 'node:crypto';
import { getTabValues, appendRowToTab, updateValues } from './sheets.js';

export const SHEET_ID = process.env.HOMESCONNECT_SHEET_ID;
// PRIVATE store for Offers / OtpChallenges / MaoListings (buyer PII, tokens, OTP).
// MUST be a SEPARATE spreadsheet that is NOT link-shared/published — otherwise its
// tabs are downloadable via /export (the main workbook is link-shared so the public
// listings CSV works). Falls back to the main sheet only if unset (NOT POPIA-safe —
// set HOMESCONNECT_PRIVATE_SHEET_ID to a restricted sheet for production use).
export const PRIVATE_SHEET_ID = process.env.HOMESCONNECT_PRIVATE_SHEET_ID || process.env.HOMESCONNECT_SHEET_ID;
export const LISTINGS_TAB = 'HomesConnect Listings';
export const OFFERS_TAB = 'Offers';
export const OTP_TAB = 'OtpChallenges';
export const ADDON_AMOUNT = process.env.MAO_ADDON_AMOUNT || '299.00';
export const SITE_URL = process.env.SITE_URL_HOMESCONNECT || 'https://homesconnect.co.za';

// Public gate (reversible): when MAO_PUBLIC_ENABLED === 'false', the public may NOT
// enable/buy/use Make an Offer on a REAL listing. Demo listings (HCDEMO*, or any id
// in MAO_DEMO_LISTINGS) stay fully functional so the journey can be demonstrated.
// Default is enabled (true) unless the env var is explicitly the string 'false'.
export const MAO_PUBLIC_ENABLED = process.env.MAO_PUBLIC_ENABLED !== 'false';
export function isDemoListing(id) {
  if (!id) return false;
  if (/^HCDEMO/i.test(id)) return true;
  return (process.env.MAO_DEMO_LISTINGS || '').split(',').map((s) => s.trim()).filter(Boolean).includes(id);
}
// Whether Make an Offer may operate for this listing right now.
export function maoAllowed(listingId) { return MAO_PUBLIC_ENABLED || isDemoListing(listingId); }

// ECTA supplier disclosure (shown at checkout + on the invoice). Physical address is
// the owner-chosen "available on request" wording — replace the `address` line with
// the exact registered street address when provided (one-line change).
export const COMPANY = {
  name: 'TownConnect (Pty) Ltd t/a HomesConnect',
  reg: '2026/106250/07',
  address: 'Registered office — full physical address available on request to hello@townconnect.co.za',
  phone: '+27 68 898 6081',
  email: 'hello@townconnect.co.za',
  website: 'https://homesconnect.co.za',
};
export const ADDON = {
  name: 'Make an Offer add-on',
  price: ADDON_AMOUNT,
  includes: [
    'Buyers can send structured, non-binding proposed terms on this listing',
    'A private dashboard to review and compare all proposals',
    'A neutral handoff to a conveyancer of your choice when you are ready',
  ],
  excludes: [
    'No legal advice', 'No conveyancing or attorney services', 'No property valuation',
    'No bond/finance approval', 'No payment of attorney/conveyancing fees',
    'HomesConnect never creates a binding sale and never holds deposits',
  ],
  duration: 'Active for as long as your listing remains active. Once-off fee — no recurring billing.',
  refund: 'Because the service is activated and performance begins immediately on your request, the fee is non-refundable once activated. If activation fails (e.g. payment captured but the add-on is not enabled), the fee is refunded in full.',
  privacy: 'Buyer proposals are stored privately and accessed only via authenticated processes — never published. See the privacy notice. We never send banking details.',
};

// Language discipline (STEP 2) — shown verbatim at every stage.
export const NONBINDING_NOTICE =
  'This online process does not create a binding sale of immovable property. It records ' +
  'proposed terms for discussion. A sale becomes binding only once the parties sign a ' +
  'written Offer to Purchase that complies with South African law.';

export const FRAUD_NOTICE =
  'HomesConnect will never send banking details. Verify all payment instructions directly ' +
  'with the conveyancer using independently confirmed contact details.';

export const OFFER_STATUSES = ['submitted', 'clarification_requested', 'revision_invited', 'proceeding_to_otp', 'declined', 'withdrawn', 'expired'];

// Exact Offers tab header order (append/update are positional).
export const OFFERS_COLS = ['id','listing_id','buyer_name','buyer_phone_verified','buyer_email','buyer_entity_type','proposed_price','funding_method','bond_amount','cash_contribution','deposit_amount','subject_to_sale','subject_to_sale_note','occupation_date','proposal_expiry','note_to_seller','note_for_conveyancer','ack_nonbinding','consent_share_seller','consent_share_conveyancer','status','selected_conveyancer','seller_action_log','created_at','updated_at'];
const OTP_COLS = ['id','phone','email','code_hash','expires_at','attempts','verified','verify_token','created_at'];

export function nowIso() { return new Date().toISOString(); }
export function genId(prefix) { return prefix + Math.floor(Date.now() / 1000) + crypto.randomBytes(2).toString('hex'); }
export function genToken() { return crypto.randomBytes(24).toString('base64url'); }
export function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
export function colLetter(idx) { let s = '', n = idx; do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0); return s; }

function toObjects(values, cols) {
  const headers = values[0] || cols;
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row || !row[0]) continue;
    const obj = { _row: i + 1 };
    headers.forEach((h, j) => { obj[h] = row[j] != null ? row[j] : ''; });
    out.push(obj);
  }
  return { headers, list: out };
}

// ---------- Listings ----------
export async function getListingById(id) {
  const values = await getTabValues(SHEET_ID, LISTINGS_TAB);
  const { headers, list } = toObjects(values);
  const obj = list.find((r) => r.id === id);
  return obj ? { listing: obj, headers } : null;
}

// Update specific listing columns by header name (writes each as one cell range).
export async function updateListingFields(rowNumber, headers, fields) {
  const data = [];
  for (const [k, v] of Object.entries(fields)) {
    const idx = headers.indexOf(k);
    if (idx === -1) continue;
    data.push(updateValues(SHEET_ID, `${LISTINGS_TAB}!${colLetter(idx)}${rowNumber}`, [[v]]));
  }
  await Promise.all(data);
}

// ---------- MaoListings (PRIVATE: seller email, disclosure, access token) ----------
// Kept out of the public listings CSV. Only make_an_offer_enabled/_at live on the
// public listings sheet (boolean/timestamp = safe to expose).
export const MAO_LISTINGS_TAB = 'MaoListings';
const MAO_LISTINGS_COLS = ['listing_id', 'seller_name', 'seller_email', 'token', 'disclosure_json', 'created_at', 'updated_at'];

export async function getMaoListing(listingId) {
  const values = await getTabValues(PRIVATE_SHEET_ID, MAO_LISTINGS_TAB);
  const { list } = toObjects(values, MAO_LISTINGS_COLS);
  return list.find((r) => r.listing_id === listingId) || null;
}
export async function upsertMaoListing(listingId, fields) {
  const existing = await getMaoListing(listingId);
  if (existing) {
    const merged = { ...existing, ...fields, listing_id: listingId, updated_at: nowIso() };
    const last = colLetter(MAO_LISTINGS_COLS.length - 1);
    await updateValues(PRIVATE_SHEET_ID, `${MAO_LISTINGS_TAB}!A${existing._row}:${last}${existing._row}`, [MAO_LISTINGS_COLS.map((c) => (merged[c] != null ? merged[c] : ''))]);
    return merged;
  }
  const obj = { listing_id: listingId, seller_name: '', seller_email: '', token: '', disclosure_json: '', created_at: nowIso(), updated_at: nowIso(), ...fields };
  await appendRowToTab(PRIVATE_SHEET_ID, MAO_LISTINGS_TAB, MAO_LISTINGS_COLS.map((c) => (obj[c] != null ? obj[c] : '')));
  return obj;
}

// ---------- Offers ----------
export function offerToRow(obj) { return OFFERS_COLS.map((c) => (obj[c] != null ? obj[c] : '')); }

export async function getOffersForListing(listingId) {
  const values = await getTabValues(PRIVATE_SHEET_ID, OFFERS_TAB);
  const { list } = toObjects(values, OFFERS_COLS);
  return list.filter((o) => o.listing_id === listingId);
}
export async function getOfferById(id) {
  const values = await getTabValues(PRIVATE_SHEET_ID, OFFERS_TAB);
  const { list } = toObjects(values, OFFERS_COLS);
  return list.find((o) => o.id === id) || null;
}
export async function appendOffer(obj) { return appendRowToTab(PRIVATE_SHEET_ID, OFFERS_TAB, offerToRow(obj)); }

// Rewrite an offer's whole row from an object (must include _row).
export async function saveOffer(obj) {
  const last = colLetter(OFFERS_COLS.length - 1);
  await updateValues(PRIVATE_SHEET_ID, `${OFFERS_TAB}!A${obj._row}:${last}${obj._row}`, [offerToRow(obj)]);
}

// ---------- OTP ----------
export async function createOtp({ phone, email, codeHash, expiresAt, verifyToken }) {
  const id = genId('OTP');
  await appendRowToTab(PRIVATE_SHEET_ID, OTP_TAB, [id, phone, email, codeHash, expiresAt, '0', 'no', verifyToken, nowIso()]);
  return id;
}
export async function getOtpById(id) {
  const values = await getTabValues(PRIVATE_SHEET_ID, OTP_TAB);
  const { list } = toObjects(values, OTP_COLS);
  return list.find((o) => o.id === id) || null;
}
export async function saveOtp(obj) {
  const last = colLetter(OTP_COLS.length - 1);
  await updateValues(PRIVATE_SHEET_ID, `${OTP_TAB}!A${obj._row}:${last}${obj._row}`, [OTP_COLS.map((c) => (obj[c] != null ? obj[c] : ''))]);
}

// ---------- helpers ----------
export function isPrivateEnabled(listing) {
  return listing && listing.seller_type === 'private' &&
    String(listing.make_an_offer_enabled).toLowerCase() === 'true';
}
export function parseActionLog(s) { try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } }

// Deterministic one-click buyer-consent token (no storage). Keyed by the PayFast
// passphrase as a server secret + the offer id + buyer email.
export function consentToken(offerId, email) {
  return crypto.createHmac('sha256', process.env.PAYFAST_PASSPHRASE || 'mao-secret')
    .update(`${offerId}|${email}`).digest('hex').slice(0, 32);
}

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
export function json(status, body) {
  return { statusCode: status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
