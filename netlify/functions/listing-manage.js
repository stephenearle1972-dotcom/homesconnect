// HomesConnect — seller's listing/billing management view (token-gated, no login).
// GET ?listing=<id>&manage=<manage_token>  →  current listing + subscription status.
// The PayFast subscription token and the manage_token itself are NEVER returned to the
// client — only whether billing is active and the headline numbers the seller needs.
import { getListingById, json, CORS } from './_lib/mao.js';
import { getSubByManageToken } from './_lib/subscriptions.js';
import { RECURRING_ENABLED } from './_lib/payfast.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const listingId = event.queryStringParameters?.listing || '';
  const manageToken = event.queryStringParameters?.manage || '';

  const sub = await getSubByManageToken(manageToken);
  if (!sub || sub.listing_id !== listingId) {
    return json(403, { error: 'Invalid or expired link' });
  }

  const found = await getListingById(listingId);
  const listing = found?.listing || null;

  return json(200, {
    recurring_enabled: RECURRING_ENABLED,
    listing: listing ? {
      id: listing.id, title: listing.title, status: listing.status,
      price_display: listing.price_display, suburb: listing.suburb, city: listing.city,
    } : { id: listingId, status: 'unknown' },
    subscription: {
      status: sub.status,                 // pending | active | payment_failed | cancelled | sold | removed
      amount: Number(sub.amount || 0),    // monthly rand amount
      tier: sub.tier,
      billing_active: sub.status === 'active',
      has_payfast_token: !!sub.token,     // false until the first charge confirms it
      last_billed_at: sub.last_billed_at || null,
      cancelled_at: sub.cancelled_at || null,
    },
  });
};
