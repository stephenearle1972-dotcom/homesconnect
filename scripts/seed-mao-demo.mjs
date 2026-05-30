// Seed a DEMO journey for "Make an Offer" (acceptance #9): one private listing with
// the add-on enabled (manual flag, no payment), two sample proposals, and one driven
// through to a real conveyancer handoff. Idempotent: clears prior demo rows first.
import fs from 'node:fs';
import crypto from 'node:crypto';

const CREDS_PATH = 'F:\\My Drive\\TOWN CONNECT\\google-sheets-credentials.json.json';
process.env.GOOGLE_SHEETS_CREDENTIALS = fs.readFileSync(CREDS_PATH, 'utf8');
const SHEET_ID = process.env.HOMESCONNECT_SHEET_ID;
const PASS = process.env.PAYFAST_PASSPHRASE || '';
const INBOX = 'stephenearle1972';
const LISTING_ID = 'HCDEMO01';
const TOKEN = 'demo7h3x9k2m4p';
const LISTINGS_TAB = 'HomesConnect Listings';

const creds = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
const b = (x) => Buffer.from(x).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function gtok() { const n = Math.floor(Date.now() / 1000); const h = b(JSON.stringify({ alg: 'RS256', typ: 'JWT' })); const p = b(JSON.stringify({ iss: creds.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: n, exp: n + 3600 })); const s = b(crypto.createSign('RSA-SHA256').update(`${h}.${p}`).sign(creds.private_key)); const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${h}.${p}.${s}` }) }); return (await r.json()).access_token; }
async function sapi(t, m, path, body) { const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${path}`, { method: m, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); if (!r.ok) throw new Error(`${m} ${path} ${r.status}: ${await r.text()}`); return r.json(); }
async function append(tab, row) { const t = await gtok(); await sapi(t, 'POST', `/${SHEET_ID}/values/${encodeURIComponent(tab + '!A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { values: [row] }); }
async function delByPrefix(tab, prefix) { const t = await gtok(); const meta = await sapi(t, 'GET', `/${SHEET_ID}?fields=sheets.properties(title,sheetId)`); const sid = meta.sheets.find(s => s.properties.title === tab).properties.sheetId; const v = (await sapi(t, 'GET', `/${SHEET_ID}/values/${encodeURIComponent(tab + '!A1:BZ2000')}`)).values || []; for (let i = v.length - 1; i >= 1; i--) { if ((v[i][0] || '').startsWith(prefix)) await sapi(t, 'POST', `/${SHEET_ID}:batchUpdate`, { requests: [{ deleteDimension: { range: { sheetId: sid, dimension: 'ROWS', startIndex: i, endIndex: i + 1 } } }] }); } }

const OFFERS_COLS = ['id','listing_id','buyer_name','buyer_phone_verified','buyer_email','buyer_entity_type','proposed_price','funding_method','bond_amount','cash_contribution','deposit_amount','subject_to_sale','subject_to_sale_note','occupation_date','proposal_expiry','note_to_seller','note_for_conveyancer','ack_nonbinding','consent_share_seller','consent_share_conveyancer','status','selected_conveyancer','seller_action_log','created_at','updated_at'];
const offerRow = (o) => OFFERS_COLS.map(c => o[c] != null ? o[c] : '');
const iso = new Date().toISOString();

console.log('Clearing prior demo rows…');
await delByPrefix('Offers', 'OFDEMO');
await delByPrefix(LISTINGS_TAB, LISTING_ID);
await delByPrefix('MaoListings', LISTING_ID);

console.log('Seeding demo listing (enabled, no payment)…');
await append(LISTINGS_TAB, [LISTING_ID, 'sale', 'active', 'enhanced', 'Demo Family Home — Brooklyn', '3500000', 'R 3,500,000', '4', '3', '2', 'yes', 'yes', 'yes', 'house', 'Brooklyn', 'Pretoria', 'Gauteng', 'Spacious demo listing used to showcase the Make an Offer journey. Light-filled living areas, pool and established garden.', 'https://res.cloudinary.com/dkn6tnxao/image/upload/homesconnect/property-05-cape-dutch.jpg', '', '', 'Demo Seller', '0825551000', '', 'no', '2026-05-30', 'private', 'yes', '2026-05-30T00:00:00Z', '0825551000', '320', '5 Demo Avenue', 'true', iso]);
await append('MaoListings', [LISTING_ID, 'Demo Seller', `${INBOX}+demoseller@gmail.com`, TOKEN, JSON.stringify({ sellerName: 'Demo Seller', sellerEmail: `${INBOX}+demoseller@gmail.com`, condition: { occupancy: 'Owner-occupied', known_defects: 'None known', additions_approved: 'Yes — plans on file', notes: 'Demo disclosure record.' }, acks: { authority: true, nonbinding: true, nominate_later: true }, at: iso }), iso, iso]);

console.log('Seeding two sample proposals…');
const auditA = JSON.stringify([{ t: iso, actor: 'buyer', event: 'submitted', consents: { ack_nonbinding: true, share_seller: true, ack_conveyancer_later: true, privacy: true, marketing: false } }]);
await append('Offers', offerRow({ id: 'OFDEMOA', listing_id: LISTING_ID, buyer_name: 'Lerato Demo', buyer_phone_verified: '27825552001', buyer_email: `${INBOX}+demobuyerA@gmail.com`, buyer_entity_type: 'individual', proposed_price: '3350000', funding_method: 'bond', bond_amount: '3350000', cash_contribution: '', deposit_amount: '150000', subject_to_sale: 'no', subject_to_sale_note: '', occupation_date: '2026-08-01', proposal_expiry: '2026-06-20', note_to_seller: 'We love the garden and can move quickly.', note_for_conveyancer: '', ack_nonbinding: 'yes', consent_share_seller: 'yes', consent_share_conveyancer: '', status: 'submitted', selected_conveyancer: '', seller_action_log: auditA, created_at: iso, updated_at: iso }));
await append('Offers', offerRow({ id: 'OFDEMOB', listing_id: LISTING_ID, buyer_name: 'Pieter Demo', buyer_phone_verified: '27825552002', buyer_email: `${INBOX}+demobuyerB@gmail.com`, buyer_entity_type: 'company', proposed_price: '3450000', funding_method: 'mixed', bond_amount: '3000000', cash_contribution: '450000', deposit_amount: '200000', subject_to_sale: 'yes', subject_to_sale_note: 'Selling our Centurion townhouse first.', occupation_date: '2026-09-01', proposal_expiry: '2026-06-25', note_to_seller: 'Flexible on dates.', note_for_conveyancer: 'Company purchase — VAT vendor.', ack_nonbinding: 'yes', consent_share_seller: 'yes', consent_share_conveyancer: '', status: 'submitted', selected_conveyancer: '', seller_action_log: JSON.stringify([{ t: iso, actor: 'buyer', event: 'submitted', consents: { ack_nonbinding: true, share_seller: true, ack_conveyancer_later: true, privacy: true, marketing: false } }]), created_at: iso, updated_at: iso }));

console.log('Driving proposal B through to a real conveyancer handoff…');
const seller = await import('../netlify/functions/mao-seller-action.js');
const proceed = await seller.handler({ httpMethod: 'POST', body: JSON.stringify({ listing_id: LISTING_ID, token: TOKEN, offer_id: 'OFDEMOB', action: 'proceed', conveyancer_mode: 'own', conveyancer_name: 'Demo Conveyancer', conveyancer_email: `${INBOX}+democonveyancer@gmail.com`, conveyancer_firm: 'Demo Attorneys Inc', seller_consent_share: true }) });
console.log('  proceed:', proceed.statusCode, JSON.parse(proceed.body).status);
const ct = crypto.createHmac('sha256', PASS || 'mao-secret').update(`OFDEMOB|${INBOX}+demobuyerB@gmail.com`).digest('hex').slice(0, 32);
const consent = await import('../netlify/functions/mao-buyer-consent.js');
const handoff = await consent.handler({ httpMethod: 'POST', body: JSON.stringify({ offer: 'OFDEMOB', t: ct, consent: true }) });
console.log('  buyer consent + handoff:', handoff.statusCode, 'emailed:', JSON.parse(handoff.body).handoff_emailed);

const SITE = process.env.SITE_URL_HOMESCONNECT || 'https://homesconnect-za.netlify.app';
console.log('\n=== DEMO READY ===');
console.log('Listing (buyer view):  ' + SITE + '/listing/' + LISTING_ID);
console.log('Make an Offer (buyer): ' + SITE + '/make-offer?listing=' + LISTING_ID);
console.log('Seller dashboard:      ' + SITE + '/seller?listing=' + LISTING_ID + '&token=' + TOKEN);
console.log('Proposal A is open for live seller actions; Proposal B is already proceeding_to_otp with a handoff sent.');
