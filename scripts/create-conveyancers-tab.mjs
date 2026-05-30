// One-off: create the "Conveyancers" tab in the HomesConnect workbook, write the
// header row, and print the tab's gid (for VITE_CONVEYANCERS_CSV_URL). Idempotent:
// if the tab already exists it just ensures the header row is correct.
import fs from 'node:fs';
import crypto from 'node:crypto';

const CREDS_PATH = 'F:\\My Drive\\TOWN CONNECT\\google-sheets-credentials.json.json';
const SHEET_ID = process.env.HOMESCONNECT_SHEET_ID || '1SMlKNPToUnmh0VzxJmcjti6DPsUML1K7xk4PqvOMKmU';
const TAB = 'Conveyancers';
const HEADERS = ['id','firm_name','contact_name','regions_served','physical_address','suburb','city','province','phone','whatsapp','email','website','practice_notes','logo_url','lpc_number','confirmation_accepted','status','date_listed'];

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

const t = await tok();
let meta = await api(t, 'GET', `/${SHEET_ID}?fields=sheets.properties(title,sheetId)`);
let tab = meta.sheets.find((s) => s.properties.title === TAB);
if (!tab) {
  await api(t, 'POST', `/${SHEET_ID}:batchUpdate`, { requests: [{ addSheet: { properties: { title: TAB } } }] });
  console.log(`Created tab "${TAB}".`);
  meta = await api(t, 'GET', `/${SHEET_ID}?fields=sheets.properties(title,sheetId)`);
  tab = meta.sheets.find((s) => s.properties.title === TAB);
} else {
  console.log(`Tab "${TAB}" already exists.`);
}
const gid = tab.properties.sheetId;

// Write/repair the header row.
await api(t, 'PUT', `/${SHEET_ID}/values/${encodeURIComponent(TAB + '!A1')}?valueInputOption=RAW`, { values: [HEADERS] });
console.log(`Header row written (${HEADERS.length} cols).`);

console.log(`GID=${gid}`);
console.log(`VITE_CONVEYANCERS_CSV_URL=https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`);
