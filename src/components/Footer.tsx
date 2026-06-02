import { Link } from 'react-router-dom';
import Logo from './Logo';
import { SUPPORT_EMAIL, WA_DISPLAY, WA_LINK } from '../lib/constants';

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-border-soft bg-bg-dark/80">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 text-soft max-w-md text-sm leading-relaxed">
            South Africa's first WhatsApp-powered property search. Buyers message, get instant results,
            and connect directly with the seller. No app. No login. No friction.
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-faint mb-4">Explore</p>
          <ul className="space-y-2 text-sm">
            <li><a href="/#how-it-works" className="text-soft hover:text-white">How It Works</a></li>
            <li><Link to="/listings" className="text-soft hover:text-white">Listings</Link></li>
            <li><a href="/#pricing" className="text-soft hover:text-white">Pricing</a></li>
            <li><a href={`mailto:${SUPPORT_EMAIL}`} className="text-soft hover:text-white">Contact</a></li>
          </ul>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-faint mb-4">Contact</p>
          <ul className="space-y-2 text-sm">
            <li><a href={WA_LINK} className="text-soft hover:text-white" target="_blank" rel="noreferrer">{WA_DISPLAY}</a></li>
            <li><a href={`mailto:${SUPPORT_EMAIL}`} className="text-soft hover:text-white">{SUPPORT_EMAIL}</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border-soft">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs text-faint">
          <p>© {new Date().getFullYear()} HomesConnect. All rights reserved.</p>
          <p>Powered by TownConnect technology</p>
        </div>
      </div>
    </footer>
  );
}
