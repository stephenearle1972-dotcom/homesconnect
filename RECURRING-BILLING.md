# HomesConnect — Recurring (monthly subscription) billing

Status: **built on branch `recurring-billing`, OFF in production.** Listings stay once-off
until the live R5/month test below passes and `PAYFAST_RECURRING_ENABLED` is flipped to
`true`.

## The one switch
`PAYFAST_RECURRING_ENABLED` (server env) + `VITE_PAYFAST_RECURRING_ENABLED` (build env).
- **unset / not `true`** → every listing payment is once-off, byte-for-byte as before. UI
  shows no "/month" wording.
- **`true`** → listing tiers are created as real PayFast monthly subscriptions and the UI
  says so honestly.

Set BOTH to `true` together (one is read server-side by the functions, the other is baked
into the front-end bundle at build time so the wording matches reality). Include the
`functions` scope on the server var, and re-trigger a deploy after setting the build var.

## What "monthly" means once the switch is on
- Subscription fields posted to PayFast: `subscription_type=1`, `frequency=3` (monthly),
  `cycles=0` (indefinite — until cancelled), `recurring_amount` = the tier price,
  `billing_date` = today. (`netlify/functions/_lib/payfast.js` → `subscriptionFields`.)
- Tiers: agent Basic R99 / Enhanced R249 / Agency R999; private = single "Private Seller"
  R99, 3-photo cap. All recurring. The **R299 Make an Offer add-on stays once-off** (it has
  no subscription fields and is handled separately via `custom_str1='mao_enable'`).
- **PayFast subscriptions REQUIRE a passphrase** on the merchant account. `PAYFAST_PASSPHRASE`
  must be set in Netlify AND configured on the PayFast dashboard, or both the subscription
  checkout and the cancel API will fail.

## Token storage
The PayFast subscription token (needed to cancel) and the seller's `manage_token` (needed
to authenticate the cancel dashboard) are SECRETS, so they live in the **private,
non-published** sheet (`HOMESCONNECT_PRIVATE_SHEET_ID`) in a new `Subscriptions` tab — never
in the public listings CSV. Provision it once:
```
HOMESCONNECT_PRIVATE_SHEET_ID=... node scripts/create-subscriptions-tab.mjs
```
The token is captured from the FIRST successful payment's ITN. On that first charge the
seller is emailed their private manage/cancel link.

## Cancellation (mandatory — proven to stop billing)
Seller dashboard: `/seller?listing=<id>&manage=<manage_token>` (link emailed on first
charge). Two actions, **Mark as sold** and **Remove listing**, both call
`netlify/functions/listing-cancel.js` which:
1. `PUT https://api.payfast.co.za/subscriptions/{token}/cancel` (the SDK-documented cancel
   endpoint; `?testing=true` in sandbox), signed with the **API signature** (alphabetical
   key sort, passphrase folded in — different from the checkout signature).
2. `GET .../subscriptions/{token}/fetch` immediately after, and returns PayFast's reported
   status back to the dashboard as **proof** the subscription is cancelled.
3. Marks the listing `sold` / `removed` (hidden from site + bot) and the subscription row
   cancelled.

## Failed payment
If a recurring charge ultimately fails, PayFast sends a non-COMPLETE ITN carrying the
subscription token. `payfast-itn.js` then sets the listing `inactive` and emails the seller
a "payment issue — update or cancel" link. It only acts on subscriptions still marked
`active`, so a cancellation echo never triggers a false failure email. (PayFast's exact
failed-charge ITN shape can't be exercised in sandbox — this is the safe interpretation the
spec asked for; confirm the field on the first real failure and tighten if needed.)

## Grandfathering
Existing once-off listings are untouched: no token, no subscription row, never re-charged,
never converted. With the flag off, new listings are also once-off. Only listings created
AFTER the flag is on become subscriptions.

## Offline tests (run now, no gateway needed)
```
node scripts/test-recurring-billing.mjs
```
Proves: subscription fields correct; the subscription **checkout** signature matches an
independent PayFast-faithful reference (gateway will accept it); the **API/cancel**
signature uses the correct (different) alphabetical algorithm; and flag-off carries no
subscription fields. Also `npm run build` (tsc + vite) is clean.

---

# LIVE R5/month test (do this BEFORE switching real sellers to monthly)

Sandbox cannot actually charge a card monthly, so the only true proof is a tiny live test
on the real merchant. ~15 minutes of work + one wait for the first recurring cycle.

**Prep**
1. Confirm `PAYFAST_PASSPHRASE` is set in Netlify (functions scope) and on the PayFast
   dashboard. Run `node scripts/create-subscriptions-tab.mjs` against the private sheet.
2. Temporarily set the tier price you'll test to **R5**. Easiest: deploy the branch to a
   Netlify **preview/deploy context** with `PAYFAST_RECURRING_ENABLED=true` and a one-line
   local override of the Basic amount to `'5.00'` (do NOT ship the R5 override to prod).
   Use your own real card.

**Run**
3. Create a Basic listing through the form and pay the R5 with your real card. Confirm:
   - the listing flips to **active**;
   - the `Subscriptions` tab row gets a non-empty `token` and `status=active`;
   - you receive the "listing is live — manage or cancel" email with a manage link.
4. **Wait for one recurring cycle.** To see it within a day instead of a month, set up this
   one test subscription with `frequency=1` (daily) via a temporary override, or simply wait
   for PayFast's monthly cycle. Confirm a SECOND R5 is charged and the listing stays active
   (`last_billed_at` updates).
5. Open the manage link → **Mark as sold**. Confirm the response shows
   `billing_stopped: true` and `payfast_status` reporting cancelled, the listing goes
   `sold`, and the `Subscriptions` row is `sold` with `cancelled_at` set.
6. **Prove billing stopped:** wait past the next scheduled cycle (or re-run with daily
   frequency) and confirm NO further charge occurs, and PayFast's dashboard shows the
   subscription cancelled. Optionally hit `fetch` again to re-confirm status.

**Roll out**
7. Refund yourself the R5 test charges from the PayFast dashboard, remove the R5/daily
   overrides, restore real prices.
8. Only now: set `PAYFAST_RECURRING_ENABLED=true` + `VITE_PAYFAST_RECURRING_ENABLED=true`
   in production and re-deploy. Existing listings remain once-off; new listings bill monthly.

Until step 8, production stays exactly as it is today: once-off.
