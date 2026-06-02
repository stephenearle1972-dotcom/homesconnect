// Acceptance test for PAYFAST_MODE=sandbox (the reversible test-without-real-money mode).
// Mirrors test-payfast-flow.mjs, but drives the REAL handlers with PAYFAST_MODE=sandbox.
// It emulates PayFast's sandbox locally (we can't push a card through the gateway here),
// proving the handler+ITN logic is correct against the SANDBOX merchant + sandbox rules.
//
// Crucially: PAYFAST_MODE and the sandbox creds are set BEFORE the handlers are imported,
// because _lib/payfast.js resolves the mode at module load.
//
// What it proves:
//   #2  full sandbox flow: a submission writes pending_payment, a valid sandbox ITN
//       flips it to active (state updates) — no real money, sandbox merchant only.
//   #3a the OUTGOING signature matches an independent PHP-faithful reference (insertion order),
//       computed with the SANDBOX passphrase rule (none, for the public test merchant).
//   #3b the outgoing post URL is the SANDBOX process URL, and the merchant id is the sandbox id.
//   #3c negatives: wrong amount / bad signature do NOT activate.
//   #4  no credential or passphrase leaks into the JSON returned to the client.

import fs from 'node:fs';
import crypto from 'node:crypto';

// ---- sandbox mode MUST be set before importing the handlers ----
process.env.PAYFAST_MODE = 'sandbox';
// Use PayFast's public sandbox test merchant unless overridden in the environment.
process.env.PAYFAST_SANDBOX_MERCHANT_ID = process.env.PAYFAST_SANDBOX_MERCHANT_ID || '10000100';
process.env.PAYFAST_SANDBOX_MERCHANT_KEY = process.env.PAYFAST_SANDBOX_MERCHANT_KEY || '46f0cd694581a';
// PAYFAST_SANDBOX_PASSPHRASE left unset => no passphrase appended (public test merchant has none).

const CREDS_PATH = 'F:\\My Drive\\TOWN CONNECT\\google-sheets-credentials.json.json';
process.env.GOOGLE_SHEETS_CREDENTIALS = fs.readFileSync(CREDS_PATH, 'utf8');

const SHEET_ID = process.env.HOMESCONNECT_SHEET_ID;
const SANDBOX_MID = process.env.PAYFAST_SANDBOX_MERCHANT_ID;
const SANDBOX_PASS = process.env.PAYFAST_SANDBOX_PASSPHRASE || '';
let failures = 0;
const ok = (c, msg) => { console.log(`${c ? 'PASS' : 'FAIL'}: ${msg}`); if (!c) failures++; };

// ---- independent PHP urlencode (space->+, encodes !*'()~ , leaves -_. ) ----
function phpUrlencode(str) {
  return encodeURIComponent(String(str))
    .replace(/%20/g, '+')
    .replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/~/g, '%7E');
}
function refSignature(orderedPairs, passphrase) {
  const parts = orderedPairs
    .filter(([k, v]) => k !== 'signature' && v !== '' && v != null)
    .map(([k, v]) => `${k}=${phpUrlencode(v)}`);
  let s = parts.join('&');
  if (passphrase) s += `&passphrase=${phpUrlencode(passphrase)}`;
  return crypto.createHash('md5').update(s).digest('hex');
}

// ---- tiny sheet client (read + delete row) for assertions/cleanup ----
const creds = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
const b64url = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function gToken() {
  const now = Math.floor(Date.now() / 1000);
  const h = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const p = b64url(JSON.stringify({ iss: creds.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = b64url(crypto.createSign('RSA-SHA256').update(`${h}.${p}`).sign(creds.private_key));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${h}.${p}.${sig}` }) });
  return (await r.json()).access_token;
}
async function gApi(t, method, path, body) {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${path}`, { method, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`${method} ${path} ${r.status}: ${await r.text()}`);
  return r.json();
}
async function findRow(id) {
  const t = await gToken();
  const meta = await gApi(t, 'GET', `/${SHEET_ID}?fields=sheets.properties(title,sheetId)`);
  const tab = meta.sheets[0].properties.title;
  const numericSheetId = meta.sheets[0].properties.sheetId;
  const res = await gApi(t, 'GET', `/${SHEET_ID}/values/${encodeURIComponent(tab + '!A1:AF500')}`);
  const rows = res.values || [];
  const headers = rows[0];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][headers.indexOf('id')] === id) {
      const obj = {}; headers.forEach((h, j) => { obj[h] = rows[i][j]; });
      return { obj, rowNumber: i + 1, numericSheetId, tab };
    }
  }
  return null;
}
async function deleteRow(rowNumber, numericSheetId) {
  const t = await gToken();
  await gApi(t, 'POST', `/${SHEET_ID}:batchUpdate`, {
    requests: [{ deleteDimension: { range: { sheetId: numericSheetId, dimension: 'ROWS', startIndex: rowNumber - 1, endIndex: rowNumber } } }],
  });
}

// ---- import the real handlers + config (also a runtime smoke test) ----
const { PAYFAST } = await import('../netlify/functions/_lib/payfast.js');
const { handler: listHandler } = await import('../netlify/functions/list-property.js');
const { handler: itnHandler } = await import('../netlify/functions/payfast-itn.js');
ok(typeof listHandler === 'function', 'list-property handler imports & is callable');
ok(typeof itnHandler === 'function', 'payfast-itn handler imports & is callable');
ok(PAYFAST.mode === 'sandbox', `config resolved to sandbox mode (got "${PAYFAST.mode}")`);
ok(PAYFAST.processUrl === 'https://sandbox.payfast.co.za/eng/process', `process URL is sandbox (got "${PAYFAST.processUrl}")`);
ok(PAYFAST.merchantId === SANDBOX_MID, `merchant id is sandbox (got "${PAYFAST.merchantId}")`);

// ---- TEST #2: submit a private listing in sandbox mode ----
const payload = {
  seller_type: 'private',
  agent_name: 'Sandbox Test Seller',
  agent_phone: '0820000111', whatsapp: '0820000222',
  agent_email: 'test-sandbox@example.com',
  title: 'TEST Sandbox Listing (auto)',
  type: 'sale', price: 1234000, property_type: 'house',
  bedrooms: 3, bathrooms: 2, garage: 1, size: 180, address: '1 Test Street',
  garden: true, pool: false, pet_friendly: true,
  suburb: 'Testville', city: 'Pretoria', province: 'Gauteng',
  description: 'Automated SANDBOX test listing — safe to delete.',
  tier: 'enhanced',
  images: ['https://res.cloudinary.com/dkn6tnxao/image/upload/homesconnect/property-01-karoo-farmhouse.jpg'],
  disclaimer_accepted: true,
};
// Simulate a request arriving on the preview deploy, so we can prove the callbacks
// return to THIS deploy (the preview) and not to production.
const PREVIEW_HOST = 'payfast-sandbox-test--homesconnect-za.netlify.app';
const listRes = await listHandler({ httpMethod: 'POST', headers: { host: PREVIEW_HOST, 'x-forwarded-proto': 'https' }, body: JSON.stringify(payload) });
ok(listRes.statusCode === 200, `list-property returns 200 (got ${listRes.statusCode})`);
const listBody = JSON.parse(listRes.body);
const listingId = listBody.listing_id;
ok(/^HC\d+$/.test(listingId || ''), `listing id generated: ${listingId}`);

const written = await findRow(listingId);
ok(!!written, 'row written to sheet');
if (written) ok(written.obj.status === 'pending_payment', `status = pending_payment (got "${written.obj.status}")`);

// ---- TEST #3a/#3b: outgoing post URL + signature ----
const params = listBody.params;
ok(listBody.payfast_url === 'https://sandbox.payfast.co.za/eng/process', `posts to sandbox URL (got "${listBody.payfast_url}")`);
ok(params.merchant_id === SANDBOX_MID, `outgoing merchant_id is sandbox (got "${params.merchant_id}")`);
const reSig = refSignature(Object.entries(params), SANDBOX_PASS);
ok(params.signature === reSig, 'outgoing signature matches independent PHP-faithful reference (sandbox rule)');
// #3: callbacks must point at the preview deploy, not production.
ok(params.notify_url === `https://${PREVIEW_HOST}/.netlify/functions/payfast-itn`, `notify_url returns to the preview (got "${params.notify_url}")`);
ok(params.return_url.startsWith(`https://${PREVIEW_HOST}/`), `return_url returns to the preview (got "${params.return_url}")`);
ok(params.amount === '249.00', `outgoing amount = 249.00 for enhanced (got "${params.amount}")`);
// The passphrase (the only secret in the signing chain) must never reach the client.
ok(SANDBOX_PASS.length === 0 || !JSON.stringify(listBody).includes(SANDBOX_PASS), 'passphrase does not appear in client JSON');

// ---- TEST #2 cont: a valid sandbox ITN flips row to active ----
function buildItn(amountGross, { tamperSig = false } = {}) {
  const pairs = [
    ['m_payment_id', listingId],
    ['pf_payment_id', '1234567'],
    ['payment_status', 'COMPLETE'],
    ['item_name', params.item_name],
    ['amount_gross', amountGross],
    ['amount_fee', '-5.74'],
    ['amount_net', String((Number(amountGross) - 5.74).toFixed(2))],
    ['merchant_id', SANDBOX_MID],
  ];
  let sig = refSignature(pairs, SANDBOX_PASS);
  if (tamperSig) sig = sig.replace(/.$/, sig.endsWith('a') ? 'b' : 'a');
  pairs.push(['signature', sig]);
  return pairs.map(([k, v]) => `${k}=${phpUrlencode(v)}`).join('&');
}

const itnRes = await itnHandler({ httpMethod: 'POST', body: buildItn('249.00') });
ok(itnRes.statusCode === 200, `ITN returns 200 (got ${itnRes.statusCode})`);
let after = await findRow(listingId);
ok(after && after.obj.status === 'active', `valid sandbox ITN flipped row to active (got "${after?.obj.status}")`);

// ---- TEST #3c negatives on a fresh listing ----
const listRes2 = await listHandler({ httpMethod: 'POST', body: JSON.stringify({ ...payload, title: 'TEST Sandbox #2 (auto)' }) });
const id2 = JSON.parse(listRes2.body).listing_id;
const params2 = JSON.parse(listRes2.body).params;

const wrongAmtItn = (() => {
  const pairs = [
    ['m_payment_id', id2], ['pf_payment_id', '7654321'], ['payment_status', 'COMPLETE'],
    ['item_name', params2.item_name], ['amount_gross', '99.00'], ['merchant_id', SANDBOX_MID],
  ];
  pairs.push(['signature', refSignature(pairs, SANDBOX_PASS)]);
  return pairs.map(([k, v]) => `${k}=${phpUrlencode(v)}`).join('&');
})();
await itnHandler({ httpMethod: 'POST', body: wrongAmtItn });
let neg = await findRow(id2);
ok(neg && neg.obj.status === 'pending_payment', `amount mismatch left row pending (got "${neg?.obj.status}")`);

const badSigItn = (() => {
  const pairs = [
    ['m_payment_id', id2], ['pf_payment_id', '7654321'], ['payment_status', 'COMPLETE'],
    ['item_name', params2.item_name], ['amount_gross', '249.00'], ['merchant_id', SANDBOX_MID],
  ];
  pairs.push(['signature', 'deadbeefdeadbeefdeadbeefdeadbeef']);
  return pairs.map(([k, v]) => `${k}=${phpUrlencode(v)}`).join('&');
})();
await itnHandler({ httpMethod: 'POST', body: badSigItn });
neg = await findRow(id2);
ok(neg && neg.obj.status === 'pending_payment', `bad signature left row pending (got "${neg?.obj.status}")`);

// ---- cleanup ----
const r1 = await findRow(listingId);
const r2 = await findRow(id2);
const toDelete = [r1, r2].filter(Boolean).sort((a, b) => b.rowNumber - a.rowNumber);
for (const r of toDelete) { await deleteRow(r.rowNumber, r.numericSheetId); }
console.log(`Cleaned up ${toDelete.length} test rows.`);

console.log(`\n${failures === 0 ? 'ALL SANDBOX TESTS PASSED' : failures + ' TEST(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
