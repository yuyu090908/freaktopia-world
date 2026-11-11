"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** WAI-ARIA tabs: one tablist, one visible panel, arrow keys move between tabs. */
export function Tabs<T extends string>({ label, tabs, active, onChange, children, className }: { label: string; tabs: { id: T; label: string }[]; active: T; onChange: (id: T) => void; children: ReactNode; className?: string }) {
  const base = useId();
  const move = (dir: 1 | -1) => {
    const i = tabs.findIndex((t) => t.id === active);
    const next = tabs[(i + dir + tabs.length) % tabs.length];
    onChange(next.id);
    requestAnimationFrame(() => document.getElementById(`${base}-tab-${next.id}`)?.focus());
  };
  return (
    <div className={className}>
      <div role="tablist" aria-label={label} className="rail !gap-2 md:!px-0" onKeyDown={(e) => { if (e.key === "ArrowRight") move(1); if (e.key === "ArrowLeft") move(-1); }}>
        {tabs.map((t) => (
          <button key={t.id} id={`${base}-tab-${t.id}`} role="tab" type="button" aria-selected={active === t.id} aria-controls={`${base}-panel`} tabIndex={active === t.id ? 0 : -1} onClick={() => onChange(t.id)} className={cn("inline-flex min-h-11 shrink-0 items-center rounded-full border px-5 text-sm font-extrabold uppercase", active === t.id ? "border-acid bg-acid/15 text-acid" : "border-line bg-surface text-cream hover:border-cream/60")}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${active}`} className="mt-4">{children}</div>
    </div>
  );
}
