import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import Logo from './Logo';
import { WA_LINK } from '../lib/constants';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm uppercase tracking-[0.2em] font-medium transition-colors ${
    isActive ? 'text-white' : 'text-soft hover:text-white'
  }`;

const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-xl px-4 py-3 text-sm uppercase tracking-[0.2em] font-medium transition-colors ${
    isActive ? 'text-white bg-white/10' : 'text-soft hover:text-white hover:bg-white/5'
  }`;

export default function Header() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  // On the home route, scroll to #pricing directly so it lands cleanly below the
  // sticky header (a plain /#pricing reload re-mounts the SPA before #pricing exists,
  // so the native hash-scroll silently no-ops). Off-route, fall back to the anchor.
  const onPricing = (e: React.MouseEvent) => {
    close();
    if (window.location.pathname === '/') {
      e.preventDefault();
      document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
      window.history.replaceState(null, '', '/#pricing');
    }
  };

  // Close the mobile menu on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-bg-dark/80 border-b border-border-soft">
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 md:h-20 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center" onClick={close}><Logo /></Link>
        <nav className="hidden md:flex items-center gap-7">
          <NavLink to="/" end className={navLinkClass}>Home</NavLink>
          <NavLink to="/listings" className={navLinkClass}>Listings</NavLink>
          <NavLink to="/search" className={navLinkClass}>Search</NavLink>
          <NavLink to="/conveyancers" className={navLinkClass}>Conveyancers</NavLink>
          <a href="/#pricing" className="text-sm uppercase tracking-[0.2em] font-medium text-soft hover:text-white transition-colors">Pricing</a>
        </nav>
        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden md:flex items-center gap-2 md:gap-3">
            <a href={WA_LINK} target="_blank" rel="noreferrer" className="btn-wa text-sm py-2 px-3 md:px-4" aria-label="Chat on WhatsApp">
              <WAIcon />
              <span className="hidden lg:inline">WhatsApp</span>
            </a>
            <Link to="/list-property" className="btn-gold text-sm py-2 px-4 md:px-5">
              List Property
            </Link>
          </div>
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl text-soft hover:text-white hover:bg-white/5 transition-colors"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden fixed inset-0 top-16 z-40">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={close}
          />
          <nav
            id="mobile-menu"
            className="relative bg-bg-dark border-b border-border-soft shadow-elev px-4 py-4 flex flex-col gap-1"
          >
            <NavLink to="/" end className={mobileLinkClass} onClick={close}>Home</NavLink>
            <NavLink to="/listings" className={mobileLinkClass} onClick={close}>Listings</NavLink>
            <NavLink to="/search" className={mobileLinkClass} onClick={close}>Search</NavLink>
            <NavLink to="/conveyancers" className={mobileLinkClass} onClick={close}>Conveyancers</NavLink>
            <a
              href="/#pricing"
              className="block rounded-xl px-4 py-3 text-sm uppercase tracking-[0.2em] font-medium text-soft hover:text-white hover:bg-white/5 transition-colors"
              onClick={onPricing}
            >
              Pricing
            </a>
            <div className="mt-3 flex flex-col gap-3">
              <a href={WA_LINK} target="_blank" rel="noreferrer" className="btn-wa w-full" onClick={close}>
                <WAIcon />
                <span>WhatsApp</span>
              </a>
              <Link to="/list-property" className="btn-gold w-full" onClick={close}>
                List Property
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function WAIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.52 3.48A11.78 11.78 0 0 0 12.05 0C5.5 0 .19 5.31.19 11.86c0 2.09.55 4.13 1.6 5.93L0 24l6.36-1.66a11.86 11.86 0 0 0 5.68 1.45h.01c6.55 0 11.86-5.31 11.86-11.86 0-3.17-1.23-6.15-3.39-8.45zM12.05 21.5h-.01a9.65 9.65 0 0 1-4.92-1.35l-.35-.21-3.77.99 1.01-3.68-.23-.38a9.65 9.65 0 0 1-1.48-5.12c0-5.34 4.34-9.68 9.69-9.68 2.58 0 5.01 1.01 6.84 2.84a9.6 9.6 0 0 1 2.83 6.84c0 5.34-4.34 9.68-9.61 9.75zm5.55-7.27c-.3-.15-1.79-.88-2.07-.98-.28-.1-.48-.15-.69.15-.21.3-.79.98-.97 1.18-.18.21-.36.23-.66.08-.3-.15-1.27-.47-2.42-1.49-.9-.8-1.5-1.79-1.68-2.09-.18-.3-.02-.46.13-.61.13-.13.3-.34.45-.51.15-.17.2-.3.3-.5.1-.21.05-.39-.02-.54-.08-.15-.69-1.66-.94-2.27-.25-.6-.5-.52-.69-.53-.18-.01-.39-.01-.6-.01-.21 0-.54.08-.83.39-.28.3-1.08 1.06-1.08 2.57s1.11 2.99 1.26 3.19c.15.21 2.18 3.33 5.28 4.67.74.32 1.31.51 1.76.65.74.24 1.41.21 1.94.13.59-.09 1.79-.73 2.05-1.43.25-.7.25-1.31.18-1.43-.07-.13-.27-.21-.57-.36z"/>
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
