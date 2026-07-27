// Small tab-switcher built from the site's existing primitives (.chip pills +
// .card-soft panels) — there was no Tabs component in the repo before this.

export type TabDef = { id: string; label: string };

export default function Tabs({
  tabs,
  activeId,
  onChange,
}: {
  tabs: TabDef[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" aria-label="Calculator" className="flex flex-wrap gap-2">
      {tabs.map((t) => {
        const active = t.id === activeId;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`chip transition-colors ${
              active ? 'bg-gold-bright text-bg-dark' : 'bg-white/5 text-soft hover:bg-white/10'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
