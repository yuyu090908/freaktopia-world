"use client";

import { useState } from "react";
import { ChevronDown, Search, X, SlidersHorizontal } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button, Chip } from "@/components/ui/primitives";
import { GENRES } from "@/lib/data";
import { LEVELS } from "@/lib/levels";
import { DATE_LABELS, EMPTY_FILTERS, activeFilterCount, type DateRange, type EventFilters } from "@/lib/filters";
import type { EventLevel, Genre } from "@/lib/types";
import { cn } from "@/lib/utils";

type Panel = null | "genre" | "date" | "level";

export function FilterBar({
  filters,
  setFilters,
  placeholder = "Search city or event",
  onSubmit,
  floating = false,
}: {
  filters: EventFilters;
  setFilters: (f: EventFilters) => void;
  placeholder?: string;
  onSubmit?: () => void;
  floating?: boolean;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const set = (p: Partial<EventFilters>) => setFilters({ ...filters, ...p });
  const count = activeFilterCount(filters);

  return (
    <div className="space-y-2.5">
      <form
        role="search"
        className={cn("relative mx-4 md:mx-0", floating && "drop-shadow-[0_8px_20px_rgba(0,0,0,0.6)]")}
        onSubmit={(e) => {
          e.preventDefault();
          (document.activeElement as HTMLElement)?.blur();
          onSubmit?.();
        }}
      >
        <label htmlFor="event-search" className="sr-only">
          {placeholder}
        </label>
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-mute" aria-hidden />
        <input
          id="event-search"
          type="search"
          enterKeyHint="search"
          value={filters.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder={placeholder}
          className="h-13 min-h-[52px] w-full rounded-full border-2 border-line bg-surface pl-12 pr-12 text-base outline-none placeholder:text-mute focus:border-acid"
        />
        {filters.q && (
          <button type="button" aria-label="Clear search" onClick={() => set({ q: "" })} className="absolute right-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full">
            <X className="size-4" />
          </button>
        )}
      </form>
      <div className="rail !gap-2 md:!px-0" role="group" aria-label="Filters">
        {count > 0 && (
          <Chip onClick={() => setFilters({ ...EMPTY_FILTERS, q: filters.q })} className="!border-coral !text-coral">
            <X className="size-4" aria-hidden /> Clear ({count})
          </Chip>
        )}
        <Chip active={filters.genres.length > 0} onClick={() => setPanel("genre")} aria-haspopup="dialog">
          <SlidersHorizontal className="size-4" aria-hidden />
          {filters.genres.length ? `${filters.genres.length} genre${filters.genres.length > 1 ? "s" : ""}` : "Genre"}
          <ChevronDown className="size-4" aria-hidden />
        </Chip>
        <Chip active={filters.date !== "any"} onClick={() => setPanel("date")} aria-haspopup="dialog">
          {filters.date === "any" ? "Date" : DATE_LABELS[filters.date]}
          <ChevronDown className="size-4" aria-hidden />
        </Chip>
        <Chip active={filters.levels.length > 0} onClick={() => setPanel("level")} aria-haspopup="dialog">
          {filters.levels.length ? `LV.${filters.levels.join(",")}` : "Level"}
          <ChevronDown className="size-4" aria-hidden />
        </Chip>
        <Chip active={filters.liveNow} onClick={() => set({ liveNow: !filters.liveNow })}>
          <span className="size-2 rounded-full bg-coral" aria-hidden /> Live now
        </Chip>
        <Chip active={filters.confirmed} onClick={() => set({ confirmed: !filters.confirmed })}>
          Confirmed
        </Chip>
        <Chip active={filters.djWanted} onClick={() => set({ djWanted: !filters.djWanted })}>
          DJs wanted
        </Chip>
        <Chip active={filters.afterParty} onClick={() => set({ afterParty: !filters.afterParty })}>
          After party
        </Chip>
      </div>

      <BottomSheet
        open={panel === "genre"}
        onClose={() => setPanel(null)}
        title="Genre"
        footer={<Button className="mb-1 w-full" onClick={() => setPanel(null)}>Show results</Button>}
      >
        <div className="flex flex-wrap gap-2">
          {GENRES.map((g) => (
            <Chip key={g} active={filters.genres.includes(g)} onClick={() => set({ genres: toggle(filters.genres, g) })}>
              {g}
            </Chip>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={panel === "date"} onClose={() => setPanel(null)} title="Date">
        <div className="grid gap-2" role="radiogroup" aria-label="Date range">
          {(Object.keys(DATE_LABELS) as DateRange[]).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={filters.date === d}
              onClick={() => {
                set({ date: d });
                setPanel(null);
              }}
              className={cn("flex min-h-12 items-center justify-between rounded-2xl border-2 px-4 font-bold", filters.date === d ? "border-acid bg-acid/10" : "border-line")}
            >
              {DATE_LABELS[d]}
              {filters.date === d && <span className="size-3 rounded-full bg-acid" aria-hidden />}
            </button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet
        open={panel === "level"}
        onClose={() => setPanel(null)}
        title="Event level"
        footer={<Button className="mb-1 w-full" onClick={() => setPanel(null)}>Show results</Button>}
      >
        <div className="grid gap-2">
          {LEVELS.map((l) => {
            const on = filters.levels.includes(l.level);
            return (
              <button
                key={l.level}
                type="button"
                aria-pressed={on}
                onClick={() => set({ levels: toggle(filters.levels, l.level as EventLevel) })}
                className={cn("flex min-h-14 items-center gap-3 rounded-2xl border-2 px-4 text-left", on ? "border-acid bg-acid/10" : "border-line")}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-ink font-display text-sm text-ink" style={{ background: l.color }}>
                  {l.level}
                </span>
                <span className="min-w-0">
                  <span className="block font-bold">{l.name}</span>
                  <span className="block text-xs text-mute">{l.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export type { Genre };
