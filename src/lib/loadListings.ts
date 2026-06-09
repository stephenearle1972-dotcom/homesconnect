import Papa from 'papaparse';
import type { Listing } from './types';
import { CSV_URL } from './constants';
import { SEED_LISTINGS } from './seedListings';

function toBool(v: string | undefined): boolean {
  if (!v) return false;
  const s = v.toString().trim().toLowerCase();
  return s === 'yes' || s === 'true' || s === '1';
}

function toInt(v: string | undefined): number {
  if (!v) return 0;
  const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function mapRow(row: Record<string, string>): Listing {
  return {
    id: row.id || '',
    type: (row.type === 'rent' ? 'rent' : 'sale'),
    status: row.status || 'active',
    tier: (row.tier as Listing['tier']) || 'basic',
    title: row.title || '',
    price: toInt(row.price),
    priceDisplay: row.price_display || row.priceDisplay || '',
    bedrooms: toInt(row.bedrooms),
    bathrooms: toInt(row.bathrooms),
    garage: toInt(row.garage),
    garden: toBool(row.garden),
    pool: toBool(row.pool),
    petFriendly: toBool(row.pet_friendly || row.petFriendly),
    propertyType: row.property_type || row.propertyType || '',
    suburb: row.suburb || '',
    city: row.city || '',
    province: row.province || '',
    description: row.description || '',
    imageUrl: row.imageUrl || row.image_url || '',
    image2: row.image2 || '',
    image3: row.image3 || '',
    agentName: row.agent_name || row.agentName || '',
    agentPhone: row.agent_phone || row.agentPhone || '',
    agentAgency: row.agent_agency || row.agentAgency || '',
    featured: toBool(row.featured),
    dateListed: row.date_listed || row.dateListed || '',
    sellerType: (row.seller_type === 'private' ? 'private' : 'agent'),
    whatsapp: row.whatsapp || '',
    sizeSqm: toInt(row.size_sqm),
    address: row.address || '',
    makeAnOfferEnabled: toBool(row.make_an_offer_enabled),
    // Blank/missing = grandfathered as approved (seed + pre-moderation listings).
    moderation: (row.moderation || '').trim().toLowerCase(),
  };
}

// A listing is publicly visible only if it is active AND its image moderation
// passed. Blank moderation is treated as approved so the existing catalogue and
// any pre-moderation rows are unaffected; only flagged/rejected rows are hidden.
function isPublic(l: Listing): boolean {
  const statusOk = !l.status || l.status === 'active';
  const modOk = !l.moderation || l.moderation === 'approved';
  return statusOk && modOk;
}

let cache: Promise<Listing[]> | null = null;

export function loadListings(): Promise<Listing[]> {
  if (cache) return cache;
  if (!CSV_URL) {
    cache = Promise.resolve(SEED_LISTINGS);
    return cache;
  }
  cache = (async () => {
    try {
      const res = await fetch(CSV_URL);
      if (!res.ok) throw new Error(`CSV ${res.status}`);
      const text = await res.text();
      const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
      const rows = (parsed.data || []).filter((r) => r.id);
      if (!rows.length) return SEED_LISTINGS;
      // Only show fully-active, moderation-approved listings. Pending-payment rows
      // (intake form pre-ITN), archived rows, and flagged/rejected images stay hidden.
      return rows.map(mapRow).filter(isPublic);
    } catch (err) {
      console.warn('[HomesConnect] CSV load failed, using seed data:', err);
      return SEED_LISTINGS;
    }
  })();
  return cache;
}
