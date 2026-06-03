import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dkn6tnxao';
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'homesconnect_listings';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`;

const PROVINCES = [
  'Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo',
  'Mpumalanga','Northern Cape','North West','Western Cape',
];

const PROPERTY_TYPES = ['house', 'apartment', 'townhouse', 'vacant land', 'commercial'];

type Seller = 'agent' | 'private';
type Tier = 'basic' | 'enhanced' | 'agency';

// The FSBO disclaimer text is fixed by the spec — show it verbatim.
const FSBO_DISCLAIMER =
  'This is a private listing platform. TownConnect does not act as an estate agent or ' +
  'property practitioner, does not negotiate, hold deposits, or charge commission on any ' +
  'sale. All negotiations and the sale itself are directly between the buyer and the ' +
  'seller. By listing, you confirm you are entitled to sell or let this property.';

// Tier id, price and photo limit are identical for both seller types. Only the
// top tier's NAME differs: agents see "Agency Package", private sellers see "Premium"
// (an individual is not an agency).
function tiersFor(seller: Seller): { id: Tier; name: string; price: string; amount: number; photoLimit: number; features: string[] }[] {
  return [
    { id: 'basic',    name: 'Basic Listing',    price: 'R99',  amount: 99,  photoLimit: 3,  features: ['1 listing', '3 photos', 'Bot visibility', 'Web listing', 'Lead notifications'] },
    { id: 'enhanced', name: 'Enhanced Listing', price: 'R249', amount: 249, photoLimit: 10, features: ['1 listing', '10 photos', 'Priority bot results', 'Video / tour links', 'Analytics', '1 featured / month'] },
    seller === 'private'
      ? { id: 'agency', name: 'Premium',        price: 'R999', amount: 999, photoLimit: 15, features: ['Up to 10 listings', '15 photos / listing', 'Top of results', 'Branded profile', '3 featured / month'] }
      : { id: 'agency', name: 'Agency Package', price: 'R999', amount: 999, photoLimit: 15, features: ['Up to 10 listings', '5 sub-accounts', '15 photos / listing', 'Top of results', 'Branded profile', '3 featured / month'] },
  ];
}

type FormState = {
  agent_name: string;
  agent_agency: string;
  agent_phone: string;
  agent_email: string;
  fidelity_fund: string;
  whatsapp: string;
  title: string;
  type: 'sale' | 'rent';
  price: string;
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  garage: number;
  size: string;
  address: string;
  garden: boolean;
  pool: boolean;
  pet_friendly: boolean;
  suburb: string;
  city: string;
  province: string;
  description: string;
};

const INITIAL: FormState = {
  agent_name: '', agent_agency: '', agent_phone: '', agent_email: '', fidelity_fund: '', whatsapp: '',
  title: '', type: 'sale', price: '', property_type: 'house',
  bedrooms: 3, bathrooms: 2, garage: 1, size: '', address: '',
  garden: false, pool: false, pet_friendly: false,
  suburb: '', city: '', province: 'Gauteng',
  description: '',
};

export default function ListPropertyPage() {
  const [params, setParams] = useSearchParams();
  const cancelled = params.get('cancelled') === 'true';
  const initialSeller: Seller = params.get('seller') === 'private' ? 'private' : 'agent';
  const initialTier = (params.get('tier') as Tier) || 'enhanced';

  const [seller, setSeller] = useState<Seller>(initialSeller);
  const [tier, setTier] = useState<Tier>(initialTier);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [disclaimerOk, setDisclaimerOk] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPrivate = seller === 'private';
  const TIERS = tiersFor(seller);

  useEffect(() => {
    const valid = TIERS.find((t) => t.id === initialTier);
    if (valid) setTier(initialTier);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTier]);

  const photoLimit = TIERS.find((t) => t.id === tier)!.photoLimit;
  const amount = TIERS.find((t) => t.id === tier)!.amount;

  function chooseSeller(next: Seller) {
    setSeller(next);
    setErrors({});
    setDisclaimerOk(false);
    // Reflect the choice in the URL so the page is shareable / bookmarkable.
    const p = new URLSearchParams(params);
    if (next === 'private') p.set('seller', 'private'); else p.delete('seller');
    p.delete('cancelled');
    setParams(p, { replace: true });
  }

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
    if (errors[k as string]) setErrors((prev) => { const n = { ...prev }; delete n[k as string]; return n; });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    const slotsLeft = photoLimit - images.length;
    const toUpload = Array.from(files).slice(0, slotsLeft);
    if (!toUpload.length) return;
    setUploading(true);
    setErrors((prev) => { const n = { ...prev }; delete n.images; return n; });

    try {
      const uploaded: string[] = [];
      for (const file of toUpload) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('upload_preset', CLOUDINARY_PRESET);
        const res = await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: fd });
        if (!res.ok) throw new Error(`Cloudinary ${res.status}`);
        const data = await res.json();
        if (data.secure_url) uploaded.push(data.secure_url);
      }
      setImages((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setErrors((prev) => ({ ...prev, images: 'One or more uploads failed — try again' }));
      console.error(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((u) => u !== url));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    const req = (k: keyof FormState, label: string) => {
      if (!String(form[k] ?? '').trim()) errs[k as string] = `${label} required`;
    };
    req('agent_name', isPrivate ? 'Full name' : 'Full name');
    req('agent_phone', 'Phone number');
    req('agent_email', 'Email');
    if (!isPrivate) req('fidelity_fund', 'FFC number');
    req('title', 'Property title');
    req('suburb', 'Suburb');
    req('city', 'City');
    req('description', 'Description');
    if (!form.price || Number(form.price) <= 0) errs.price = 'Price required (numeric)';
    if (form.agent_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.agent_email)) errs.agent_email = 'Enter a valid email';
    if (images.length === 0) errs.images = `Add at least 1 photo (up to ${photoLimit})`;
    if (isPrivate && !disclaimerOk) errs.disclaimer = 'Please accept the private-listing terms to continue';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAttemptedSubmit(true);
    if (!validate()) {
      const first = document.querySelector('[data-error="true"]') as HTMLElement | null;
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/.netlify/functions/list-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
          tier,
          images,
          seller_type: seller,
          // Private sellers don't have a Fidelity Fund Certificate.
          fidelity_fund: isPrivate ? '' : form.fidelity_fund,
          disclaimer_accepted: isPrivate ? disclaimerOk : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        else setErrors({ form: data.error || 'Submission failed' });
        setSubmitting(false);
        return;
      }
      // Build & submit a hidden form to PayFast
      submitToPayfast(data.payfast_url, data.params);
    } catch (err) {
      setErrors({ form: 'Network error — try again' });
      setSubmitting(false);
    }
  }

  function submitToPayfast(url: string, fields: Record<string, string>) {
    const f = document.createElement('form');
    f.method = 'POST';
    f.action = url;
    f.style.display = 'none';
    for (const [k, v] of Object.entries(fields)) {
      const input = document.createElement('input');
      input.type = 'hidden'; input.name = k; input.value = String(v);
      f.appendChild(input);
    }
    document.body.appendChild(f);
    f.submit();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-12 md:py-16">
      <p className="chip bg-white/5 text-gold-bright mb-4">List Your Property</p>
      <h1 className="font-display text-4xl md:text-5xl text-white">List Your Property on HomesConnect</h1>
      <p className="mt-3 text-soft max-w-2xl">
        Fill in the details below, choose a tier, and pay via PayFast. Your listing
        goes live on the website and WhatsApp bot within 48 hours.
      </p>

      {/* Seller-type chooser */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <SellerCard
          active={!isPrivate}
          onClick={() => chooseSeller('agent')}
          title="Estate agent"
          blurb="Registered agent or agency with a Fidelity Fund Certificate."
        />
        <SellerCard
          active={isPrivate}
          onClick={() => chooseSeller('private')}
          title="Private seller"
          blurb="Selling or letting your own property — no agent involved."
        />
      </div>

      {cancelled && (
        <div className="mt-6 rounded-2xl p-5 border border-gold/40 bg-gold/10 text-soft">
          Payment was cancelled. Your details are still on this page — fill in any missing fields and click <strong>Pay &amp; List</strong> to try again.
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-10 space-y-10">
        {/* Tier selection */}
        <FormSection title="1. Choose your tier">
          <div className="grid gap-4 md:grid-cols-3">
            {TIERS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTier(t.id);
                  if (images.length > t.photoLimit) setImages((prev) => prev.slice(0, t.photoLimit));
                }}
                className={`text-left rounded-2xl p-5 transition-all ${
                  tier === t.id
                    ? 'bg-teal/15 border-2 border-teal'
                    : 'card-soft border-2 border-transparent hover:border-white/20'
                }`}
              >
                <p className="font-display text-xl text-white">{t.name}</p>
                <p className="mt-2 font-display text-3xl text-gold-bright">{t.price}<span className="text-xs text-faint ml-1">/mo</span></p>
                <ul className="mt-3 space-y-1 text-xs text-soft">
                  {t.features.slice(0, 4).map((f) => <li key={f}>· {f}</li>)}
                </ul>
              </button>
            ))}
          </div>
        </FormSection>

        {/* Contact details */}
        <FormSection title={isPrivate ? '2. Your contact details' : '2. Agent details'}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Full name" required error={errors.agent_name}>
              <input type="text" value={form.agent_name} onChange={(e) => setField('agent_name', e.target.value)} className="input" />
            </Field>
            {!isPrivate && (
              <Field label="Agency name" hint="optional">
                <input type="text" value={form.agent_agency} onChange={(e) => setField('agent_agency', e.target.value)} className="input" />
              </Field>
            )}
            <Field label="Phone" required error={errors.agent_phone}>
              <input type="tel" placeholder="0821234567" value={form.agent_phone} onChange={(e) => setField('agent_phone', e.target.value)} className="input" />
            </Field>
            {isPrivate && (
              <Field label="WhatsApp number" hint="optional — defaults to your phone">
                <input type="tel" placeholder="0821234567" value={form.whatsapp} onChange={(e) => setField('whatsapp', e.target.value)} className="input" />
              </Field>
            )}
            <Field label="Email" required error={errors.agent_email}>
              <input type="email" value={form.agent_email} onChange={(e) => setField('agent_email', e.target.value)} className="input" />
            </Field>
            {!isPrivate && (
              <Field label="Fidelity Fund Certificate number" required error={errors.fidelity_fund} className="md:col-span-2">
                <input type="text" value={form.fidelity_fund} onChange={(e) => setField('fidelity_fund', e.target.value)} className="input" />
              </Field>
            )}
          </div>
        </FormSection>

        {/* Property details */}
        <FormSection title="3. Property details">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Property title" required error={errors.title} className="md:col-span-2">
              <input type="text" placeholder="e.g. Modern 3-Bed Family Home" value={form.title} onChange={(e) => setField('title', e.target.value)} className="input" />
            </Field>
            <Field label="Listing type" required>
              <div className="flex gap-3">
                <RadioCard label="For sale" checked={form.type === 'sale'} onClick={() => setField('type', 'sale')} />
                <RadioCard label="To let" checked={form.type === 'rent'} onClick={() => setField('type', 'rent')} />
              </div>
            </Field>
            <Field label={form.type === 'rent' ? 'Monthly rent (R)' : 'Price (R)'} required error={errors.price}>
              <input type="number" min={0} step={1000} placeholder="e.g. 2250000" value={form.price} onChange={(e) => setField('price', e.target.value)} className="input" />
            </Field>
            <Field label="Property type" required>
              <select value={form.property_type} onChange={(e) => setField('property_type', e.target.value)} className="input">
                {PROPERTY_TYPES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
              </select>
            </Field>
            <Field label="Size (m²)" hint="optional">
              <input type="number" min={0} step={1} placeholder="e.g. 180" value={form.size} onChange={(e) => setField('size', e.target.value)} className="input" />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Beds"><NumStepper value={form.bedrooms} min={1} max={10} onChange={(v) => setField('bedrooms', v)} /></Field>
              <Field label="Baths"><NumStepper value={form.bathrooms} min={1} max={5} onChange={(v) => setField('bathrooms', v)} /></Field>
              <Field label="Garage"><NumStepper value={form.garage} min={0} max={4} onChange={(v) => setField('garage', v)} /></Field>
            </div>
            <Field label="Features">
              <div className="flex flex-wrap gap-2">
                <Toggle label="Garden" on={form.garden} onClick={() => setField('garden', !form.garden)} />
                <Toggle label="Pool" on={form.pool} onClick={() => setField('pool', !form.pool)} />
                <Toggle label="Pet friendly" on={form.pet_friendly} onClick={() => setField('pet_friendly', !form.pet_friendly)} />
              </div>
            </Field>
            <Field label="Suburb" required error={errors.suburb}>
              <input type="text" value={form.suburb} onChange={(e) => setField('suburb', e.target.value)} className="input" />
            </Field>
            <Field label="City" required error={errors.city}>
              <input type="text" value={form.city} onChange={(e) => setField('city', e.target.value)} className="input" />
            </Field>
            <Field label="Province" required>
              <select value={form.province} onChange={(e) => setField('province', e.target.value)} className="input">
                {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Street address" hint="optional / approximate" className="md:col-span-2">
              <input type="text" placeholder="e.g. 12 Oak Avenue (or leave blank)" value={form.address} onChange={(e) => setField('address', e.target.value)} className="input" />
            </Field>
            <Field label="Description" hint="2-3 sentences" required error={errors.description} className="md:col-span-2">
              <textarea rows={4} value={form.description} onChange={(e) => setField('description', e.target.value)} className="input resize-none" />
            </Field>
          </div>
        </FormSection>

        {/* Photos */}
        <FormSection title={`4. Photos (up to ${photoLimit})`}>
          <p className="text-soft text-sm mb-4">First photo becomes the main listing image. Drag &amp; drop or click below.</p>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {images.map((url, i) => (
              <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-white/10 group">
                <img src={url} alt="" className="w-full h-full object-cover" />
                {i === 0 && <span className="absolute top-1 left-1 chip bg-gold/90 text-bg-dark text-[9px] tracking-[0.1em]">Main</span>}
                <button type="button" onClick={() => removeImage(url)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white text-xs hover:bg-red-500">✕</button>
              </div>
            ))}
            {images.length < photoLimit && (
              <label className="aspect-square rounded-lg border-2 border-dashed border-white/15 hover:border-teal/50 flex items-center justify-center cursor-pointer transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <span className="text-soft text-xs text-center px-2">
                  {uploading ? 'Uploading…' : (<><span className="block text-2xl text-teal-bright">+</span>Add photo</>)}
                </span>
              </label>
            )}
          </div>
          {errors.images && <p data-error="true" className="mt-3 text-sm text-red-300">{errors.images}</p>}
        </FormSection>

        {/* FSBO disclaimer — private sellers only */}
        {isPrivate && (
          <FormSection title="5. Private-listing terms">
            <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-soft text-sm leading-relaxed">
              {FSBO_DISCLAIMER}
            </div>
            <label
              data-error={errors.disclaimer ? 'true' : undefined}
              className="mt-4 flex items-start gap-3 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={disclaimerOk}
                onChange={(e) => {
                  setDisclaimerOk(e.target.checked);
                  if (errors.disclaimer) setErrors((prev) => { const n = { ...prev }; delete n.disclaimer; return n; });
                }}
                className="mt-1 h-5 w-5 accent-teal flex-shrink-0"
              />
              <span className="text-sm text-white">
                I have read and accept the private-listing terms above, and confirm I am
                entitled to sell or let this property. <span className="text-gold-bright">*</span>
              </span>
            </label>
            {errors.disclaimer && <p className="mt-2 text-sm text-red-300">{errors.disclaimer}</p>}
          </FormSection>
        )}

        {/* Submit */}
        <div className="card-soft rounded-2xl p-6">
          {errors.form && <p className="text-sm text-red-300 mb-4">{errors.form}</p>}
          <button
            type="submit"
            disabled={submitting || uploading || (isPrivate && !disclaimerOk)}
            className="btn-gold w-full text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Redirecting to PayFast…' : `Pay R${amount} & List My Property`}
          </button>
          {isPrivate && attemptedSubmit && !disclaimerOk && (
            <p className="mt-3 text-xs text-gold-bright text-center">Tick the private-listing terms above to continue.</p>
          )}
          <p className="mt-3 text-xs text-faint text-center">
            Payment is processed securely by PayFast. Your listing goes live within 48 hours of payment.
          </p>
        </div>
      </form>

      <div className="mt-12 text-sm text-soft text-center">
        Questions? <Link to="/" className="text-teal-bright hover:text-white">Back to home</Link> · WhatsApp{' '}
        <a href="https://wa.me/27767959872" target="_blank" rel="noreferrer" className="text-teal-bright hover:text-white">+27 76 795 9872</a>
      </div>
    </div>
  );
}

function SellerCard({ active, onClick, title, blurb }: { active: boolean; onClick: () => void; title: string; blurb: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-2xl p-5 transition-all ${
        active ? 'bg-teal/15 border-2 border-teal' : 'card-soft border-2 border-transparent hover:border-white/20'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-4 w-4 rounded-full border-2 ${active ? 'border-teal bg-teal' : 'border-white/30'}`} />
        <p className="font-display text-lg text-white">{title}</p>
      </div>
      <p className="mt-2 text-xs text-soft">{blurb}</p>
    </button>
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

function RadioCard({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${checked ? 'bg-teal text-white' : 'bg-white/5 text-soft border border-white/10 hover:border-white/30'}`}>
      {label}
    </button>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`px-3 py-2 rounded-lg text-xs uppercase tracking-[0.15em] transition-all ${on ? 'bg-teal text-white' : 'bg-white/5 text-soft border border-white/10 hover:border-white/30'}`}>
      {on && '✓ '}{label}
    </button>
  );
}

function NumStepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center bg-white/5 border border-white/10 rounded-lg">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="w-9 h-9 text-soft hover:text-white">−</button>
      <span className="flex-1 text-center font-display text-lg text-white">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} className="w-9 h-9 text-soft hover:text-white">+</button>
    </div>
  );
}
