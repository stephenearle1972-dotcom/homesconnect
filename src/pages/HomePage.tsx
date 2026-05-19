import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { WA_LINK } from '../lib/constants';
import { loadListings } from '../lib/loadListings';
import type { Listing } from '../lib/types';
import ListingCard from '../components/ListingCard';

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
      <Features />
      <FeaturedListings featured={featured} />
      <BotDemo />
      <Pricing />
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
          and connect directly with the listing agent. No app. No login. No friction.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a href="#pricing" className="btn-gold">List Your Properties</a>
          <a href={WA_LINK} target="_blank" rel="noreferrer" className="btn-wa">Try the WhatsApp Bot</a>
        </div>
        <div className="mt-16 grid grid-cols-3 gap-4 max-w-xl">
          <Stat top="9" bottom="Provinces" />
          <Stat top="24 / 7" bottom="WhatsApp Bot" />
          <Stat top="Instant" bottom="Agent Leads" />
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
    { n: '01', title: 'Agent lists property', body: 'A HomesConnect licensee onboards the agent and collects the listing details.' },
    { n: '02', title: 'Listing goes live', body: 'Published on the HomesConnect website and the WhatsApp bot within 48 hours.' },
    { n: '03', title: 'Buyers search via WhatsApp', body: 'Natural-language queries like "3 bed in Durban under R2.5M" return instant results.' },
    { n: '04', title: 'Agent gets the lead', body: 'Instant WhatsApp notification with the buyer’s details — no missed opportunities.' },
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
        <SectionHeading eyebrow="Features" title="Everything an agent needs" />
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

function BotDemo() {
  return (
    <section className="py-20 md:py-28 bg-bg-mid/40">
      <div className="max-w-6xl mx-auto px-4 md:px-8 grid gap-12 md:grid-cols-2 items-center">
        <div>
          <SectionHeading eyebrow="WhatsApp Demo" title="Search at the speed of a text message" tight />
          <p className="mt-6 text-soft leading-relaxed">
            The HomesConnect WhatsApp bot understands natural language. Buyers describe what they want and
            the bot replies with matching properties — complete with price, location, specs and the agent’s direct line.
          </p>
          <a href={WA_LINK} target="_blank" rel="noreferrer" className="btn-wa mt-8">Try it now</a>
        </div>
        <div className="rounded-3xl p-5 md:p-7 border border-white/10" style={{ background: 'linear-gradient(180deg,#0b1d14,#0d1b12)' }}>
          <div className="flex flex-col gap-3 max-w-md mx-auto text-sm">
            <Bubble side="user">3 bed house in Pretoria East under R2M</Bubble>
            <Bubble side="bot">
              I found 1 match in Pretoria East:{"\n\n"}
              <strong>Family Home in Faerie Glen — R 2,100,000</strong>{"\n"}
              3 bed · 2 bath · 2 garage · Garden · Pet friendly{"\n\n"}
              Agent: Pieter van der Merwe (PVDM Realty)
            </Bubble>
            <Bubble side="user">Contact the agent</Bubble>
            <Bubble side="bot">Connecting you to Pieter — sending him your number now. He’ll reach out within the hour 👍</Bubble>
          </div>
        </div>
      </div>
    </section>
  );
}

function Bubble({ side, children }: { side: 'user' | 'bot'; children: React.ReactNode }) {
  const isUser = side === 'user';
  return (
    <div className={`max-w-[85%] rounded-2xl px-4 py-3 whitespace-pre-wrap leading-relaxed ${
      isUser
        ? 'self-end bg-wa-green text-white rounded-br-sm'
        : 'self-start bg-white/95 text-bg-dark rounded-bl-sm'
    }`}>{children}</div>
  );
}

function Pricing() {
  const tiers = [
    {
      name: 'Basic Listing', price: 'R99', per: '/mo per property',
      features: ['1 listing', '3 photos', 'Bot visibility', 'Basic agent profile', 'Web listing', 'Lead notifications'],
      highlight: false,
    },
    {
      name: 'Enhanced Listing', price: 'R249', per: '/mo per property',
      features: ['1 listing', '10 photos', 'Priority bot results', 'Enhanced profile', 'Video / tour links', 'Analytics', '1 featured / month'],
      highlight: true,
    },
    {
      name: 'Agency Package', price: 'R999', per: '/mo per agency',
      features: ['Up to 10 listings', '5 agent sub-accounts', '15 photos per listing', 'Top of results', 'Branded profile', '3 featured / month'],
      highlight: false,
    },
  ];
  return (
    <section id="pricing" className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <SectionHeading eyebrow="Pricing" title="Simple monthly pricing for agents" />
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
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-faint text-center">
          All prices exclude 15% VAT. Contact us for custom packages.
        </p>
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
