import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { trackEvent } from '../lib/analytics';

// payment_return fires on any visit to this URL, not only a genuine return
// from PayFast — the `ref` param survives a bookmark/back-button revisit
// too. ITN is the only real source of truth (see netlify/functions/
// list-property.js / payfast-itn); same known limitation as CarsConnect.
export default function ListingSuccessPage() {
  const [params] = useSearchParams();
  const ref = params.get('ref') || params.get('m_payment_id') || '';

  useEffect(() => {
    trackEvent('payment_return');
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-16 md:py-24 text-center">
      <div className="inline-flex w-16 h-16 rounded-full bg-teal/20 items-center justify-center mb-6">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#22A88F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h1 className="font-display text-4xl md:text-6xl text-white">Your Property is Listed!</h1>
      <p className="mt-6 text-soft text-lg leading-relaxed">
        Payment confirmed. Your listing will go live on the website and WhatsApp bot within 48 hours.
      </p>
      {ref && (
        <p className="mt-6 text-sm text-faint">
          Listing reference: <span className="font-mono text-teal-bright">{ref}</span>
        </p>
      )}

      <div className="mt-12 flex flex-wrap justify-center gap-3">
        <Link to="/list-property" className="btn-gold">List another property</Link>
        <Link to="/listings" className="btn-ghost">Browse listings</Link>
        <Link to="/" className="btn-ghost">Back to home</Link>
      </div>
    </div>
  );
}
