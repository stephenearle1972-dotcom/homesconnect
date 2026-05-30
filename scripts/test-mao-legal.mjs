// Acceptance tests for the Make-an-Offer legal adjustments. Real handlers + real
// (private) sheet. Emails use example.com to avoid noise. Self-cleaning.
import fs from 'node:fs';
import crypto from 'node:crypto';

process.env.GOOGLE_SHEETS_CREDENTIALS = fs.readFileSync('F:\\My Drive\\TOWN CONNECT\\google-sheets-credentials.json.json', 'utf8');
const PUB = process.env.HOMESCONNECT_SHEET_ID;
const PRIV = process.env.HOMESCONNECT_PRIVATE_SHEET_ID || PUB;
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}: ${m}`); if (!c) fails++; };
const creds = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
const b = (x) => Buffer.from(x).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function gtok() { const n = Math.floor(Date.now() / 1000); const h = b(JSON.stringify({ alg: 'RS256', typ: 'JWT' })); const p = b(JSON.stringify({ iss: creds.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: n, exp: n + 3600 })); const s = b(crypto.createSign('RSA-SHA256').update(`${h}.${p}`).sign(creds.private_key)); const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${h}.${p}.${s}` }) }); return (await r.json()).access_token; }
async function sapi(t, m, path, body) { const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${path}`, { method: m, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); if (!r.ok) throw new Error(`${m} ${path} ${r.status}: ${await r.text()}`); return r.json(); }
async function append(sheet, tab, row) { const t = await gtok(); await sapi(t, 'POST', `/${sheet}/values/${encodeURIComponent(tab + '!A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { values: [row] }); }
async function findObj(sheet, tab, idCol, idVal) { const t = await gtok(); const v = (await sapi(t, 'GET', `/${sheet}/values/${encodeURIComponent(tab + '!A1:BZ2000')}`)).values || []; const h = v[0]; for (let i = 1; i < v.length; i++) { if (v[i][h.indexOf(idCol)] === idVal) { const o = { _row: i + 1 }; h.forEach((k, j) => o[k] = v[i][j]); return o; } } return null; }
async function delByPrefix(sheet, tab, prefix) { const t = await gtok(); const meta = await sapi(t, 'GET', `/${sheet}?fields=sheets.properties(title,sheetId)`); const sid = meta.sheets.find(s => s.properties.title === tab).properties.sheetId; const v = (await sapi(t, 'GET', `/${sheet}/values/${encodeURIComponent(tab + '!A1:A2000')}`)).values || []; for (let i = v.length - 1; i >= 1; i--) if ((v[i][0] || '').startsWith(prefix)) await sapi(t, 'POST', `/${sheet}:batchUpdate`, { requests: [{ deleteDimension: { range: { sheetId: sid, dimension: 'ROWS', startIndex: i, endIndex: i + 1 } } }] }); }
const call = async (fn, body, method = 'POST') => { const m = await import(`../netlify/functions/${fn}.js?legal2`); const ev = method === 'GET' ? { httpMethod: 'GET', queryStringParameters: body } : { httpMethod: 'POST', body: JSON.stringify(body) }; const r = await m.handler(ev); return { status: r.statusCode, data: JSON.parse(r.body || '{}') }; };

const LID = 'HCLEGALTEST';
const LT = 'HomesConnect Listings';
const listingRow = [LID, 'sale', 'active', 'enhanced', 'Legal Test Villa', '3500000', 'R 3,500,000', '4', '3', '2', 'yes', 'yes', 'yes', 'house', 'Brooklyn', 'Pretoria', 'Gauteng', 'Legal test.', 'https://res.cloudinary.com/dkn6tnxao/image/upload/x.jpg', '', '', 'Seller X', '0825550000', '', 'no', '2026-05-30', 'private', 'yes', '2026-05-30T00:00:00Z', '0825550000', '300', '1 Rd', 'true', '2026-05-30T00:00:00Z'];

console.log('Setup…');
await delByPrefix(PUB, LT, LID); await delByPrefix(PRIV, 'MaoListings', LID); await delByPrefix(PRIV, 'Offers', 'OFLEGAL'); await delByPrefix(PRIV, 'OtpChallenges', 'OTPLEGAL');
await append(PUB, LT, listingRow);
await append(PRIV, 'MaoListings', [LID, 'Seller X', 'seller-x@example.com', 'tok_legal_1', JSON.stringify({ sellerName: 'Seller X', sellerEmail: 'seller-x@example.com', condition: { occupancy: 'owner-occupied', known_defects: 'none', additions_approved: 'yes', notes: '' }, acks: { authority: true, nonbinding: true, nominate_later: true }, declarations: { owner_or_authorised: true, mandate_disclosed: true, disclosure_complete: true, immediate_activation: true, at: '2026-05-30T00:00:00Z' }, at: '2026-05-30T00:00:00Z' }), '2026-05-30T00:00:00Z', '2026-05-30T00:00:00Z']);
await append(PRIV, 'OtpChallenges', ['OTPLEGAL1', '27825551234', 'buyer-x@example.com', crypto.createHash('sha256').update('424242').digest('hex'), new Date(Date.now() + 6e5).toISOString(), '0', 'yes', 'vtok_legal_1', new Date().toISOString()]);

// #1 disclosure endpoint: condition only, NO email/token
{
  const r = await call('mao-disclosure', { listing: LID }, 'GET');
  ok(r.status === 200 && r.data.disclosure?.occupancy === 'owner-occupied', 'mao-disclosure returns condition fields');
  ok(!JSON.stringify(r.data).includes('seller-x@example.com') && !JSON.stringify(r.data).includes('tok_legal_1'), 'mao-disclosure leaks NO seller email/token');
}

// #1 submit blocked without disclosure-received ack
const sBase = { listing_id: LID, challengeId: 'OTPLEGAL1', verifyToken: 'vtok_legal_1', buyer_name: 'Buyer X', buyer_entity_type: 'individual', proposed_price: 3400000, funding_method: 'bond', bond_amount: 3400000, subject_to_sale: 'no', proposal_expiry: '2026-06-30', ack_nonbinding: true, consent_share_seller: true, ack_conveyancer_later: true, ack_privacy: true };
{
  const no = await call('mao-submit', { ...sBase, ack_disclosure_received: false });
  ok(no.status === 400 && JSON.stringify(no.data).includes('disclosure'), 'submit blocked until disclosure-received ack (#1)');
  const yes = await call('mao-submit', { ...sBase, ack_disclosure_received: true });
  ok(yes.status === 200, 'submit succeeds with disclosure-received ack');
  const o = await findObj(PRIV, 'Offers', 'id', yes.data.offer_id);
  ok(o && (o.seller_action_log || '').includes('disclosure_received'), 'audit log records disclosure_received consent');
  globalThis.OFFER_ID = yes.data.offer_id;
}

// #3 enable declarations required
{
  const missing = await call('mao-enable', { listing_id: LID, seller_email: 'seller-x@example.com', confirm_authority: true, ack_nonbinding: true, ack_nominate_later: true });
  ok(missing.status === 400 && /owner_or_authorised|mandate_disclosed|disclosure_complete|immediate/.test(JSON.stringify(missing.data)), 'enable blocked without authority/mandate/disclosure/immediate declarations (#3,#5)');
  const full = await call('mao-enable', { listing_id: LID, seller_email: 'seller-x@example.com', seller_name: 'Seller X', confirm_authority: true, ack_nonbinding: true, ack_nominate_later: true, decl_owner_or_authorised: true, decl_mandate_disclosed: true, decl_disclosure_complete: true, consent_immediate_activation: true, cond_occupancy: 'owner-occupied' });
  ok(full.status === 200 && full.data.params?.custom_str1 === 'mao_enable', 'enable with all declarations returns signed PayFast params');
  const mao = await findObj(PRIV, 'MaoListings', 'listing_id', LID);
  const d = JSON.parse(mao.disclosure_json);
  ok(d.declarations?.owner_or_authorised && d.declarations?.mandate_disclosed && d.declarations?.disclosure_complete && d.declarations?.at, 'declarations stored with timestamp (#3)');
}

// #2 AI never echoes PII (feed poison PII; assert absent from output)
{
  const poison = { proposed_price: 3400000, funding_method: 'cash', proposal_expiry: '2026-06-30', subject_to_sale: 'no',
    buyer_name: 'POISONNAME', buyer_email: 'poison@evil.com', buyer_phone: '0820000000', note_to_seller: 'POISONNOTE', subject_to_sale_note: 'POISONSALE' };
  const sm = await call('mao-ai', { action: 'summarize', offer: poison });
  const out = JSON.stringify(sm.data).toLowerCase();
  ok(sm.status === 200, 'AI summarize returns 200');
  ok(!out.includes('poisonname') && !out.includes('poison@evil.com') && !out.includes('0820000000') && !out.includes('poisonnote') && !out.includes('poisonsale'), 'AI summary contains NO buyer name/email/phone/notes (#2)');
  const ex = await call('mao-ai', { action: 'explain', field: 'proposed_price' });
  ok(ex.status === 200 && !!ex.data.text, 'AI explain works (field label only)');
}

// #4 private seller note: stored, status unchanged, not buyer-facing
{
  const r = await call('mao-seller-action', { listing_id: LID, token: 'tok_legal_1', offer_id: globalThis.OFFER_ID, action: 'private_note', note: 'Buyer seems financed; SELLERONLYNOTE' });
  ok(r.status === 200 && r.data.status === 'submitted', 'private_note saved without changing status (#4)');
  const o = await findObj(PRIV, 'Offers', 'id', globalThis.OFFER_ID);
  ok((o.seller_action_log || '').includes('SELLERONLYNOTE') && (o.seller_action_log || '').includes('private_note'), 'private note stored in seller log');
  // It must NOT appear in any buyer-facing column
  ok(!(o.note_to_seller || '').includes('SELLERONLYNOTE') && !(o.note_for_conveyancer || '').includes('SELLERONLYNOTE'), 'private note not copied into buyer-facing fields');
}

console.log('Cleanup…');
await delByPrefix(PUB, LT, LID); await delByPrefix(PRIV, 'MaoListings', LID);
if (globalThis.OFFER_ID) await delByPrefix(PRIV, 'Offers', globalThis.OFFER_ID); // exact id only — never touch demo offers
await delByPrefix(PRIV, 'OtpChallenges', 'OTPLEGAL');
console.log(`\n${fails === 0 ? 'ALL TESTS PASSED' : fails + ' TEST(S) FAILED'}`);
process.exit(fails ? 1 : 0);
