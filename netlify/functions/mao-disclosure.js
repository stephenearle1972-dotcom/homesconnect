// Make an Offer — return the seller's property-condition disclosure record to a
// prospective buyer BEFORE they submit (legal review #1). Returns ONLY the condition
// fields + seller display name. NEVER returns the seller email, token, or any PII.
import { getListingById, isPrivateEnabled, getMaoListing, json, CORS } from './_lib/mao.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const listingId = event.queryStringParameters?.listing || '';
  const found = await getListingById(listingId);
  if (!found || !isPrivateEnabled(found.listing)) {
    return json(404, { error: 'No disclosure available for this listing' });
  }
  const mao = await getMaoListing(listingId);
  let d = null; try { d = JSON.parse((mao && mao.disclosure_json) || 'null'); } catch {}
  const c = (d && d.condition) || {};

  return json(200, {
    listing: { id: found.listing.id, title: found.listing.title, suburb: found.listing.suburb, city: found.listing.city },
    seller_name: (d && d.sellerName) || 'The seller',
    disclosure: {
      occupancy: c.occupancy || '',
      known_defects: c.known_defects || '',
      additions_approved: c.additions_approved || '',
      notes: c.notes || '',
    },
    disclosed_complete: !!(d && d.declarations && d.declarations.disclosure_complete),
    disclosed_at: (d && d.at) || '',
  });
};
