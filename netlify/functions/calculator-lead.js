// HomesConnect — property calculator "email me this estimate" lead handler.
//   POST { name, email, consent:true, buyerAlertsOptIn?, calcType, headlineLabel,
//          headlineValue, emailLines?, budget?, sid? }
//
// Reuses the same building blocks as the listing enquiry pipeline
// (logHcEvent + sendEmail) rather than the /enquiry endpoint itself — that
// endpoint requires a listing ref and a phone number, neither of which apply
// to a calculator lead (no listing, email not phone).
//
// Data minimisation (Stephen's instruction, on top of the brief): gross
// income, monthly expenses and existing debt repayments must NEVER be stored,
// logged or transmitted past the browser. This endpoint never receives them —
// the client only ever sends derived results — and the event row logged here
// is restricted to name, email, consent flags, calculator type, the headline
// output figure, `budget` (purchase price only — for Buyer Alerts matching)
// and `email_status`. `emailLines` is used ONLY to compose the estimate email
// and is never written to the events sheet.

import { logHcEvent } from './_lib/hcEvents.js';
import { sendEmail } from './_lib/email.js';
import { PRIME_RATE } from '../../src/config/propertyRates.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CALC_LABELS = {
  'bond-repayment': 'Bond Repayment estimate',
  affordability: 'Affordability estimate',
  'cost-of-buying': 'Cost of Buying estimate',
};

function bad(status, body) {
  return { statusCode: status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
function ok(body) {
  return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
function isValidEmail(e) {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return bad(405, { error: 'Method not allowed' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return bad(400, { error: 'Bad JSON' });
  }

  const name = String(body.name || '').trim().slice(0, 120);
  const email = String(body.email || '').trim().slice(0, 200);
  const consent = body.consent === true;
  const buyerAlertsOptIn = body.buyerAlertsOptIn === true;
  const calcType = Object.prototype.hasOwnProperty.call(CALC_LABELS, body.calcType) ? body.calcType : '';
  const headlineLabel = String(body.headlineLabel || '').trim().slice(0, 120);
  const headlineValue = String(body.headlineValue || '').trim().slice(0, 120);
  // Budget: purchase price only (Bond Repayment / Cost of Buying pass the
  // entered price, Affordability passes its calculated max purchase price).
  // Income, expenses and debt are never part of this payload — the client
  // never sends them to this endpoint at all.
  const budget = Math.max(0, Math.round(Number(body.budget) || 0));
  // Email-body-only fields — never logged (see file header).
  const emailLines = Array.isArray(body.emailLines)
    ? body.emailLines.map((l) => String(l).slice(0, 300)).slice(0, 40)
    : [];
  const sid = String(body.sid || '').trim() || 'anon';

  if (!name) return bad(400, { error: 'Name is required' });
  if (!isValidEmail(email)) return bad(400, { error: 'A valid email is required' });
  if (!consent) return bad(400, { error: 'Consent is required' });
  if (!calcType) return bad(400, { error: 'Unknown calculator type' });

  // 1. Email the estimate to the buyer FIRST — we need to know whether it
  //    succeeded before writing the sheet row, so the row (the channel that
  //    doesn't fail silently) can record the outcome of the one that can.
  //    bcc:null suppresses the usual operator copy — this email may carry
  //    non-sensitive assumptions the buyer only consented to receive
  //    themselves, not to forward internally.
  const label = CALC_LABELS[calcType] || 'Property estimate';
  const firstName = name.split(/\s+/)[0] || 'there';
  const sentDate = new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' });
  const text = [
    `Hi ${firstName},`,
    '',
    `Here is the ${label} you requested from HomesConnect:`,
    '',
    ...emailLines,
    '',
    'These figures are estimates for general information only. They are not a quotation, an offer of credit, a ' +
      'pre-approval, or an affordability assessment as contemplated in the National Credit Act 34 of 2005. No ' +
      'financial or credit advice is given or intended. Confirm all figures with your bank and conveyancer before ' +
      'making any offer or financial commitment.',
    '',
    `Figures calculated on ${sentDate} at a prime lending rate of ${PRIME_RATE}%. Rates, SARS thresholds and fees ` +
      'change from time to time.',
    '',
    'Browse listings on HomesConnect: https://homesconnect.co.za/listings',
    '',
    '— The HomesConnect Team',
  ].join('\n');

  let emailSent = false;
  try {
    const res = await sendEmail({ to: email, subject: `Your ${label} from HomesConnect`, text, bcc: null });
    emailSent = !!res.ok;
    if (!res.ok) console.error('[alert-email-fail] calculator-lead -', res.error);
  } catch (err) {
    console.error('[alert-email-fail] calculator-lead -', err.message);
  }

  // 2. Primary record — data-minimised, see file header. Best-effort. Now
  //    carries email_status so a silent send failure is never actually silent.
  await logHcEvent({
    event_type: 'calculator_lead',
    channel: 'web',
    listing_ref: '',
    agent_id: '',
    query_text: calcType,
    session_hash: sid,
    meta: {
      name,
      email,
      consent,
      buyerAlertsOptIn,
      calcType,
      headlineLabel,
      headlineValue,
      budget,
      email_status: emailSent ? 'sent' : 'failed',
    },
  });

  return ok({ ok: true, emailSent });
};
