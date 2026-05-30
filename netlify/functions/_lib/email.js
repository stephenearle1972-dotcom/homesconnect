// Generalised transactional email sender for HomesConnect (Make an Offer).
// Uses the TownConnect SMTP mailbox (same creds as vaalwaterconnect's helper),
// but unlike that helper this one sends to arbitrary recipients.
// NEVER put banking details in any email body (fraud-control policy).
import nodemailer from 'nodemailer';

const FROM = '"HomesConnect (TownConnect)" <hello@townconnect.co.za>';

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: 'mail.townconnect.co.za',
    port: 465,
    secure: true,
    auth: { user: 'hello@townconnect.co.za', pass: process.env.NOTIFY_EMAIL_PASS },
  });
  return transporter;
}

// Returns { ok: true } on success, { ok: false, error } on failure — callers
// should treat email as best-effort and never fail the whole request on it.
export async function sendEmail({ to, subject, text, html, replyTo, bcc }) {
  if (!process.env.NOTIFY_EMAIL_PASS) {
    console.warn('[email] NOTIFY_EMAIL_PASS not set — skipping send to', to);
    return { ok: false, error: 'email_not_configured' };
  }
  try {
    await getTransporter().sendMail({
      from: FROM,
      to,
      bcc: bcc || 'hello@townconnect.co.za', // keep a copy for the operator
      replyTo,
      subject,
      text,
      html: html || undefined,
    });
    return { ok: true };
  } catch (err) {
    console.error('[email] send failed to', to, '-', err.message);
    return { ok: false, error: err.message };
  }
}
