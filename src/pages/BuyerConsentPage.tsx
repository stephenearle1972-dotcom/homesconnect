import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { NONBINDING_NOTICE, FRAUD_NOTICE } from '../lib/constants';

export default function BuyerConsentPage() {
  const [params] = useSearchParams();
  const offer = params.get('offer') || '';
  const t = params.get('t') || '';
  const [state, setState] = useState<any>(undefined);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const res = await fetch(`/.netlify/functions/mao-buyer-consent?offer=${encodeURIComponent(offer)}&t=${encodeURIComponent(t)}`);
      setState(res.ok ? await res.json() : null);
    })();
  }, [offer, t]);

  async function consent() {
    setBusy(true); setErr('');
    const res = await fetch('/.netlify/functions/mao-buyer-consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offer, t, consent: true }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error || 'Could not record consent'); return; }
    setDone(true);
  }

  const wrap = (c: React.ReactNode) => <div className="max-w-2xl mx-auto px-4 md:px-8 py-16">{c}</div>;
  if (state === undefined) return wrap(<p className="text-soft">Loading…</p>);
  if (state === null) return wrap(<><p className="font-display text-2xl text-white">This consent link is invalid or has expired.</p><Link to="/" className="text-teal-bright">← Home</Link></>);

  if (done || state.offer?.already_consented) {
    return wrap(
      <>
        <h1 className="font-display text-3xl md:text-4xl text-white">Thank you — consent recorded</h1>
        <p className="mt-4 text-soft">Your proposed terms and contact details have been shared with the seller's chosen conveyancer to draw the formal Offer to Purchase.</p>
        <div className="mt-6 rounded-2xl border border-gold/30 bg-gold/5 p-4 text-soft text-sm">{FRAUD_NOTICE}</div>
        <Link to="/" className="btn-ghost mt-6 inline-block">← Home</Link>
      </>
    );
  }

  return wrap(
    <>
      <p className="chip bg-white/5 text-gold-bright mb-4">Consent to proceed</p>
      <h1 className="font-display text-3xl md:text-4xl text-white">Share your details with the conveyancer?</h1>
      <div className="mt-4 rounded-2xl border border-gold/30 bg-gold/5 p-4 text-soft text-sm">{NONBINDING_NOTICE}</div>
      <p className="mt-5 text-soft">The seller wishes to proceed toward a formal Offer to Purchase for <strong className="text-white">{state.offer?.listing_title}</strong>.</p>
      {state.conveyancer
        ? <p className="mt-3 text-soft">Chosen conveyancer: <strong className="text-white">{state.conveyancer.name}</strong>{state.conveyancer.firm ? `, ${state.conveyancer.firm}` : ''} ({state.conveyancer.email}).</p>
        : <p className="mt-3 text-soft">The seller has not yet nominated a conveyancer.</p>}
      <p className="mt-3 text-soft text-sm">If you consent, your proposed terms and contact details will be shared with this conveyancer so they can prepare the formal Offer to Purchase. You can decline by simply closing this page.</p>
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-faint text-sm">{FRAUD_NOTICE}</div>
      {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
      <button className="btn-gold mt-6 disabled:opacity-50" disabled={busy || !state.conveyancer} onClick={consent}>{busy ? 'Recording…' : 'I consent — share with the conveyancer'}</button>
    </>
  );
}
