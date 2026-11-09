"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, List, MapPin, Ticket, Users, X } from "lucide-react";
import { FilterBar } from "@/components/event/FilterBar";
import { EventLevelBadge } from "@/components/event/EventLevelBadge";
import { EventProgress } from "@/components/event/EventProgress";
import { EventCover } from "@/components/cards/Cards";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { DemoBadge, Tag } from "@/components/ui/primitives";
import { LoadingSkeleton, EmptyState } from "@/components/ui/States";
import { EventRow } from "@/components/cards/Cards";
import { EVENTS } from "@/lib/data";
import { EMPTY_FILTERS, filterEvents, type EventFilters } from "@/lib/filters";
import { levelFor } from "@/lib/levels";
import { useDemo } from "@/lib/store";
import { fmtDate } from "@/lib/utils";
import { useDaoQuery } from "@/lib/dao/client";
import { STATUS_META } from "@/lib/dao/meta";
import type { DaoSummaryDto } from "@/components/dao/EventDaoPanel";
import type { FreakEvent } from "@/lib/types";

const WorldMap = dynamic(() => import("@/components/map/WorldMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0">
      <LoadingSkeleton variant="map" />
    </div>
  ),
});

export function WorldExplorer() {
  const [filters, setFilters] = useState<EventFilters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const support = useDemo((s) => s.support);
  const sim = useDemo((s) => s.sim);

  const stats = useMemo(
    () => (e: FreakEvent) => sim[e.id] ?? { supporters: e.supporters + (support[e.id]?.supporters ?? 0), raised: e.raised + (support[e.id]?.raised ?? 0) },
    [support, sim],
  );
  const results = useMemo(() => filterEvents(EVENTS, filters, stats), [filters, stats]);
  const daoQ = useDaoQuery<{ daos: DaoSummaryDto[] }>("summary");
  const daos = useMemo(() => new Map(daoQ.state.status === "ok" ? daoQ.state.data.daos.map((d) => [d.eventId, d]) : []), [daoQ.state]);
  const points = useMemo(() => results.map((e) => ({ event: e, level: levelFor(stats(e).supporters, stats(e).raised), dao: daos.has(e.id) && daos.get(e.id)!.status !== "archived" })), [results, stats, daos]);
  const sel = results.find((e) => e.id === selected) ?? null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] top-[calc(60px+env(safe-area-inset-top))] overflow-hidden lg:bottom-0">
      <style>{`body{overflow:hidden}`}</style>
      <h1 className="sr-only">World map</h1>
      <WorldMap points={points} selectedId={selected} onSelect={setSelected} focus={focus} />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-ink/85 via-ink/40 to-transparent pb-6 pt-3">
        <div className="pointer-events-auto mx-auto max-w-3xl md:px-4">
          <FilterBar
            filters={filters}
            setFilters={(f) => {
              setFilters(f);
              setSelected(null);
            }}
            onSubmit={() => setFocus((n) => n + 1)}
            placeholder="Search city, event or genre"
            floating
          />
        </div>
        <div className="pointer-events-auto mx-auto mt-2 flex max-w-3xl items-center gap-2 px-4">
          <span className="rounded-full bg-ink/80 px-3 py-1.5 text-xs font-bold" aria-live="polite">
            {results.length} event{results.length === 1 ? "" : "s"}
          </span>
          <DemoBadge label="Sample events" className="bg-ink/80" />
          <button
            type="button"
            onClick={() => setListOpen(true)}
            className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-full bg-cream px-4 text-sm font-extrabold uppercase text-ink"
          >
            <List className="size-4" aria-hidden /> List
          </button>
        </div>
      </div>

      {results.length === 0 && (
        <div className="absolute inset-x-4 top-1/2 z-10 mx-auto max-w-sm -translate-y-1/2">
          <EmptyState title="No events here" body="フィルターを変えると、他の惑星のイベントが見つかるかも。" className="bg-ink/90" />
        </div>
      )}

      {sel && <MapEventSheet event={sel} dao={daos.get(sel.id) ?? null} onClose={() => setSelected(null)} />}

      <BottomSheet open={listOpen} onClose={() => setListOpen(false)} title={`${results.length} events`}>
        <div className="space-y-3">
          {results.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
          {results.length === 0 && <p className="py-6 text-center text-mute">No events match these filters.</p>}
        </div>
      </BottomSheet>
    </div>
  );
}

/** In-map bottom sheet for the tapped pin. Non-modal so the map stays usable. */
function MapEventSheet({ event, dao, onClose }: { event: FreakEvent; dao: DaoSummaryDto | null; onClose: () => void }) {
  const support = useDemo((s) => s.support[event.id]);
  const sim = useDemo((s) => s.sim[event.id]);
  const supporters = sim?.supporters ?? event.supporters + (support?.supporters ?? 0);
  const raised = sim?.raised ?? event.raised + (support?.raised ?? 0);
  const level = levelFor(supporters, raised);
  return (
    <section
      aria-label={`${event.name} summary`}
      className="absolute inset-x-0 bottom-0 z-20 mx-auto max-w-lg animate-[sheet-in_220ms_ease-out] neon rounded-t-[28px] border-2 border-b-0 bg-surface/95 p-4 pt-2 backdrop-blur md:bottom-4 md:left-4 md:right-auto md:w-[400px] md:rounded-[28px] md:border-b-2"
    >
      <style>{`@keyframes sheet-in{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}`}</style>
      <div className="mb-2 flex justify-center md:hidden" aria-hidden>
        <span className="h-1.5 w-12 rounded-full bg-cream/30" />
      </div>
      <div className="flex gap-3">
        <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-2xl">
          <EventCover id={event.id} sizes="96px" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <EventLevelBadge level={level} long />
            {event.status === "live" && <Tag color="#FF625C" dark>● Live</Tag>}
          </div>
          <h2 className="mt-2 text-xl uppercase leading-none">{event.name}</h2>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-mute">
            <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{event.city}</span>
            <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" aria-hidden />{fmtDate(event.startsAt, { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close event summary" className="-mr-1 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2">
          <X className="size-5" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {event.genres.map((g) => <Tag key={g}>{g}</Tag>)}
        <span className="inline-flex items-center gap-1 text-[13px] font-semibold"><Users className="size-3.5" aria-hidden />{supporters.toLocaleString("en-US")}</span>
      </div>
      <div className="mt-3">
        <EventProgress supporters={supporters} raised={raised} goal={event.goal} compactView />
      </div>
      {dao && (
        <Link href={`/dao/${event.id}`} className="mt-3 flex min-h-11 items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2 text-[13px]" data-testid="map-dao">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase text-ink" style={{ background: STATUS_META[dao.status].color }}>{STATUS_META[dao.status].label}</span>
          <span className="min-w-0 flex-1 truncate">{dao.members} members · {dao.activeVote ? `voting: ${dao.activeVote.title}` : `${dao.activeProposals} proposals`}</span>
          <ArrowRight className="size-4 shrink-0 text-acid" aria-hidden />
        </Link>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link href={`/events/${event.id}/tickets`} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-coral font-extrabold uppercase text-ink shadow-[0_4px_0_0_#9b2f2b]">
          <Ticket className="size-4" aria-hidden /> Tickets
        </Link>
        <Link href={`/events/${event.id}`} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-acid font-extrabold uppercase text-ink shadow-[0_4px_0_0_#5f8a22]">
          View event <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
