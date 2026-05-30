import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PROVINCES, CONVEYANCER_DISCLAIMER } from '../lib/constants';

const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dkn6tnxao';
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'homesconnect_listings';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`;

const CONFIRMATION =
  'I confirm I am a practising attorney/conveyancer entitled to perform conveyancing in ' +
  'South Africa, and that the details above are accurate. I understand listing is free and ' +
  'that TownConnect does not receive payment for, or endorse, any listing.';

type FormState = {
  firm_name: string;
  contact_name: string;
  other_regions: string;
  physical_address: string;
  suburb: string;
  city: string;
  province: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  practice_notes: string;
  lpc_number: string;
};

const INITIAL: FormState = {
  firm_name: '', contact_name: '', other_regions: '', physical_address: '',
  suburb: '', city: '', province: 'Gauteng', phone: '', whatsapp: '', email: '',
  website: '', practice_notes: '', lpc_number: '',
};

export default function ListConveyancerPage() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [regions, setRegions] = useState<string[]>([]);
  const [logo, setLogo] = useState('');
  const [uploading, setUploading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k as string]) setErrors((p) => { const n = { ...p }; delete n[k as string]; return n; });
  }

  function toggleRegion(p: string) {
    setRegions((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
    if (errors.regions_served) setErrors((p) => { const n = { ...p }; delete n.regions_served; return n; });
  }

  // Merge province chips + free-text "other areas" into one comma list.
  function regionsServed(): string {
    const extra = form.other_regions.split(',').map((s) => s.trim()).filter(Boolean);
    return [...regions, ...extra].join(', ');
  }

  async function handleLogo(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    setErrors((p) => { const n = { ...p }; delete n.logo; return n; });
    try {
      const fd = new FormData();
      fd.append('file', files[0]);
      fd.append('upload_preset', CLOUDINARY_PRESET);
      const res = await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`Cloudinary ${res.status}`);
      const data = await res.json();
      if (data.secure_url) setLogo(data.secure_url);
    } catch (err) {
      setErrors((p) => ({ ...p, logo: 'Upload failed — try again' }));
      console.error(err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    const req = (k: keyof FormState, label: string) => { if (!String(form[k] ?? '').trim()) errs[k as string] = `${label} required`; };
    req('firm_name', 'Firm name');
    req('contact_name', 'Contact attorney');
    req('suburb', 'Suburb');
    req('city', 'City');
    req('phone', 'Phone');
    req('email', 'Email');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email';
    if (!regionsServed()) errs.regions_served = 'Select at least one region or add one';
    if (!confirmed) errs.confirmation = 'Please tick the confirmation to continue';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) {
      const first = document.querySelector('[data-error="true"]') as HTMLElement | null;
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/.netlify/functions/list-conveyancer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firm_name: form.firm_name,
          contact_name: form.contact_name,
          regions_served: regionsServed(),
          physical_address: form.physical_address,
          suburb: form.suburb,
          city: form.city,
          province: form.province,
          phone: form.phone,
          whatsapp: form.whatsapp,
          email: form.email,
          website: form.website,
          practice_notes: form.practice_notes,
          lpc_number: form.lpc_number,
          logo_url: logo,
          confirmation_accepted: confirmed,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        else setErrors({ form: data.error || 'Submission failed' });
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch (err) {
      setErrors({ form: 'Network error — try again' });
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-8 py-16 md:py-24 text-center">
        <div className="inline-flex w-16 h-16 rounded-full bg-teal/20 items-center justify-center mb-6">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#22A88F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="font-display text-4xl md:text-5xl text-white">Thank you</h1>
        <p className="mt-6 text-soft text-lg leading-relaxed">
          Your listing will appear once reviewed (usually within 48 hours).
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to="/conveyancers" className="btn-gold">View the directory</Link>
          <Link to="/" className="btn-ghost">Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-12 md:py-16">
      <p className="chip bg-white/5 text-gold-bright mb-4">Free listing</p>
      <h1 className="font-display text-4xl md:text-5xl text-white">List Your Conveyancing Firm</h1>
      <p className="mt-3 text-soft max-w-2xl">
        Add your firm to the HomesConnect conveyancer directory. Listing is completely free —
        there is no payment at any step.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 space-y-10">
        <FormSection title="1. Firm details">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Firm name" required error={errors.firm_name}>
              <input type="text" value={form.firm_name} onChange={(e) => setField('firm_name', e.target.value)} className="input" />
            </Field>
            <Field label="Contact attorney" required error={errors.contact_name}>
              <input type="text" value={form.contact_name} onChange={(e) => setField('contact_name', e.target.value)} className="input" />
            </Field>
            <Field label="Phone" required error={errors.phone}>
              <input type="tel" placeholder="0123456789" value={form.phone} onChange={(e) => setField('phone', e.target.value)} className="input" />
            </Field>
            <Field label="WhatsApp number" hint="optional">
              <input type="tel" value={form.whatsapp} onChange={(e) => setField('whatsapp', e.target.value)} className="input" />
            </Field>
            <Field label="Email" required error={errors.email}>
              <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} className="input" />
            </Field>
            <Field label="Website" hint="optional">
              <input type="text" placeholder="www.example.co.za" value={form.website} onChange={(e) => setField('website', e.target.value)} className="input" />
            </Field>
            <Field label="LPC / practice number" hint="optional" className="md:col-span-2">
              <input type="text" value={form.lpc_number} onChange={(e) => setField('lpc_number', e.target.value)} className="input" />
            </Field>
          </div>
        </FormSection>

        <FormSection title="2. Location & regions served">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Physical address" hint="optional" className="md:col-span-2">
              <input type="text" value={form.physical_address} onChange={(e) => setField('physical_address', e.target.value)} className="input" />
            </Field>
            <Field label="Suburb" required error={errors.suburb}>
              <input type="text" value={form.suburb} onChange={(e) => setField('suburb', e.target.value)} className="input" />
            </Field>
            <Field label="City" required error={errors.city}>
              <input type="text" value={form.city} onChange={(e) => setField('city', e.target.value)} className="input" />
            </Field>
            <Field label="Province (where the firm is based)" required className="md:col-span-2">
              <select value={form.province} onChange={(e) => setField('province', e.target.value)} className="input">
                {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          </div>

          <div className="mt-4" data-error={errors.regions_served ? 'true' : undefined}>
            <span className="block text-xs uppercase tracking-[0.2em] text-faint mb-2">
              Regions served <span className="text-gold-bright">*</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {PROVINCES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggleRegion(p)}
                  className={`px-3 py-2 rounded-lg text-xs uppercase tracking-[0.12em] transition-all ${regions.includes(p) ? 'bg-teal text-white' : 'bg-white/5 text-soft border border-white/10 hover:border-white/30'}`}
                >
                  {regions.includes(p) && '✓ '}{p}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={form.other_regions}
              onChange={(e) => setField('other_regions', e.target.value)}
              placeholder="Other areas (comma-separated) — e.g. Sandton, Midrand"
              className="input mt-3"
            />
            {errors.regions_served && <p className="mt-2 text-sm text-red-300">{errors.regions_served}</p>}
          </div>
        </FormSection>

        <FormSection title="3. About the firm">
          <Field label="Short practice notes" hint="optional — areas of focus, languages, etc.">
            <textarea rows={4} value={form.practice_notes} onChange={(e) => setField('practice_notes', e.target.value)} className="input resize-none" />
          </Field>
          <div className="mt-4">
            <span className="block text-xs uppercase tracking-[0.2em] text-faint mb-2">Firm logo (optional)</span>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl overflow-hidden border border-white/10 flex items-center justify-center bg-white/5">
                {logo ? <img src={logo} alt="logo" className="w-full h-full object-cover" /> : <span className="text-faint text-xs">No logo</span>}
              </div>
              <label className="btn-ghost cursor-pointer">
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="sr-only" onChange={(e) => handleLogo(e.target.files)} />
                {uploading ? 'Uploading…' : (logo ? 'Replace logo' : 'Upload logo')}
              </label>
              {logo && <button type="button" onClick={() => setLogo('')} className="text-sm text-soft hover:text-white">Remove</button>}
            </div>
            {errors.logo && <p className="mt-2 text-sm text-red-300">{errors.logo}</p>}
          </div>
        </FormSection>

        {/* Disclaimer */}
        <div className="rounded-2xl p-5 border border-white/10 bg-white/5 text-faint text-sm leading-relaxed">
          {CONVEYANCER_DISCLAIMER}
        </div>

        {/* Confirmation */}
        <FormSection title="4. Confirmation">
          <label data-error={errors.confirmation ? 'true' : undefined} className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => { setConfirmed(e.target.checked); if (errors.confirmation) setErrors((p) => { const n = { ...p }; delete n.confirmation; return n; }); }}
              className="mt-1 h-5 w-5 accent-teal flex-shrink-0"
            />
            <span className="text-sm text-white">{CONFIRMATION} <span className="text-gold-bright">*</span></span>
          </label>
          {errors.confirmation && <p className="mt-2 text-sm text-red-300">{errors.confirmation}</p>}
        </FormSection>

        <div className="card-soft rounded-2xl p-6">
          {errors.form && <p className="text-sm text-red-300 mb-4">{errors.form}</p>}
          <button type="submit" disabled={submitting || uploading || !confirmed} className="btn-gold w-full text-lg disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? 'Submitting…' : 'Submit my free listing'}
          </button>
          {!confirmed && <p className="mt-3 text-xs text-gold-bright text-center">Tick the confirmation above to continue.</p>}
          <p className="mt-3 text-xs text-faint text-center">Free listing. No payment, ever. Your firm appears once reviewed (usually within 48 hours).</p>
        </div>
      </form>

      <div className="mt-12 text-sm text-soft text-center">
        <Link to="/conveyancers" className="text-teal-bright hover:text-white">← Back to the directory</Link>
      </div>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-soft rounded-2xl p-6 md:p-8">
      <h2 className="font-display text-2xl text-white mb-6">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, required, error, hint, children, className }: { label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className || ''}`} data-error={error ? 'true' : undefined}>
      <span className="block text-xs uppercase tracking-[0.2em] text-faint mb-2">
        {label}{required && <span className="text-gold-bright"> *</span>}
        {hint && <span className="text-faint normal-case ml-2">({hint})</span>}
      </span>
      {children}
      {error && <span className="block mt-1 text-xs text-red-300">{error}</span>}
    </label>
  );
}
