// "Email me this estimate" — reuses the existing enquiry pipeline's building
// blocks (logHcEvent + sendEmail via netlify/functions/calculator-lead.js),
// not the /enquiry endpoint itself (that one requires a listing ref + phone,
// neither of which applies here — calculators collect email, not phone).
//
// Data-minimisation: this component only ever receives calcType, a formatted
// headline string and caller-built emailLines/budget. Gross income, expenses
// and existing debt never reach this component — callers must not put them
// in emailLines. The server-side lead record is restricted further still
// (name, email, consent flags, calcType, headline only — see calculator-lead.js).
import { useState } from 'react';
import { getSid } from '../../lib/track';
import { Field, ToggleRow } from './CalcUI';

export type CalcType = 'bond-repayment' | 'affordability' | 'cost-of-buying';

export default function LeadCaptureForm({
  calcType,
  headlineLabel,
  headlineValue,
  emailLines,
}: {
  calcType: CalcType;
  headlineLabel: string;
  headlineValue: string;
  emailLines: string[];
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [buyerAlerts, setBuyerAlerts] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!consent) {
      setError('Please tick the consent box so we can email you this estimate.');
      return;
    }
    setState('sending');
    try {
      const res = await fetch('/.netlify/functions/calculator-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          consent,
          buyerAlertsOptIn: buyerAlerts,
          calcType,
          headlineLabel,
          headlineValue,
          emailLines,
          sid: getSid(),
        }),
      });
      if (!res.ok) throw new Error('failed');
      setState('sent');
    } catch {
      setError('Something went wrong sending your estimate. Please try again.');
      setState('idle');
    }
  }

  if (state === 'sent') {
    return (
      <div className="card-soft rounded-2xl p-6">
        <p className="font-display text-lg text-white">Thanks — check your inbox.</p>
        <p className="text-soft text-sm mt-2">We've emailed your estimate to {email}.</p>
      </div>
    );
  }

  return (
    <div className="card-soft rounded-2xl p-6">
      <p className="text-xs uppercase tracking-[0.2em] text-faint mb-3">Email me this estimate</p>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Your name">
          <input className="input text-sm" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Your email">
          <input className="input text-sm" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      </div>
      <div className="mt-4 space-y-3">
        <ToggleRow checked={consent} onChange={setConsent}>
          I agree that my details are shared with HomesConnect so they can email me this estimate and follow up.
        </ToggleRow>
        <ToggleRow checked={buyerAlerts} onChange={setBuyerAlerts}>
          Also send me new listings that match this budget
        </ToggleRow>
      </div>
      {error && <p className="text-xs text-red-300 mt-3">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={state === 'sending'}
        className="btn-gold w-full md:w-auto mt-4 text-sm disabled:opacity-50"
      >
        {state === 'sending' ? 'Sending…' : 'Email me this estimate'}
      </button>
    </div>
  );
}
