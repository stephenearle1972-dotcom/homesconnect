import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { loadListings } from '../lib/loadListings';
import type { Listing } from '../lib/types';
import { WA_NUMBER } from '../lib/constants';
import { toSlug } from '../lib/slug';

export default function ListingDetailPage() {
  const { id } = useParams();
  const [listing, setListing] = useState<Listing | null | undefined>(undefined);
  const [active, setActive] = useState(0);

  useEffect(() => {
    loadListings().then((all) => setListing(all.find((l) => l.id === id) || null));
  }, [id]);

  if (listing === undefined) {
    return <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 text-soft">Loading…</div>;
  }
  if (listing === null) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-16">
        <p className="font-display text-3xl text-white">Listing not found</p>
        <Link to="/listings" className="mt-4 inline-block text-teal-bright">← Back to listings</Link>
      </div>
    );
  }

  const images = [listing.imageUrl, listing.image2, listing.image3].filter(Boolean);
  const enquireMsg = encodeURIComponent(
    `Hi! I'm interested in ${listing.title} (${listing.id}) — ${listing.suburb}, ${listing.city}. Is it still available?`
  );
  const enquireWa = `https://wa.me/${WA_NUMBER}?text=${enquireMsg}`;
  const isPrivate = listing.sellerType === 'private';
  // Prefer the dedicated WhatsApp number, fall back to the contact phone.
  const directNumber = listing.whatsapp || listing.agentPhone;
  const agentWa = directNumber
    ? `https://wa.me/${normalize(directNumber)}?text=${enquireMsg}`
    : enquireWa;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-16">
      <Link to="/listings" className="text-sm text-soft hover:text-white">← Back to listings</Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[2fr,1fr]">
        <div>
          <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-bg-mid">
            {images[active] && (
              <img src={images[active]} alt={listing.title} className="w-full h-full object-cover" />
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {images.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`aspect-[4/3] rounded-lg overflow-hidden border ${active === i ? 'border-teal-bright' : 'border-white/10'}`}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="mt-10">
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="chip bg-white/5 text-soft">{listing.type === 'sale' ? 'For sale' : 'To let'}</span>
              <span className="chip bg-white/5 text-soft capitalize">{listing.propertyType}</span>
              {listing.featured && <span className="chip bg-gold/90 text-bg-dark">Featured</span>}
            </div>
            <h1 className="font-display text-3xl md:text-5xl text-white">{listing.title}</h1>
            <p className="mt-2 text-soft">{listing.suburb}, {listing.city}, {listing.province}</p>
            <p className="mt-4 font-display text-3xl md:text-4xl text-gold-bright">{listing.priceDisplay}</p>

            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Spec label="Bedrooms" value={String(listing.bedrooms)} />
              <Spec label="Bathrooms" value={String(listing.bathrooms)} />
              <Spec label="Garages" value={String(listing.garage)} />
              <Spec label="Type" value={listing.propertyType} />
            </div>

            {(listing.pool || listing.garden || listing.petFriendly) && (
              <div className="mt-5 flex flex-wrap gap-2">
                {listing.pool && <Tag>Pool</Tag>}
                {listing.garden && <Tag>Garden</Tag>}
                {listing.petFriendly && <Tag>Pet friendly</Tag>}
              </div>
            )}

            <h2 className="mt-10 font-display text-2xl text-white">About this property</h2>
            <p className="mt-3 text-soft leading-relaxed whitespace-pre-line">{listing.description}</p>
          </div>
        </div>

        <aside className="lg:sticky lg:top-28 self-start space-y-4">
          <div className="card-soft rounded-2xl p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-faint">{isPrivate ? 'Private seller' : 'Listing agent'}</p>
            {listing.agentName ? (
              isPrivate ? (
                <p className="mt-2 font-display text-xl text-white">{listing.agentName}</p>
              ) : (
                <Link to={`/agent/${toSlug(listing.agentName)}`} className="block mt-2 font-display text-xl text-white hover:text-teal-bright transition-colors">
                  {listing.agentName}
                </Link>
              )
            ) : (
              <p className="mt-2 font-display text-xl text-white">HomesConnect Agent</p>
            )}
            {listing.agentAgency && <p className="text-soft text-sm mt-1">{listing.agentAgency}</p>}
            {isPrivate && <p className="text-faint text-xs mt-1">Sold privately — no agent, no commission.</p>}
            {directNumber && <p className="text-soft text-sm mt-1">{formatPhone(directNumber)}</p>}
            <a href={enquireWa} target="_blank" rel="noreferrer" className="btn-wa w-full mt-5">
              Enquire via WhatsApp
            </a>
            {directNumber && (
              <a href={agentWa} target="_blank" rel="noreferrer" className="btn-ghost w-full mt-3">
                {isPrivate ? 'WhatsApp the seller direct' : 'WhatsApp the agent direct'}
              </a>
            )}
            {!isPrivate && listing.agentName && (
              <Link to={`/agent/${toSlug(listing.agentName)}`} className="block mt-3 text-center text-sm text-teal-bright hover:text-white transition-colors">
                View all listings by this agent →
              </Link>
            )}
          </div>
          <div className="card-soft rounded-2xl p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-faint mb-2">Listing ID</p>
            <p className="text-soft text-sm">{listing.id}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-soft rounded-xl p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-faint">{label}</p>
      <p className="mt-1 font-display text-lg text-white capitalize">{value}</p>
    </div>
  );
}
function Tag({ children }: { children: React.ReactNode }) {
  return <span className="chip bg-teal/15 text-teal-bright">{children}</span>;
}

function normalize(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.startsWith('27') && d.length === 11) return d;
  if (d.startsWith('0') && d.length === 10) return '27' + d.slice(1);
  return d;
}
function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length === 10) return `${d.slice(0,3)} ${d.slice(3,6)} ${d.slice(6)}`;
  return raw;
}
