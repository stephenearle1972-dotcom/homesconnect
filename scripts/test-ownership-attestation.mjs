// Acceptance test for the private-seller OWNERSHIP ATTESTATION at listing creation.
// Drives the REAL list-property handler + REAL sheet (reads back + self-cleans).
//
// Proves:
//   1. Private submit WITHOUT the attestation flag is rejected server-side (forged submit).
//   2. Private submit with attestation=false is rejected server-side.
//   3. Private submit with attestation=true → 200, stores ownership_attested=yes + timestamp.
//   4. Agent submit (no attestation field) is unaffected → 200, ownership_attested=no, no timestamp.
import fs from 'node:fs';
import crypto from 'node:crypto';

process.env.GOOGLE_SHEETS_CREDENTIALS = fs.readFileSync('F:\\My Drive\\TOWN CONNECT\\google-sheets-credentials.json.json', 'utf8');
const SHEET_ID = process.env.HOMESCONNECT_SHEET_ID;
let failures = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}: ${m}`); if (!c) failures++; };

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
  const tab = meta.sheets[0].properties.title, numericSheetId = meta.sheets[0].properties.sheetId;
  const rows = (await gApi(t, 'GET', `/${SHEET_ID}/values/${encodeURIComponent(tab + '!A1:AZ1000')}`)).values || [];
  const headers = rows[0];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][headers.indexOf('id')] === id) {
      const obj = {}; headers.forEach((h, j) => { obj[h] = rows[i][j]; });
      return { obj, rowNumber: i + 1, numericSheetId };
    }
  }
  return null;
}
async function deleteRow(rowNumber, numericSheetId) {
  const t = await gToken();
  await gApi(t, 'POST', `/${SHEET_ID}:batchUpdate`, { requests: [{ deleteDimension: { range: { sheetId: numericSheetId, dimension: 'ROWS', startIndex: rowNumber - 1, endIndex: rowNumber } } }] });
}

const { handler } = await import('../netlify/functions/list-property.js');
ok(typeof handler === 'function', 'list-property handler imports & is callable');

const basePrivate = {
  seller_type: 'private', agent_name: 'Attest Test Seller', agent_phone: '0820000111',
  agent_email: 'attest@example.com', title: 'TEST attestation (auto)', type: 'sale', price: 1000000,
  property_type: 'house', bedrooms: 2, bathrooms: 1, garage: 1, suburb: 'Testville', city: 'Pretoria',
  province: 'Gauteng', description: 'Attestation test — safe to delete.', tier: 'basic',
  images: ['https://res.cloudinary.com/dkn6tnxao/image/upload/homesconnect/property-01-karoo-farmhouse.jpg'],
  disclaimer_accepted: true,
};
const post = (b) => handler({ httpMethod: 'POST', body: JSON.stringify(b) });
const created = [];

// 1. Forged submit: private, disclaimer ok, attestation MISSING → rejected server-side.
let res = await post({ ...basePrivate });
ok(res.statusCode === 400, `missing attestation rejected (got ${res.statusCode})`);
ok(JSON.parse(res.body).errors?.ownership_attested, 'error names ownership_attested');
if (res.statusCode === 200) created.push(JSON.parse(res.body).listing_id);

// 2. attestation explicitly false → rejected.
res = await post({ ...basePrivate, ownership_attested: false });
ok(res.statusCode === 400, `attestation=false rejected (got ${res.statusCode})`);
if (res.statusCode === 200) created.push(JSON.parse(res.body).listing_id);

// 3. attestation true → accepted, stored yes + timestamp.
res = await post({ ...basePrivate, ownership_attested: true, title: 'TEST attestation OK (auto)' });
ok(res.statusCode === 200, `attestation=true accepted (got ${res.statusCode})`);
const okId = JSON.parse(res.body).listing_id; if (okId) created.push(okId);
const okRow = await findRow(okId);
ok(okRow?.obj.ownership_attested === 'yes', `stored ownership_attested=yes (got "${okRow?.obj.ownership_attested}")`);
ok(!!okRow?.obj.ownership_attested_at && !Number.isNaN(Date.parse(okRow.obj.ownership_attested_at)), `stored a valid ownership_attested_at (got "${okRow?.obj.ownership_attested_at}")`);
// the make_an_offer columns must stay blank (alignment sanity — not shifted).
ok(okRow?.obj.make_an_offer_enabled === '' || okRow?.obj.make_an_offer_enabled === undefined, `make_an_offer_enabled stays blank on new listing (got "${okRow?.obj.make_an_offer_enabled}")`);

// 4. Agent flow unchanged: no attestation field required; ownership_attested stored as "no".
res = await post({
  seller_type: 'agent', agent_name: 'Agent Test', agent_phone: '0820000999', agent_email: 'agent@example.com',
  fidelity_fund: 'FFC12345', title: 'TEST agent (auto)', type: 'sale', price: 2000000, property_type: 'house',
  bedrooms: 3, bathrooms: 2, garage: 2, suburb: 'Testville', city: 'Pretoria', province: 'Gauteng',
  description: 'Agent test — safe to delete.', tier: 'basic',
  images: ['https://res.cloudinary.com/dkn6tnxao/image/upload/homesconnect/property-01-karoo-farmhouse.jpg'],
});
ok(res.statusCode === 200, `agent submit unaffected (got ${res.statusCode})`);
const agentId = JSON.parse(res.body).listing_id; if (agentId) created.push(agentId);
const agentRow = await findRow(agentId);
ok(agentRow?.obj.seller_type === 'agent', 'agent row stored as agent');
ok(agentRow?.obj.ownership_attested === 'no', `agent ownership_attested=no (got "${agentRow?.obj.ownership_attested}")`);
ok(agentRow?.obj.ownership_attested_at === '' || agentRow?.obj.ownership_attested_at === undefined, 'agent has no attestation timestamp');

// cleanup
const found = (await Promise.all(created.map((id) => findRow(id)))).filter(Boolean).sort((a, b) => b.rowNumber - a.rowNumber);
for (const r of found) await deleteRow(r.rowNumber, r.numericSheetId);
console.log(`Cleaned up ${found.length} test rows.`);
console.log(`\n${failures === 0 ? 'ALL ATTESTATION TESTS PASSED' : failures + ' TEST(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
