// Make an Offer — email the seller their private tokenised offers link ("lost my link").
// Only works once the add-on is enabled (the seller email is captured at enable time).
// Never reveals the email address to the caller.
import { getListingById, getMaoListing, json, CORS, SITE_URL } from './_lib/mao.js';
import { sendEmail } from './_lib/email.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Bad JSON' }); }

  const found = await getListingById(b.listing_id);
  // Generic response either way so we don't leak which listings exist/are enabled.
  const generic = { ok: true, message: 'If this listing has Make an Offer enabled, we have emailed the seller their private link.' };
  if (!found) return json(200, generic);
  const listing = found.listing;
  const mao = await getMaoListing(listing.id);
  if (String(listing.make_an_offer_enabled).toLowerCase() !== 'true' || !mao || !mao.token) return json(200, generic);

  const sellerEmail = (mao.seller_email || '').trim();
  if (sellerEmail) {
    const link = `${SITE_URL}/seller?listing=${encodeURIComponent(listing.id)}&token=${encodeURIComponent(mao.token)}`;
    await sendEmail({
      to: sellerEmail,
      subject: `Your private offers link — ${listing.title}`,
      text: `Here is your private link to review proposed terms for ${listing.title}. Do not share it:\n\n${link}`,
    });
  }
  return json(200, generic);
};
