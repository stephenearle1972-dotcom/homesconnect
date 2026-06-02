import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadConveyancers, type Conveyancer } from '../lib/conveyancers';
import { PROVINCES, CONVEYANCER_DISCLAIMER } from '../lib/constants';

const FALLBACK_BG = 'linear-gradient(135deg,#1e3428,#0d1b12)';

function waLink(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.startsWith('27') && d.length === 11) return `https://wa.me/${d}`;
  if (d.startsWith('0') && d.length === 10) return `https://wa.me/27${d.slice(1)}`;
  return `https://wa.me/${d}`;
}

export default function ConveyancersPage() {
  const [all, setAll] = useState<Conveyancer[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [province, setProvince] = useState('');
  const [region, setRegion] = useState('');

  useEffect(() => {
    loadConveyancers().then((rows) => { setAll(rows); setLoading(false); });
  }, []);

  // Region options are every distinct entry across firms' regions_served lists.
  const regions = useMemo(() => {
    const set = new Set<string>();
    all.forEach((c) => c.regionsServed.forEach((r) => set.add(r)));
    return Array.from(set).sort();
  }, [all]);

  const filtered = useMemo(() => {
    const qLow = q.trim().toLowerCase();
    return all.filter((c) => {
      if (province && c.province !== province) return false;
      if (region && !c.regionsServed.includes(region)) return false;
      if (qLow) {
        const hay = `${c.firmName} ${c.contactName} ${c.suburb} ${c.city} ${c.province} ${c.regionsServed.join(' ')} ${c.practiceNotes}`.toLowerCase();
        if (!hay.includes(qLow)) return false;
      }
      return true;
    });
  }, [all, q, province, region]);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16">
      <p className="chip bg-white/5 text-gold-bright mb-4">Free directory</p>
      <h1 className="font-display text-4xl md:text-6xl text-white">Conveyancing Attorneys</h1>
      <p className="mt-3 text-soft max-w-2xl">
        A free public directory of conveyancers across South Africa. Find a firm by province
        or region and contact them directly.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/list-conveyancer" className="btn-gold">List your firm — free</Link>
      </div>

      {/* Disclaimer */}
      <div className="mt-8 rounded-2xl p-5 border border-white/10 bg-white/5 text-faint text-sm leading-relaxed">
        {CONVEYANCER_DISCLAIMER}
      </div>

      {/* Filters */}
      <div className="mt-8 card-soft rounded-2xl p-5 md:p-6 grid gap-3 md:grid-cols-12">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search firm, attorney or keyword"
          className="md:col-span-6 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder:text-faint focus:outline-none focus:border-teal"
        />
        <Select value={province} onChange={setProvince} className="md:col-span-3">
          <option value="">All provinces</option>
          {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
        </Select>
        <Select value={region} onChange={setRegion} className="md:col-span-3">
          <option value="">All regions served</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
      </div>

      <p className="mt-8 text-soft text-sm">
        {loading ? 'Loading…' : all.length ? `${filtered.length} ${filtered.length === 1 ? 'firm' : 'firms'}` : ''}
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => <ConveyancerCard key={c.id} c={c} />)}
      </div>

      {!loading && !filtered.length && (
        <div className="mt-6 card-soft rounded-2xl p-10 text-center">
          {all.length === 0 ? (
            <>
              <p className="font-display text-2xl text-white">We’re building this directory</p>
              <p className="text-soft mt-2">
                Conveyancers — <Link to="/list-conveyancer" className="text-teal-bright hover:text-white">list your firm free</Link> and be among the first listed.
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-2xl text-white">No conveyancers match that search</p>
              <p className="text-soft mt-2">Try widening your filters, or check back soon as the directory grows.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ConveyancerCard({ c }: { c: Conveyancer }) {
  return (
    <article className="rounded-2xl overflow-hidden card-soft p-6 flex flex-col">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: FALLBACK_BG }}>
          {c.logoUrl
            ? <img src={c.logoUrl} alt={c.firmName} className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            : <span className="font-display text-xl text-gold-bright">{(c.firmName[0] || 'C').toUpperCase()}</span>}
        </div>
        <div className="min-w-0">
          <p className="font-display text-xl text-white line-clamp-1">{c.firmName}</p>
          {c.contactName && <p className="text-soft text-sm">{c.contactName}</p>}
        </div>
      </div>

      <p className="mt-4 text-soft text-sm">{[c.suburb, c.city].filter(Boolean).join(', ')}{c.province ? ` · ${c.province}` : ''}</p>

      {c.regionsServed.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.regionsServed.slice(0, 6).map((r) => (
            <span key={r} className="px-2 py-0.5 rounded-full bg-teal/15 text-teal-bright text-[10px] uppercase tracking-[0.12em]">{r}</span>
          ))}
        </div>
      )}

      {c.practiceNotes && <p className="mt-3 text-faint text-sm leading-relaxed line-clamp-3">{c.practiceNotes}</p>}
      {c.lpcNumber && <p className="mt-2 text-faint text-xs">LPC / practice no.: {c.lpcNumber}</p>}

      <div className="mt-auto pt-5 flex flex-wrap gap-2">
        {c.phone && <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="btn-ghost text-sm py-2 px-3">Call</a>}
        {c.whatsapp && <a href={waLink(c.whatsapp)} target="_blank" rel="noreferrer" className="btn-wa text-sm py-2 px-3">WhatsApp</a>}
        {c.email && <a href={`mailto:${c.email}`} className="btn-ghost text-sm py-2 px-3">Email</a>}
        {c.website && <a href={/^https?:\/\//.test(c.website) ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer" className="btn-ghost text-sm py-2 px-3">Website</a>}
      </div>
    </article>
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
