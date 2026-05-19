import { useEffect, useMemo, useState } from 'react';
import { loadListings } from '../lib/loadListings';
import type { Listing } from '../lib/types';
import ListingCard from '../components/ListingCard';
import { PROVINCES } from '../lib/constants';

const PROPERTY_TYPES = ['house', 'apartment', 'townhouse', 'vacant land', 'commercial'];

export default function ListingsPage() {
  const [all, setAll] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [type, setType] = useState<'' | 'sale' | 'rent'>('');
  const [propertyType, setPropertyType] = useState('');
  const [minBeds, setMinBeds] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);

  useEffect(() => {
    loadListings().then((rows) => {
      setAll(rows);
      setLoading(false);
    });
  }, []);

  const cities = useMemo(() => {
    const set = new Set<string>();
    all.forEach((l) => { if (!province || l.province === province) set.add(l.city); });
    return Array.from(set).sort();
  }, [all, province]);

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

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16">
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
          <option value="">Sale or rent</option>
          <option value="sale">For sale</option>
          <option value="rent">To let</option>
        </Select>
        <Select value={province} onChange={(v) => { setProvince(v); setCity(''); }} className="md:col-span-2">
          <option value="">All provinces</option>
          {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
        </Select>
        <Select value={city} onChange={setCity} className="md:col-span-2">
          <option value="">All cities</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={propertyType} onChange={setPropertyType} className="md:col-span-2">
          <option value="">Any type</option>
          {PROPERTY_TYPES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
        </Select>
        <Select value={String(minBeds)} onChange={(v) => setMinBeds(Number(v))} className="md:col-span-2">
          <option value="0">Any beds</option>
          <option value="1">1+ beds</option>
          <option value="2">2+ beds</option>
          <option value="3">3+ beds</option>
          <option value="4">4+ beds</option>
        </Select>
        <Select value={String(maxPrice)} onChange={(v) => setMaxPrice(Number(v))} className="md:col-span-3">
          <option value="0">Max price (any)</option>
          <option value="50000">Up to R 50,000 / mo</option>
          <option value="1000000">Up to R 1,000,000</option>
          <option value="2000000">Up to R 2,000,000</option>
          <option value="3000000">Up to R 3,000,000</option>
          <option value="5000000">Up to R 5,000,000</option>
        </Select>
        <button
          onClick={() => { setQ(''); setProvince(''); setCity(''); setType(''); setPropertyType(''); setMinBeds(0); setMaxPrice(0); }}
          className="md:col-span-2 text-sm text-soft hover:text-white border border-white/10 rounded-lg px-4 py-2.5"
        >
          Reset
        </button>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <p className="text-soft text-sm">
          {loading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'property' : 'properties'}`}
        </p>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((l) => <ListingCard key={l.id} listing={l} />)}
      </div>

      {!loading && !filtered.length && (
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
