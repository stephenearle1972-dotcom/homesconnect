// One-off: prepare the workbook for the "Make an Offer" add-on.
//  1. Append 4 columns to the listings tab: make_an_offer_enabled,
//     make_an_offer_enabled_at, make_an_offer_disclosure, make_an_offer_token.
//  2. Create private "Offers" tab (25 cols) — NEVER published as CSV (POPIA).
//  3. Create private "OtpChallenges" tab — ephemeral mobile-OTP store.
// Idempotent. Prints the Offers gid (kept private; only here for reference).
import fs from 'node:fs';
import crypto from 'node:crypto';

const CREDS_PATH = 'F:\\My Drive\\TOWN CONNECT\\google-sheets-credentials.json.json';
const SHEET_ID = process.env.HOMESCONNECT_SHEET_ID || '1SMlKNPToUnmh0VzxJmcjti6DPsUML1K7xk4PqvOMKmU';
const LISTINGS_TAB = 'HomesConnect Listings';
const NEW_LISTING_COLS = ['make_an_offer_enabled', 'make_an_offer_enabled_at', 'make_an_offer_disclosure', 'make_an_offer_token'];
const OFFERS_HEADERS = ['id','listing_id','buyer_name','buyer_phone_verified','buyer_email','buyer_entity_type','proposed_price','funding_method','bond_amount','cash_contribution','deposit_amount','subject_to_sale','subject_to_sale_note','occupation_date','proposal_expiry','note_to_seller','note_for_conveyancer','ack_nonbinding','consent_share_seller','consent_share_conveyancer','status','selected_conveyancer','seller_action_log','created_at','updated_at'];
const OTP_HEADERS = ['id','phone','email','code_hash','expires_at','attempts','verified','verify_token','created_at'];

const creds = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
const b = (x) => Buffer.from(x).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function tok() {
  const n = Math.floor(Date.now() / 1000);
  const h = b(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const p = b(JSON.stringify({ iss: creds.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: n, exp: n + 3600 }));
  const s = b(crypto.createSign('RSA-SHA256').update(`${h}.${p}`).sign(creds.private_key));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${h}.${p}.${s}` }) });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()).access_token;
}
async function api(t, m, path, body) {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${path}`, { method: m, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`${m} ${path} ${r.status}: ${await r.text()}`);
  return r.json();
}
function colLetter(idx) { let s = '', n = idx; do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0); return s; }

const t = await tok();

// 1. Listings columns
const listingHdr = (await api(t, 'GET', `/${SHEET_ID}/values/${encodeURIComponent(LISTINGS_TAB + '!1:1')}`)).values?.[0] || [];
const toAdd = NEW_LISTING_COLS.filter((c) => !listingHdr.includes(c));
if (toAdd.length) {
  const start = listingHdr.length; // 0-based index of first empty header cell
  const range = `${LISTINGS_TAB}!${colLetter(start)}1:${colLetter(start + toAdd.length - 1)}1`;
  await api(t, 'PUT', `/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, { values: [toAdd] });
  console.log(`Listings: added ${toAdd.join(', ')} at ${range}.`);
} else {
  console.log('Listings: make_an_offer columns already present.');
}

// 2 + 3. Private tabs
async function ensureTab(title, headers) {
  let meta = await api(t, 'GET', `/${SHEET_ID}?fields=sheets.properties(title,sheetId)`);
  let tab = meta.sheets.find((s) => s.properties.title === title);
  if (!tab) {
    await api(t, 'POST', `/${SHEET_ID}:batchUpdate`, { requests: [{ addSheet: { properties: { title } } }] });
    meta = await api(t, 'GET', `/${SHEET_ID}?fields=sheets.properties(title,sheetId)`);
    tab = meta.sheets.find((s) => s.properties.title === title);
    console.log(`Created tab "${title}".`);
  } else {
    console.log(`Tab "${title}" already exists.`);
  }
  await api(t, 'PUT', `/${SHEET_ID}/values/${encodeURIComponent(title + '!A1')}?valueInputOption=RAW`, { values: [headers] });
  console.log(`  header written (${headers.length} cols), gid=${tab.properties.sheetId}`);
}
await ensureTab('Offers', OFFERS_HEADERS);
await ensureTab('OtpChallenges', OTP_HEADERS);
console.log('DONE. NOTE: do NOT publish Offers/OtpChallenges as CSV (POPIA).');
