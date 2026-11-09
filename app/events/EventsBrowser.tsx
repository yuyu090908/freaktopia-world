"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { FilterBar } from "@/components/event/FilterBar";
import { EventCard, EventRow } from "@/components/cards/Cards";
import { EmptyState } from "@/components/ui/States";
import { Button, DemoBadge } from "@/components/ui/primitives";
import { EVENTS } from "@/lib/data";
import { EMPTY_FILTERS, filterEvents, type EventFilters } from "@/lib/filters";
import { levelFor } from "@/lib/levels";
import { useDemo } from "@/lib/store";
import type { FreakEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

type Sort = "popular" | "soonest" | "level";

export function EventsBrowser() {
  const [filters, setFilters] = useState<EventFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<Sort>("soonest");
  const support = useDemo((s) => s.support);
  const sim = useDemo((s) => s.sim);
  const created = useDemo((s) => s.createdEvents);
  const stats = useMemo(
    () => (e: FreakEvent) => sim[e.id] ?? { supporters: e.supporters + (support[e.id]?.supporters ?? 0), raised: e.raised + (support[e.id]?.raised ?? 0) },
    [support, sim],
  );
  const list = useMemo(() => {
    const r = filterEvents(EVENTS, filters, stats);
    return [...r].sort((a, b) => {
      if (sort === "popular") return stats(b).supporters - stats(a).supporters;
      if (sort === "level") return levelFor(stats(b).supporters, stats(b).raised) - levelFor(stats(a).supporters, stats(a).raised);
      return a.startsAt.localeCompare(b.startsAt);
    });
  }, [filters, sort, stats]);

  return (
    <div>
      <FilterBar filters={filters} setFilters={setFilters} />
      <div className="mt-4 flex flex-wrap items-center gap-2 px-4 md:px-0">
        <span className="text-sm font-bold" aria-live="polite">{list.length} events</span>
        <DemoBadge label="Sample data" />
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-mute">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="min-h-11 rounded-full border-2 border-line bg-surface px-3 font-bold">
            <option value="soonest">Soonest</option>
            <option value="popular">Most supported</option>
            <option value="level">Highest level</option>
          </select>
        </label>
      </div>

      {created.length > 0 && (
        <div className="mx-4 mt-4 rounded-3xl border-2 border-acid/50 bg-acid/5 p-4 md:mx-0">
          <div className="text-xs font-extrabold uppercase tracking-widest text-acid">Your events (saved in this browser)</div>
          <ul className="mt-2 space-y-1">
            {created.map((c) => (
              <li key={c.id}>
                <Link href="/dashboard?role=organizer" className="flex min-h-11 items-center justify-between gap-2 font-bold">
                  <span className="truncate">{c.name}</span>
                  <span className="shrink-0 text-sm text-mute">{c.city} · {c.date}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState
          className="mx-4 mt-6 md:mx-0"
          title="No events found"
          body="条件に合うイベントがありません。フィルターを外すか、自分で作ってみよう。"
          action={<Button onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</Button>}
        />
      ) : (
        <>
          <ul className="mt-4 space-y-3 px-4 md:hidden">
            {list.map((e) => (
              <li key={e.id} className="cv-auto [contain-intrinsic-size:auto_130px]">
                <EventRow event={e} />
              </li>
            ))}
          </ul>
          <ul className={cn("mt-6 hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3")}>
            {list.map((e) => (
              <li key={e.id} className="flex">
                <EventCard event={e} wide />
              </li>
            ))}
          </ul>
        </>
      )}

      <Link
        href="/events/create"
        className="hide-on-kb fixed bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom)+16px)] right-4 z-40 inline-flex min-h-14 items-center gap-2 rounded-full border-[3px] border-ink bg-acid px-5 font-extrabold uppercase text-ink shadow-[0_6px_0_#000] lg:bottom-8"
      >
        <Plus className="size-5" aria-hidden /> Create
      </Link>
    </div>
  );
}
