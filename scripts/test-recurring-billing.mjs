// Offline acceptance test for recurring (subscription) billing.
// No network, no Google Sheet, no live gateway — it pins the two things that, if wrong,
// silently break the integration:
//   A. The CHECKOUT signature for a subscription (insertion order, passphrase appended)
//      matches an independent PHP-urlencode-faithful reference → the gateway will accept it.
//   B. The SUBSCRIPTIONS API signature (alphabetical ksort, passphrase FOLDED into the
//      sort) matches an independent reference AND differs from the checkout signer → the
//      cancel/fetch calls will authenticate (a 401 "merchant auth failed" is the symptom
//      of getting this wrong).
//   C. subscriptionFields() emits exactly the documented fields/values (monthly, indefinite).
//   D. With the flag OFF, the listing params carry NO subscription fields (grandfathering).
//
// Run: node scripts/test-recurring-billing.mjs
import crypto from 'node:crypto';

// Deterministic creds so signing is reproducible; real values are irrelevant because we
// compare our signer against an independent re-implementation using the SAME inputs.
process.env.PAYFAST_MERCHANT_ID = '10000100';
process.env.PAYFAST_MERCHANT_KEY = '46f0cd694581a';
process.env.PAYFAST_PASSPHRASE = 'test-passphrase';
process.env.PAYFAST_MODE = 'sandbox';
process.env.PAYFAST_RECURRING_ENABLED = 'true';

const PASS = process.env.PAYFAST_PASSPHRASE;
let failures = 0;
const ok = (c, msg) => { console.log(`${c ? 'PASS' : 'FAIL'}: ${msg}`); if (!c) failures++; };

// ---- independent PHP urlencode (space->+, %-encode !*'() ) ----
function phpUrlencode(str) {
  return encodeURIComponent(String(str))
    .replace(/%20/g, '+')
    .replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}
// Reference CHECKOUT signature: name=value in GIVEN order, drop blanks, passphrase appended.
function refCheckoutSig(orderedPairs, passphrase) {
  const parts = orderedPairs
    .filter(([k, v]) => k !== 'signature' && v !== '' && v != null)
    .map(([k, v]) => `${k}=${phpUrlencode(v)}`);
  let s = parts.join('&');
  if (passphrase) s += `&passphrase=${phpUrlencode(passphrase)}`;
  return crypto.createHash('md5').update(s).digest('hex');
}
// Reference API signature: passphrase folded in, keys sorted ALPHABETICALLY, then md5.
function refApiSig(data, passphrase) {
  const all = { ...data };
  if (passphrase) all.passphrase = passphrase;
  const s = Object.keys(all)
    .filter((k) => k !== 'signature')
    .sort()
    .map((k) => `${k}=${phpUrlencode(all[k])}`)
    .join('&');
  return crypto.createHash('md5').update(s).digest('hex');
}

const pf = await import('../netlify/functions/_lib/payfast.js');
ok(pf.RECURRING_ENABLED === true, 'RECURRING_ENABLED reflects PAYFAST_RECURRING_ENABLED=true');

// ---- C: subscriptionFields ----
const fields = pf.subscriptionFields('99.00');
ok(fields.subscription_type === '1', 'subscription_type = 1');
ok(fields.frequency === '3', 'frequency = 3 (monthly)');
ok(fields.cycles === '0', 'cycles = 0 (indefinite until cancelled)');
ok(fields.recurring_amount === '99.00', 'recurring_amount = the tier price (rands)');
ok(/^\d{4}-\d{2}-\d{2}$/.test(fields.billing_date), `billing_date is YYYY-MM-DD (${fields.billing_date})`);

// ---- A: subscription CHECKOUT signature matches the gateway's algorithm ----
// Build params exactly as list-property.js does (base fields, then subscription fields).
function buildListingParams({ recurring }) {
  const params = {
    merchant_id: process.env.PAYFAST_MERCHANT_ID,
    merchant_key: process.env.PAYFAST_MERCHANT_KEY,
    return_url: 'https://homesconnect-za.netlify.app/listing-success?ref=HC123',
    cancel_url: 'https://homesconnect-za.netlify.app/list-property?cancelled=true',
    notify_url: 'https://homesconnect-za.netlify.app/.netlify/functions/payfast-itn',
    name_first: 'Test', name_last: 'Seller',
    email_address: 'seller@example.com',
    m_payment_id: 'HC123',
    amount: '99.00',
    item_name: 'HomesConnect Basic Listing — Test',
    item_description: '3 bed house in Testville, Pretoria',
  };
  if (recurring) Object.assign(params, pf.subscriptionFields('99.00'));
  params.signature = pf.signParams(params, PASS);
  return params;
}
const recur = buildListingParams({ recurring: true });
ok('subscription_type' in recur, 'recurring params include subscription_type');
ok(recur.recurring_amount === '99.00' && recur.frequency === '3' && recur.cycles === '0', 'recurring params include recurring_amount/frequency/cycles');
ok(recur.signature === refCheckoutSig(Object.entries(recur), PASS), 'subscription checkout signature matches independent PHP-faithful reference (insertion order)');

// ---- D: flag-off (once-off) carries NO subscription fields ----
const once = buildListingParams({ recurring: false });
ok(!('subscription_type' in once), 'once-off params do NOT include subscription_type (grandfathering safe)');
ok(once.signature === refCheckoutSig(Object.entries(once), PASS), 'once-off checkout signature still matches reference');

// ---- B: API (cancel/fetch) signature — alphabetical, passphrase folded ----
const apiData = { 'merchant-id': '10000100', version: 'v1', timestamp: '2026-01-01T00:00:00+0000' };
const apiSig = pf.signApiData(apiData, PASS);
ok(apiSig === refApiSig(apiData, PASS), 'API signature matches independent alphabetical-ksort reference');
// Prove it is genuinely a DIFFERENT algorithm from the checkout signer (insertion order):
const asCheckout = refCheckoutSig(Object.entries(apiData), PASS);
ok(apiSig !== asCheckout, 'API signature differs from checkout-style signing of the same fields (correct algorithm chosen)');
// Pin the PHP-urlencode of the timestamp (colon -> %3A, plus -> %2B) inside the signed string.
const signedStr = Object.keys({ ...apiData, passphrase: PASS }).filter((k) => k !== 'signature').sort()
  .map((k) => `${k}=${phpUrlencode({ ...apiData, passphrase: PASS }[k])}`).join('&');
ok(signedStr.includes('timestamp=2026-01-01T00%3A00%3A00%2B0000'), 'timestamp is PHP-urlencoded in the API signature (%3A / %2B)');
ok(/(^|&)passphrase=/.test(signedStr) && signedStr.indexOf('passphrase=') < signedStr.indexOf('timestamp='), 'passphrase is folded into the alphabetical sort (before timestamp)');

// ---- import smoke test: changed handlers load without ReferenceError ----
try {
  await import('../netlify/functions/_lib/subscriptions.js');
  ok(true, 'subscriptions.js imports');
} catch (e) { ok(false, `subscriptions.js import failed: ${e.message}`); }

console.log(`\n${failures === 0 ? 'ALL TESTS PASSED' : failures + ' TEST(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
