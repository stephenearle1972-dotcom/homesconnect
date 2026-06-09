// HomesConnect — PayFast ITN webhook.
// Validates the ITN, then flips the listing row in the Google Sheet from
// status="pending_payment" to status="active".

import { getAllValues, getTabValues, updateCell } from './_lib/sheets.js';
import { sendEmail } from './_lib/email.js';
import { getMaoListing, COMPANY, ADDON, SITE_URL, maoAllowed } from './_lib/mao.js';
import { PAYFAST, signPairs } from './_lib/payfast.js';

const SHEET_ID = process.env.HOMESCONNECT_SHEET_ID;
// Deploy-context data isolation: sandbox/preview deploys read + activate listings in
// HOMESCONNECT_LISTINGS_TAB; unset (production) → first tab (original behaviour).
const LISTINGS_TAB = process.env.HOMESCONNECT_LISTINGS_TAB || '';
// Where the "new listing" business notification goes. Overridable in Netlify without
// a code change; defaults to the operator inbox.
const NOTIFY_EMAIL = process.env.HOMESCONNECT_NOTIFY_EMAIL || 'hello@townconnect.co.za';

// Resolve the listings tab + its rows. Mirrors getAllValues' {tab, values} shape so
// callers can pass `tab` straight to updateCell.
async function readListings(range = 'A1:Z2000') {
  if (LISTINGS_TAB) return { tab: LISTINGS_TAB, values: await getTabValues(SHEET_ID, LISTINGS_TAB, range) };
  return getAllValues(SHEET_ID, range);
}

const TIER_AMOUNT = { basic: 99, enhanced: 249, agency: 999 };
// "Make an Offer" add-on once-off fee (custom_str1 === 'mao_enable').
const MAO_ADDON_AMOUNT = Math.round(Number(process.env.MAO_ADDON_AMOUNT || '299') || 299);

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

// Look up the pending row, verify the paid amount matches the tier it was created
// with, then flip status -> active. Throws on any mismatch so the caller can log it
// and leave the listing unpublished.
async function flipRowToActive(listingId, amountGross) {
  // Read past column Z so the record includes agent_email (AG) etc. for the emails.
  const { tab, values: rows } = await readListings('A1:AZ2000');
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
  // Build a header->value record of the activated row for the notification emails.
  const record = {};
  headers.forEach((h, i) => { record[h] = rows[rowIdx][i] || ''; });
  return { rowIdx, cellA1: `${tab}!${a1Cell}`, tier, paid, record };
}

// Best-effort notification emails sent AFTER a listing is activated. Two emails:
//  1) business notification to the operator, 2) confirmation to the lister.
// Never throws — a mail hiccup must not roll back a paid, activated listing.
async function sendListingEmails(listingId, record, itnMap, paid) {
  const r = record || {};
  const listerEmail = (r.agent_email || itnMap.email_address || '').trim();
  const name = r.agent_name || [itnMap.name_first, itnMap.name_last].filter(Boolean).join(' ') || 'the lister';
  const location = [r.suburb, r.city, r.province].filter(Boolean).join(', ');
  const price = r.price_display || (r.price ? `R ${Number(r.price).toLocaleString('en-ZA')}` : `R ${paid}`);
  // Blank moderation = grandfathered approved. Only 'flagged' holds the listing.
  const isFlagged = (r.moderation || '').trim().toLowerCase() === 'flagged';
  const images = [r.imageUrl, r.image2, r.image3].filter(Boolean);

  // 1) Operator email. Two shapes share the listing facts below:
  //    - approved → "now live" notification
  //    - flagged  → "HELD FOR REVIEW" alert with image URLs + approve/reject steps
  const factLines = [
    `Reference:     ${listingId}`,
    `Tier:          ${r.tier || ''}`,
    `Type:          ${r.type === 'rent' ? 'To Let' : 'For Sale'}`,
    `Property type: ${r.property_type || ''}`,
    `Location:      ${location}`,
    `Bedrooms:      ${r.bedrooms || '0'}`,
    `Bathrooms:     ${r.bathrooms || '0'}`,
    `Garages:       ${r.garage || '0'}`,
    `Price:         ${price}`,
    ``,
    `Listed by:     ${name}`,
    `Phone:         ${r.agent_phone || itnMap.cell_number || ''}`,
    `Email:         ${listerEmail || '(not provided)'}`,
    r.seller_type ? `Seller type:   ${r.seller_type}` : ``,
    ``,
    `Title: ${r.title || ''}`,
  ].filter((l) => l !== undefined);

  let bizSubject;
  let bizLines;
  if (isFlagged) {
    bizSubject = `⚠️ HomesConnect listing HELD for review — ${listingId}`;
    bizLines = [
      `A paid HomesConnect listing has been HELD because its image(s) were flagged by`,
      `automated moderation. It is NOT visible on the website or WhatsApp bot.`,
      ``,
      `Please review the image(s) below and decide:`,
      `  • To PUBLISH it: open the listings sheet, find row ${listingId}, and set the`,
      `    "moderation" cell to:  approved`,
      `  • To KILL it: set the "moderation" cell to:  rejected`,
      `(Either change takes effect on the next site/bot refresh — no redeploy needed.)`,
      ``,
      `Image(s) to review:`,
      ...(images.length ? images.map((u, i) => `  ${i + 1}. ${u}`) : ['  (no images on the listing)']),
      ``,
      `— Listing details —`,
      ...factLines,
    ];
  } else {
    bizSubject = `New HomesConnect listing — ${listingId}`;
    bizLines = [
      `A new HomesConnect listing has been paid and is now live.`,
      ``,
      ...factLines,
    ];
  }
  const biz = await sendEmail({
    to: NOTIFY_EMAIL,
    subject: bizSubject,
    text: bizLines.join('\n'),
    replyTo: listerEmail || undefined,
  });
  if (!biz.ok) console.error('[payfast-itn] operator email failed:', biz.error);

  // 2) Lister confirmation
  if (listerEmail) {
    const firstName = (name || '').split(' ')[0] || 'there';
    const confLines = [
      `Hi ${firstName},`,
      ``,
      `Thank you — your HomesConnect listing has been received and your payment confirmed.`,
      ``,
      `Listing reference: ${listingId}`,
      r.title ? `Property: ${r.title}` : ``,
      location ? `Location: ${location}` : ``,
      ``,
      `Your listing will appear on the HomesConnect website and WhatsApp bot within 48 hours.`,
      `If anything needs changing, reply to this email and we'll help.`,
      ``,
      `Kind regards,`,
      `The HomesConnect team`,
      `${COMPANY.website}`,
    ].filter((l) => l !== undefined);
    const conf = await sendEmail({
      to: listerEmail,
      subject: `Your HomesConnect listing has been submitted — ${listingId}`,
      text: confLines.join('\n'),
    });
    if (!conf.ok) console.error('[payfast-itn] lister confirmation failed:', conf.error);
  } else {
    console.warn('[payfast-itn] no lister email for', listingId, '— confirmation skipped');
  }
}

// ECTA transaction record: email the seller a tax-invoice-style record of the add-on.
async function emailInvoice(listingId, amountGross, pfPaymentId) {
  const mao = await getMaoListing(listingId);
  const to = mao && mao.seller_email;
  if (!to) return;
  const amt = Number(amountGross) || 0;
  const ex = (amt / 1.15);
  const vat = amt - ex;
  const invNo = `HC-MAO-${listingId}-${pfPaymentId || ''}`.slice(0, 40);
  const lines = [
    `${COMPANY.name}`,
    `Company reg: ${COMPANY.reg}`,
    `${COMPANY.address}`,
    `Tel: ${COMPANY.phone}  ·  ${COMPANY.email}  ·  ${COMPANY.website}`,
    ``,
    `INVOICE / TRANSACTION RECORD`,
    `Invoice no: ${invNo}`,
    `PayFast payment id: ${pfPaymentId || '-'}`,
    ``,
    `Item: ${ADDON.name} — listing ${listingId}`,
    `Amount (incl. VAT): R ${amt.toFixed(2)}`,
    `  VAT (15%, if applicable): R ${vat.toFixed(2)}`,
    `  Excl. VAT: R ${ex.toFixed(2)}`,
    `Duration: ${ADDON.duration}`,
    ``,
    `Included: ${ADDON.includes.join('; ')}.`,
    `Excluded: ${ADDON.excludes.join('; ')}.`,
    `Refunds: ${ADDON.refund}`,
    `Access your transaction record + proposals via your private seller link emailed to you (or request it at ${COMPANY.email}).`,
    ``,
    `HomesConnect does not act as your estate agent, negotiate on your behalf, recommend terms, hold deposits, or earn commission.`,
  ];
  await sendEmail({ to, subject: `Invoice — ${ADDON.name} (${listingId})`, text: lines.join('\n') });
}

// "Make an Offer" add-on: verify the add-on amount, then set make_an_offer_enabled=true.
async function enableMakeAnOffer(listingId, amountGross) {
  // Public gate: never enable a real listing while gated (even on a valid ITN).
  if (!maoAllowed(listingId)) throw new Error(`make_an_offer gated — not enabling ${listingId}`);
  const { tab, values: rows } = await readListings('A1:AZ5000');
  if (!rows.length) throw new Error('Sheet empty');
  const headers = rows[0];
  const idCol = headers.indexOf('id');
  const enCol = headers.indexOf('make_an_offer_enabled');
  const atCol = headers.indexOf('make_an_offer_enabled_at');
  if (idCol === -1 || enCol === -1) throw new Error('Missing id/make_an_offer_enabled column');

  let rowIdx = -1;
  for (let i = 1; i < rows.length; i++) { if (rows[i][idCol] === listingId) { rowIdx = i; break; } }
  if (rowIdx === -1) throw new Error(`Listing ${listingId} not found`);

  const paid = Math.round(Number(amountGross) || 0);
  if (paid !== MAO_ADDON_AMOUNT) throw new Error(`add-on amount mismatch for ${listingId}: expected R${MAO_ADDON_AMOUNT}, paid R${paid}`);

  await updateCell(SHEET_ID, tab, `${colLetter(enCol)}${rowIdx + 1}`, 'true');
  if (atCol !== -1) await updateCell(SHEET_ID, tab, `${colLetter(atCol)}${rowIdx + 1}`, new Date().toISOString());
  return { paid };
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

  // 1. Verify merchant_id matches ours (live or sandbox, per PAYFAST_MODE)
  if (PAYFAST.merchantId && map.merchant_id !== PAYFAST.merchantId) {
    console.error('[payfast-itn] merchant_id mismatch:', map.merchant_id);
    return { statusCode: 200, body: 'OK' };
  }

  // 2. Verify signature (insertion order, passphrase appended only if configured)
  const expectedSig = signPairs(pairs, PAYFAST.passphrase);
  if (expectedSig !== map.signature) {
    console.error('[payfast-itn] signature mismatch. expected:', expectedSig, 'got:', map.signature);
    return { statusCode: 200, body: 'OK' };
  }

  // 3. Verify payment_status
  if (map.payment_status !== 'COMPLETE') {
    console.log('[payfast-itn] payment_status not COMPLETE, ignoring:', map.payment_status);
    return { statusCode: 200, body: 'OK' };
  }

  // 4. Apply the payment. Two payment types share this ITN:
  //    - custom_str1='mao_enable' → enable the Make an Offer add-on on the listing
  //    - otherwise → activate a newly-paid listing (verify amount matches the tier)
  try {
    if (map.custom_str1 === 'mao_enable') {
      const r = await enableMakeAnOffer(map.m_payment_id, map.amount_gross);
      console.log('[payfast-itn] make_an_offer enabled', map.m_payment_id, `paid=R${r.paid}`, 'in', (Date.now() - t0) + 'ms');
      // ECTA: issue an invoice / transaction record to the seller (best-effort).
      try { await emailInvoice(map.m_payment_id, map.amount_gross, map.pf_payment_id); }
      catch (e) { console.error('[payfast-itn] invoice email failed:', e.message); }
    } else {
      const result = await flipRowToActive(map.m_payment_id, map.amount_gross);
      console.log('[payfast-itn] flipped to active', map.m_payment_id, result.cellA1, `tier=${result.tier} paid=R${result.paid}`, 'in', (Date.now() - t0) + 'ms');
      // Notify the business + confirm to the lister. Best-effort: a mail failure must
      // never undo the activation above.
      try { await sendListingEmails(map.m_payment_id, result.record, map, result.paid); }
      catch (e) { console.error('[payfast-itn] listing emails failed:', e.message); }
    }
  } catch (err) {
    console.error('[payfast-itn] not applied:', err.message);
    // Still 200 — PayFast retries on non-200 and re-applying is idempotent anyway.
  }

  return { statusCode: 200, body: 'OK' };
};
