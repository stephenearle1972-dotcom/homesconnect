// HomesConnect — Agent self-listing intake.
// 1. Validates the form payload
// 2. Generates a listing ID (HC + unix seconds)
// 3. Appends a pending_payment row to the Google Sheet
// 4. Builds a signed PayFast param set
// 5. Returns the PayFast post URL + params so the client can auto-submit a form

import { appendRow as sheetsAppendRow } from './_lib/sheets.js';
import { PAYFAST, signParams, siteBaseUrl } from './_lib/payfast.js';

const SHEET_ID = process.env.HOMESCONNECT_SHEET_ID;

const TIER_AMOUNT = { basic: '99.00', enhanced: '249.00', agency: '999.00' };
const TIER_NAME   = { basic: 'Basic',  enhanced: 'Enhanced', agency: 'Agency' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function bad(status, body) { return { statusCode: status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }; }
function ok(body) { return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }; }

// Header order in the sheet (must match the header row, A..AF). The final 6
// columns (AA..AF) were added for the private-seller path. Append is positional,
// so this array order must mirror the sheet exactly.
const SHEET_COLS = [
  'id','type','status','tier','title','price','price_display','bedrooms','bathrooms',
  'garage','garden','pool','pet_friendly','property_type','suburb','city','province',
  'description','imageUrl','image2','image3','agent_name','agent_phone','agent_agency',
  'featured','date_listed',
  'seller_type','disclaimer_accepted','disclaimer_accepted_at','whatsapp','size_sqm','address',
];

function formatRand(n) {
  const v = Number(n) || 0;
  return 'R ' + v.toLocaleString('en-ZA');
}

function validate(input) {
  const errors = {};
  const req = (k, label) => { if (!String(input[k] ?? '').trim()) errors[k] = `${label} is required`; };
  const isPrivate = input.seller_type === 'private';

  req('agent_name', isPrivate ? 'Full name' : 'Agent name');
  req('agent_phone', 'Phone number');
  req('agent_email', 'Email address');
  // Estate agents must supply a Fidelity Fund Certificate; private sellers don't have one.
  if (!isPrivate) req('fidelity_fund', 'Fidelity Fund Certificate number');
  req('title', 'Property title');
  req('property_type', 'Property type');
  req('suburb', 'Suburb');
  req('city', 'City');
  req('province', 'Province');
  req('description', 'Description');

  if (!['sale', 'rent'].includes(input.type)) errors.type = 'Type must be sale or rent';
  if (!['basic', 'enhanced', 'agency'].includes(input.tier)) errors.tier = 'Choose a tier';
  if (!(Number(input.price) > 0)) errors.price = 'Price must be greater than 0';
  if (input.agent_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.agent_email)) errors.agent_email = 'Enter a valid email';
  // FSBO disclaimer is mandatory for private sellers (STEP 2).
  if (isPrivate && input.disclaimer_accepted !== true) {
    errors.disclaimer_accepted = 'You must accept the private-listing terms to continue';
  }

  if (Array.isArray(input.images)) {
    for (const u of input.images) {
      if (typeof u !== 'string' || !/^https:\/\/res\.cloudinary\.com\/dkn6tnxao\//.test(u)) {
        errors.images = 'Images must be Cloudinary URLs';
        break;
      }
    }
  }

  return Object.keys(errors).length ? errors : null;
}

function buildRow({ id, input }) {
  const images = Array.isArray(input.images) ? input.images : [];
  const priceNum = Math.round(Number(input.price));
  const priceDisplay = input.type === 'rent'
    ? `${formatRand(priceNum)}/mo`
    : formatRand(priceNum);

  const sellerType = input.seller_type === 'private' ? 'private' : 'agent';
  const isPrivate = sellerType === 'private';
  const phone = (input.agent_phone || '').trim();
  const whatsapp = (input.whatsapp || '').trim() || phone; // default WhatsApp to the contact number
  const disclaimerAccepted = isPrivate && input.disclaimer_accepted === true;

  const map = {
    id,
    type: input.type,
    status: 'pending_payment',
    tier: input.tier,
    title: input.title.trim(),
    price: String(priceNum),
    price_display: priceDisplay,
    bedrooms: String(Number(input.bedrooms) || 0),
    bathrooms: String(Number(input.bathrooms) || 0),
    garage: String(Number(input.garage) || 0),
    garden: input.garden ? 'yes' : 'no',
    pool: input.pool ? 'yes' : 'no',
    pet_friendly: input.pet_friendly ? 'yes' : 'no',
    property_type: input.property_type,
    suburb: input.suburb.trim(),
    city: input.city.trim(),
    province: input.province,
    description: input.description.trim(),
    imageUrl: images[0] || '',
    image2: images[1] || '',
    image3: images[2] || '',
    // For private sellers, agent_* holds the seller's own details (no agency) so
    // the listing card / detail page / bot all surface the right contact.
    agent_name: input.agent_name.trim(),
    agent_phone: phone,
    agent_agency: isPrivate ? '' : (input.agent_agency || '').trim(),
    featured: 'no',
    date_listed: new Date().toISOString().slice(0, 10),
    seller_type: sellerType,
    disclaimer_accepted: disclaimerAccepted ? 'yes' : 'no',
    disclaimer_accepted_at: disclaimerAccepted ? new Date().toISOString() : '',
    whatsapp,
    size_sqm: input.size ? String(Math.round(Number(input.size)) || '') : '',
    address: (input.address || '').trim(),
  };
  return SHEET_COLS.map((c) => map[c] ?? '');
}

async function appendRow(row) {
  return sheetsAppendRow(SHEET_ID, row);
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return bad(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return bad(400, { error: 'Bad JSON' }); }

  const errors = validate(body);
  if (errors) return bad(400, { error: 'Validation failed', errors });

  // 1. Generate listing ID
  const id = 'HC' + Math.floor(Date.now() / 1000);

  // 2. Append pending row
  try {
    const row = buildRow({ id, input: body });
    await appendRow(row);
  } catch (err) {
    console.error('[list-property] Sheet append failed:', err.message);
    return bad(500, { error: 'Could not save listing. Please try again.' });
  }

  // 3. Build PayFast params + signature
  const amount = TIER_AMOUNT[body.tier];
  const tierName = TIER_NAME[body.tier];
  // Callbacks must return to THIS deploy (production = live URL; preview = preview URL).
  const siteUrl = siteBaseUrl(event);
  const params = {
    merchant_id: PAYFAST.merchantId,
    merchant_key: PAYFAST.merchantKey,
    return_url: `${siteUrl}/listing-success?ref=${id}`,
    cancel_url: `${siteUrl}/list-property?cancelled=true`,
    notify_url: `${siteUrl}/.netlify/functions/payfast-itn`,
    name_first: (body.agent_name || '').split(' ')[0] || '',
    name_last:  (body.agent_name || '').split(' ').slice(1).join(' ') || '',
    email_address: body.agent_email,
    m_payment_id: id,
    amount,
    item_name: `HomesConnect ${tierName} Listing — ${body.title}`.slice(0, 100),
    item_description: `${body.bedrooms || 0} bed ${body.property_type} in ${body.suburb}, ${body.city}`.slice(0, 254),
  };
  params.signature = signParams(params, PAYFAST.passphrase);

  return ok({
    listing_id: id,
    payfast_url: PAYFAST.processUrl,
    params,
  });
};
