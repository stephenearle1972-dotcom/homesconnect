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
// on the account", which is the same for live and sandbox.
//
// IMPORTANT: PayFast's public sandbox test merchant (10000100 / 46f0cd694581a) DOES
// have a passphrase on the account — `jt7NOE43FZPn` per PayFast's current docs. So in
// sandbox we MUST append it (PAYFAST_SANDBOX_PASSPHRASE defaults to that value). Omitting
// it was the cause of the "Generated signature does not match submitted signature" 400 at
// /eng/process. Override PAYFAST_SANDBOX_PASSPHRASE only if you use your own sandbox
// account with a different passphrase.

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
// (10000100 / 46f0cd694581a / passphrase jt7NOE43FZPn) so sandbox works out of the
// box; override per-deploy with PAYFAST_SANDBOX_* if you have your own sandbox account.
// The public test merchant's documented passphrase MUST be appended to the signature
// or the sandbox rejects it with a signature mismatch.
const SANDBOX = {
  mode: 'sandbox',
  processUrl: 'https://sandbox.payfast.co.za/eng/process',
  validateUrl: 'https://sandbox.payfast.co.za/eng/query/validate',
  merchantId: process.env.PAYFAST_SANDBOX_MERCHANT_ID || '10000100',
  merchantKey: process.env.PAYFAST_SANDBOX_MERCHANT_KEY || '46f0cd694581a',
  passphrase: process.env.PAYFAST_SANDBOX_PASSPHRASE || 'jt7NOE43FZPn',
};

export const PAYFAST = MODE === 'sandbox' ? SANDBOX : LIVE;

const DEFAULT_SITE_URL = 'https://homesconnect-za.netlify.app';

// Base URL for PayFast return / cancel / notify (ITN) callbacks.
//
// PayFast must be able to send the user back to — and POST the ITN to — the SAME
// deploy the payment started on. On a Netlify branch/preview deploy that is the
// preview's own public URL, NOT production. So in SANDBOX mode we derive the base
// from the incoming request's host (always correct at function runtime, on any
// deploy context), falling back to Netlify's DEPLOY_PRIME_URL / URL build vars.
//
// In LIVE mode (production) we keep the explicitly configured site URL exactly as
// before — production behaviour is unchanged.
export function siteBaseUrl(event) {
  if (PAYFAST.mode === 'sandbox') {
    const h = (event && event.headers) || {};
    const host = h['x-forwarded-host'] || h['host'] || h['Host'];
    if (host) {
      const proto = h['x-forwarded-proto'] || 'https';
      return `${proto}://${host}`;
    }
    return process.env.DEPLOY_PRIME_URL || process.env.URL
      || process.env.SITE_URL_HOMESCONNECT || DEFAULT_SITE_URL;
  }
  return process.env.SITE_URL_HOMESCONNECT || DEFAULT_SITE_URL;
}

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
