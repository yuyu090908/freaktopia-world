"use client";

import type { ReactNode } from "react";
import { PageTitle } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export interface ShellTab<T extends string> { id: T; label: string }

/**
 * One frame for every dashboard (user, organizer, DJ, venue): title, role tabs, one panel.
 * Tabs follow the WAI-ARIA tabs pattern (arrow keys move between roles).
 */
export function DashboardShell<T extends string>({ kicker, title, sub, badge, tabs, active, onTab, children }: { kicker: string; title: string; sub?: string; badge?: ReactNode; tabs: ShellTab<T>[]; active: T; onTab: (id: T) => void; children: ReactNode }) {
  const move = (dir: 1 | -1) => {
    const i = tabs.findIndex((t) => t.id === active);
    const next = tabs[(i + dir + tabs.length) % tabs.length];
    onTab(next.id);
    requestAnimationFrame(() => document.getElementById(`tab-${next.id}`)?.focus());
  };
  return (
    <div className="mx-auto max-w-6xl md:px-6" data-testid="dashboard-shell">
      <PageTitle kicker={kicker} title={title} sub={sub}>
        {badge && <div className="mt-3">{badge}</div>}
      </PageTitle>
      <div role="tablist" aria-label={kicker} className="rail !gap-2 md:!px-0" onKeyDown={(e) => { if (e.key === "ArrowRight") move(1); if (e.key === "ArrowLeft") move(-1); }}>
        {tabs.map((r) => (
          <button
            key={r.id}
            role="tab"
            type="button"
            aria-selected={active === r.id}
            tabIndex={active === r.id ? 0 : -1}
            aria-controls={`panel-${r.id}`}
            id={`tab-${r.id}`}
            onClick={() => onTab(r.id)}
            className={cn("inline-flex min-h-11 shrink-0 items-center rounded-full border px-5 text-sm font-extrabold uppercase", active === r.id ? "border-acid bg-acid/15 text-acid" : "border-line bg-surface text-cream hover:border-cream/60")}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} className="mt-6 px-4 md:px-0">
        {children}
      </div>
    </div>
  );
}
