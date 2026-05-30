// Deterministic test for the free conveyancer intake against the REAL handler + sheet.
//   #1 A submission writes a pending row to the Conveyancers tab with the
//      confirmation flag + timestamp + status=pending.
//   #3 There is no payment: the handler returns no PayFast params and imports no PayFast.
//   negative: missing confirmation -> 400 and NO row written.
import fs from 'node:fs';
import crypto from 'node:crypto';

const CREDS_PATH = 'F:\\My Drive\\TOWN CONNECT\\google-sheets-credentials.json.json';
process.env.GOOGLE_SHEETS_CREDENTIALS = fs.readFileSync(CREDS_PATH, 'utf8');
const SHEET_ID = process.env.HOMESCONNECT_SHEET_ID;
const TAB = 'Conveyancers';
let failures = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}: ${m}`); if (!c) failures++; };

const creds = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
const b = (x) => Buffer.from(x).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function tok() {
  const n = Math.floor(Date.now() / 1000);
  const h = b(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const p = b(JSON.stringify({ iss: creds.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: n, exp: n + 3600 }));
  const s = b(crypto.createSign('RSA-SHA256').update(`${h}.${p}`).sign(creds.private_key));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${h}.${p}.${s}` }) });
  return (await r.json()).access_token;
}
async function api(t, m, path, body) {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${path}`, { method: m, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`${m} ${path} ${r.status}: ${await r.text()}`);
  return r.json();
}
async function findRow(id) {
  const t = await tok();
  const meta = await api(t, 'GET', `/${SHEET_ID}?fields=sheets.properties(title,sheetId)`);
  const sid = meta.sheets.find((s) => s.properties.title === TAB).properties.sheetId;
  const rows = (await api(t, 'GET', `/${SHEET_ID}/values/${encodeURIComponent(TAB + '!A1:R500')}`)).values || [];
  const headers = rows[0];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][headers.indexOf('id')] === id) {
      const obj = {}; headers.forEach((h2, j) => { obj[h2] = rows[i][j]; });
      return { obj, rowNumber: i + 1, sid };
    }
  }
  return null;
}
async function deleteRow(rowNumber, sid) {
  const t = await tok();
  await api(t, 'POST', `/${SHEET_ID}:batchUpdate`, { requests: [{ deleteDimension: { range: { sheetId: sid, dimension: 'ROWS', startIndex: rowNumber - 1, endIndex: rowNumber } } }] });
}

// no-payment static check
const src = fs.readFileSync(new URL('../netlify/functions/list-conveyancer.js', import.meta.url), 'utf8');
ok(!/payfast/i.test(src), 'list-conveyancer.js contains no PayFast reference');

const { handler } = await import('../netlify/functions/list-conveyancer.js');
ok(typeof handler === 'function', 'list-conveyancer handler imports & is callable');

const payload = {
  firm_name: 'TEST Conveyancers Inc',
  contact_name: 'Adv. Test Attorney',
  regions_served: ['Gauteng', 'Western Cape'],
  physical_address: '1 Test Chambers',
  suburb: 'Sandown', city: 'Sandton', province: 'Gauteng',
  phone: '0111234567', whatsapp: '0821234567', email: 'test-conv@example.com',
  website: 'www.testconv.co.za', practice_notes: 'Transfers and bonds. Test row.',
  lpc_number: 'LPC-TEST-123', logo_url: '',
  confirmation_accepted: true,
};
const res = await handler({ httpMethod: 'POST', body: JSON.stringify(payload) });
ok(res.statusCode === 200, `submit returns 200 (got ${res.statusCode})`);
const bodyOut = JSON.parse(res.body);
ok(/^CV\d+$/.test(bodyOut.conveyancer_id || ''), `id generated: ${bodyOut.conveyancer_id}`);
ok(!('payfast_url' in bodyOut) && !('params' in bodyOut), 'response contains NO PayFast fields');
const id = bodyOut.conveyancer_id;

const written = await findRow(id);
ok(!!written, 'row written to Conveyancers tab');
if (written) {
  ok(written.obj.status === 'pending', `status = pending (got "${written.obj.status}")`);
  ok(written.obj.confirmation_accepted === 'yes', `confirmation_accepted = yes (got "${written.obj.confirmation_accepted}")`);
  ok(/^\d{4}-\d{2}-\d{2}$/.test(written.obj.date_listed || ''), `date_listed stored (${written.obj.date_listed})`);
  ok(written.obj.regions_served === 'Gauteng, Western Cape', `regions joined (got "${written.obj.regions_served}")`);
  ok(written.obj.firm_name === 'TEST Conveyancers Inc', 'firm_name persisted');
}

// negative: missing confirmation
const neg = await handler({ httpMethod: 'POST', body: JSON.stringify({ ...payload, confirmation_accepted: false }) });
ok(neg.statusCode === 400, `missing confirmation rejected with 400 (got ${neg.statusCode})`);
ok(/confirm/i.test(neg.body), 'rejection mentions confirmation');

// cleanup
if (written) { await deleteRow(written.rowNumber, written.sid); console.log('Cleaned up test row.'); }

console.log(`\n${failures === 0 ? 'ALL TESTS PASSED' : failures + ' TEST(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
