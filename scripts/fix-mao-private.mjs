// Correction: token + disclosure (seller email, condition) must NOT live on the
// PUBLIC listings sheet (it's published as CSV). Delete those two listings columns
// and move that data into a PRIVATE "MaoListings" tab. Keep make_an_offer_enabled
// + make_an_offer_enabled_at on the listings sheet (boolean/timestamp = safe public).
import fs from 'node:fs';
import crypto from 'node:crypto';
const CREDS_PATH = 'F:\\My Drive\\TOWN CONNECT\\google-sheets-credentials.json.json';
const SHEET_ID = process.env.HOMESCONNECT_SHEET_ID || '1SMlKNPToUnmh0VzxJmcjti6DPsUML1K7xk4PqvOMKmU';
const LISTINGS_TAB = 'HomesConnect Listings';
const DROP = ['make_an_offer_disclosure', 'make_an_offer_token'];
const MAO_LISTINGS_HEADERS = ['listing_id','seller_name','seller_email','token','disclosure_json','created_at','updated_at'];

const creds = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
const b = (x) => Buffer.from(x).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function tok() { const n = Math.floor(Date.now() / 1000); const h = b(JSON.stringify({ alg: 'RS256', typ: 'JWT' })); const p = b(JSON.stringify({ iss: creds.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: n, exp: n + 3600 })); const s = b(crypto.createSign('RSA-SHA256').update(`${h}.${p}`).sign(creds.private_key)); const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${h}.${p}.${s}` }) }); return (await r.json()).access_token; }
async function api(t, m, path, body) { const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${path}`, { method: m, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); if (!r.ok) throw new Error(`${m} ${path} ${r.status}: ${await r.text()}`); return r.json(); }

const t = await tok();
const meta = await api(t, 'GET', `/${SHEET_ID}?fields=sheets.properties(title,sheetId)`);
const listingsSheet = meta.sheets.find((s) => s.properties.title === LISTINGS_TAB);
const hdr = (await api(t, 'GET', `/${SHEET_ID}/values/${encodeURIComponent(LISTINGS_TAB + '!1:1')}`)).values?.[0] || [];

// Delete the two columns (highest index first so indices stay valid).
const idxs = DROP.map((c) => hdr.indexOf(c)).filter((i) => i !== -1).sort((a, b2) => b2 - a);
if (idxs.length) {
  const requests = idxs.map((i) => ({ deleteDimension: { range: { sheetId: listingsSheet.properties.sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 } } }));
  await api(t, 'POST', `/${SHEET_ID}:batchUpdate`, { requests });
  console.log(`Deleted listings columns: ${DROP.join(', ')}.`);
} else {
  console.log('Listings columns already removed.');
}

// Create private MaoListings tab.
let mao = meta.sheets.find((s) => s.properties.title === 'MaoListings');
if (!mao) {
  await api(t, 'POST', `/${SHEET_ID}:batchUpdate`, { requests: [{ addSheet: { properties: { title: 'MaoListings' } } }] });
  console.log('Created private tab "MaoListings".');
}
await api(t, 'PUT', `/${SHEET_ID}/values/${encodeURIComponent('MaoListings!A1')}?valueInputOption=RAW`, { values: [MAO_LISTINGS_HEADERS] });

// Verify listings header now ends with the two safe columns only.
const after = (await api(t, 'GET', `/${SHEET_ID}/values/${encodeURIComponent(LISTINGS_TAB + '!1:1')}`)).values?.[0] || [];
console.log('Listings last 4 headers:', after.slice(-4).join(', '));
console.log('DONE. MaoListings + OtpChallenges + Offers are PRIVATE (never published as CSV).');
