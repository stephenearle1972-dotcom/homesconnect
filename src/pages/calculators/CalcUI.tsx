// Shared presentational bits for the three calculator tabs — kept local to
// this feature (same pattern as MakeOfferPage.tsx's own Field/Section helpers).
import type { ReactNode } from 'react';

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="card-soft rounded-2xl p-6 md:p-8">
      {title && <h2 className="font-display text-xl text-white mb-5">{title}</h2>}
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className || ''}`}>
      <span className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-faint mb-2">
        {label}
        {hint && <span className="text-faint normal-case">({hint})</span>}
      </span>
      {children}
    </label>
  );
}

export function StatCard({ label, value, primary, sub }: { label: string; value: ReactNode; primary?: boolean; sub?: ReactNode }) {
  return (
    <div className={`rounded-xl border p-4 ${primary ? 'border-gold/30 bg-gold/5' : 'border-white/10 bg-white/5'}`}>
      <p className="text-xs uppercase tracking-[0.2em] text-faint mb-1">{label}</p>
      <p className={primary ? 'font-display text-2xl md:text-3xl text-white' : 'font-display text-lg text-white'}>{value}</p>
      {sub && <p className="text-faint text-xs mt-1">{sub}</p>}
    </div>
  );
}

export function ToggleRow({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 accent-teal flex-shrink-0"
      />
      <span className="text-sm text-white">{children}</span>
    </label>
  );
}
