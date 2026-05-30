// Make an Offer — verify the emailed OTP code. On success returns a verify_token
// that the buyer's final submit must present (proves the mobile was verified).
import { getOtpById, saveOtp, sha256, json, CORS } from './_lib/mao.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body; try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Bad JSON' }); }
  const { challengeId, code } = body;
  if (!challengeId || !code) return json(400, { error: 'Missing code' });

  const otp = await getOtpById(challengeId);
  if (!otp) return json(404, { error: 'Verification not found — please request a new code' });
  if (otp.verified === 'yes') return json(200, { verifyToken: otp.verify_token, phone: otp.phone, email: otp.email });
  if (new Date(otp.expires_at).getTime() < Date.now()) return json(400, { error: 'Code expired — please request a new one' });

  const attempts = Number(otp.attempts || 0);
  if (attempts >= 5) return json(429, { error: 'Too many attempts — please request a new code' });

  if (sha256(String(code).trim()) !== otp.code_hash) {
    otp.attempts = String(attempts + 1);
    await saveOtp(otp);
    return json(400, { error: 'Incorrect code', attemptsLeft: 5 - (attempts + 1) });
  }

  otp.verified = 'yes';
  await saveOtp(otp);
  return json(200, { verifyToken: otp.verify_token, phone: otp.phone, email: otp.email });
};
