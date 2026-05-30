import { Link } from 'react-router-dom';
import type { Listing } from '../lib/types';
import { toSlug } from '../lib/slug';

const FALLBACK_BG = 'linear-gradient(135deg,#1e3428,#0d1b12)';

export default function ListingCard({ listing }: { listing: Listing }) {
  const badge = listing.type === 'sale' ? 'FOR SALE' : 'TO LET';
  return (
    <article className="group rounded-2xl overflow-hidden card-soft hover:border-teal/50 transition-all">
      <Link to={`/listing/${listing.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden" style={{ background: FALLBACK_BG }}>
          {listing.imageUrl && (
            <img
              src={listing.imageUrl}
              alt={listing.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <div className="absolute top-3 left-3 flex gap-2">
            <span className="chip bg-black/60 text-white border border-white/15">{badge}</span>
            {listing.featured && (
              <span className="chip bg-gold/90 text-bg-dark">Featured</span>
            )}
            {listing.sellerType === 'private' && (
              <span className="chip bg-teal/90 text-white">Private seller</span>
            )}
          </div>
        </div>
        <div className="px-5 pt-5">
          <p className="font-display text-xl text-white mb-1 line-clamp-1">{listing.title}</p>
          <p className="text-soft text-sm mb-3">{listing.suburb}, {listing.city}</p>
          <p className="text-gold-bright font-display text-2xl mb-4">{listing.priceDisplay}</p>
          <div className="flex gap-4 text-xs text-soft">
            <Spec label="Beds" value={listing.bedrooms} />
            <Spec label="Baths" value={listing.bathrooms} />
            {listing.garage > 0 && <Spec label="Garage" value={listing.garage} />}
            {listing.pool && <Tag>Pool</Tag>}
            {listing.garden && <Tag>Garden</Tag>}
          </div>
        </div>
      </Link>
      {listing.agentName && (
        <div className="px-5 pb-5 pt-3 mt-2 border-t border-white/5 text-xs">
          {listing.sellerType === 'private' ? (
            <>
              <span className="text-faint">Private seller: </span>
              <span className="text-teal-bright">{listing.agentName}</span>
            </>
          ) : (
            <>
              <span className="text-faint">Agent: </span>
              <Link
                to={`/agent/${toSlug(listing.agentName)}`}
                className="text-teal-bright hover:text-white transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {listing.agentName}
              </Link>
            </>
          )}
        </div>
      )}
    </article>
  );
}

function Spec({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-baseline gap-1">
      <strong className="text-white text-sm">{value}</strong>
      <span>{label}</span>
    </span>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="px-2 py-0.5 rounded-full bg-teal/15 text-teal-bright text-[10px] uppercase tracking-[0.15em]">{children}</span>;
}
