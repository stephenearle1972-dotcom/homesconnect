// Shared presentational bits for the three calculator tabs — kept local to
// this feature (same pattern as MakeOfferPage.tsx's own Field/Section helpers).
import { useState, type ReactNode } from 'react';

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

// Strip everything but digits (and, if allowDecimal, a single decimal point),
// and collapse leading zeros — "0150000" becomes "150000", "00.5" becomes "0.5".
// This runs on every keystroke, so the stranded-leading-zero bug (state
// coerced '' -> 0 -> "0" -> "0" + next digit) can't happen in the first place.
function sanitizeDigits(raw: string, allowDecimal: boolean): string {
  if (!allowDecimal) {
    return raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  }
  let s = raw.replace(/[^\d.]/g, '');
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
  }
  return s.replace(/^0+(?=\d)/, '');
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// Numeric input backed by a raw STRING (never a number) so '' is a valid,
// displayable state — the field can actually go empty on mobile instead of
// snapping back to "0". Digits are grouped with spaces for readability, but
// only while the field isn't focused: reformatting on every keystroke is what
// makes the caret jump, so while typing the user edits the plain raw digits.
export function NumberField({
  label,
  hint,
  value,
  onChange,
  className,
  allowDecimal = false,
  placeholder = '—',
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (raw: string) => void;
  className?: string;
  allowDecimal?: boolean;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);

  const display = (() => {
    if (value === '') return '';
    if (focused) return value;
    if (!allowDecimal) return groupThousands(value);
    const [intPart, decPart] = value.split('.');
    const grouped = groupThousands(intPart);
    return decPart === undefined ? grouped : `${grouped}.${decPart}`;
  })();

  return (
    <Field label={label} hint={hint} className={className}>
      <input
        className="input"
        type="text"
        inputMode={allowDecimal ? 'decimal' : 'numeric'}
        placeholder={placeholder}
        value={display}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (value.endsWith('.')) onChange(value.slice(0, -1));
        }}
        onChange={(e) => onChange(sanitizeDigits(e.target.value, allowDecimal))}
      />
    </Field>
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
