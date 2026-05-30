// HomesConnect — free conveyancer directory intake.
// 1. Validates the form payload (incl. the required confirmation checkbox)
// 2. Generates a conveyancer id (CV + unix seconds)
// 3. Appends a row with status="pending" to the "Conveyancers" tab
// There is NO payment in this flow — listing is free.

import { appendRowToTab } from './_lib/sheets.js';

const SHEET_ID = process.env.HOMESCONNECT_SHEET_ID;
const TAB = 'Conveyancers';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function bad(status, body) { return { statusCode: status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }; }
function ok(body) { return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }; }

// Must match the Conveyancers tab header row exactly (append is positional).
const SHEET_COLS = [
  'id','firm_name','contact_name','regions_served','physical_address','suburb','city','province',
  'phone','whatsapp','email','website','practice_notes','logo_url','lpc_number',
  'confirmation_accepted','status','date_listed',
];

function validate(input) {
  const errors = {};
  const req = (k, label) => { if (!String(input[k] ?? '').trim()) errors[k] = `${label} is required`; };
  req('firm_name', 'Firm name');
  req('contact_name', 'Contact attorney name');
  req('regions_served', 'Regions served');
  req('suburb', 'Suburb');
  req('city', 'City');
  req('province', 'Province');
  req('phone', 'Phone number');
  req('email', 'Email address');
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) errors.email = 'Enter a valid email';
  // The directory is a legal-practitioner listing — the confirmation is mandatory.
  if (input.confirmation_accepted !== true) errors.confirmation_accepted = 'You must confirm you are entitled to perform conveyancing';
  return Object.keys(errors).length ? errors : null;
}

function buildRow(id, input) {
  // regions_served may arrive as an array (multi-select) or a comma string.
  const regions = Array.isArray(input.regions_served)
    ? input.regions_served.join(', ')
    : String(input.regions_served || '').trim();
  const logo = typeof input.logo_url === 'string' && /^https:\/\/res\.cloudinary\.com\/dkn6tnxao\//.test(input.logo_url)
    ? input.logo_url : '';
  const map = {
    id,
    firm_name: input.firm_name.trim(),
    contact_name: input.contact_name.trim(),
    regions_served: regions,
    physical_address: (input.physical_address || '').trim(),
    suburb: input.suburb.trim(),
    city: input.city.trim(),
    province: input.province.trim(),
    phone: input.phone.trim(),
    whatsapp: (input.whatsapp || '').trim(),
    email: input.email.trim(),
    website: (input.website || '').trim(),
    practice_notes: (input.practice_notes || '').trim(),
    logo_url: logo,
    lpc_number: (input.lpc_number || '').trim(),
    confirmation_accepted: 'yes',
    status: 'pending',
    date_listed: new Date().toISOString().slice(0, 10),
  };
  return SHEET_COLS.map((c) => map[c] ?? '');
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return bad(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return bad(400, { error: 'Bad JSON' }); }

  const errors = validate(body);
  if (errors) return bad(400, { error: 'Validation failed', errors });

  const id = 'CV' + Math.floor(Date.now() / 1000);
  try {
    await appendRowToTab(SHEET_ID, TAB, buildRow(id, body));
  } catch (err) {
    console.error('[list-conveyancer] Sheet append failed:', err.message);
    return bad(500, { error: 'Could not save your listing. Please try again.' });
  }

  return ok({ conveyancer_id: id, status: 'pending' });
};
