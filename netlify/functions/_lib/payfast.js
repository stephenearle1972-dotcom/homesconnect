// HomesConnect — PayFast configuration + signing (shared by every PayFast touchpoint).
//
// One reversible toggle, `PAYFAST_MODE`, selects which gateway we talk to:
//   - unset / "live"  -> the real PayFast gateway with the live merchant credentials
//                        (behaviour is byte-for-byte what it has always been)
//   - "sandbox"       -> PayFast's sandbox gateway with sandbox credentials, so the
//                        full flow can be exercised with NO real money.
//
// ALL credentials and passphrases are read from server-side env only — never from
// VITE_ / build-time variables, so nothing secret reaches the browser bundle.
//
// Signature method is IDENTICAL in both modes: parameters are signed in INSERTION
// order (the order they are posted), NOT alphabetically. Sorting was the original
// live bug — never reintroduce it. The passphrase is appended to the signed string
// ONLY when one is configured; PayFast's own rule is "append iff a passphrase is set
// on the account", which is the same for live and sandbox. The public sandbox test
// merchant has no passphrase, so PAYFAST_SANDBOX_PASSPHRASE is optional and unset by
// default (nothing is appended) — which is what the sandbox expects.

import crypto from 'node:crypto';

const MODE = String(process.env.PAYFAST_MODE || 'live').trim().toLowerCase() === 'sandbox'
  ? 'sandbox'
  : 'live';

// Live gateway + live merchant (unchanged from the original hardcoded values).
const LIVE = {
  mode: 'live',
  processUrl: 'https://www.payfast.co.za/eng/process',
  validateUrl: 'https://www.payfast.co.za/eng/query/validate',
  merchantId: process.env.PAYFAST_MERCHANT_ID,
  merchantKey: process.env.PAYFAST_MERCHANT_KEY,
  passphrase: process.env.PAYFAST_PASSPHRASE || '',
};

// Sandbox gateway + sandbox merchant. Defaults to PayFast's public test merchant
// (10000100 / 46f0cd694581a) so sandbox works out of the box; override per-deploy
// with PAYFAST_SANDBOX_* if you have your own sandbox account. No passphrase by
// default (the public test merchant has none).
const SANDBOX = {
  mode: 'sandbox',
  processUrl: 'https://sandbox.payfast.co.za/eng/process',
  validateUrl: 'https://sandbox.payfast.co.za/eng/query/validate',
  merchantId: process.env.PAYFAST_SANDBOX_MERCHANT_ID || '10000100',
  merchantKey: process.env.PAYFAST_SANDBOX_MERCHANT_KEY || '46f0cd694581a',
  passphrase: process.env.PAYFAST_SANDBOX_PASSPHRASE || '',
};

export const PAYFAST = MODE === 'sandbox' ? SANDBOX : LIVE;

// PayFast urlencode: PHP urlencode style — spaces become '+' (not %20), and a few
// extra characters are percent-encoded to match PayFast's PHP implementation.
export function payfastEncode(v) {
  return encodeURIComponent(String(v))
    .replace(/%20/g, '+')
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

// Sign an OUTGOING param object (what we post to the gateway). Insertion order,
// skipping `signature` and any empty/undefined/null value (PayFast excludes blanks).
export function signParams(params, passphrase = PAYFAST.passphrase) {
  const parts = [];
  for (const k of Object.keys(params)) {
    if (k === 'signature') continue;
    const v = params[k];
    if (v === undefined || v === null || v === '') continue;
    parts.push(`${k}=${payfastEncode(v)}`);
  }
  let s = parts.join('&');
  if (passphrase) s += `&passphrase=${payfastEncode(passphrase)}`;
  return crypto.createHash('md5').update(s).digest('hex');
}

// Sign an INCOMING ITN: ordered [key,value] pairs exactly as received, excluding
// `signature`, in the order sent. (We do NOT drop blanks here — we sign what PayFast
// sent, in the order it sent it.)
export function signPairs(pairs, passphrase = PAYFAST.passphrase) {
  const enc = pairs
    .filter(([k]) => k !== 'signature')
    .map(([k, v]) => `${k}=${payfastEncode(v)}`)
    .join('&');
  return crypto.createHash('md5')
    .update(passphrase ? `${enc}&passphrase=${payfastEncode(passphrase)}` : enc)
    .digest('hex');
}

// ---------------------------------------------------------------------------
// RECURRING (subscription) billing
// ---------------------------------------------------------------------------
// One reversible toggle, exactly like PAYFAST_MODE. When OFF (the default), every
// payment is once-off and the listing flow behaves byte-for-byte as it always has —
// so production stays once-off until the live R5/month test passes and this is
// flipped on. When ON, listing tiers are created as real monthly subscriptions.
export const RECURRING_ENABLED =
  String(process.env.PAYFAST_RECURRING_ENABLED || '').trim().toLowerCase() === 'true';

export const FREQUENCY_MONTHLY = 3; // PayFast frequency codes: 1=daily 2=weekly 3=monthly 4=quarterly 5=biannual 6=annual
export const CYCLES_INDEFINITE = 0; // 0 = bill indefinitely until cancelled

// Today's date as YYYY-MM-DD (used for billing_date — the first recurring charge).
export function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

// The five subscription fields that turn a standard checkout into a monthly
// subscription. Returned in PayFast's documented order so that, combined with our
// insertion-order signing, the signed string and the posted form agree.
// `amountRands` is a string like "99.00" (same rand-decimal format as `amount`).
export function subscriptionFields(amountRands, { billingDate = todayYmd() } = {}) {
  return {
    subscription_type: '1',
    billing_date: billingDate,
    recurring_amount: amountRands,
    frequency: String(FREQUENCY_MONTHLY),
    cycles: String(CYCLES_INDEFINITE),
  };
}

// ---- Subscriptions API (cancel / fetch) -----------------------------------
// IMPORTANT: the API request signature is DIFFERENT from the checkout signature.
// PayFast's API signs the merged header + body values SORTED ALPHABETICALLY by key,
// with the passphrase folded INTO the sorted set (key "passphrase"), then MD5. This
// matches PayFast's own PHP SDK (Auth::generateApiSignature). The checkout signature,
// by contrast, is insertion-order with passphrase appended at the end — do not mix
// the two up.
const API_BASE = MODE === 'sandbox'
  ? 'https://api.payfast.co.za' // same host; sandbox is selected via ?testing=true
  : 'https://api.payfast.co.za';
const API_VERSION = 'v1';

// PayFast API timestamp: PHP date("Y-m-d\TH:i:sO"), e.g. 2026-06-02T12:00:00+0000.
function apiTimestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, '+0000');
}

export function signApiData(data, passphrase = PAYFAST.passphrase) {
  const all = { ...data };
  if (passphrase) all.passphrase = passphrase;
  const s = Object.keys(all)
    .filter((k) => k !== 'signature')
    .sort()
    .map((k) => `${k}=${payfastEncode(all[k])}`)
    .join('&');
  return crypto.createHash('md5').update(s).digest('hex');
}

// Low-level signed API call. `token` is the PayFast subscription token. Returns the
// parsed JSON body and throws on a non-2xx response so callers can log/handle it.
async function subscriptionApi(method, token, action, body = {}) {
  if (!token) throw new Error('subscription token required');
  if (!PAYFAST.passphrase) throw new Error('PAYFAST passphrase required for subscription API calls');

  const headers = {
    'merchant-id': PAYFAST.merchantId,
    version: API_VERSION,
    timestamp: apiTimestamp(),
  };
  // Signature is computed over headers + body together.
  const signature = signApiData({ ...headers, ...body }, PAYFAST.passphrase);

  const qs = MODE === 'sandbox' ? '?testing=true' : '';
  const url = `${API_BASE}/subscriptions/${encodeURIComponent(token)}/${action}${qs}`;
  const res = await fetch(url, {
    method,
    headers: {
      ...headers,
      signature,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: method === 'GET' ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`PayFast subscriptions/${action} ${res.status}: ${json?.data?.response || json?.data?.message || text}`);
    err.code = res.status;
    err.detail = json;
    throw err;
  }
  return json;
}

// Cancel a subscription so PayFast stops all further billing. Idempotent enough for
// our use: cancelling an already-cancelled token returns an error we treat as success.
export async function cancelSubscription(token) {
  return subscriptionApi('PUT', token, 'cancel');
}

// Fetch a subscription's current status from PayFast (used to PROVE billing stopped).
export async function fetchSubscription(token) {
  return subscriptionApi('GET', token, 'fetch');
}
