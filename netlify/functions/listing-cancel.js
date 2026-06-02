// HomesConnect — seller cancels recurring billing (token-gated, no login).
// POST { listing_id, token (manage_token), action: 'sold' | 'remove' }
//
// MANDATORY GUARDRAIL: either action must (1) call PayFast's cancel-subscription API so
// NO further monthly charge is taken, and (2) take the listing down. We then fetch the
// subscription back from PayFast and return its status as PROOF that billing stopped.
import { getListingById, updateListingFields, json, CORS, SITE_URL, nowIso, COMPANY } from './_lib/mao.js';
import { getSubByManageToken, upsertSub } from './_lib/subscriptions.js';
import { cancelSubscription, fetchSubscription } from './_lib/payfast.js';
import { sendEmail } from './_lib/email.js';

// Pull a human-readable status out of PayFast's fetch response (shape varies by gateway
// version — we surface whatever we can find so the seller/live-test sees real proof).
function readPfStatus(f) {
  if (!f) return null;
  const d = f.data?.response ?? f.data ?? f;
  const s = d?.status_text ?? d?.status ?? f.status ?? null;
  return s != null ? String(s) : null;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Bad JSON' }); }

  const action = b.action === 'sold' ? 'sold' : b.action === 'remove' ? 'remove' : null;
  if (!action) return json(400, { error: 'action must be "sold" or "remove"' });

  const sub = await getSubByManageToken(b.token);
  if (!sub || sub.listing_id !== b.listing_id) return json(403, { error: 'Invalid or expired link' });

  // 1. Stop billing at PayFast (only if a subscription token has been captured — it is
  //    set on the first successful charge). Cancelling an already-cancelled token is
  //    treated as success.
  let billingStopped = false;
  let cancelError = null;
  let payfastStatus = null;
  if (sub.token) {
    try {
      await cancelSubscription(sub.token);
      billingStopped = true;
    } catch (e) {
      cancelError = e.message;
      console.error('[listing-cancel] PayFast cancel error:', e.message);
    }
    // 2. PROOF: fetch the subscription and report its status back.
    try { payfastStatus = readPfStatus(await fetchSubscription(sub.token)); }
    catch (e) { console.error('[listing-cancel] fetch-for-proof failed:', e.message); }
  } else {
    // No token yet (first charge not seen) — there is no live billing to stop, but we
    // still take the listing down and mark the subscription cancelled so the upcoming
    // first charge's ITN will be ignored (status !== 'active').
    billingStopped = true;
  }

  // 3. Update the private subscription record.
  await upsertSub(sub.listing_id, {
    status: action === 'sold' ? 'sold' : 'removed',
    cancelled_at: nowIso(),
    last_event: `seller_${action}${cancelError ? '_cancel_api_error' : ''}`,
  });

  // 4. Take the public listing down (both states are hidden from site + bot).
  const newListingStatus = action === 'sold' ? 'sold' : 'removed';
  try {
    const found = await getListingById(sub.listing_id);
    if (found) await updateListingFields(found.listing._row, found.headers, { status: newListingStatus });
  } catch (e) {
    console.error('[listing-cancel] could not update listing status:', e.message);
  }

  // 5. Confirm to the seller (best-effort).
  if (sub.seller_email) {
    const lines = [
      action === 'sold'
        ? `Congratulations on the sale! Your HomesConnect listing has been marked as sold.`
        : `Your HomesConnect listing has been removed.`,
      ``,
      sub.token
        ? `Your monthly subscription has been cancelled — no further payments will be taken.`
        : `No active billing was running, so nothing further will be charged.`,
      ``,
      `${COMPANY.name} · ${COMPANY.email}`,
    ];
    try { await sendEmail({ to: sub.seller_email, subject: `HomesConnect — billing cancelled (${action})`, text: lines.join('\n') }); }
    catch (e) { console.error('[listing-cancel] confirm email failed:', e.message); }
  }

  return json(200, {
    ok: true,
    action,
    listing_status: newListingStatus,
    billing_stopped: billingStopped,
    had_payfast_subscription: !!sub.token,
    payfast_status: payfastStatus, // e.g. "cancelled" — proof from PayFast's own records
    cancel_error: cancelError,
  });
};
