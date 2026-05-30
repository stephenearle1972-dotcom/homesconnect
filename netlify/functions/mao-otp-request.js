// Make an Offer — request a mobile-verification OTP.
// Channel: EMAIL (decision: no SMS gateway / WhatsApp template yet). The code is
// emailed; the buyer's mobile number is captured and stored on success.
import crypto from 'node:crypto';
import { createOtp, sha256, genToken, nowIso, json, CORS } from './_lib/mao.js';
import { sendEmail } from './_lib/email.js';

function normalizePhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('27') && d.length === 11) return d;
  if (d.startsWith('0') && d.length === 10) return '27' + d.slice(1);
  return null;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body; try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Bad JSON' }); }
  const phone = normalizePhone(body.phone);
  const email = String(body.email || '').trim();
  if (!phone) return json(400, { error: 'Enter a valid South African mobile number' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: 'Enter a valid email address' });

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const verifyToken = genToken();
  let challengeId;
  try {
    challengeId = await createOtp({ phone, email, codeHash: sha256(code), expiresAt, verifyToken });
  } catch (err) {
    console.error('[mao-otp-request] store failed:', err.message);
    return json(500, { error: 'Could not start verification. Please try again.' });
  }

  const sent = await sendEmail({
    to: email,
    subject: 'Your HomesConnect verification code',
    text: `Your HomesConnect verification code is ${code}.\n\nIt expires in 10 minutes. ` +
      `Enter it to verify the mobile number ${phone} and continue submitting your non-binding proposed terms.\n\n` +
      `If you did not request this, ignore this email.`,
  });

  // Email is the reliable channel; if it failed, surface it so the buyer can retry.
  if (!sent.ok) return json(502, { error: 'Could not send the code by email. Please check the address and try again.' });
  return json(200, { challengeId, sentTo: email, at: nowIso() });
};
