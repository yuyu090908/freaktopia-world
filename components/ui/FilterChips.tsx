"use client";

import { useTranslations } from "next-intl";
import { X } from "lucide-react";

export interface ActiveFilter { key: string; label: string; onRemove: () => void }

/** The filters in use, each removable, plus "clear all". Nothing is rendered when no filter is set. */
export function FilterChips({ items, onClearAll }: { items: ActiveFilter[]; onClearAll: () => void }) {
  const t = useTranslations("events");
  const tw = useTranslations("world");
  if (!items.length) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label={t("filters")} data-testid="active-filters">
      {items.map((f) => (
        <li key={f.key}>
          <button type="button" onClick={f.onRemove} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-acid/60 bg-acid/10 px-3.5 text-sm font-bold text-acid" aria-label={`${f.label} ×`}>
            {f.label} <X className="size-4" aria-hidden />
          </button>
        </li>
      ))}
      <li>
        <button type="button" onClick={onClearAll} className="inline-flex min-h-11 items-center px-2 text-sm font-bold text-mute underline underline-offset-4 hover:text-cream">
          {tw("clearFilters")}
        </button>
      </li>
    </ul>
  );
}
