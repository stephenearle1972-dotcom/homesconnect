// Make an Offer — seller acts on a proposal (token-gated, no login).
// Actions: clarification | revision | proceed | decline | archive | unarchive.
// Language discipline: never "accept"/"sold"/"deal". On proceed the seller picks a
// conveyancer (directory / own / later) and gives consent; the buyer is then emailed
// a one-click consent link (handoff pack only sends after BOTH consents — see
// mao-buyer-consent.js).
import {
  getListingById, getMaoListing, getOfferById, saveOffer, parseActionLog, nowIso, json, CORS,
  NONBINDING_NOTICE, SITE_URL, consentToken,
} from './_lib/mao.js';
import { sendEmail } from './_lib/email.js';

const ACTIONS = {
  clarification: 'clarification_requested',
  revision: 'revision_invited',
  proceed: 'proceeding_to_otp',
  decline: 'declined',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Bad JSON' }); }

  const found = await getListingById(b.listing_id);
  if (!found) return json(404, { error: 'Listing not found' });
  const listing = found.listing;
  const mao = await getMaoListing(listing.id);
  if (!mao || !mao.token || b.token !== mao.token) {
    return json(403, { error: 'Invalid or expired link' });
  }
  const offer = await getOfferById(b.offer_id);
  if (!offer || offer.listing_id !== listing.id) return json(404, { error: 'Proposal not found' });

  const action = b.action;
  const log = parseActionLog(offer.seller_action_log);
  const note = String(b.note || '').trim();

  // Archive / unarchive are UI-only markers; status unchanged.
  if (action === 'archive' || action === 'unarchive') {
    log.push({ t: nowIso(), actor: 'seller', event: action, note });
    offer.seller_action_log = JSON.stringify(log);
    offer.updated_at = nowIso();
    await saveOffer(offer);
    return json(200, { ok: true, status: offer.status });
  }

  if (!ACTIONS[action]) return json(400, { error: 'Unknown action' });

  let buyerEmailSubject, buyerEmailBody;

  if (action === 'proceed') {
    const mode = b.conveyancer_mode; // 'directory' | 'own' | 'later'
    if (!['directory', 'own', 'later'].includes(mode)) return json(400, { error: 'Choose how to nominate a conveyancer' });
    if (b.seller_consent_share !== true) return json(400, { error: 'Seller consent to share data with the conveyancer is required' });

    let conv = { mode };
    if (mode !== 'later') {
      const name = String(b.conveyancer_name || '').trim();
      const cemail = String(b.conveyancer_email || '').trim();
      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cemail)) {
        return json(400, { error: 'Enter the conveyancer’s name and a valid email' });
      }
      conv = { mode, name, email: cemail, firm: String(b.conveyancer_firm || '').trim() };
    }
    offer.selected_conveyancer = JSON.stringify(conv);
    offer.status = 'proceeding_to_otp';
    log.push({ t: nowIso(), actor: 'seller', event: 'proceed_to_otp', conveyancer: conv, consent_share_conveyancer: true });
    offer.seller_action_log = JSON.stringify(log);
    offer.updated_at = nowIso();
    await saveOffer(offer);

    // Ask the buyer to consent to sharing with this conveyancer (handoff waits for it).
    if (mode !== 'later') {
      const t = consentToken(offer.id, offer.buyer_email);
      const link = `${SITE_URL}/offer-consent?offer=${encodeURIComponent(offer.id)}&t=${t}`;
      buyerEmailSubject = `The seller wishes to proceed to a formal Offer to Purchase — ${listing.title}`;
      buyerEmailBody = `${NONBINDING_NOTICE}\n\nThe seller wishes to proceed toward a formal Offer to Purchase for ${listing.title} (${listing.id}).\n\n` +
        `To continue, please confirm you consent to your proposed terms and contact details being shared with the seller's chosen conveyancer:\n${link}\n\n` +
        `No sale is binding until a written Offer to Purchase is signed.`;
    } else {
      buyerEmailSubject = `The seller wishes to proceed — ${listing.title}`;
      buyerEmailBody = `${NONBINDING_NOTICE}\n\nThe seller wishes to proceed toward a formal Offer to Purchase for ${listing.title}. ` +
        `They will nominate a conveyancer shortly; you'll be asked to confirm sharing your details at that point.`;
    }
  } else {
    offer.status = ACTIONS[action];
    const eventName = { clarification: 'request_clarification', revision: 'invite_revised_terms', decline: 'decline' }[action];
    log.push({ t: nowIso(), actor: 'seller', event: eventName, note });
    offer.seller_action_log = JSON.stringify(log);
    offer.updated_at = nowIso();
    await saveOffer(offer);

    if (action === 'clarification') {
      buyerEmailSubject = `The seller has a question about your proposed terms — ${listing.title}`;
      buyerEmailBody = `${NONBINDING_NOTICE}\n\nThe seller has requested clarification on your proposed terms for ${listing.title}:\n\n"${note}"\n\nYou can reply by submitting revised proposed terms.`;
    } else if (action === 'revision') {
      buyerEmailSubject = `The seller invites revised terms — ${listing.title}`;
      buyerEmailBody = `${NONBINDING_NOTICE}\n\nThe seller invites you to submit revised proposed terms for ${listing.title}.${note ? `\n\nSeller note: "${note}"` : ''}\n\nVisit the listing to send revised non-binding proposed terms.`;
    } else if (action === 'decline') {
      buyerEmailSubject = `Update on your proposed terms — ${listing.title}`;
      buyerEmailBody = `${NONBINDING_NOTICE}\n\nThank you for your interest in ${listing.title}. The seller has decided not to proceed with your proposed terms at this time.`;
    }
  }

  if (buyerEmailSubject) await sendEmail({ to: offer.buyer_email, subject: buyerEmailSubject, text: buyerEmailBody });
  return json(200, { ok: true, status: offer.status });
};
