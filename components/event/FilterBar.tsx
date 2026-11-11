"use client";

import { Tx } from "@/components/i18n/Tx";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Chip } from "@/components/ui/primitives";
import { SearchBar } from "@/components/ui/SearchBar";
import { FilterGroup, FilterSheet } from "@/components/ui/FilterSheet";
import { FilterChips, type ActiveFilter } from "@/components/ui/FilterChips";
import { GENRES } from "@/lib/data";
import { LEVELS } from "@/lib/levels";
import { DATE_RANGES, EMPTY_FILTERS, KIND_VALUES, activeFilterCount, type DateRange, type EventFilters, type PriceFilter, type StatusFilter } from "@/lib/filters";
import type { EventLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

const DATES: DateRange[] = DATE_RANGES;
const STATUSES: StatusFilter[] = ["live", "confirmed", "funding"];
const PRICES: PriceFilter[] = ["any", "free", "u30", "u60"];

/**
 * Events: search + one "Filters" button. Every filter lives in one sheet (bottom sheet on phones) and applies on
 * "Apply"; the filters in use are listed as removable chips. Within a group any option matches (OR); groups combine (AND).
 */
export function FilterBar({ filters, setFilters, cities, countFor }: { filters: EventFilters; setFilters: (f: EventFilters) => void; cities: string[]; countFor: (f: EventFilters) => number }) {
  const t = useTranslations("events");
  const tw = useTranslations("world");
  const tf = useTranslations("eventFilters");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<EventFilters>(filters);
  const n = activeFilterCount(filters);
  const set = (p: Partial<EventFilters>) => setDraft((d) => ({ ...d, ...p }));
  const statusLabel = (s: StatusFilter) => (s === "live" ? tw("chips.live") : s === "confirmed" ? tw("chips.confirmed") : tw("chips.funding"));
  const levelName = (l: number) => LEVELS.find((x) => x.level === l)?.name ?? "";

  const active: ActiveFilter[] = [
    ...(filters.place ? [{ key: "place", label: filters.place, onRemove: () => setFilters({ ...filters, place: "" }) }] : []),
    ...(filters.date !== "any" ? [{ key: "date", label: tw(`dates.${filters.date}`), onRemove: () => setFilters({ ...filters, date: "any" }) }] : []),
    ...filters.kinds.map((k) => ({ key: `k-${k}`, label: tf(`kinds.${k}`), onRemove: () => setFilters({ ...filters, kinds: filters.kinds.filter((x) => x !== k) }) })),
    ...filters.genres.map((g) => ({ key: `g-${g}`, label: g, onRemove: () => setFilters({ ...filters, genres: filters.genres.filter((x) => x !== g) }) })),
    ...filters.statuses.map((s) => ({ key: `s-${s}`, label: statusLabel(s), onRemove: () => setFilters({ ...filters, statuses: filters.statuses.filter((x) => x !== s) }) })),
    ...filters.levels.map((l) => ({ key: `l-${l}`, label: `LV.${l}`, onRemove: () => setFilters({ ...filters, levels: filters.levels.filter((x) => x !== l) }) })),
    ...(filters.price !== "any" ? [{ key: "price", label: tf(`price.${filters.price}`), onRemove: () => setFilters({ ...filters, price: "any" }) }] : []),
    ...(filters.djWanted ? [{ key: "dj", label: tw("chips.djWanted"), onRemove: () => setFilters({ ...filters, djWanted: false }) }] : []),
    ...(filters.afterParty ? [{ key: "ap", label: tw("chips.afterParty"), onRemove: () => setFilters({ ...filters, afterParty: false }) }] : []),
  ];

  return (
    <div className="space-y-3 px-4 md:px-0">
      <div className="flex items-center gap-2">
        <SearchBar id="event-search" value={filters.q} onChange={(q) => setFilters({ ...filters, q })} placeholder={t("searchCityOrEvent")} />
        <button
          type="button"
          onClick={() => {
            setDraft(filters);
            setOpen(true);
          }}
          aria-haspopup="dialog"
          data-testid="filters-open"
          className={cn("inline-flex min-h-[52px] shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-extrabold", n ? "border-acid text-acid" : "border-line bg-surface text-cream hover:border-cream/60")}
        >
          <SlidersHorizontal className="size-5" aria-hidden />
          <span className="hidden min-[380px]:inline">{t("filters")}</span>
          {n > 0 && <span className="inline-flex size-6 items-center justify-center rounded-full bg-acid text-[12px] text-ink" aria-label={t("clearCount", { count: n })}>{n}</span>}
        </button>
      </div>
      <FilterChips items={active} onClearAll={() => setFilters({ ...EMPTY_FILTERS, q: filters.q })} />

      <FilterSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("filters")}
        onClear={() => setDraft({ ...EMPTY_FILTERS, q: draft.q })}
        onApply={() => {
          setFilters(draft);
          setOpen(false);
        }}
        applyLabel={tf("apply", { count: countFor(draft) })}
      >
        <FilterGroup title={tf("place")}>
          <label className="sr-only" htmlFor="filter-place">{tf("place")}</label>
          <select id="filter-place" value={draft.place} onChange={(e) => set({ place: e.target.value })} className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-base font-bold">
            <option value="">{tf("anywhere")}</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </FilterGroup>
        <FilterGroup title={tf("kind")} hint={tf("kindHint")}>
          {KIND_VALUES.map((k) => (
            <Chip key={k} active={draft.kinds.includes(k)} onClick={() => set({ kinds: toggle(draft.kinds, k) })}>{tf(`kinds.${k}`)}</Chip>
          ))}
        </FilterGroup>
        <FilterGroup title={tw("date")}>
          {DATES.map((d) => (
            <Chip key={d} active={draft.date === d} onClick={() => set({ date: d })}>{tw(`dates.${d}`)}</Chip>
          ))}
        </FilterGroup>
        <FilterGroup title={tw("genre")} hint={tf("anyOf")}>
          {GENRES.map((g) => (
            <Chip key={g} active={draft.genres.includes(g)} onClick={() => set({ genres: toggle(draft.genres, g) })}>{g}</Chip>
          ))}
        </FilterGroup>
        <FilterGroup title={tf("status")} hint={tf("anyOf")}>
          {STATUSES.map((s) => (
            <Chip key={s} active={draft.statuses.includes(s)} onClick={() => set({ statuses: toggle(draft.statuses, s) })}>
              {s === "live" && <span className="size-2 rounded-full bg-danger" aria-hidden />}
              {statusLabel(s)}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup title={tf("size")} hint={tf("sizeHint")}>
          {LEVELS.map((l) => (
            <Chip key={l.level} active={draft.levels.includes(l.level as EventLevel)} onClick={() => set({ levels: toggle(draft.levels, l.level as EventLevel) })}>
              LV.{l.level} <span className="font-semibold opacity-80"><Tx>{levelName(l.level)}</Tx></span>
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup title={tf("priceTitle")} hint={tf("priceHint")}>
          {PRICES.map((p) => (
            <Chip key={p} active={draft.price === p} onClick={() => set({ price: p })}>{tf(`price.${p}`)}</Chip>
          ))}
        </FilterGroup>
        <FilterGroup title={tf("more")}>
          <Chip active={draft.djWanted} onClick={() => set({ djWanted: !draft.djWanted })}>{tw("chips.djWanted")}</Chip>
          <Chip active={draft.afterParty} onClick={() => set({ afterParty: !draft.afterParty })}>{tw("chips.afterParty")}</Chip>
        </FilterGroup>
      </FilterSheet>
    </div>
  );
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}
