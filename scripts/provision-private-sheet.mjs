// Run AFTER Stephen creates a private spreadsheet and shares it (Editor) with the
// service account, and sets HOMESCONNECT_PRIVATE_SHEET_ID on the homesconnect-za site.
// Creates the three private tabs (Offers / OtpChallenges / MaoListings) with headers
// in that private sheet, then deletes those tabs from the public workbook so no PII
// remains in the link-shared file.
//   node scripts/provision-private-sheet.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
const CREDS_PATH = 'F:\\My Drive\\TOWN CONNECT\\google-sheets-credentials.json.json';
const PUBLIC_ID = process.env.HOMESCONNECT_SHEET_ID || '1SMlKNPToUnmh0VzxJmcjti6DPsUML1K7xk4PqvOMKmU';
const PRIVATE_ID = process.env.HOMESCONNECT_PRIVATE_SHEET_ID;
if (!PRIVATE_ID) { console.error('Set HOMESCONNECT_PRIVATE_SHEET_ID first.'); process.exit(1); }

const HEADERS = {
  Offers: ['id','listing_id','buyer_name','buyer_phone_verified','buyer_email','buyer_entity_type','proposed_price','funding_method','bond_amount','cash_contribution','deposit_amount','subject_to_sale','subject_to_sale_note','occupation_date','proposal_expiry','note_to_seller','note_for_conveyancer','ack_nonbinding','consent_share_seller','consent_share_conveyancer','status','selected_conveyancer','seller_action_log','created_at','updated_at'],
  OtpChallenges: ['id','phone','email','code_hash','expires_at','attempts','verified','verify_token','created_at'],
  MaoListings: ['listing_id','seller_name','seller_email','token','disclosure_json','created_at','updated_at'],
};

const creds = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
const b = (x) => Buffer.from(x).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function tok() { const n = Math.floor(Date.now() / 1000); const h = b(JSON.stringify({ alg: 'RS256', typ: 'JWT' })); const p = b(JSON.stringify({ iss: creds.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: n, exp: n + 3600 })); const s = b(crypto.createSign('RSA-SHA256').update(`${h}.${p}`).sign(creds.private_key)); const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${h}.${p}.${s}` }) }); return (await r.json()).access_token; }
async function api(t, m, path, body) { const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${path}`, { method: m, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); if (!r.ok) throw new Error(`${m} ${path} ${r.status}: ${await r.text()}`); return r.json(); }

const t = await tok();
// Create + header the tabs in the PRIVATE sheet.
let meta = await api(t, 'GET', `/${PRIVATE_ID}?fields=sheets.properties(title,sheetId)`);
for (const [title, headers] of Object.entries(HEADERS)) {
  if (!meta.sheets.find((s) => s.properties.title === title)) {
    await api(t, 'POST', `/${PRIVATE_ID}:batchUpdate`, { requests: [{ addSheet: { properties: { title } } }] });
    console.log(`PRIVATE: created tab "${title}".`);
  }
  await api(t, 'PUT', `/${PRIVATE_ID}/values/${encodeURIComponent(title + '!A1')}?valueInputOption=RAW`, { values: [headers] });
}
console.log('PRIVATE sheet provisioned.');

// Delete the same tabs from the PUBLIC workbook so no PII remains there.
const pub = await api(t, 'GET', `/${PUBLIC_ID}?fields=sheets.properties(title,sheetId)`);
for (const title of Object.keys(HEADERS)) {
  const sh = pub.sheets.find((s) => s.properties.title === title);
  if (sh) {
    await api(t, 'POST', `/${PUBLIC_ID}:batchUpdate`, { requests: [{ deleteSheet: { sheetId: sh.properties.sheetId } }] });
    console.log(`PUBLIC: deleted tab "${title}".`);
  }
}
console.log('DONE. Private PII now lives only in the restricted spreadsheet.');
