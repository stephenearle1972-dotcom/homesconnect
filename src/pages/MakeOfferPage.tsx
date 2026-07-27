import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { loadListings } from '../lib/loadListings';
import type { Listing } from '../lib/types';
import { NONBINDING_NOTICE } from '../lib/constants';
import { formatRand as rand } from '../lib/format';

type Stage = 'verify' | 'form' | 'review' | 'done';
const ENTITY = [['individual', 'An individual'], ['company', 'A company'], ['trust', 'A trust'], ['other', 'Other']];

export default function MakeOfferPage() {
  const [params] = useSearchParams();
  const listingId = params.get('listing') || '';
  const [listing, setListing] = useState<Listing | null | undefined>(undefined);
  const [stage, setStage] = useState<Stage>('verify');

  // verification
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [verifyToken, setVerifyToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // proposal form
  const [f, setF] = useState({
    buyer_name: '', buyer_entity_type: 'individual', proposed_price: '',
    funding_method: 'bond', bond_amount: '', cash_contribution: '', deposit_amount: '',
    subject_to_sale: 'no', subject_to_sale_note: '', occupation_date: '',
    proposal_expiry: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
    note_to_seller: '', note_for_conveyancer: '',
  });
  const [consents, setConsents] = useState({ disclosure_received: false, nonbinding: false, share_seller: false, conveyancer_later: false, privacy: false, marketing: false });
  const [aiSummary, setAiSummary] = useState('');
  const [explain, setExplain] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [offerId, setOfferId] = useState('');
  const [disclosure, setDisclosure] = useState<any>(null);

  useEffect(() => { loadListings().then((all) => setListing(all.find((l) => l.id === listingId) || null)); }, [listingId]);
  // Seller's property-condition disclosure record (no PII) — shown to the buyer before submit.
  useEffect(() => {
    if (!listingId) return;
    fetch(`/.netlify/functions/mao-disclosure?listing=${encodeURIComponent(listingId)}`)
      .then((r) => (r.ok ? r.json() : null)).then(setDisclosure).catch(() => {});
  }, [listingId]);

  function downloadDisclosure() {
    if (!disclosure) return;
    const d = disclosure.disclosure || {};
    const txt = [
      `HomesConnect — Seller's property-condition disclosure record`,
      `Property: ${disclosure.listing?.title} (${disclosure.listing?.id}) — ${disclosure.listing?.suburb}, ${disclosure.listing?.city}`,
      `Seller: ${disclosure.seller_name}`,
      disclosure.disclosed_at ? `Disclosed: ${disclosure.disclosed_at}` : '',
      ``,
      `Occupancy: ${d.occupancy || '-'}`,
      `Known defects: ${d.known_defects || '-'}`,
      `Additions/alterations approved: ${d.additions_approved || '-'}`,
      `Other notes: ${d.notes || '-'}`,
      ``,
      `The seller declared this record complete to the best of their knowledge. Verify independently; this is for discussion and does not create a binding sale.`,
    ].filter(Boolean).join('\n');
    const url = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
    const a = document.createElement('a'); a.href = url; a.download = `disclosure-${listingId}.txt`; a.click();
    URL.revokeObjectURL(url);
  }

  const price = Number(f.proposed_price) || 0;
  const bond = Number(f.bond_amount) || 0;
  const cash = Number(f.cash_contribution) || 0;
  const arithmeticOk = f.funding_method !== 'mixed' || (price > 0 && bond + cash === price);

  function set<K extends keyof typeof f>(k: K, v: string) { setF((p) => ({ ...p, [k]: v })); }

  async function api(path: string, body: any) {
    const res = await fetch(`/.netlify/functions/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  async function sendCode() {
    setErr(''); setBusy(true);
    const { ok, data } = await api('mao-otp-request', { phone, email });
    setBusy(false);
    if (!ok) { setErr(data.error || 'Could not send code'); return; }
    setChallengeId(data.challengeId); setCodeSent(true);
  }
  async function verifyCode() {
    setErr(''); setBusy(true);
    const { ok, data } = await api('mao-otp-verify', { challengeId, code });
    setBusy(false);
    if (!ok) { setErr(data.error || 'Incorrect code'); return; }
    setVerifyToken(data.verifyToken); setStage('form');
  }

  async function askExplain(field: string) {
    setExplain((p) => ({ ...p, [field]: '…' }));
    const { data } = await api('mao-ai', { action: 'explain', field });
    setExplain((p) => ({ ...p, [field]: data.text || 'No explanation available.' }));
  }

  function validateForm(): boolean {
    const e: Record<string, string> = {};
    if (!f.buyer_name.trim()) e.buyer_name = 'Your name is required';
    if (!(price > 0)) e.proposed_price = 'Enter a proposed price';
    if (f.funding_method === 'mixed' && !arithmeticOk) e.arithmetic = `Bond (${rand(bond)}) + cash (${rand(cash)}) must equal the proposed price (${rand(price)}).`;
    if (f.subject_to_sale === 'yes' && !f.subject_to_sale_note.trim()) e.subject_to_sale_note = 'Add a short note';
    setErrors(e); return Object.keys(e).length === 0;
  }

  async function goReview() {
    if (!validateForm()) return;
    setStage('review'); setAiSummary('…');
    // POPIA s72 — send ONLY de-identified numeric/enum fields to the AI. No name, no notes.
    const { data } = await api('mao-ai', { action: 'summarize', offer: {
      proposed_price: price, funding_method: f.funding_method, bond_amount: bond,
      cash_contribution: cash, deposit_amount: Number(f.deposit_amount) || 0,
      subject_to_sale: f.subject_to_sale, occupation_date: f.occupation_date, proposal_expiry: f.proposal_expiry,
    } });
    setAiSummary(data.text || '');
  }

  const allConsents = consents.disclosure_received && consents.nonbinding && consents.share_seller && consents.conveyancer_later && consents.privacy;

  async function submit() {
    setErr('');
    if (!allConsents) { setErr('Please tick all required acknowledgements and consents.'); return; }
    setBusy(true);
    const { ok, data } = await api('mao-submit', {
      listing_id: listingId, challengeId, verifyToken,
      buyer_name: f.buyer_name, buyer_entity_type: f.buyer_entity_type,
      proposed_price: price, funding_method: f.funding_method,
      bond_amount: bond, cash_contribution: cash, deposit_amount: f.deposit_amount,
      subject_to_sale: f.subject_to_sale, subject_to_sale_note: f.subject_to_sale_note,
      occupation_date: f.occupation_date, proposal_expiry: f.proposal_expiry,
      note_to_seller: f.note_to_seller, note_for_conveyancer: f.note_for_conveyancer,
      ack_nonbinding: consents.nonbinding, consent_share_seller: consents.share_seller,
      ack_conveyancer_later: consents.conveyancer_later, ack_privacy: consents.privacy,
      ack_disclosure_received: consents.disclosure_received,
      marketing_consent: consents.marketing,
    });
    setBusy(false);
    if (!ok) { setErr(data.error || 'Submission failed'); if (data.errors) setErrors(data.errors); return; }
    setOfferId(data.offer_id); setStage('done');
  }

  if (listing === undefined) return <Wrap><p className="text-soft">Loading…</p></Wrap>;
  if (listing === null) return <Wrap><p className="font-display text-2xl text-white">Listing not found.</p><Link to="/listings" className="text-teal-bright">← Listings</Link></Wrap>;
  if (listing.sellerType !== 'private' || !listing.makeAnOfferEnabled) {
    return <Wrap><p className="font-display text-2xl text-white">This listing is not accepting proposed terms.</p><Link to={`/listing/${listing.id}`} className="text-teal-bright">← Back to listing</Link></Wrap>;
  }

  return (
    <Wrap>
      <p className="chip bg-white/5 text-gold-bright mb-4">Make an Offer</p>
      <h1 className="font-display text-3xl md:text-5xl text-white">Send non-binding proposed terms</h1>
      <Notice />

      {/* locked property summary */}
      <div className="mt-6 card-soft rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-faint mb-1">Property</p>
        <p className="font-display text-xl text-white">{listing.title}</p>
        <p className="text-soft text-sm">{listing.suburb}, {listing.city}, {listing.province} · Listed at {listing.priceDisplay}</p>
      </div>

      {stage === 'verify' && (
        <Section title="1. Verify your mobile number">
          <p className="text-soft text-sm mb-4">We'll email you a 6-digit code to verify your number before you can send proposed terms.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Mobile number"><input className="input" type="tel" placeholder="082 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={codeSent} /></Field>
            <Field label="Email"><input className="input" type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={codeSent} /></Field>
          </div>
          {!codeSent
            ? <button className="btn-gold mt-5" disabled={busy} onClick={sendCode}>{busy ? 'Sending…' : 'Email me a code'}</button>
            : (<div className="mt-5">
                <Field label="Enter the 6-digit code"><input className="input max-w-[12rem]" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></Field>
                <div className="mt-4 flex gap-3">
                  <button className="btn-gold" disabled={busy || code.length < 6} onClick={verifyCode}>{busy ? 'Verifying…' : 'Verify & continue'}</button>
                  <button className="btn-ghost" disabled={busy} onClick={sendCode}>Resend</button>
                </div>
              </div>)}
          {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
        </Section>
      )}

      {stage === 'form' && (
        <Section title="2. Your proposed terms">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Your full name" error={errors.buyer_name}><input className="input" value={f.buyer_name} onChange={(e) => set('buyer_name', e.target.value)} /></Field>
            <Field label="Who is buying?" explainKey="buyer_entity_type" onExplain={askExplain} explain={explain.buyer_entity_type}>
              <select className="input" value={f.buyer_entity_type} onChange={(e) => set('buyer_entity_type', e.target.value)}>{ENTITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </Field>
            <Field label="Proposed price (R)" error={errors.proposed_price} explainKey="proposed_price" onExplain={askExplain} explain={explain.proposed_price}>
              <input className="input" type="number" min={0} value={f.proposed_price} onChange={(e) => set('proposed_price', e.target.value)} />
            </Field>
            <Field label="Funding method" explainKey="funding_method" onExplain={askExplain} explain={explain.funding_method}>
              <select className="input" value={f.funding_method} onChange={(e) => set('funding_method', e.target.value)}>
                <option value="cash">Cash</option><option value="bond">Bond (home loan)</option><option value="mixed">Mixed (bond + cash)</option>
              </select>
            </Field>
            {f.funding_method !== 'cash' && <Field label="Bond amount (R)"><input className="input" type="number" min={0} value={f.bond_amount} onChange={(e) => set('bond_amount', e.target.value)} /></Field>}
            {f.funding_method !== 'bond' && <Field label="Cash contribution (R)"><input className="input" type="number" min={0} value={f.cash_contribution} onChange={(e) => set('cash_contribution', e.target.value)} /></Field>}
            <Field label="Deposit (R)" hint="optional" explainKey="deposit_amount" onExplain={askExplain} explain={explain.deposit_amount}><input className="input" type="number" min={0} value={f.deposit_amount} onChange={(e) => set('deposit_amount', e.target.value)} /></Field>
            <Field label="Preferred occupation date" hint="optional"><input className="input" type="date" value={f.occupation_date} onChange={(e) => set('occupation_date', e.target.value)} /></Field>
            <Field label="Subject to sale of another property?"><select className="input" value={f.subject_to_sale} onChange={(e) => set('subject_to_sale', e.target.value)}><option value="no">No</option><option value="yes">Yes</option></select></Field>
            <Field label="Proposal valid until" explainKey="proposal_expiry" onExplain={askExplain} explain={explain.proposal_expiry}><input className="input" type="date" value={f.proposal_expiry} onChange={(e) => set('proposal_expiry', e.target.value)} /></Field>
            {f.subject_to_sale === 'yes' && <Field label="Note about the property you must sell" error={errors.subject_to_sale_note} className="md:col-span-2"><input className="input" value={f.subject_to_sale_note} onChange={(e) => set('subject_to_sale_note', e.target.value)} /></Field>}
            <Field label="Short note to the seller" hint="optional" className="md:col-span-2"><textarea className="input resize-none" rows={2} value={f.note_to_seller} onChange={(e) => set('note_to_seller', e.target.value)} /></Field>
            <Field label="Note for the conveyancer" hint="optional — only shared if the seller proceeds" className="md:col-span-2"><textarea className="input resize-none" rows={2} value={f.note_for_conveyancer} onChange={(e) => set('note_for_conveyancer', e.target.value)} /></Field>
          </div>
          {f.funding_method === 'mixed' && !arithmeticOk && price > 0 && (
            <p className="mt-4 text-sm text-gold-bright">⚠ Bond ({rand(bond)}) + cash ({rand(cash)}) = {rand(bond + cash)}, which must equal the proposed price ({rand(price)}).</p>
          )}
          {errors.arithmetic && <p className="mt-2 text-sm text-red-300">{errors.arithmetic}</p>}
          <button className="btn-gold mt-6" onClick={goReview} disabled={f.funding_method === 'mixed' && !arithmeticOk}>Review my proposed terms</button>
        </Section>
      )}

      {stage === 'review' && (
        <Section title="3. Review & send">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-soft text-sm leading-relaxed">
            <p className="text-xs uppercase tracking-[0.2em] text-faint mb-2">Plain-language summary</p>
            {aiSummary === '…' ? 'Preparing summary…' : (aiSummary || `You are proposing ${rand(price)} (${f.funding_method}).`)}
          </div>
          <ul className="mt-4 text-sm text-soft space-y-1">
            <li>Proposed price: <strong className="text-white">{rand(price)}</strong></li>
            <li>Funding: {f.funding_method}{f.funding_method === 'mixed' ? ` (bond ${rand(bond)} + cash ${rand(cash)})` : ''}</li>
            {f.deposit_amount && <li>Deposit: {rand(Number(f.deposit_amount))}</li>}
            <li>Subject to another sale: {f.subject_to_sale === 'yes' ? `Yes — ${f.subject_to_sale_note}` : 'No'}</li>
            {f.occupation_date && <li>Occupation: {f.occupation_date}</li>}
            <li>Valid until: {f.proposal_expiry}</li>
          </ul>

          {/* Seller's property-condition disclosure record (shown before submit) */}
          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.2em] text-faint">Seller's property-condition disclosure</p>
              {disclosure && <button type="button" onClick={downloadDisclosure} className="text-xs text-teal-bright hover:text-white">Download</button>}
            </div>
            {disclosure ? (
              <ul className="mt-3 text-sm text-soft space-y-1">
                <li>Occupancy: {disclosure.disclosure?.occupancy || '—'}</li>
                <li>Known defects: {disclosure.disclosure?.known_defects || '—'}</li>
                <li>Additions/alterations approved: {disclosure.disclosure?.additions_approved || '—'}</li>
                {disclosure.disclosure?.notes && <li>Other notes: {disclosure.disclosure.notes}</li>}
                <li className="text-faint text-xs pt-1">Declared by {disclosure.seller_name} as complete to the best of their knowledge. Verify independently.</li>
              </ul>
            ) : <p className="mt-2 text-sm text-faint">Loading the seller's disclosure record…</p>}
          </div>

          <div className="mt-6 space-y-3">
            <Check checked={consents.disclosure_received} onChange={(v) => setConsents((p) => ({ ...p, disclosure_received: v }))}>I confirm that I have received access to the seller's property-condition disclosure record before submitting my proposed terms.</Check>
            <Check checked={consents.nonbinding} onChange={(v) => setConsents((p) => ({ ...p, nonbinding: v }))}>I understand this is <strong>non-binding</strong> and does not create a sale.</Check>
            <Check checked={consents.share_seller} onChange={(v) => setConsents((p) => ({ ...p, share_seller: v }))}>I consent to sharing these proposed terms with the seller.</Check>
            <Check checked={consents.conveyancer_later} onChange={(v) => setConsents((p) => ({ ...p, conveyancer_later: v }))}>I understand my personal details go to a conveyancer only if the seller proceeds and I consent at that point.</Check>
            <Check checked={consents.privacy} onChange={(v) => setConsents((p) => ({ ...p, privacy: v }))}>I have read the <Link to="/privacy" className="text-teal-bright underline">privacy notice</Link>.</Check>
            <Check checked={consents.marketing} onChange={(v) => setConsents((p) => ({ ...p, marketing: v }))}>(Optional) I'm happy to receive occasional HomesConnect updates.</Check>
          </div>

          <div className="mt-6 rounded-xl border border-gold/30 bg-gold/5 p-4 text-soft text-sm leading-relaxed">{NONBINDING_NOTICE}</div>
          {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
          <div className="mt-5 flex gap-3">
            <button className="btn-ghost" onClick={() => setStage('form')}>← Edit</button>
            <button className="btn-gold" disabled={busy || !allConsents} onClick={submit}>{busy ? 'Sending…' : 'Send non-binding proposed terms'}</button>
          </div>
          {!allConsents && <p className="mt-3 text-xs text-gold-bright">Tick the required acknowledgements above to send.</p>}
        </Section>
      )}

      {stage === 'done' && (
        <Section title="Sent ✓">
          <p className="text-soft">Thank you. Your <strong className="text-white">non-binding proposed terms</strong> have been sent to the seller for consideration. Reference <span className="font-mono text-teal-bright">{offerId}</span>.</p>
          <p className="text-soft mt-3 text-sm">The seller may request clarification, invite revised terms, proceed to a formal Offer to Purchase, or decline. We've emailed you a confirmation.</p>
          <div className="mt-4 rounded-xl border border-gold/30 bg-gold/5 p-4 text-soft text-sm">{NONBINDING_NOTICE}</div>
          <Link to={`/listing/${listing.id}`} className="btn-ghost mt-6 inline-block">← Back to listing</Link>
        </Section>
      )}
    </Wrap>
  );
}

function Notice() {
  return <div className="mt-4 rounded-2xl border border-gold/30 bg-gold/5 p-4 text-soft text-sm leading-relaxed">{NONBINDING_NOTICE}</div>;
}
function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="max-w-3xl mx-auto px-4 md:px-8 py-12 md:py-16">{children}</div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-8 card-soft rounded-2xl p-6 md:p-8"><h2 className="font-display text-2xl text-white mb-5">{title}</h2>{children}</section>;
}
function Field({ label, hint, error, children, className, explainKey, onExplain, explain }: { label: string; hint?: string; error?: string; children: React.ReactNode; className?: string; explainKey?: string; onExplain?: (k: string) => void; explain?: string }) {
  return (
    <label className={`block ${className || ''}`}>
      <span className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-faint mb-2">
        {label}{hint && <span className="text-faint normal-case">({hint})</span>}
        {explainKey && onExplain && <button type="button" onClick={() => onExplain(explainKey)} className="ml-auto normal-case text-teal-bright hover:text-white text-[11px]">explain</button>}
      </span>
      {children}
      {explain && <span className="block mt-1 text-xs text-teal-bright/90 normal-case">{explain}</span>}
      {error && <span className="block mt-1 text-xs text-red-300">{error}</span>}
    </label>
  );
}
function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-5 w-5 accent-teal flex-shrink-0" />
      <span className="text-sm text-white">{children}</span>
    </label>
  );
}
