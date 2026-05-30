// Gate tests: with MAO_PUBLIC_ENABLED=false, the public cannot enable Make an Offer
// on a REAL listing (function + ITN), but a DEMO listing (HCDEMO*) still can. Real
// handlers + real public sheet. Self-cleaning. Does NOT touch HCDEMO01.
process.env.MAO_PUBLIC_ENABLED = 'false';
import fs from 'node:fs';
import crypto from 'node:crypto';
process.env.GOOGLE_SHEETS_CREDENTIALS = fs.readFileSync('F:\\My Drive\\TOWN CONNECT\\google-sheets-credentials.json.json', 'utf8');
const PUB = process.env.HOMESCONNECT_SHEET_ID;
const PASS = process.env.PAYFAST_PASSPHRASE || ''; const MID = process.env.PAYFAST_MERCHANT_ID;
const LT = 'HomesConnect Listings';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}: ${m}`); if (!c) fails++; };
const creds = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
const b = (x) => Buffer.from(x).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function gtok() { const n = Math.floor(Date.now() / 1000); const h = b(JSON.stringify({ alg: 'RS256', typ: 'JWT' })); const p = b(JSON.stringify({ iss: creds.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: n, exp: n + 3600 })); const s = b(crypto.createSign('RSA-SHA256').update(`${h}.${p}`).sign(creds.private_key)); const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${h}.${p}.${s}` }) }); return (await r.json()).access_token; }
async function sapi(t, m, path, body) { const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${path}`, { method: m, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); if (!r.ok) throw new Error(`${m} ${path} ${r.status}: ${await r.text()}`); return r.json(); }
async function append(tab, row) { const t = await gtok(); await sapi(t, 'POST', `/${PUB}/values/${encodeURIComponent(tab + '!A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { values: [row] }); }
async function findObj(tab, id) { const t = await gtok(); const v = (await sapi(t, 'GET', `/${PUB}/values/${encodeURIComponent(tab + '!A1:AZ2000')}`)).values || []; const h = v[0]; for (let i = 1; i < v.length; i++) if (v[i][0] === id) { const o = {}; h.forEach((k, j) => o[k] = v[i][j]); return o; } return null; }
async function delById(tab, id) { const t = await gtok(); const meta = await sapi(t, 'GET', `/${PUB}?fields=sheets.properties(title,sheetId)`); const sid = meta.sheets.find(s => s.properties.title === tab).properties.sheetId; const v = (await sapi(t, 'GET', `/${PUB}/values/${encodeURIComponent(tab + '!A1:A2000')}`)).values || []; for (let i = v.length - 1; i >= 1; i--) if (v[i][0] === id) await sapi(t, 'POST', `/${PUB}:batchUpdate`, { requests: [{ deleteDimension: { range: { sheetId: sid, dimension: 'ROWS', startIndex: i, endIndex: i + 1 } } }] }); }
const call = async (fn, body) => { const m = await import(`../netlify/functions/${fn}.js?gatetest`); const r = await m.handler({ httpMethod: 'POST', body: JSON.stringify(body) }); return { status: r.statusCode, data: JSON.parse(r.body || '{}') }; };
function phpEnc(s) { return encodeURIComponent(String(s)).replace(/%20/g, '+').replace(/[!*'()]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase()).replace(/~/g, '%7E'); }
function refSig(pairs, pass) { const parts = pairs.filter(([k, v]) => k !== 'signature' && v !== '' && v != null).map(([k, v]) => `${k}=${phpEnc(v)}`); let s = parts.join('&'); if (pass) s += `&passphrase=${phpEnc(pass)}`; return crypto.createHash('md5').update(s).digest('hex'); }
async function itnEnable(listingId) {
  const pairs = [['m_payment_id', listingId], ['pf_payment_id', 'gate1'], ['payment_status', 'COMPLETE'], ['item_name', 'addon'], ['amount_gross', '299.00'], ['merchant_id', MID], ['custom_str1', 'mao_enable']];
  pairs.push(['signature', refSig(pairs, PASS)]);
  const m = await import('../netlify/functions/payfast-itn.js?gatetest');
  return m.handler({ httpMethod: 'POST', body: pairs.map(([k, v]) => `${k}=${phpEnc(v)}`).join('&') });
}

// Unit: gate helpers
const mao = await import('../netlify/functions/_lib/mao.js?gatetest');
ok(mao.MAO_PUBLIC_ENABLED === false, 'MAO_PUBLIC_ENABLED reads false from env');
ok(mao.isDemoListing('HCDEMO01') && !mao.isDemoListing('HC001'), 'isDemoListing: HCDEMO* yes, real no');
ok(mao.maoAllowed('HCDEMO77') === true && mao.maoAllowed('HC001') === false, 'maoAllowed: demo true, real false');

// Fixtures: a REAL private listing (not enabled) + a DEMO-prefixed one (not enabled)
const REAL = 'HCGATEREAL', DEMO = 'HCDEMOGATE';
const baseRow = (id) => [id, 'sale', 'active', 'enhanced', 'Gate test', '2000000', 'R 2,000,000', '3', '2', '1', 'no', 'no', 'no', 'house', 'X', 'Y', 'Gauteng', 'gate', 'https://res.cloudinary.com/dkn6tnxao/image/upload/x.jpg', '', '', 'S', '0820000000', '', 'no', '2026-05-30', 'private', 'yes', '2026-05-30T00:00:00Z', '0820000000', '100', 'r', 'false', ''];
await delById(LT, REAL); await delById(LT, DEMO);
await append(LT, baseRow(REAL)); await append(LT, baseRow(DEMO));

const decls = { confirm_authority: true, ack_nonbinding: true, ack_nominate_later: true, decl_owner_or_authorised: true, decl_mandate_disclosed: true, decl_disclosure_complete: true, consent_immediate_activation: true, seller_email: 'gate@example.com', seller_name: 'S' };

// #1 enable endpoint refuses a REAL listing
{
  const r = await call('mao-enable', { listing_id: REAL, ...decls });
  ok(r.status === 403, `mao-enable refuses REAL listing while gated (got ${r.status})`);
  // demo-prefixed listing is allowed through the gate (returns signed params)
  const d = await call('mao-enable', { listing_id: DEMO, ...decls });
  ok(d.status === 200 && d.data.params?.custom_str1 === 'mao_enable', `mao-enable allows DEMO listing while gated (got ${d.status})`);
}

// #2 ITN will NOT enable a REAL listing, but WILL enable a DEMO listing
{
  const r = await itnEnable(REAL);
  ok(r.statusCode === 200, 'ITN returns 200 for real (no error to PayFast)');
  const realRow = await findObj(LT, REAL);
  ok(realRow.make_an_offer_enabled !== 'true', `REAL listing NOT enabled by gated ITN (got "${realRow.make_an_offer_enabled}")`);
  await itnEnable(DEMO);
  const demoRow = await findObj(LT, DEMO);
  ok(demoRow.make_an_offer_enabled === 'true', `DEMO listing IS enabled by ITN even while gated (got "${demoRow.make_an_offer_enabled}")`);
}

// cleanup
await delById(LT, REAL); await delById(LT, DEMO);
const t = await gtok(); // also remove any MaoListings the DEMO enable created
const meta = await sapi(t, 'GET', `/${process.env.HOMESCONNECT_PRIVATE_SHEET_ID || PUB}?fields=sheets.properties(title,sheetId)`);
const ms = meta.sheets.find(s => s.properties.title === 'MaoListings');
if (ms) { const PS = process.env.HOMESCONNECT_PRIVATE_SHEET_ID || PUB; const v = (await sapi(t, 'GET', `/${PS}/values/${encodeURIComponent('MaoListings!A1:A2000')}`)).values || []; for (let i = v.length - 1; i >= 1; i--) if (v[i][0] === DEMO) await sapi(t, 'POST', `/${PS}:batchUpdate`, { requests: [{ deleteDimension: { range: { sheetId: ms.properties.sheetId, dimension: 'ROWS', startIndex: i, endIndex: i + 1 } } }] }); }

console.log(`\n${fails === 0 ? 'ALL TESTS PASSED' : fails + ' TEST(S) FAILED'}`);
process.exit(fails ? 1 : 0);
