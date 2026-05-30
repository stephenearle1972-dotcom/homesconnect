import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { loadListings } from '../lib/loadListings';
import { loadConveyancers, type Conveyancer } from '../lib/conveyancers';
import type { Listing } from '../lib/types';
import { NONBINDING_NOTICE, FRAUD_NOTICE, COMPANY, ADDON } from '../lib/constants';

const rand = (n: number) => 'R ' + (Number(n) || 0).toLocaleString('en-ZA');

async function api(path: string, body: any) {
  const res = await fetch(`/.netlify/functions/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}
function payfastRedirect(url: string, fields: Record<string, string>) {
  const form = document.createElement('form'); form.method = 'POST'; form.action = url; form.style.display = 'none';
  Object.entries(fields).forEach(([k, v]) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = String(v); form.appendChild(i); });
  document.body.appendChild(form); form.submit();
}

export default function SellerPortalPage() {
  const [params] = useSearchParams();
  const listingId = params.get('listing') || '';
  const token = params.get('token') || '';
  const justEnabled = params.get('enabled') === '1';
  const enableCancelled = params.get('enable_cancelled') === '1';

  const [listing, setListing] = useState<Listing | null | undefined>(undefined);
  const [view, setView] = useState<'loading' | 'enable' | 'requestlink' | 'dashboard' | 'invalid'>('loading');
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const all = await loadListings();
      const l = all.find((x) => x.id === listingId) || null;
      setListing(l);
      if (!l) { setView('invalid'); return; }
      if (token) {
        const res = await fetch(`/.netlify/functions/mao-offers?listing=${encodeURIComponent(listingId)}&token=${encodeURIComponent(token)}`);
        if (res.ok) { setData(await res.json()); setView('dashboard'); return; }
        setView('invalid'); return;
      }
      setView(l.makeAnOfferEnabled ? 'requestlink' : 'enable');
    })();
  }, [listingId, token]);

  if (view === 'loading') return <Wrap><p className="text-soft">Loading…</p></Wrap>;
  if (view === 'invalid' || listing === null) return <Wrap><p className="font-display text-2xl text-white">This link is invalid or has expired.</p><Link to="/" className="text-teal-bright">← Home</Link></Wrap>;

  if (view === 'enable') return <EnableView listing={listing!} cancelled={enableCancelled} />;
  if (view === 'requestlink') return <RequestLinkView listing={listing!} />;
  return <Dashboard listing={listing!} token={token} data={data} justEnabled={justEnabled} onReload={async () => { const r = await fetch(`/.netlify/functions/mao-offers?listing=${encodeURIComponent(listingId)}&token=${encodeURIComponent(token)}`); if (r.ok) setData(await r.json()); }} err={err} setErr={setErr} />;
}

// ---------- Enable (paid add-on, ECTA-compliant checkout) ----------
function EnableView({ listing, cancelled }: { listing: Listing; cancelled: boolean }) {
  const [estage, setEstage] = useState<'form' | 'review'>('form');
  const [f, setF] = useState({ seller_name: listing.agentName || '', seller_email: '', cond_occupancy: '', cond_known_defects: '', cond_additions_approved: '', cond_notes: '' });
  const [acks, setAcks] = useState({ authority: false, nonbinding: false, nominate_later: false, owner_or_authorised: false, mandate_disclosed: false, disclosure_complete: false });
  const [immediate, setImmediate] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.seller_email);
  const declarationsOk = acks.authority && acks.nonbinding && acks.nominate_later && acks.owner_or_authorised && acks.mandate_disclosed && acks.disclosure_complete;
  const formReady = emailOk && declarationsOk;

  async function placeOrder() {
    setBusy(true); setErr('');
    const { ok, data } = await api('mao-enable', {
      listing_id: listing.id, ...f,
      confirm_authority: acks.authority, ack_nonbinding: acks.nonbinding, ack_nominate_later: acks.nominate_later,
      decl_owner_or_authorised: acks.owner_or_authorised, decl_mandate_disclosed: acks.mandate_disclosed,
      decl_disclosure_complete: acks.disclosure_complete, consent_immediate_activation: immediate,
    });
    setBusy(false);
    if (!ok) { setErr(data.error || 'Could not start checkout'); return; }
    payfastRedirect(data.payfast_url, data.params);
  }

  return (
    <Wrap>
      <p className="chip bg-white/5 text-gold-bright mb-4">Seller · Make an Offer add-on</p>
      <h1 className="font-display text-3xl md:text-5xl text-white">Enable “Make an Offer” for {listing.title}</h1>
      <div className="mt-4 rounded-2xl border border-gold/30 bg-gold/5 p-4 text-soft text-sm">{NONBINDING_NOTICE}</div>
      {cancelled && <div className="mt-4 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-soft text-sm">Checkout was cancelled — your details are saved. Review and try again.</div>}

      {/* ECTA supplier + product disclosures (always visible) */}
      <Section title="About this purchase">
        <p className="text-soft text-sm"><strong className="text-white">{COMPANY.name}</strong> · Reg {COMPANY.reg}</p>
        <p className="text-faint text-xs mt-1">{COMPANY.address}</p>
        <p className="text-faint text-xs">Tel {COMPANY.phone} · {COMPANY.email} · {COMPANY.website}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-faint mb-1">Product</p>
            <p className="text-soft text-sm">{ADDON.name} — <strong className="text-white">{ADDON.price}</strong> once-off (paid via PayFast card/EFT).</p>
            <p className="text-faint text-xs mt-1">{ADDON.duration}</p>
            <p className="text-xs uppercase tracking-[0.2em] text-faint mt-3 mb-1">Included</p>
            <ul className="text-soft text-xs space-y-0.5">{ADDON.includes.map((x) => <li key={x}>✓ {x}</li>)}</ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-faint mb-1">Explicitly excluded</p>
            <ul className="text-soft text-xs space-y-0.5">{ADDON.excludes.map((x) => <li key={x}>· {x}</li>)}</ul>
            <p className="text-xs uppercase tracking-[0.2em] text-faint mt-3 mb-1">Refunds</p>
            <p className="text-faint text-xs">{ADDON.refund}</p>
          </div>
        </div>
        <p className="mt-3 text-faint text-xs">{ADDON.privacy}</p>
        <p className="mt-2 text-faint text-xs">Transaction record: an invoice is emailed to you on activation; your proposals and record are always available via your private seller link.</p>
        <p className="mt-3 text-soft text-xs border-t border-white/10 pt-3">{ADDON.conduct}</p>
      </Section>

      {estage === 'form' && (<>
        <Section title="Your details & property-condition disclosure">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Your name"><input className="input" value={f.seller_name} onChange={(e) => setF({ ...f, seller_name: e.target.value })} /></Field>
            <Field label="Email for proposal notifications"><input className="input" type="email" value={f.seller_email} onChange={(e) => setF({ ...f, seller_email: e.target.value })} /></Field>
            <Field label="Current occupancy" hint="e.g. owner-occupied / tenanted" className="md:col-span-2"><input className="input" value={f.cond_occupancy} onChange={(e) => setF({ ...f, cond_occupancy: e.target.value })} /></Field>
            <Field label="Known defects" hint="brief" className="md:col-span-2"><textarea className="input resize-none" rows={2} value={f.cond_known_defects} onChange={(e) => setF({ ...f, cond_known_defects: e.target.value })} /></Field>
            <Field label="Additions/alterations approved?" className="md:col-span-2"><input className="input" value={f.cond_additions_approved} onChange={(e) => setF({ ...f, cond_additions_approved: e.target.value })} /></Field>
            <Field label="Other disclosure notes" hint="optional" className="md:col-span-2"><textarea className="input resize-none" rows={2} value={f.cond_notes} onChange={(e) => setF({ ...f, cond_notes: e.target.value })} /></Field>
          </div>
          <p className="text-faint text-xs mt-2">This disclosure record will be shown to buyers who submit proposed terms.</p>
          <div className="mt-5 space-y-3">
            <Check checked={acks.owner_or_authorised} onChange={(v) => setAcks({ ...acks, owner_or_authorised: v })}>I am the registered owner of the property or am duly authorised to act on behalf of the owner.</Check>
            <Check checked={acks.mandate_disclosed} onChange={(v) => setAcks({ ...acks, mandate_disclosed: v })}>I have disclosed whether the property is subject to an estate-agent mandate, sole mandate, option, right of first refusal, existing agreement of sale, or other restriction affecting marketing or sale.</Check>
            <Check checked={acks.disclosure_complete} onChange={(v) => setAcks({ ...acks, disclosure_complete: v })}>I confirm that the property-condition disclosure record is complete to the best of my knowledge and may be provided to prospective buyers who submit proposed terms.</Check>
            <Check checked={acks.authority} onChange={(v) => setAcks({ ...acks, authority: v })}>I confirm I am entitled to sell this property.</Check>
            <Check checked={acks.nonbinding} onChange={(v) => setAcks({ ...acks, nonbinding: v })}>I acknowledge that no online action creates a binding sale.</Check>
            <Check checked={acks.nominate_later} onChange={(v) => setAcks({ ...acks, nominate_later: v })}>I acknowledge I will nominate a conveyancer later, if I choose to proceed.</Check>
          </div>
          <button className="btn-gold mt-6 disabled:opacity-50" disabled={!formReady} onClick={() => { setErr(''); setEstage('review'); }}>Review order</button>
          {!formReady && <p className="mt-2 text-xs text-gold-bright">Enter your email and tick all confirmations to review your order.</p>}
        </Section>
      </>)}

      {estage === 'review' && (
        <Section title="Review your order">
          <ul className="text-soft text-sm space-y-1">
            <li>Product: <strong className="text-white">{ADDON.name}</strong> — {ADDON.price} once-off</li>
            <li>Listing: {listing.title} ({listing.id})</li>
            <li>Notifications to: {f.seller_email}</li>
            <li>Disclosure: occupancy “{f.cond_occupancy || '—'}”, defects “{f.cond_known_defects || '—'}”, additions “{f.cond_additions_approved || '—'}”</li>
          </ul>
          <div className="mt-5 rounded-xl border border-gold/30 bg-gold/5 p-4">
            <Check checked={immediate} onChange={setImmediate}>I request immediate activation of the Make an Offer add-on and consent to HomesConnect beginning the service immediately. I understand the statutory cooling-off position may be affected once performance begins.</Check>
          </div>
          {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="btn-ghost" onClick={() => setEstage('form')}>← Edit / correct</button>
            <button className="btn-gold disabled:opacity-50" disabled={busy || !immediate} onClick={placeOrder}>{busy ? 'Redirecting to PayFast…' : `Place order — pay ${ADDON.price}`}</button>
            <Link to={`/listing/${listing.id}`} className="text-sm text-faint hover:text-white self-center">Cancel</Link>
          </div>
          {!immediate && <p className="mt-2 text-xs text-gold-bright">Tick the immediate-activation consent to place your order.</p>}
        </Section>
      )}
      <BackLink listing={listing} />
    </Wrap>
  );
}

// ---------- Request link ----------
function RequestLinkView({ listing }: { listing: Listing }) {
  const [sent, setSent] = useState(false);
  async function go() { await api('mao-seller-link', { listing_id: listing.id }); setSent(true); }
  return (
    <Wrap>
      <p className="chip bg-white/5 text-gold-bright mb-4">Seller</p>
      <h1 className="font-display text-3xl md:text-5xl text-white">Review proposals for {listing.title}</h1>
      <Section title="Get your private link">
        <p className="text-soft text-sm">“Make an Offer” is enabled on this listing. For privacy, the proposals are only visible via a private link. We'll email it to the address on file.</p>
        {!sent ? <button className="btn-gold mt-5" onClick={go}>Email me my private link</button>
          : <p className="mt-5 text-teal-bright">If this listing is yours, check your email for the private link.</p>}
      </Section>
      <BackLink listing={listing} />
    </Wrap>
  );
}

// ---------- Dashboard ----------
function Dashboard({ listing, token, data, justEnabled, onReload, err, setErr }: any) {
  const offers = (data?.offers || []).filter((o: any) => !o.archived);
  const archived = (data?.offers || []).filter((o: any) => o.archived);
  const [active, setActive] = useState<string>('');
  return (
    <Wrap wide>
      <p className="chip bg-white/5 text-gold-bright mb-4">Seller dashboard</p>
      <h1 className="font-display text-3xl md:text-5xl text-white">Proposals for {listing.title}</h1>
      <div className="mt-4 rounded-2xl border border-gold/30 bg-gold/5 p-4 text-soft text-sm">{NONBINDING_NOTICE}</div>
      {justEnabled && <div className="mt-3 rounded-2xl border border-teal/40 bg-teal/10 p-4 text-soft text-sm">✓ Make an Offer is now enabled on this listing.</div>}
      <p className="mt-4 text-faint text-xs">Each buyer's proposal is private and never shown to other buyers. These are proposed terms for discussion — choose an action when you're ready. There is no “accept” here; a sale is only formed by a signed Offer to Purchase.</p>

      {!offers.length && <div className="mt-8 card-soft rounded-2xl p-10 text-center text-soft">No proposals yet. Buyers can send non-binding proposed terms from your listing page.</div>}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {offers.map((o: any) => (
          <OfferCard key={o.id} o={o} listing={listing} token={token} active={active === o.id} onOpen={() => setActive(active === o.id ? '' : o.id)} onReload={onReload} setErr={setErr} />
        ))}
      </div>
      {err && <p className="mt-4 text-sm text-red-300">{err}</p>}
      {archived.length > 0 && <p className="mt-8 text-faint text-sm">{archived.length} archived proposal(s) hidden.</p>}

      <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-4 text-faint text-sm leading-relaxed">{FRAUD_NOTICE}</div>
      <BackLink listing={listing} />
    </Wrap>
  );
}

function statusLabel(s: string) {
  return ({ submitted: 'New proposal', clarification_requested: 'Clarification requested', revision_invited: 'Revised terms invited', proceeding_to_otp: 'Proceeding to formal OTP', declined: 'Declined', withdrawn: 'Withdrawn', expired: 'Expired' } as any)[s] || s;
}

function OfferCard({ o, listing, token, active, onOpen, onReload, setErr }: any) {
  const [panel, setPanel] = useState<'' | 'clarification' | 'revision' | 'proceed' | 'private_note'>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  // Seller-only private notes (never emailed to the buyer, never sent to AI).
  const privateNotes = (o.action_log || []).filter((e: any) => e.event === 'private_note' && e.note);
  async function act(action: string, extra: any = {}) {
    setBusy(true); setErr('');
    const { ok, data } = await api('mao-seller-action', { listing_id: listing.id, token, offer_id: o.id, action, note, ...extra });
    setBusy(false);
    if (!ok) { setErr(data.error || 'Action failed'); return false; }
    setPanel(''); setNote(''); await onReload(); return true;
  }
  return (
    <article className="card-soft rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl text-gold-bright">{rand(o.proposed_price)}</p>
          <p className="text-white text-sm mt-1">{o.buyer_name} <span className="text-faint">· {o.buyer_entity_type}</span></p>
        </div>
        <span className="chip bg-white/5 text-soft text-[10px]">{statusLabel(o.status)}</span>
      </div>
      <ul className="mt-3 text-xs text-soft space-y-1">
        <li>Funding: {o.funding_method}{o.funding_method === 'mixed' ? ` (bond ${rand(o.bond_amount)} + cash ${rand(o.cash_contribution)})` : ''}</li>
        {o.deposit_amount > 0 && <li>Deposit: {rand(o.deposit_amount)}</li>}
        <li>Subject to another sale: {o.subject_to_sale ? `Yes — ${o.subject_to_sale_note}` : 'No'}</li>
        {o.occupation_date && <li>Occupation: {o.occupation_date}</li>}
        <li>Valid until: {o.proposal_expiry}</li>
        <li>Contact: {o.buyer_phone} · {o.buyer_email}</li>
        {o.note_to_seller && <li className="text-faint">Note: “{o.note_to_seller}”</li>}
        {o.selected_conveyancer && <li className="text-teal-bright">Conveyancer (selected by seller): {o.selected_conveyancer.mode === 'later' ? 'to be decided' : `${o.selected_conveyancer.name} (${o.selected_conveyancer.email})`}{o.consent_share_conveyancer ? ' · buyer consented' : ' · awaiting buyer consent'}</li>}
      </ul>

      {privateNotes.length > 0 && (
        <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
          <p className="text-[10px] uppercase tracking-[0.15em] text-faint mb-1">Your private notes (seller-only)</p>
          {privateNotes.map((e: any, i: number) => <p key={i} className="text-xs text-soft">• {e.note}</p>)}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {o.status !== 'declined' && o.status !== 'proceeding_to_otp' && (<>
          <button className="btn-ghost text-xs py-1.5 px-3" onClick={() => { onOpen(); setPanel('clarification'); }}>Request clarification</button>
          <button className="btn-ghost text-xs py-1.5 px-3" onClick={() => { onOpen(); setPanel('revision'); }}>Invite revised proposed terms</button>
          <button className="btn-gold text-xs py-1.5 px-3" onClick={() => { onOpen(); setPanel('proceed'); }}>Proceed to formal OTP</button>
          <button className="btn-ghost text-xs py-1.5 px-3" onClick={() => act('decline')}>Decline</button>
          <button className="text-xs py-1.5 px-3 text-faint hover:text-white" onClick={() => act('archive')}>Archive</button>
        </>)}
        <button className="text-xs py-1.5 px-3 text-faint hover:text-white" onClick={() => { onOpen(); setPanel('private_note'); }}>Add private note</button>
      </div>

      {active && panel === 'clarification' && (
        <Panel><textarea className="input resize-none" rows={2} placeholder="What would you like the buyer to clarify?" value={note} onChange={(e) => setNote(e.target.value)} /><button className="btn-gold mt-3 text-sm" disabled={busy || !note.trim()} onClick={() => act('clarification')}>Send request</button></Panel>
      )}
      {active && panel === 'revision' && (
        <Panel><textarea className="input resize-none" rows={2} placeholder="Optional note inviting revised proposed terms" value={note} onChange={(e) => setNote(e.target.value)} /><button className="btn-gold mt-3 text-sm" disabled={busy} onClick={() => act('revision')}>Invite revised proposed terms</button></Panel>
      )}
      {active && panel === 'private_note' && (
        <Panel>
          <p className="text-xs text-gold-bright mb-2">Use private notes only for objective, transaction-related information. Do not record special personal information, discriminatory comments, or unsupported assumptions.</p>
          <textarea className="input resize-none" rows={2} placeholder="Seller-only note (never shared with the buyer)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn-gold mt-3 text-sm" disabled={busy || !note.trim()} onClick={() => act('private_note')}>Save private note</button>
        </Panel>
      )}
      {active && panel === 'proceed' && <ProceedPanel busy={busy} act={act} />}
    </article>
  );
}

function ProceedPanel({ busy, act }: { busy: boolean; act: (a: string, e?: any) => Promise<boolean> }) {
  const [mode, setMode] = useState<'directory' | 'own' | 'later'>('directory');
  const [conv, setConv] = useState({ conveyancer_name: '', conveyancer_email: '', conveyancer_firm: '' });
  const [consent, setConsent] = useState(false);
  const [list, setList] = useState<Conveyancer[]>([]);
  useEffect(() => { loadConveyancers().then(setList); }, []);
  const canSubmit = consent && (mode === 'later' || (conv.conveyancer_name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(conv.conveyancer_email)));
  return (
    <Panel>
      <div className="rounded-xl border border-gold/30 bg-gold/5 p-3 text-soft text-xs mb-3">{NONBINDING_NOTICE}</div>
      <p className="text-xs uppercase tracking-[0.2em] text-faint mb-2">Choose a conveyancer (neutral — your choice)</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {(['directory', 'own', 'later'] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={`text-xs px-3 py-1.5 rounded-lg ${mode === m ? 'bg-teal text-white' : 'bg-white/5 text-soft border border-white/10'}`}>
            {m === 'directory' ? 'From the free directory' : m === 'own' ? 'Enter my own' : 'Decide later'}
          </button>
        ))}
      </div>
      {mode === 'directory' && (
        <select className="input mb-2" onChange={(e) => { const c = list.find((x) => x.id === e.target.value); if (c) setConv({ conveyancer_name: c.contactName || c.firmName, conveyancer_email: c.email, conveyancer_firm: c.firmName }); }} defaultValue="">
          <option value="" disabled>Select a firm…</option>
          {list.map((c) => <option key={c.id} value={c.id}>{c.firmName} — {c.city} {c.email ? '' : '(no email on file)'}</option>)}
        </select>
      )}
      {(mode === 'directory' || mode === 'own') && (
        <div className="grid gap-2 md:grid-cols-3 mb-2">
          <input className="input" placeholder="Conveyancer name" value={conv.conveyancer_name} onChange={(e) => setConv({ ...conv, conveyancer_name: e.target.value })} />
          <input className="input" placeholder="Firm (optional)" value={conv.conveyancer_firm} onChange={(e) => setConv({ ...conv, conveyancer_firm: e.target.value })} />
          <input className="input" placeholder="Conveyancer email" value={conv.conveyancer_email} onChange={(e) => setConv({ ...conv, conveyancer_email: e.target.value })} />
        </div>
      )}
      <Check checked={consent} onChange={setConsent}>I consent to sharing this proposal and my disclosure with the chosen conveyancer.</Check>
      <button className="btn-gold mt-3 text-sm disabled:opacity-50" disabled={busy || !canSubmit}
        onClick={() => act('proceed', { conveyancer_mode: mode, seller_consent_share: consent, ...conv })}>
        {mode === 'later' ? 'Mark as proceeding (nominate later)' : 'Proceed & request buyer consent'}
      </button>
      <p className="mt-2 text-[11px] text-faint">{FRAUD_NOTICE}</p>
    </Panel>
  );
}

function Wrap({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return <div className={`${wide ? 'max-w-5xl' : 'max-w-3xl'} mx-auto px-4 md:px-8 py-12 md:py-16`}>{children}</div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-6 card-soft rounded-2xl p-6 md:p-8"><h2 className="font-display text-xl text-white mb-4">{title}</h2>{children}</section>;
}
function Panel({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">{children}</div>;
}
function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return <label className={`block ${className || ''}`}><span className="block text-xs uppercase tracking-[0.2em] text-faint mb-2">{label}{hint && <span className="text-faint normal-case ml-2">({hint})</span>}</span>{children}</label>;
}
function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return <label className="flex items-start gap-3 cursor-pointer select-none"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-5 w-5 accent-teal flex-shrink-0" /><span className="text-sm text-white">{children}</span></label>;
}
function BackLink({ listing }: { listing: Listing }) {
  return <div className="mt-10 text-sm"><Link to={`/listing/${listing.id}`} className="text-teal-bright hover:text-white">← Back to listing</Link></div>;
}
