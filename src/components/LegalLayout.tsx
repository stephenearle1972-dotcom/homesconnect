import { Link } from 'react-router-dom';
import { SUPPORT_EMAIL } from '../lib/constants';

// Shared layout for the content/legal pages (FAQ, Terms, Privacy, Disclaimer,
// Cookies). Matches the native page styling: max-w-3xl wrapper, font-display
// headings, soft body text, teal accents.

export function LegalPage({ title, intro, children }: { title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-12 md:py-16 text-soft leading-relaxed">
      <h1 className="font-display text-3xl md:text-5xl text-white">{title}</h1>
      <p className="mt-4 text-sm text-faint">Last updated: June 2026</p>
      {intro && <p className="mt-4 text-sm">{intro}</p>}
      <div>{children}</div>
      <Link to="/" className="text-teal-bright hover:text-white mt-10 inline-block">&larr; Home</Link>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl md:text-2xl text-white">{title}</h2>
      <div className="mt-3 text-sm space-y-3">{children}</div>
    </section>
  );
}

// Verbatim operator block. Written so a future swap to a standalone HomesConnect
// company is a find-and-replace of this one component.
export function OperatorBlock() {
  return (
    <div className="mt-6 rounded-2xl border border-border-soft bg-white/5 p-5 text-sm space-y-1">
      <p>HomesConnect is operated by TownConnect (Pty) Ltd (Registration number 2026/106250/07), a company incorporated in South Africa ("HomesConnect", "we", "us", "our").</p>
      <p className="pt-2"><span className="text-faint">Information Officer:</span> Stephen Phillip Earle</p>
      <p><span className="text-faint">Email:</span> <a className="text-teal-bright hover:text-white" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
      <p><span className="text-faint">Telephone:</span> 068 898 6081</p>
    </div>
  );
}
