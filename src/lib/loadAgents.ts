import Papa from 'papaparse';
import type { Agent } from './types';
import { AGENTS_CSV_URL } from './constants';

function mapRow(row: Record<string, string>): Agent {
  return {
    agentName: row.agent_name || '',
    photoUrl: row.photo_url || '',
    agencyLogoWhiteUrl: row.agency_logo_white_url || '',
    agencyLogoColourUrl: row.agency_logo_colour_url || '',
    email: row.email || '',
    jobTitle: row.job_title || '',
    bio: row.bio || '',
  };
}

let cache: Promise<Agent[]> | null = null;

// Purely additive data source. On any failure, resolves to [] rather than
// throwing — AgentPage already renders fully from listing data alone, so a
// missing/broken Agents tab must never break the page, just leave it
// without a photo/logo.
export function loadAgents(): Promise<Agent[]> {
  if (cache) return cache;
  if (!AGENTS_CSV_URL) {
    cache = Promise.resolve([]);
    return cache;
  }
  cache = (async () => {
    try {
      const res = await fetch(AGENTS_CSV_URL);
      if (!res.ok) throw new Error(`Agents CSV ${res.status}`);
      const text = await res.text();
      const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
      const rows = (parsed.data || []).filter((r) => r.agent_name);
      return rows.map(mapRow);
    } catch (err) {
      console.warn('[HomesConnect] Agents CSV load failed, agent pages will render without photos/logos:', err);
      return [];
    }
  })();
  return cache;
}

// Join rule: trim + lowercase, nothing fuzzier. Never guess a near-miss —
// see scripts/check-agents-join.mjs for surfacing those instead.
export function findAgent(agents: Agent[], agentName: string): Agent | undefined {
  const n = agentName.trim().toLowerCase();
  if (!n) return undefined;
  return agents.find((a) => a.agentName.trim().toLowerCase() === n);
}
