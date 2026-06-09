// HomesConnect — image moderation via Google Cloud Vision SafeSearch.
//
// Reuses the SAME service-account credentials as the Sheets client
// (GOOGLE_SHEETS_CREDENTIALS), but signs its own JWT with the cloud-vision
// scope and keeps its own token cache (mixing scopes in one cache is wrong).
//
// One-time manual step required before this works: enable the "Cloud Vision API"
// on the service account's GCP project (gen-lang-client-0093084150). Until it is
// enabled, every Vision call 403s — and the caller fail-safes to `flagged`, which
// is the safe direction (nothing inappropriate slips through), never fail-open.

import crypto from 'node:crypto';

const VISION_SCOPE = 'https://www.googleapis.com/auth/cloud-vision';

// SafeSearch likelihood ladder. We flag at LIKELY (4) — high enough to avoid
// false positives on ordinary property photos (a bedroom, a pool, swimwear in a
// magazine on a coffee table), low enough to catch genuinely explicit content.
const RANK = { UNKNOWN: 0, VERY_UNLIKELY: 1, UNLIKELY: 2, POSSIBLE: 3, LIKELY: 4, VERY_LIKELY: 5 };
const FLAG_AT = RANK.LIKELY;
// Categories that hold a listing. (spoof/medical are ignored — not relevant here.)
const FLAG_CATEGORIES = ['adult', 'violence', 'racy'];

let cachedToken = null;
let cachedTokenExpiresAt = 0;

function getCreds() {
  const raw = process.env.GOOGLE_SHEETS_CREDENTIALS;
  if (!raw) throw new Error('GOOGLE_SHEETS_CREDENTIALS env var not set');
  return JSON.parse(raw);
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedTokenExpiresAt > now + 60) return cachedToken;

  const creds = getCreds();
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: creds.client_email,
    scope: VISION_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${payload}`;
  const signature = base64url(
    crypto.createSign('RSA-SHA256').update(signingInput).sign(creds.private_key)
  );
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Vision OAuth token exchange ${res.status}: ${await res.text()}`);
  const data = await res.json();
  cachedToken = data.access_token;
  cachedTokenExpiresAt = now + (data.expires_in || 3600);
  return cachedToken;
}

// Scan ONE image URL. Returns { ok, flagged, categories }.
// ok=false means the scan itself failed/was inconclusive → caller fail-safes.
async function scanOne(url) {
  const token = await getAccessToken();
  const res = await fetch('https://vision.googleapis.com/v1/images:annotate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        image: { source: { imageUri: url } },
        features: [{ type: 'SAFE_SEARCH_DETECTION' }],
      }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vision annotate ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  const r0 = json.responses && json.responses[0];
  // Per-image error (e.g. Vision couldn't fetch the URL) → inconclusive.
  if (!r0 || r0.error) {
    return { ok: false, error: r0 && r0.error ? r0.error.message : 'no_response' };
  }
  const ss = r0.safeSearchAnnotation;
  if (!ss) return { ok: false, error: 'no_safesearch_annotation' };
  const categories = {};
  FLAG_CATEGORIES.forEach((k) => { categories[k] = ss[k] || 'UNKNOWN'; });
  const flagged = FLAG_CATEGORIES.some((k) => (RANK[ss[k]] || 0) >= FLAG_AT);
  return { ok: true, flagged, categories };
}

// Moderate EVERY image on a listing. Synchronous from the caller's point of view
// (awaited inline before the row is written), so clean listings still publish
// instantly. Fail-safe, never fail-open:
//   - any image flagged adult/violent/racy >= LIKELY  → moderation 'flagged'
//   - any scan errored / inconclusive / API disabled  → moderation 'flagged'
//   - all images clean                                → moderation 'approved'
//   - no images at all                                → 'approved' (nothing to scan)
export async function moderateImages(urls) {
  const list = (urls || []).filter((u) => typeof u === 'string' && u.trim());
  if (!list.length) return { moderation: 'approved', reason: 'no_images', perImage: [] };

  const perImage = [];
  let anyFlagged = false;
  let anyError = false;

  for (const url of list) {
    try {
      const r = await scanOne(url);
      if (!r.ok) {
        anyError = true;
        perImage.push({ url, result: 'error', error: r.error });
        continue;
      }
      if (r.flagged) anyFlagged = true;
      perImage.push({ url, result: r.flagged ? 'flagged' : 'clean', categories: r.categories });
    } catch (err) {
      anyError = true;
      perImage.push({ url, result: 'error', error: err.message });
    }
  }

  const moderation = (anyFlagged || anyError) ? 'flagged' : 'approved';
  const reason = anyFlagged ? 'unsafe_content' : (anyError ? 'scan_error_failsafe' : 'clean');
  return { moderation, reason, perImage };
}
