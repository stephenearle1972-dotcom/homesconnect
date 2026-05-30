// Make an Offer — seller's tokenised view of all proposals for their listing.
// Token-gated (no login). Offers data is returned ONLY here, server-side — never
// via a public CSV. Buyers never call this; each buyer only sees their own confirmation.
import {
  getListingById, getMaoListing, getOffersForListing, parseActionLog, json, CORS,
  NONBINDING_NOTICE, FRAUD_NOTICE,
} from './_lib/mao.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const listingId = event.queryStringParameters?.listing || '';
  const token = event.queryStringParameters?.token || '';
  const found = await getListingById(listingId);
  if (!found) return json(404, { error: 'Listing not found' });
  const listing = found.listing;

  // Token must match the seller token stored in the PRIVATE MaoListings tab.
  const mao = await getMaoListing(listingId);
  if (!mao || !mao.token || token !== mao.token) {
    return json(403, { error: 'Invalid or expired link' });
  }

  let disclosure = null;
  try { disclosure = JSON.parse(mao.disclosure_json || 'null'); } catch {}

  const offers = (await getOffersForListing(listingId)).map((o) => {
    const log = parseActionLog(o.seller_action_log);
    const archived = log.some((e) => e.event === 'archived') && !log.some((e, i) => e.event === 'unarchived' && i > log.findLastIndex?.((x) => x.event === 'archived'));
    let conv = null; try { conv = JSON.parse(o.selected_conveyancer || 'null'); } catch {}
    return {
      id: o.id,
      buyer_name: o.buyer_name,
      buyer_phone: o.buyer_phone_verified,
      buyer_email: o.buyer_email,
      buyer_entity_type: o.buyer_entity_type,
      proposed_price: Number(o.proposed_price) || 0,
      funding_method: o.funding_method,
      bond_amount: Number(o.bond_amount) || 0,
      cash_contribution: Number(o.cash_contribution) || 0,
      deposit_amount: Number(o.deposit_amount) || 0,
      subject_to_sale: o.subject_to_sale === 'yes',
      subject_to_sale_note: o.subject_to_sale_note,
      occupation_date: o.occupation_date,
      proposal_expiry: o.proposal_expiry,
      note_to_seller: o.note_to_seller,
      note_for_conveyancer: o.note_for_conveyancer,
      status: o.status,
      selected_conveyancer: conv,
      consent_share_conveyancer: o.consent_share_conveyancer === 'yes',
      action_log: log,
      archived,
      created_at: o.created_at,
      updated_at: o.updated_at,
    };
  });

  return json(200, {
    listing: {
      id: listing.id, title: listing.title, suburb: listing.suburb, city: listing.city,
      province: listing.province, price_display: listing.price_display, type: listing.type,
      enabled: String(listing.make_an_offer_enabled).toLowerCase() === 'true',
    },
    disclosure,
    offers,
    nonbinding_notice: NONBINDING_NOTICE,
    fraud_notice: FRAUD_NOTICE,
  });
};
