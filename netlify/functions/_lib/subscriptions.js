// HomesConnect — recurring-billing subscription store.
//
// Holds the PayFast subscription token (used to CANCEL billing) and the seller's
// private manage_token (used to authenticate the cancel/billing dashboard). Both are
// secrets, so this tab lives in the PRIVATE, NON-published sheet (HOMESCONNECT_PRIVATE_SHEET_ID)
// — exactly like MaoListings. The public listings CSV only ever exposes `status` and
// `billing_mode`, never a token.
//
// One row per listing that has (or had) a subscription.
import { getTabValues, appendRowToTab, updateValues } from './sheets.js';
import { PRIVATE_SHEET_ID, nowIso, genToken, colLetter } from './mao.js';

export const SUBS_TAB = 'Subscriptions';

// status: pending  -> created, awaiting the first ITN that returns the token
//         active   -> token captured, monthly billing live
//         payment_failed -> a recurring charge ultimately failed (listing set inactive)
//         cancelled / sold / removed -> seller stopped billing via the dashboard
export const SUBS_COLS = [
  'listing_id', 'token', 'manage_token', 'seller_email', 'seller_name',
  'tier', 'amount', 'status', 'created_at', 'updated_at',
  'last_billed_at', 'cancelled_at', 'last_event',
];

function toObjects(values) {
  const headers = values[0] || SUBS_COLS;
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row || !row[0]) continue;
    const obj = { _row: i + 1 };
    headers.forEach((h, j) => { obj[h] = row[j] != null ? row[j] : ''; });
    out.push(obj);
  }
  return out;
}

export async function getSubByListingId(listingId) {
  if (!listingId) return null;
  const values = await getTabValues(PRIVATE_SHEET_ID, SUBS_TAB);
  return toObjects(values).find((r) => r.listing_id === listingId) || null;
}

export async function getSubByManageToken(token) {
  if (!token) return null;
  const values = await getTabValues(PRIVATE_SHEET_ID, SUBS_TAB);
  return toObjects(values).find((r) => r.manage_token && r.manage_token === token) || null;
}

// Create or update the subscription row for a listing. Returns the merged record.
export async function upsertSub(listingId, fields) {
  const existing = await getSubByListingId(listingId);
  if (existing) {
    const merged = { ...existing, ...fields, listing_id: listingId, updated_at: nowIso() };
    const last = colLetter(SUBS_COLS.length - 1);
    await updateValues(
      PRIVATE_SHEET_ID,
      `${SUBS_TAB}!A${existing._row}:${last}${existing._row}`,
      [SUBS_COLS.map((c) => (merged[c] != null ? merged[c] : ''))],
    );
    return merged;
  }
  const obj = {
    listing_id: listingId,
    token: '', manage_token: genToken(), seller_email: '', seller_name: '',
    tier: '', amount: '', status: 'pending',
    created_at: nowIso(), updated_at: nowIso(),
    last_billed_at: '', cancelled_at: '', last_event: '',
    ...fields,
  };
  await appendRowToTab(PRIVATE_SHEET_ID, SUBS_TAB, SUBS_COLS.map((c) => (obj[c] != null ? obj[c] : '')));
  return obj;
}
