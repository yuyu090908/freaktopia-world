"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { DemoBadge } from "./primitives";

/**
 * A KPI: value with its unit, what it counts (definition, always visible on tap/hover via <details>) and
 * where the figure comes from: an "as of" time for figures computed now, or DEMO for fixed sample figures.
 */
export function StatCard({ label, value, unit, definition, asOf, demo = false, accent, className }: { label: string; value: ReactNode; unit?: string; definition: string; asOf?: Date | string | null; demo?: boolean; accent?: string; className?: string }) {
  const t = useTranslations("ui");
  const time = asOf ? new Date(asOf) : null;
  return (
    <div className={cn("flex min-w-0 flex-col rounded-[16px] border border-line bg-surface-2 p-3", className)} data-testid="stat-card">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12px] font-bold uppercase tracking-wider text-mute">{label}</span>
        {demo && <DemoBadge />}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="truncate font-display text-[22px] leading-none" style={accent ? { color: accent } : undefined}>{value}</span>
        {unit && <span className="text-[12px] font-bold text-mute">{unit}</span>}
      </div>
      <details className="group mt-2 text-[12px] text-mute">
        <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 font-bold hover:text-cream">
          <Info className="size-3.5" aria-hidden /> {t("kpiDefinition")}
        </summary>
        <p className="mt-1 leading-snug">{definition}</p>
      </details>
      {time && !demo && <p className="mt-auto pt-1 text-[11px] text-mute">{t("asOf", { time: time.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) })}</p>}
    </div>
  );
}

/** KPI grid: 2 columns on phones, up to 4 on wider screens. */
export function StatGrid({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  return <div className={cn("grid grid-cols-2 gap-2", cols === 3 ? "sm:grid-cols-3" : cols === 4 ? "sm:grid-cols-4" : "")}>{children}</div>;
}
