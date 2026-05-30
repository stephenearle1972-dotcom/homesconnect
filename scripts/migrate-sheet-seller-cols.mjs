// One-off migration: prepare the HomesConnect Listings sheet for private sellers.
//   1. Clear the garbled junk in columns AA:AL of the seed rows (a bad seed split
//      Cloudinary URLs on commas, leaving duplicate/partial values in cols 27-38).
//   2. Add 6 new headers at AA1:AF1:
//        seller_type | disclaimer_accepted | disclaimer_accepted_at | whatsapp | size_sqm | address
//   3. Backfill seller_type = "agent" for all existing listing rows.
//
// Header-based CSV parsing on the frontend reads by column name, and the backend
// append is positional — both rely on these 6 columns sitting immediately after
// date_listed (col Z) at AA..AF. Run once: `node scripts/migrate-sheet-seller-cols.mjs`
import fs from 'node:fs';
import crypto from 'node:crypto';

const CREDS_PATH = 'F:\\My Drive\\TOWN CONNECT\\google-sheets-credentials.json.json';
const SHEET_ID = process.env.HOMESCONNECT_SHEET_ID || '1SMlKNPToUnmh0VzxJmcjti6DPsUML1K7xk4PqvOMKmU';
const NEW_HEADERS = ['seller_type', 'disclaimer_accepted', 'disclaimer_accepted_at', 'whatsapp', 'size_sqm', 'address'];

const creds = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
const b64url = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function token() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const pay = b64url(JSON.stringify({
    iss: creds.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const input = `${head}.${pay}`;
  const sig = b64url(crypto.createSign('RSA-SHA256').update(input).sign(creds.private_key));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${input}.${sig}` }),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).access_token;
}
async function api(t, method, path, body) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${path}`, {
    method, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

const t = await token();
const meta = await api(t, 'GET', `/${SHEET_ID}?fields=sheets.properties(title,sheetId,gridProperties)`);
const tab = meta.sheets[0].properties.title;
const enc = (r) => encodeURIComponent(`${tab}!${r}`);

// Current values to know how many data rows exist.
const cur = (await api(t, 'GET', `/${SHEET_ID}/values/${enc('A1:AL200')}`)).values || [];
const lastRow = cur.length; // 1-based count incl header
const dataRows = lastRow - 1;
console.log(`Tab "${tab}" has ${dataRows} data rows (rows 2..${lastRow}).`);

// 1. Clear the AA:AL junk on data rows (cols 27..38).
if (dataRows > 0) {
  await api(t, 'POST', `/${SHEET_ID}/values/${enc(`AA2:AL${lastRow}`)}:clear`, {});
  console.log(`Cleared junk in AA2:AL${lastRow}.`);
}

// 2. Write the 6 new headers at AA1:AF1.
await api(t, 'PUT', `/${SHEET_ID}/values/${enc('AA1:AF1')}?valueInputOption=RAW`, { values: [NEW_HEADERS] });
console.log(`Wrote headers AA1:AF1 = ${NEW_HEADERS.join(', ')}.`);

// 3. Backfill seller_type = "agent" for existing rows (AA2:AA{last}).
if (dataRows > 0) {
  const col = Array.from({ length: dataRows }, () => ['agent']);
  await api(t, 'PUT', `/${SHEET_ID}/values/${enc(`AA2:AA${lastRow}`)}?valueInputOption=RAW`, { values: col });
  console.log(`Backfilled seller_type=agent for ${dataRows} rows.`);
}

// Verify.
const after = (await api(t, 'GET', `/${SHEET_ID}/values/${enc('Z1:AF3')}`)).values || [];
console.log('Verify (Z1:AF3):', JSON.stringify(after, null, 2));
console.log('DONE.');
