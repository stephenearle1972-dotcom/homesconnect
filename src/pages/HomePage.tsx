import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { WA_LINK } from '../lib/constants';
import { loadListings } from '../lib/loadListings';
import type { Listing } from '../lib/types';
import ListingCard from '../components/ListingCard';
import ChatPanel from '../components/ChatPanel';
import PhoneDemo from '../components/PhoneDemo';

const HERO_BG = 'https://res.cloudinary.com/dkn6tnxao/image/upload/c_fill/w_1800/h_1100/q_auto/f_auto/homesconnect/property-02-bushveld-lodge.jpg';

export default function HomePage() {
  const [featured, setFeatured] = useState<Listing[]>([]);
  useEffect(() => {
    loadListings().then((all) => {
      const top = all.filter((l) => l.featured).slice(0, 3);
      setFeatured(top.length ? top : all.slice(0, 3));
    });
  }, []);

  return (
    <>
      <Hero />
      <HowItWorks />
      <Pricing />
      <PhoneDemo />
      <Features />
      <FeaturedListings featured={featured} />
      <EmbeddedSearch />
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(13,27,18,0.55) 0%, rgba(13,27,18,0.85) 65%, #0d1b12 100%), url(${HERO_BG})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        aria-hidden
      />
      <div className="relative max-w-7xl mx-auto px-4 md:px-8 pt-20 pb-28 md:pt-28 md:pb-40">
        <p className="chip bg-white/10 text-soft mb-6">Property × WhatsApp</p>
        <h1 className="font-display text-4xl sm:text-5xl md:text-7xl leading-[1.05] tracking-tight max-w-4xl text-white">
          Find Your Next Home<br />via <span className="text-teal-bright">WhatsApp</span>.
        </h1>
        <p className="mt-6 text-soft text-lg md:text-xl max-w-2xl leading-relaxed">
          South Africa's first WhatsApp-powered property search. Buyers message, get instant results,
          and connect directly with the seller. No app. No login. No friction.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a href="#pricing" className="btn-gold">List Your Property</a>
          <a href="#pricing" className="btn-ghost">See pricing</a>
          <a href={WA_LINK} target="_blank" rel="noreferrer" className="btn-wa">Try the WhatsApp Bot</a>
        </div>
        <div className="mt-16 grid grid-cols-3 gap-4 max-w-xl">
          <Stat top="9" bottom="Provinces" />
          <Stat top="24 / 7" bottom="WhatsApp Bot" />
          <Stat top="Instant" bottom="Enquiries" />
        </div>
      </div>
    </section>
  );
}

function Stat({ top, bottom }: { top: string; bottom: string }) {
  return (
    <div className="card-soft rounded-2xl px-5 py-4">
      <p className="font-display text-2xl md:text-3xl text-white">{top}</p>
      <p className="text-xs uppercase tracking-[0.2em] text-faint mt-1">{bottom}</p>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { n: '01', title: 'List your property', body: 'Add your property details, photos and price — or have a HomesConnect licensee set it up for you.' },
    { n: '02', title: 'It goes live across the network', body: 'Published on the HomesConnect website and the WhatsApp bot within 48 hours.' },
    { n: '03', title: 'Buyers find it via WhatsApp search', body: 'Natural-language queries like "3 bed in Durban under R2.5M" return instant results.' },
    { n: '04', title: 'You get the enquiry direct', body: 'An instant WhatsApp notification with the buyer’s details — no missed opportunities.' },
  ];
  return (
    <section id="how-it-works" className="relative py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <SectionHeading eyebrow="How it works" title="From listing to lead in 4 steps" />
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="card-soft rounded-2xl p-6">
              <p className="font-display text-gold-bright text-3xl mb-3">{s.n}</p>
              <h3 className="font-display text-xl text-white mb-2">{s.title}</h3>
              <p className="text-soft text-sm leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    { title: 'WhatsApp bot search', body: 'Natural-language search, 24/7. Buyers ask in plain English or Afrikaans.' },
    { title: 'Property website listings', body: 'Browse, filter and search the full catalogue on a beautiful, fast website.' },
    { title: 'Lead notifications', body: 'Agents get an instant WhatsApp ping the moment a buyer enquires.' },
    { title: 'Area-based search', body: 'Search by suburb, city or province. Find exactly what your budget will buy.' },
    { title: 'Agent profile pages', body: 'Every agent gets a professional profile with photo, agency, and direct contact.' },
    { title: 'Photo galleries', body: 'Up to 15 photos per listing depending on tier — buyers see what they’re getting.' },
  ];
  return (
    <section className="py-20 md:py-28 bg-bg-mid/40">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <SectionHeading eyebrow="Features" title="Everything you need to sell" />
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((f) => (
            <div key={f.title} className="card-soft rounded-2xl p-6">
              <h3 className="font-display text-xl text-white mb-3 flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-teal-bright" />
                {f.title}
              </h3>
              <p className="text-soft text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturedListings({ featured }: { featured: Listing[] }) {
  if (!featured.length) return null;
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-end justify-between gap-4 mb-12 flex-wrap">
          <SectionHeading eyebrow="Featured" title="Hand-picked properties" tight />
          <Link to="/listings" className="text-sm text-teal-bright hover:text-white transition-colors">
            View all listings →
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      </div>
    </section>
  );
}

function EmbeddedSearch() {
  return (
    <section id="search" className="py-20 md:py-28">
      <div className="max-w-5xl mx-auto px-4 md:px-8">
        <SectionHeading eyebrow="Live demo" title="Try It — Search Properties Right Now" />
        <p className="mt-4 text-soft max-w-2xl">
          Ask our AI assistant anything about available properties. It searches our live listings in real time.
        </p>
        <div className="mt-10 h-[440px] md:h-[480px]">
          <ChatPanel
            variant="floating"
            placeholder="Try: '3 bed house in Durban under R2.5M'"
            className="h-full"
          />
        </div>
        <div className="mt-6 text-center">
          <Link to="/search" className="text-sm text-teal-bright hover:text-white transition-colors">
            Open full-page search →
          </Link>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const tiers = [
    {
      name: 'Basic Listing', price: 'R99', per: '/mo per property',
      features: ['1 listing', '3 photos', 'Bot visibility', 'Basic agent profile', 'Web listing', 'Lead notifications'],
      highlight: false,
      cta: 'Get Started',
      ctaStyle: 'gold' as const,
      tierParam: 'basic',
    },
    {
      name: 'Enhanced Listing', price: 'R249', per: '/mo per property',
      features: ['1 listing', '10 photos', 'Priority bot results', 'Enhanced profile', 'Video / tour links', 'Analytics', '1 featured / month'],
      highlight: true,
      cta: 'Get Started',
      ctaStyle: 'gold' as const,
      tierParam: 'enhanced',
    },
    {
      name: 'Agency Package', price: 'R999', per: '/mo per agency',
      features: ['Up to 10 listings', '5 agent sub-accounts', '15 photos per listing', 'Top of results', 'Branded profile', '3 featured / month'],
      highlight: false,
      cta: 'Get Started',
      ctaStyle: 'wa' as const,
      tierParam: 'agency',
    },
  ];
  return (
    <section id="pricing" className="scroll-mt-24 py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <SectionHeading eyebrow="Pricing" title="Flat fee. No commission." />
        <p className="mt-4 text-soft text-lg max-w-2xl leading-relaxed">
          Pay a simple flat monthly fee — no agent, no commission, ever. List from R99/month on the
          website and the WhatsApp bot.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {tiers.map((t) => (
            <div key={t.name}
              className={`rounded-2xl p-7 transition-all ${
                t.highlight
                  ? 'bg-teal/15 border border-teal/50 shadow-elev'
                  : 'card-soft'
              }`}
            >
              {t.highlight && <p className="chip bg-gold/90 text-bg-dark mb-4">Most popular</p>}
              <h3 className="font-display text-2xl text-white">{t.name}</h3>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-5xl text-white">{t.price}</span>
                <span className="text-faint text-sm">{t.per}</span>
              </p>
              <ul className="mt-6 space-y-2 text-sm text-soft">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="text-teal-bright mt-0.5">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={`/list-property?tier=${t.tierParam}`}
                className={`${t.ctaStyle === 'wa' ? 'btn-wa' : 'btn-gold'} w-full mt-7`}
              >
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-faint text-center">
          All prices exclude 15% VAT. Contact us for custom packages.
        </p>

        <div className="mt-8 card-soft rounded-2xl px-6 py-6 text-center">
          <p className="font-display text-2xl text-white">Selling your own home?</p>
          <p className="mt-2 text-soft text-sm max-w-xl mx-auto">
            No agent, no commission. List your own property privately from R99 — same tiers,
            same reach on the website and WhatsApp bot.
          </p>
          <Link to="/list-property?seller=private" className="btn-gold mt-5 inline-block">
            List as a private seller
          </Link>
        </div>

        <div className="mt-12 card-soft rounded-2xl px-6 py-5 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-sm text-soft text-center">
          <span>Questions? WhatsApp us at</span>
          <a href="https://wa.me/27767959872" target="_blank" rel="noreferrer" className="text-teal-bright hover:text-white transition-colors font-semibold">
            +27 76 795 9872
          </a>
          <span className="hidden sm:inline">or email</span>
          <span className="sm:hidden">or</span>
          <a href="mailto:hello@townconnect.co.za" className="text-teal-bright hover:text-white transition-colors font-semibold">
            hello@townconnect.co.za
          </a>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title, tight }: { eyebrow: string; title: string; tight?: boolean }) {
  return (
    <div className={tight ? '' : 'max-w-2xl'}>
      <p className="chip bg-white/5 text-gold-bright mb-4">{eyebrow}</p>
      <h2 className="font-display text-3xl md:text-5xl text-white">{title}</h2>
    </div>
  );
}
