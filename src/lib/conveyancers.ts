import Papa from 'papaparse';
import { CONVEYANCERS_CSV_URL } from './constants';

export type Conveyancer = {
  id: string;
  firmName: string;
  contactName: string;
  regionsServed: string[];
  physicalAddress: string;
  suburb: string;
  city: string;
  province: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  practiceNotes: string;
  logoUrl: string;
  lpcNumber: string;
  status: string;
};

function splitRegions(v: string | undefined): string[] {
  if (!v) return [];
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

function mapRow(row: Record<string, string>): Conveyancer {
  return {
    id: row.id || '',
    firmName: row.firm_name || '',
    contactName: row.contact_name || '',
    regionsServed: splitRegions(row.regions_served),
    physicalAddress: row.physical_address || '',
    suburb: row.suburb || '',
    city: row.city || '',
    province: row.province || '',
    phone: row.phone || '',
    whatsapp: row.whatsapp || '',
    email: row.email || '',
    website: row.website || '',
    practiceNotes: row.practice_notes || '',
    logoUrl: row.logo_url || '',
    lpcNumber: row.lpc_number || '',
    status: row.status || '',
  };
}

let cache: Promise<Conveyancer[]> | null = null;

export function loadConveyancers(): Promise<Conveyancer[]> {
  if (cache) return cache;
  if (!CONVEYANCERS_CSV_URL) {
    cache = Promise.resolve([]);
    return cache;
  }
  cache = (async () => {
    try {
      const res = await fetch(CONVEYANCERS_CSV_URL);
      if (!res.ok) throw new Error(`CSV ${res.status}`);
      const text = await res.text();
      const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
      const rows = (parsed.data || []).filter((r) => r.id);
      // Only approved (active) firms are shown publicly; pending rows stay hidden.
      return rows.map(mapRow).filter((c) => c.status === 'active');
    } catch (err) {
      console.warn('[HomesConnect] Conveyancers CSV load failed:', err);
      return [];
    }
  })();
  return cache;
}
