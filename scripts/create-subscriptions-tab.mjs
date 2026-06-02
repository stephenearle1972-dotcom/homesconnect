// One-off: create the private "Subscriptions" tab used by recurring billing.
// Stores the PayFast subscription token (to cancel) + the seller's manage_token. These
// are SECRETS, so the tab lives in the PRIVATE sheet and must NEVER be published as CSV.
// Idempotent — safe to re-run.
import fs from 'node:fs';
import crypto from 'node:crypto';

const CREDS_PATH = 'F:\\My Drive\\TOWN CONNECT\\google-sheets-credentials.json.json';
// Prefer the restricted private sheet; fall back to the main sheet only if unset.
const SHEET_ID = process.env.HOMESCONNECT_PRIVATE_SHEET_ID || process.env.HOMESCONNECT_SHEET_ID;
const SUBS_TAB = 'Subscriptions';
const SUBS_COLS = ['listing_id','token','manage_token','seller_email','seller_name','tier','amount','status','created_at','updated_at','last_billed_at','cancelled_at','last_event'];

if (!SHEET_ID) { console.error('Set HOMESCONNECT_PRIVATE_SHEET_ID (or HOMESCONNECT_SHEET_ID).'); process.exit(1); }

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
let tab = meta.sheets.find((s) => s.properties.title === SUBS_TAB);
if (!tab) {
  await api(t, 'POST', `/${SHEET_ID}:batchUpdate`, { requests: [{ addSheet: { properties: { title: SUBS_TAB } } }] });
  meta = await api(t, 'GET', `/${SHEET_ID}?fields=sheets.properties(title,sheetId)`);
  tab = meta.sheets.find((s) => s.properties.title === SUBS_TAB);
  console.log(`Created tab "${SUBS_TAB}".`);
} else {
  console.log(`Tab "${SUBS_TAB}" already exists.`);
}
await api(t, 'PUT', `/${SHEET_ID}/values/${encodeURIComponent(SUBS_TAB + '!A1')}?valueInputOption=RAW`, { values: [SUBS_COLS] });
console.log(`Header written (${SUBS_COLS.length} cols), gid=${tab.properties.sheetId}`);
console.log('DONE. NOTE: do NOT publish the Subscriptions tab as CSV (it holds cancel tokens).');
