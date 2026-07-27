import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { loadListings } from '../lib/loadListings';
import type { Listing } from '../lib/types';
import { maoAllowed } from '../lib/constants';
import { toSlug } from '../lib/slug';
import Seo, { listingJsonLd } from '../lib/seo';
import { track, goUrl, getSid } from '../lib/track';

export default function ListingDetailPage() {
  const { id } = useParams();
  const [listing, setListing] = useState<Listing | null | undefined>(undefined);
  const [active, setActive] = useState(0);

  useEffect(() => {
    loadListings().then((all) => setListing(all.find((l) => l.id === id) || null));
  }, [id]);

  // Buyer Alerts: log one web_view per listing mount (fire-and-forget).
  useEffect(() => {
    if (listing && listing.id) track({ event_type: 'web_view', listing_ref: listing.id });
  }, [listing?.id]);

  if (listing === undefined) {
    return <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 text-soft">Loading…</div>;
  }
  if (listing === null) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-16">
        <Seo
          title="Listing not found | HomesConnect"
          description="This property listing is no longer available. Browse current listings on HomesConnect."
          noindex
        />
        <p className="font-display text-3xl text-white">Listing not found</p>
        <Link to="/listings" className="mt-4 inline-block text-teal-bright">← Back to listings</Link>
      </div>
    );
  }

  const images = [listing.imageUrl, listing.image2, listing.image3].filter(Boolean);
  const dealType = listing.type === 'rent' ? 'to rent' : 'for sale';
  const metaTitle = `${listing.title} — ${listing.priceDisplay} | HomesConnect`;
  const metaDesc = [
    `${listing.bedrooms} bed`,
    `${listing.bathrooms} bath`,
    listing.propertyType,
  ].filter(Boolean).join(', ')
    + ` ${dealType} in ${listing.suburb || listing.city}, ${listing.province}.`
    + ` ${listing.priceDisplay}. Enquire on WhatsApp via HomesConnect.`;
  const isPrivate = listing.sellerType === 'private';
  // Prefer the dedicated WhatsApp number, fall back to the contact phone.
  const directNumber = listing.whatsapp || listing.agentPhone;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-16">
      <Seo
        title={metaTitle}
        description={metaDesc.slice(0, 160)}
        path={`/listing/${listing.id}`}
        image={listing.imageUrl || undefined}
        type="article"
        jsonLd={listingJsonLd(listing)}
      />
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
            <Link
              to={`/calculators/bond-repayment?price=${listing.price}`}
              className="mt-2 inline-block text-sm text-teal-bright hover:text-white transition-colors"
            >
              Calculate the bond repayment on this property →
            </Link>

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
            <a href={goUrl(listing.id, 'hc')} target="_blank" rel="noreferrer" className="btn-wa w-full mt-5">
              Enquire via WhatsApp
            </a>
            {directNumber && (
              <a href={goUrl(listing.id, 'agent')} target="_blank" rel="noreferrer" className="btn-ghost w-full mt-3">
                {isPrivate ? 'WhatsApp the seller direct' : 'WhatsApp the agent direct'}
              </a>
            )}
            {!isPrivate && listing.agentName && (
              <Link to={`/agent/${toSlug(listing.agentName)}`} className="block mt-3 text-center text-sm text-teal-bright hover:text-white transition-colors">
                View all listings by this agent →
              </Link>
            )}
          </div>
          {isPrivate && listing.makeAnOfferEnabled && maoAllowed(listing.id) && (
            <div className="card-soft rounded-2xl p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-faint">Buying privately?</p>
              <p className="mt-2 text-soft text-sm">Send the seller structured, non-binding proposed terms for discussion.</p>
              <Link to={`/make-offer?listing=${listing.id}`} className="btn-gold w-full mt-4">Make an Offer</Link>
              <p className="mt-2 text-[11px] text-faint">This does not create a binding sale — it records proposed terms only.</p>
            </div>
          )}
          <div className="card-soft rounded-2xl p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-faint mb-2">Listing ID</p>
            <p className="text-soft text-sm">{listing.id}</p>
          </div>
          <EnquiryForm listingId={listing.id} title={listing.title} isPrivate={isPrivate} />
          <ReportListing listingId={listing.id} title={listing.title} />
          {isPrivate && maoAllowed(listing.id) && (
            <div className="text-center">
              <Link to={`/seller?listing=${listing.id}`} className="text-xs text-faint hover:text-teal-bright">Are you the seller? Manage this listing →</Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// Buyer enquiry form. Captures name + phone (+ optional message) with explicit
// consent to share details with the listing agent, then posts to the enquiry
// function which logs the lead and emails the agent. Styled to match the
// report-listing control below.
function EnquiryForm({ listingId, title, isPrivate }: { listingId: string; title: string; isPrivate: boolean }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  const who = isPrivate ? 'seller' : 'agent';

  async function submit() {
    setError('');
    if (!phone.trim()) { setError('Please enter your phone number.'); return; }
    if (!consent) { setError('Please tick the consent box so we can pass your details on.'); return; }
    setState('sending');
    try {
      const res = await fetch('/.netlify/functions/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: listingId, title, name, phone, message, consent, sid: getSid() }),
      });
      if (!res.ok) throw new Error('failed');
      setState('sent');
    } catch {
      // Best-effort: show a soft failure but don't trap the user.
      setError('Something went wrong sending your enquiry. Please try WhatsApp instead.');
      setState('idle');
    }
  }

  if (state === 'sent') {
    return (
      <div className="card-soft rounded-2xl p-6">
        <p className="font-display text-lg text-white">Thanks — your enquiry is on its way.</p>
        <p className="text-soft text-sm mt-2">The {who} will contact you on the number you gave. You can also message them on WhatsApp above.</p>
      </div>
    );
  }

  return (
    <div className="card-soft rounded-2xl p-6">
      <p className="text-xs uppercase tracking-[0.2em] text-faint mb-2">Enquire about this property</p>
      <p className="text-soft text-xs mb-3">Leave your details and the {who} will get back to you.</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="input text-sm w-full"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Your phone number *"
        inputMode="tel"
        className="input text-sm w-full mt-3"
      />
      <textarea
        rows={3}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Message (optional)"
        className="input resize-none text-sm w-full mt-3"
      />
      <label className="flex items-start gap-2 mt-3 text-xs text-soft">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5"
        />
        <span>I agree that my details are shared with the listing agent so they can contact me.</span>
      </label>
      {error && <p className="text-xs text-red-300 mt-2">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={state === 'sending'}
        className="btn-gold w-full mt-4 text-sm disabled:opacity-50"
      >
        {state === 'sending' ? 'Sending…' : 'Send enquiry'}
      </button>
    </div>
  );
}

// Public "Report listing" control. Posts to a function that emails the operator.
// It never hides the listing client-side — a single anonymous report must not be
// able to unpublish a paid listing; the operator reviews and decides.
function ReportListing({ listingId, title }: { listingId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');

  async function submit() {
    setState('sending');
    try {
      await fetch('/.netlify/functions/report-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: listingId, title, reason }),
      });
    } catch {
      /* best-effort — show the same thank-you either way */
    }
    setState('sent');
  }

  if (state === 'sent') {
    return (
      <p className="text-center text-xs text-faint">
        Thanks — our team will review this listing.
      </p>
    );
  }

  if (!open) {
    return (
      <div className="text-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-faint hover:text-red-300 transition-colors"
        >
          ⚑ Report this listing
        </button>
      </div>
    );
  }

  return (
    <div className="card-soft rounded-2xl p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-faint mb-2">Report this listing</p>
      <p className="text-soft text-xs mb-3">
        Tell us what's wrong (inappropriate images, misleading or unlawful content). Optional.
      </p>
      <textarea
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        className="input resize-none text-sm"
      />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={state === 'sending'}
          className="btn-ghost flex-1 text-sm disabled:opacity-50"
        >
          {state === 'sending' ? 'Sending…' : 'Submit report'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-faint hover:text-white px-3"
        >
          Cancel
        </button>
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

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length === 10) return `${d.slice(0,3)} ${d.slice(3,6)} ${d.slice(6)}`;
  return raw;
}
