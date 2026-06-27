// HomesConnect — shared "instant agent alert" email helper.
// One clean, consistent format for every business-initiated agent notification.
// Wraps the repo's existing _lib/email.js sendEmail() (TownConnect SMTP).
//
// Phase 1 callers (instant alerts only): bot_connect_request (CONNECT flow,
// vaalwaterconnect handler) and enquiry (web enquiry form). Aggregated events
// (contact_click / web_view / web_search / bot_appearance) do NOT email — they
// feed the Phase 2 daily pulse + weekly digest.
//
// Duplicated with an identical interface + output in vaalwaterconnect at
// netlify/functions/utils/agentAlert.js (which wraps that repo's _email-helper).
//
// All sends are best-effort: an email failure must never break the caller, and
// is logged as [alert-email-fail] with the event/subject.

import { sendEmail } from './email.js';

const FALLBACK_EMAIL = 'hello@townconnect.co.za';

function isValidEmail(e) {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
}
function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function sendAgentAlertEmail({ agentEmail, agentName, subject, lines }) {
  const valid = isValidEmail(agentEmail);
  const to = valid ? agentEmail.trim() : FALLBACK_EMAIL;
  const finalSubject = valid ? subject : `[NO AGENT EMAIL] ${subject}`;
  const firstName = (agentName || '').trim().split(/\s+/)[0] || 'there';
  const bodyLines = Array.isArray(lines) ? lines : [];

  const text = [
    `Hi ${firstName},`,
    '',
    ...bodyLines,
    '',
    'You are receiving this because you have listings on HomesConnect.',
    '— The HomesConnect Team',
  ].join('\n');

  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1a1a1a;line-height:1.55">` +
    `<p>Hi ${escapeHtml(firstName)},</p>` +
    bodyLines.map((l) => (l === '' ? '' : `<p style="margin:8px 0">${escapeHtml(l)}</p>`)).join('') +
    `<hr style="border:none;border-top:1px solid #dddddd;margin:20px 0">` +
    `<p style="font-size:12px;color:#777777">You are receiving this because you have listings on HomesConnect.<br>— The HomesConnect Team</p>` +
    `</div>`;

  try {
    const res = await sendEmail({ to, subject: finalSubject, text, html });
    if (!res.ok) console.error('[alert-email-fail]', finalSubject, '-', res.error);
    return res;
  } catch (err) {
    console.error('[alert-email-fail]', finalSubject, '-', err.message);
    return { ok: false, error: err.message };
  }
}
