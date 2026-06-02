// Deterministic acceptance test for the private-seller PayFast flow.
// Runs against the REAL Netlify Function handlers and the REAL Google Sheet, but
// emulates PayFast locally (we can't drive a card through the live gateway here).
//
// What it proves:
//   #2  A private submission writes a pending_payment row with seller_type=private.
//   #3a The OUTGOING signature the handler generates matches an INDEPENDENT,
//       PHP-urlencode-faithful re-implementation of PayFast's algorithm (insertion
//       order, not sorted). This is the exact computation the gateway performs.
//   #3b An ITN signed with the configured passphrase (PayFast's documented method)
//       validates in payfast-itn AND the amount-vs-tier check passes -> row active.
//   #3c Negative: wrong amount_gross  -> row NOT activated.  Bad signature -> rejected.
//
// Secrets are read from process.env (injected by the runner) and never printed.
import fs from 'node:fs';
import crypto from 'node:crypto';

const CREDS_PATH = 'F:\\My Drive\\TOWN CONNECT\\google-sheets-credentials.json.json';
process.env.GOOGLE_SHEETS_CREDENTIALS = fs.readFileSync(CREDS_PATH, 'utf8');

const SHEET_ID = process.env.HOMESCONNECT_SHEET_ID;
const PASS = process.env.PAYFAST_PASSPHRASE || '';
const MID = process.env.PAYFAST_MERCHANT_ID;
let failures = 0;
const ok = (c, msg) => { console.log(`${c ? 'PASS' : 'FAIL'}: ${msg}`); if (!c) failures++; };

// ---- independent PHP urlencode (space->+, encodes !*'()~ , leaves -_. ) ----
function phpUrlencode(str) {
  return encodeURIComponent(String(str))
    .replace(/%20/g, '+')
    .replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/~/g, '%7E');
}
// Reference PayFast signature: name=value pairs in given order, non-blank, &passphrase appended.
function refSignature(orderedPairs, passphrase) {
  const parts = orderedPairs
    .filter(([k, v]) => k !== 'signature' && v !== '' && v != null)
    .map(([k, v]) => `${k}=${phpUrlencode(v)}`);
  let s = parts.join('&');
  if (passphrase) s += `&passphrase=${phpUrlencode(passphrase)}`;
  return crypto.createHash('md5').update(s).digest('hex');
}

// ---- tiny sheet client (read + delete row) just for assertions/cleanup ----
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

// ---- import the real handlers (also a runtime smoke test) ----
const { handler: listHandler } = await import('../netlify/functions/list-property.js');
const { handler: itnHandler } = await import('../netlify/functions/payfast-itn.js');
ok(typeof listHandler === 'function', 'list-property handler imports & is callable');
ok(typeof itnHandler === 'function', 'payfast-itn handler imports & is callable');

// ---- TEST #2: submit a private listing ----
const payload = {
  seller_type: 'private',
  agent_name: 'Test Private Seller',
  agent_phone: '0820000111',
  whatsapp: '0820000222',
  agent_email: 'test-fsbo@example.com',
  title: 'TEST FSBO Listing (auto)',
  type: 'sale',
  price: 1234000,
  property_type: 'house',
  bedrooms: 3, bathrooms: 2, garage: 1,
  size: 180,
  address: '1 Test Street',
  garden: true, pool: false, pet_friendly: true,
  suburb: 'Testville', city: 'Pretoria', province: 'Gauteng',
  description: 'Automated test listing — safe to delete.',
  tier: 'enhanced',
  images: ['https://res.cloudinary.com/dkn6tnxao/image/upload/homesconnect/property-01-karoo-farmhouse.jpg'],
  disclaimer_accepted: true,
  ownership_attested: true,
};
const listRes = await listHandler({ httpMethod: 'POST', body: JSON.stringify(payload) });
ok(listRes.statusCode === 200, `list-property returns 200 (got ${listRes.statusCode})`);
const listBody = JSON.parse(listRes.body);
const listingId = listBody.listing_id;
ok(/^HC\d+$/.test(listingId || ''), `listing id generated: ${listingId}`);

const written = await findRow(listingId);
ok(!!written, 'row written to sheet');
if (written) {
  ok(written.obj.status === 'pending_payment', `status = pending_payment (got "${written.obj.status}")`);
  ok(written.obj.seller_type === 'private', `seller_type = private (got "${written.obj.seller_type}")`);
  ok(written.obj.disclaimer_accepted === 'yes', `disclaimer_accepted = yes (got "${written.obj.disclaimer_accepted}")`);
  ok(!!written.obj.disclaimer_accepted_at, `disclaimer timestamp stored (${written.obj.disclaimer_accepted_at})`);
  ok(written.obj.whatsapp === '0820000222', `whatsapp stored (got "${written.obj.whatsapp}")`);
  ok(written.obj.agent_agency === '', 'agency blank for private seller');
  ok(written.obj.tier === 'enhanced', 'tier persisted');
}

// ---- TEST #3a: outgoing signature matches independent reference ----
const params = listBody.params;
const orderedOut = Object.entries(params); // insertion order == form post order
const reSig = refSignature(orderedOut, PASS);
ok(params.signature === reSig, 'outgoing PayFast signature matches independent PHP-faithful reference');
ok(params.merchant_id === MID, 'outgoing merchant_id matches configured id');
ok(params.amount === '249.00', `outgoing amount = 249.00 for enhanced (got "${params.amount}")`);
ok(!JSON.stringify(listBody).includes(PASS) && PASS.length > 0, 'passphrase does NOT appear in the JSON returned to the client');

// ---- TEST #3b: valid ITN flips row to active ----
function buildItn(amountGross, { tamperSig = false } = {}) {
  // Fields in PayFast send-order; signature computed over them (excl. signature) + passphrase.
  const pairs = [
    ['m_payment_id', listingId],
    ['pf_payment_id', '1234567'],
    ['payment_status', 'COMPLETE'],
    ['item_name', params.item_name],
    ['amount_gross', amountGross],
    ['amount_fee', '-5.74'],
    ['amount_net', String((Number(amountGross) - 5.74).toFixed(2))],
    ['merchant_id', MID],
  ];
  let sig = refSignature(pairs, PASS);
  if (tamperSig) sig = sig.replace(/.$/, sig.endsWith('a') ? 'b' : 'a');
  pairs.push(['signature', sig]);
  return pairs.map(([k, v]) => `${k}=${phpUrlencode(v)}`).join('&');
}

const goodItn = buildItn('249.00');
const itnRes = await itnHandler({ httpMethod: 'POST', body: goodItn });
ok(itnRes.statusCode === 200, `ITN returns 200 (got ${itnRes.statusCode})`);
let after = await findRow(listingId);
ok(after && after.obj.status === 'active', `valid ITN flipped row to active (got "${after?.obj.status}")`);

// ---- TEST #3c negatives (use a second fresh listing so state is clean) ----
const listRes2 = await listHandler({ httpMethod: 'POST', body: JSON.stringify({ ...payload, title: 'TEST FSBO #2 (auto)' }) });
const id2 = JSON.parse(listRes2.body).listing_id;

// wrong amount (R99 instead of R249) must NOT activate
const wrongAmtItn = (() => {
  const pairs = [
    ['m_payment_id', id2], ['pf_payment_id', '7654321'], ['payment_status', 'COMPLETE'],
    ['item_name', params.item_name], ['amount_gross', '99.00'], ['merchant_id', MID],
  ];
  pairs.push(['signature', refSignature(pairs, PASS)]);
  return pairs.map(([k, v]) => `${k}=${phpUrlencode(v)}`).join('&');
})();
await itnHandler({ httpMethod: 'POST', body: wrongAmtItn });
let neg = await findRow(id2);
ok(neg && neg.obj.status === 'pending_payment', `amount mismatch left row pending (got "${neg?.obj.status}")`);

// bad signature must NOT activate
const badSigItn = (() => {
  const pairs = [
    ['m_payment_id', id2], ['pf_payment_id', '7654321'], ['payment_status', 'COMPLETE'],
    ['item_name', params.item_name], ['amount_gross', '249.00'], ['merchant_id', MID],
  ];
  pairs.push(['signature', 'deadbeefdeadbeefdeadbeefdeadbeef']);
  return pairs.map(([k, v]) => `${k}=${phpUrlencode(v)}`).join('&');
})();
await itnHandler({ httpMethod: 'POST', body: badSigItn });
neg = await findRow(id2);
ok(neg && neg.obj.status === 'pending_payment', `bad signature left row pending (got "${neg?.obj.status}")`);

// ---- cleanup: delete both test rows (delete higher row number first) ----
const r1 = await findRow(listingId);
const r2 = await findRow(id2);
const toDelete = [r1, r2].filter(Boolean).sort((a, b) => b.rowNumber - a.rowNumber);
for (const r of toDelete) { await deleteRow(r.rowNumber, r.numericSheetId); }
console.log(`Cleaned up ${toDelete.length} test rows.`);

console.log(`\n${failures === 0 ? 'ALL TESTS PASSED' : failures + ' TEST(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
