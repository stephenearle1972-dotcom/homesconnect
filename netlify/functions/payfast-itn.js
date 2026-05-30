// HomesConnect — PayFast ITN webhook.
// Validates the ITN, then flips the listing row in the Google Sheet from
// status="pending_payment" to status="active".

import crypto from 'node:crypto';
import { getAllValues, updateCell } from './_lib/sheets.js';

const SHEET_ID = process.env.HOMESCONNECT_SHEET_ID;
const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE || '';
const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID;

const TIER_AMOUNT = { basic: 99, enhanced: 249, agency: 999 };

// PayFast urlencode: spaces -> '+', not %20. See list-property.js for details.
function payfastEncode(v) {
  return encodeURIComponent(String(v))
    .replace(/%20/g, '+')
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

function parseFormBody(body) {
  // application/x-www-form-urlencoded → ordered list of [key, value] pairs.
  const out = [];
  for (const pair of String(body).split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const k = decodeURIComponent((eq === -1 ? pair : pair.slice(0, eq)).replace(/\+/g, ' '));
    const v = decodeURIComponent((eq === -1 ? '' : pair.slice(eq + 1)).replace(/\+/g, ' '));
    out.push([k, v]);
  }
  return out;
}

function buildSignString(pairs, passphrase) {
  // PayFast expects params in the order they were SENT, excluding `signature`.
  const filtered = pairs.filter(([k]) => k !== 'signature');
  const enc = filtered.map(([k, v]) => `${k}=${payfastEncode(v)}`).join('&');
  return passphrase ? `${enc}&passphrase=${payfastEncode(passphrase)}` : enc;
}

// Look up the pending row, verify the paid amount matches the tier it was created
// with, then flip status -> active. Throws on any mismatch so the caller can log it
// and leave the listing unpublished.
async function flipRowToActive(listingId, amountGross) {
  const { tab, values: rows } = await getAllValues(SHEET_ID);
  if (!rows.length) throw new Error('Sheet empty');
  const headers = rows[0];
  const idCol = headers.indexOf('id');
  const statusCol = headers.indexOf('status');
  const tierCol = headers.indexOf('tier');
  if (idCol === -1 || statusCol === -1) throw new Error('Missing id/status column');

  let rowIdx = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idCol] === listingId) { rowIdx = i; break; }
  }
  if (rowIdx === -1) throw new Error(`Listing ${listingId} not found`);

  // Verify the gross amount paid matches the tier's price (cents-tolerant).
  const tier = tierCol === -1 ? null : rows[rowIdx][tierCol];
  const expected = tier ? TIER_AMOUNT[tier] : null;
  const paid = Math.round(Number(amountGross) || 0);
  if (expected != null && paid !== expected) {
    throw new Error(`amount mismatch for ${listingId}: tier=${tier} expected R${expected}, paid R${paid}`);
  }

  const a1Cell = `${colLetter(statusCol)}${rowIdx + 1}`;
  await updateCell(SHEET_ID, tab, a1Cell, 'active');
  return { rowIdx, cellA1: `${tab}!${a1Cell}`, tier, paid };
}

function colLetter(idx) {
  let s = ''; let n = idx;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const pairs = parseFormBody(event.body || '');
  const map = Object.fromEntries(pairs);
  const t0 = Date.now();
  console.log('[payfast-itn] received', {
    m_payment_id: map.m_payment_id,
    payment_status: map.payment_status,
    amount_gross: map.amount_gross,
    merchant_id: map.merchant_id,
  });

  // 1. Verify merchant_id matches ours
  if (PAYFAST_MERCHANT_ID && map.merchant_id !== PAYFAST_MERCHANT_ID) {
    console.error('[payfast-itn] merchant_id mismatch:', map.merchant_id);
    return { statusCode: 200, body: 'OK' };
  }

  // 2. Verify signature
  const expectedSig = crypto.createHash('md5')
    .update(buildSignString(pairs, PAYFAST_PASSPHRASE))
    .digest('hex');
  if (expectedSig !== map.signature) {
    console.error('[payfast-itn] signature mismatch. expected:', expectedSig, 'got:', map.signature);
    return { statusCode: 200, body: 'OK' };
  }

  // 3. Verify payment_status
  if (map.payment_status !== 'COMPLETE') {
    console.log('[payfast-itn] payment_status not COMPLETE, ignoring:', map.payment_status);
    return { statusCode: 200, body: 'OK' };
  }

  // 4. Verify amount matches the tier, then flip row to active in the sheet
  try {
    const result = await flipRowToActive(map.m_payment_id, map.amount_gross);
    console.log('[payfast-itn] flipped to active', map.m_payment_id, result.cellA1, `tier=${result.tier} paid=R${result.paid}`, 'in', (Date.now() - t0) + 'ms');
  } catch (err) {
    console.error('[payfast-itn] not activated:', err.message);
    // Still 200 — PayFast retries on non-200 and re-flipping is idempotent anyway.
  }

  return { statusCode: 200, body: 'OK' };
};
