import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { loadListings } from '../lib/loadListings';
import { loadAgents, findAgent } from '../lib/loadAgents';
import type { Listing, Agent } from '../lib/types';
import ListingCard from '../components/ListingCard';
import { toSlug, normalizeWaNumber, formatPhone } from '../lib/slug';

// Same fallback background used behind property photos in ListingCard.tsx —
// replicated here (not imported, it isn't exported) so a missing/broken
// photo or logo degrades the same way everywhere on the site.
const FALLBACK_BG = 'linear-gradient(135deg,#1e3428,#0d1b12)';

export default function AgentPage() {
  const { slug } = useParams();
  const [agent, setAgent] = useState<{ name: string; agency: string; phone: string } | null | undefined>(undefined);
  const [agentListings, setAgentListings] = useState<Listing[]>([]);
  const [agentAssets, setAgentAssets] = useState<Agent | undefined>(undefined);

  useEffect(() => {
    Promise.all([loadListings(), loadAgents()]).then(([all, agents]) => {
      const match = all.find((l) => toSlug(l.agentName) === slug);
      if (!match) { setAgent(null); return; }
      setAgent({ name: match.agentName, agency: match.agentAgency, phone: match.agentPhone });
      setAgentListings(all.filter((l) => toSlug(l.agentName) === slug));
      // Purely additive — findAgent() returns undefined on no match, and
      // every render below already treats agentAssets fields as optional.
      setAgentAssets(findAgent(agents, match.agentName));
    });
  }, [slug]);

  if (agent === undefined) {
    return <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 text-soft">Loading…</div>;
  }
  if (agent === null) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-16">
        <p className="font-display text-3xl text-white">Agent not found</p>
        <Link to="/listings" className="mt-4 inline-block text-teal-bright">← Browse all listings</Link>
      </div>
    );
  }

  const wa = agent.phone ? `https://wa.me/${normalizeWaNumber(agent.phone)}` : '';

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16">
      <Link to="/listings" className="text-sm text-soft hover:text-white">← Back to listings</Link>

      <div className="mt-6 card-soft rounded-2xl p-8 md:p-10 grid gap-6 md:grid-cols-[1fr,auto] items-start">
        <div className="flex items-start gap-5">
          <div
            className="relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden shrink-0"
            style={{ background: FALLBACK_BG }}
          >
            {agentAssets?.photoUrl && (
              <img
                src={agentAssets.photoUrl}
                alt={agent.name}
                className="w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </div>
          <div>
            <p className="chip bg-white/5 text-gold-bright mb-3">Listing Agent</p>
            <h1 className="font-display text-4xl md:text-5xl text-white">{agent.name}</h1>
            {agent.agency && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <p className="text-soft text-lg">{agent.agency}</p>
                {agentAssets?.agencyLogoWhiteUrl && (
                  <img
                    src={agentAssets.agencyLogoWhiteUrl}
                    alt={`${agent.agency} logo`}
                    className="h-6 w-auto"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
              </div>
            )}
            {agent.phone && <p className="mt-1 text-soft">{formatPhone(agent.phone)}</p>}
            <p className="mt-4 text-faint text-sm">
              {agentListings.length} {agentListings.length === 1 ? 'listing' : 'listings'} on HomesConnect
            </p>
          </div>
        </div>
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" className="btn-wa whitespace-nowrap">
            Chat on WhatsApp
          </a>
        )}
      </div>

      <h2 className="mt-12 font-display text-2xl md:text-3xl text-white">All listings by {agent.name}</h2>
      <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {agentListings.map((l) => <ListingCard key={l.id} listing={l} />)}
      </div>

      {!agentListings.length && (
        <div className="mt-6 card-soft rounded-2xl p-8 text-center">
          <p className="text-soft">No active listings right now.</p>
        </div>
      )}
    </div>
  );
}
