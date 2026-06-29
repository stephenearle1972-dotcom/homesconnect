import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { loadListings } from '../lib/loadListings';
import type { Listing } from '../lib/types';
import ListingCard from '../components/ListingCard';
import Seo from '../lib/seo';
import { track } from '../lib/track';

// Native <option> popups inherit the <select>'s translucent background, which renders
// near-white — so white option text was invisible until hovered. Set an EXPLICIT dark
// background + light text on every option so they read clearly, open or closed.
const OPTION_STYLE = { backgroundColor: '#0d1b12', color: '#e8efe9' };

// How many cards to show per "Load more" press.
const BATCH = 24;

// Compact rand label: R500k, R1m, R2.5m, R85m.
function randLabel(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return 'R' + (Number.isInteger(m) ? m : m.toFixed(1).replace(/\.0$/, '')) + 'm';
  }
  if (n >= 1000) return 'R' + Math.round(n / 1000) + 'k';
  return 'R' + n;
}

// Round a max price up to a tidy top bracket so the priciest listings stay reachable.
function niceTop(n: number): number {
  if (n <= 1_000_000) return Math.ceil(n / 100_000) * 100_000;
  if (n <= 10_000_000) return Math.ceil(n / 1_000_000) * 1_000_000;
  return Math.ceil(n / 5_000_000) * 5_000_000;
}

const PRICE_STEPS = [500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000, 20_000_000, 50_000_000];

type Sort = 'newest' | 'price_asc' | 'price_desc';

export default function ListingsPage() {
  const [all, setAll] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  // Seed the keyword filter from ?q= so deep links and the WebSite SearchAction work.
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [type, setType] = useState<'' | 'sale' | 'rent'>('');
  const [propertyType, setPropertyType] = useState('');
  const [minBeds, setMinBeds] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);
  const [sort, setSort] = useState<Sort>('newest');
  const [visible, setVisible] = useState(BATCH);

  useEffect(() => {
    loadListings().then((rows) => {
      setAll(rows);
      setLoading(false);
    });
  }, []);

  // Buyer Alerts: log a web_search once the keyword query settles (debounced),
  // rather than on every keystroke. Only meaningful queries (2+ chars).
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const t = setTimeout(() => track({ event_type: 'web_search', query_text: term }), 700);
    return () => clearTimeout(t);
  }, [q]);

  // Every dropdown's options are derived from the currently loaded listings so they
  // never go stale: provinces/types/property-types that don't exist simply don't appear.
  const types = useMemo(() => {
    const set = new Set<string>();
    all.forEach((l) => { if (l.type) set.add(l.type); });
    return Array.from(set).sort((a, b) => (a === 'sale' ? -1 : b === 'sale' ? 1 : a.localeCompare(b)));
  }, [all]);

  const provinces = useMemo(() => {
    const set = new Set<string>();
    all.forEach((l) => { if (l.province) set.add(l.province); });
    return Array.from(set).sort();
  }, [all]);

  const propertyTypes = useMemo(() => {
    const set = new Set<string>();
    all.forEach((l) => { if (l.propertyType) set.add(l.propertyType); });
    return Array.from(set).sort();
  }, [all]);

  // Cities depend on the selected province. Blank and "UNKNOWN" towns are omitted so
  // we never show a bare "UNKNOWN" option (those listings still show in the full grid).
  const cities = useMemo(() => {
    const set = new Set<string>();
    all.forEach((l) => {
      if (province && l.province !== province) return;
      const c = (l.city || '').trim();
      if (c && c.toUpperCase() !== 'UNKNOWN') set.add(c);
    });
    return Array.from(set).sort();
  }, [all, province]);

  const bedOptions = useMemo(() => {
    const maxBeds = all.reduce((m, l) => Math.max(m, l.bedrooms || 0), 0);
    const out: number[] = [];
    for (let i = 1; i <= Math.min(maxBeds, 6); i++) out.push(i);
    return out;
  }, [all]);

  // Price brackets derived from the actual data range, in round steps.
  const priceBrackets = useMemo(() => {
    const prices = all.map((l) => l.price).filter((p) => p > 0);
    if (!prices.length) return [];
    const maxP = Math.max(...prices);
    const out = PRICE_STEPS.filter((s) => s < maxP);
    const top = niceTop(maxP);
    if (!out.includes(top)) out.push(top);
    return out;
  }, [all]);

  const filtered = useMemo(() => {
    const qLow = q.trim().toLowerCase();
    return all.filter((l) => {
      if (type && l.type !== type) return false;
      if (province && l.province !== province) return false;
      if (city && l.city !== city) return false;
      if (propertyType && l.propertyType !== propertyType) return false;
      if (minBeds && l.bedrooms < minBeds) return false;
      if (maxPrice && l.price > maxPrice) return false;
      if (qLow) {
        const hay = `${l.title} ${l.suburb} ${l.city} ${l.province} ${l.description} ${l.agentAgency}`.toLowerCase();
        if (!hay.includes(qLow)) return false;
      }
      return true;
    });
  }, [all, q, province, city, type, propertyType, minBeds, maxPrice]);

  // Sort the filtered set (stable; equal keys keep their existing order).
  const sorted = useMemo(() => {
    const arr = filtered.slice();
    if (sort === 'price_asc') arr.sort((a, b) => a.price - b.price);
    else if (sort === 'price_desc') arr.sort((a, b) => b.price - a.price);
    else arr.sort((a, b) => (new Date(b.dateListed).getTime() || 0) - (new Date(a.dateListed).getTime() || 0));
    return arr;
  }, [filtered, sort]);

  // Any change to the filtered/sorted set drops the visible batch back to the first page.
  useEffect(() => { setVisible(BATCH); }, [q, province, city, type, propertyType, minBeds, maxPrice, sort]);

  const shown = sorted.slice(0, visible);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16">
      <Seo
        title="Property Listings — Houses & Apartments for Sale and Rent | HomesConnect"
        description="Browse HomesConnect property listings across South Africa. Filter homes for sale or to rent by province, city, price and bedrooms — then enquire on WhatsApp."
        path="/listings"
      />
      <p className="chip bg-white/5 text-gold-bright mb-4">Browse</p>
      <h1 className="font-display text-4xl md:text-6xl text-white">Listings</h1>
      <p className="mt-3 text-soft max-w-2xl">Filter the catalogue or message the bot for instant matches.</p>

      <div className="mt-8 card-soft rounded-2xl p-5 md:p-6 grid gap-3 md:grid-cols-12">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search suburb, agency or keyword"
          className="md:col-span-4 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder:text-faint focus:outline-none focus:border-teal"
        />
        <Select value={type} onChange={(v) => setType(v as 'sale' | 'rent' | '')} className="md:col-span-2">
          <option style={OPTION_STYLE} value="">Sale or rent</option>
          {types.map((t) => (
            <option style={OPTION_STYLE} key={t} value={t}>{t === 'sale' ? 'For sale' : t === 'rent' ? 'To let' : t}</option>
          ))}
        </Select>
        <Select value={province} onChange={(v) => { setProvince(v); setCity(''); }} className="md:col-span-2">
          <option style={OPTION_STYLE} value="">All provinces</option>
          {provinces.map((p) => <option style={OPTION_STYLE} key={p} value={p}>{p}</option>)}
        </Select>
        <Select value={city} onChange={setCity} className="md:col-span-2">
          <option style={OPTION_STYLE} value="">All cities</option>
          {cities.map((c) => <option style={OPTION_STYLE} key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={propertyType} onChange={setPropertyType} className="md:col-span-2">
          <option style={OPTION_STYLE} value="">Any type</option>
          {propertyTypes.map((p) => <option style={OPTION_STYLE} key={p} value={p}>{p}</option>)}
        </Select>
        <Select value={String(minBeds)} onChange={(v) => setMinBeds(Number(v))} className="md:col-span-2">
          <option style={OPTION_STYLE} value="0">Any beds</option>
          {bedOptions.map((b) => <option style={OPTION_STYLE} key={b} value={String(b)}>{b}+ beds</option>)}
        </Select>
        <Select value={String(maxPrice)} onChange={(v) => setMaxPrice(Number(v))} className="md:col-span-3">
          <option style={OPTION_STYLE} value="0">Max price (any)</option>
          {priceBrackets.map((b) => <option style={OPTION_STYLE} key={b} value={String(b)}>Up to {randLabel(b)}</option>)}
        </Select>
        <button
          onClick={() => { setQ(''); setProvince(''); setCity(''); setType(''); setPropertyType(''); setMinBeds(0); setMaxPrice(0); }}
          className="md:col-span-2 text-sm text-soft hover:text-white border border-white/10 rounded-lg px-4 py-2.5"
        >
          Reset
        </button>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4 flex-wrap">
        <p className="text-soft text-sm">
          {loading ? 'Loading…' : `${sorted.length} ${sorted.length === 1 ? 'property' : 'properties'}`}
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="sort" className="text-faint text-sm whitespace-nowrap">Sort by</label>
          <Select value={sort} onChange={(v) => setSort(v as Sort)} className="">
            <option style={OPTION_STYLE} value="newest">Newest</option>
            <option style={OPTION_STYLE} value="price_asc">Price: low to high</option>
            <option style={OPTION_STYLE} value="price_desc">Price: high to low</option>
          </Select>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {shown.map((l) => <ListingCard key={l.id} listing={l} />)}
      </div>

      {!loading && sorted.length > visible && (
        <div className="mt-10 flex justify-center">
          <button
            onClick={() => setVisible((v) => v + BATCH)}
            className="btn-gold px-8"
          >
            Load more ({sorted.length - visible} more)
          </button>
        </div>
      )}

      {!loading && !sorted.length && (
        <div className="mt-12 card-soft rounded-2xl p-10 text-center">
          <p className="font-display text-2xl text-white">No properties match that search</p>
          <p className="text-soft mt-2">Try widening your filters, or ask the WhatsApp bot for live help.</p>
        </div>
      )}
    </div>
  );
}

function Select({ value, onChange, children, className }: { value: string; onChange: (v: string) => void; children: React.ReactNode; className?: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-teal ${className || ''}`}
    >
      {children}
    </select>
  );
}
