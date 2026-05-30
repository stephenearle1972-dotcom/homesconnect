// IMMEDIATE POPIA mitigation: until a separate PRIVATE spreadsheet exists, the
// Offers/OtpChallenges/MaoListings tabs sit in the link-shared workbook and are
// downloadable via /export. This clears all their data rows and disables the demo
// listing's add-on so no buyer PII can be written to the exposed location.
import fs from 'node:fs';
import crypto from 'node:crypto';
const CREDS_PATH = 'F:\\My Drive\\TOWN CONNECT\\google-sheets-credentials.json.json';
const SHEET_ID = process.env.HOMESCONNECT_SHEET_ID || '1SMlKNPToUnmh0VzxJmcjti6DPsUML1K7xk4PqvOMKmU';
const LISTINGS_TAB = 'HomesConnect Listings';
const creds = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
const b = (x) => Buffer.from(x).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function tok() { const n = Math.floor(Date.now() / 1000); const h = b(JSON.stringify({ alg: 'RS256', typ: 'JWT' })); const p = b(JSON.stringify({ iss: creds.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: n, exp: n + 3600 })); const s = b(crypto.createSign('RSA-SHA256').update(`${h}.${p}`).sign(creds.private_key)); const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${h}.${p}.${s}` }) }); return (await r.json()).access_token; }
async function api(t, m, path, body) { const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${path}`, { method: m, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); if (!r.ok) throw new Error(`${m} ${path} ${r.status}: ${await r.text()}`); return r.json(); }
function colLetter(i) { let s = '', n = i; do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0); return s; }

const t = await tok();
// 1. Clear all data rows from the private tabs (keep header row).
for (const tab of ['Offers', 'OtpChallenges', 'MaoListings']) {
  await api(t, 'POST', `/${SHEET_ID}/values/${encodeURIComponent(tab + '!A2:BZ5000')}:clear`, {});
  console.log(`Cleared data rows in "${tab}".`);
}
// 2. Disable the demo listing's add-on.
const hdr = (await api(t, 'GET', `/${SHEET_ID}/values/${encodeURIComponent(LISTINGS_TAB + '!1:1')}`)).values[0];
const enCol = hdr.indexOf('make_an_offer_enabled');
const vals = (await api(t, 'GET', `/${SHEET_ID}/values/${encodeURIComponent(LISTINGS_TAB + '!A1:A2000')}`)).values || [];
for (let i = 1; i < vals.length; i++) {
  if (vals[i][0] === 'HCDEMO01') {
    await api(t, 'PUT', `/${SHEET_ID}/values/${encodeURIComponent(`${LISTINGS_TAB}!${colLetter(enCol)}${i + 1}`)}?valueInputOption=RAW`, { values: [['false']] });
    console.log('Disabled make_an_offer on HCDEMO01.');
  }
}
console.log('SECURED. Re-enable + re-seed after HOMESCONNECT_PRIVATE_SHEET_ID is wired.');
