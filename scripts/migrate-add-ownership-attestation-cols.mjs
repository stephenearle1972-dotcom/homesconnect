// One-off migration: add the private-seller ownership-attestation headers to the
// HomesConnect Listings sheet, AFTER the existing Make-an-Offer columns.
//
// Real column layout (header-based reads + positional append must both stay aligned):
//   ... AF=address, AG=make_an_offer_enabled, AH=make_an_offer_enabled_at,
//   AI=ownership_attested, AJ=ownership_attested_at
//
// NOTE: an earlier run of this script mistakenly assumed the sheet ended at AF and
// overwrote the AG/AH *header labels* (the column DATA was untouched). This script is
// self-correcting and idempotent: it restores AG/AH if needed and writes AI/AJ.
// Run: `node scripts/migrate-add-ownership-attestation-cols.mjs`
import fs from 'node:fs';
import crypto from 'node:crypto';

const CREDS_PATH = 'F:\\My Drive\\TOWN CONNECT\\google-sheets-credentials.json.json';
const SHEET_ID = process.env.HOMESCONNECT_SHEET_ID || '1SMlKNPToUnmh0VzxJmcjti6DPsUML1K7xk4PqvOMKmU';
const AG_AH = ['make_an_offer_enabled', 'make_an_offer_enabled_at'];
const AI_AJ = ['ownership_attested', 'ownership_attested_at'];

const creds = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
const b64url = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function token() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const pay = b64url(JSON.stringify({ iss: creds.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const input = `${head}.${pay}`;
  const sig = b64url(crypto.createSign('RSA-SHA256').update(input).sign(creds.private_key));
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${input}.${sig}` }) });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).access_token;
}
async function api(t, method, path, body) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${path}`, { method, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

const t = await token();
const meta = await api(t, 'GET', `/${SHEET_ID}?fields=sheets.properties(title,sheetId)`);
const tab = meta.sheets[0].properties.title;
const enc = (r) => encodeURIComponent(`${tab}!${r}`);

const rows = (await api(t, 'GET', `/${SHEET_ID}/values/${enc('A1:AZ6')}`)).values || [];
const header = rows[0] || [];
console.log(`Header has ${header.length} cols. AF/AG/AH/AI/AJ = `, [header[31], header[32], header[33], header[34], header[35]]);
console.log('AG/AH sample data (cols 32/33) — should be the make_an_offer booleans/timestamps:');
for (let r = 1; r < rows.length; r++) console.log(`  id=${rows[r][0]}  AG=${JSON.stringify(rows[r][32] ?? '')}  AH=${JSON.stringify(rows[r][33] ?? '')}`);

// 1. Restore AG/AH header labels (idempotent — only writes if they drifted).
if (header[32] !== AG_AH[0] || header[33] !== AG_AH[1]) {
  await api(t, 'PUT', `/${SHEET_ID}/values/${enc('AG1:AH1')}?valueInputOption=RAW`, { values: [AG_AH] });
  console.log(`Restored AG1:AH1 = ${AG_AH.join(', ')}.`);
} else {
  console.log('AG1:AH1 already correct.');
}

// 2. Write AI/AJ ownership-attestation headers.
if (header[34] !== AI_AJ[0] || header[35] !== AI_AJ[1]) {
  await api(t, 'PUT', `/${SHEET_ID}/values/${enc('AI1:AJ1')}?valueInputOption=RAW`, { values: [AI_AJ] });
  console.log(`Wrote AI1:AJ1 = ${AI_AJ.join(', ')}.`);
} else {
  console.log('AI1:AJ1 already correct.');
}

const after = ((await api(t, 'GET', `/${SHEET_ID}/values/${enc('A1:AZ1')}`)).values || [[]])[0];
console.log(`Verify — header now ${after.length} cols, tail:`, after.slice(31));
console.log('DONE.');
