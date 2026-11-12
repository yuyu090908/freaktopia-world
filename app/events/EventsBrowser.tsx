"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { FilterBar } from "@/components/event/FilterBar";
import { EventCard, EventRow } from "@/components/cards/Cards";
import { EmptyState } from "@/components/ui/States";
import { Button, DemoBadge } from "@/components/ui/primitives";
import { ARCHIVE_EVENTS, EVENTS, GENRES } from "@/lib/data";
import { EMPTY_FILTERS, filterCommunity, filterEvents, readEventsUrl, writeEventsUrl, type EventFilters, type EventSort } from "@/lib/filters";
import { levelFor } from "@/lib/levels";
import { useDemo } from "@/lib/store";
import type { FreakEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { UpcomingParties, type Upcoming } from "@/components/party/Directory";
import { useParty } from "@/components/party/shared";
import { HomeFeatured } from "@/app/HomeFeatured";
import { distinctCovers } from "@/lib/art";
import { WorldEventsSection } from "@/components/event/WorldEventsSection";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { EMPTY_MAP_FILTERS, writeWorldUrl } from "@/lib/map/view";
import { MapPin } from "lucide-react";

type Sort = EventSort;

export function EventsBrowser() {
  const tu = useTranslations("events");
  const to = useTranslations("ops");
  const tp = useTranslations("party");
  const tf = useTranslations("eventFilters");
  const lhref = useLocalHref();
  const [filters, setFilters] = useState<EventFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<Sort>("soonest");
  // Filters live in the URL: reload, a shared link and the back button keep them.
  const [urlReady, setUrlReady] = useState(false);
  useEffect(() => {
    const read = () => {
      const u = readEventsUrl(window.location.search, GENRES);
      setFilters(u.filters);
      setSort(u.sort);
    };
    read();
    setUrlReady(true);
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  useEffect(() => {
    if (!urlReady) return;
    // Typing in the search box updates the list at once; the URL follows after a short pause.
    const id = setTimeout(() => {
      const qs = writeEventsUrl(filters, sort);
      if (qs !== window.location.search && !(qs === "" && window.location.search === "")) window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs}${window.location.hash}`);
    }, 300);
    return () => clearTimeout(id);
  }, [filters, sort, urlReady]);
  const support = useDemo((s) => s.support);
  const sim = useDemo((s) => s.sim);
  const created = useDemo((s) => s.createdEvents);
  // The same published community parties the world map shows (lib/party upcomingParties), so both pages count one list.
  const { data: communityData, error: communityError } = useParty<{ parties: Upcoming[] }>("/api/party/upcoming?limit=500");
  const stats = useMemo(
    () => (e: FreakEvent) => sim[e.id] ?? { supporters: e.supporters + (support[e.id]?.supporters ?? 0), raised: e.raised + (support[e.id]?.raised ?? 0) },
    [support, sim],
  );
  const communityAll = useMemo(() => (communityData?.parties ?? []).filter((p) => p.handle), [communityData]);
  const cities = useMemo(() => Array.from(new Set([...EVENTS.map((e) => e.city), ...communityAll.map((p) => p.city)])).sort(), [communityAll]);
  const countFor = useCallback((f: EventFilters) => filterEvents(EVENTS, f, stats).length + filterCommunity(communityAll, f).length, [communityAll, stats]);
  const community = useMemo(() => filterCommunity(communityAll, filters), [communityAll, filters]);
  const list = useMemo(() => {
    const r = filterEvents(EVENTS, filters, stats);
    return [...r].sort((a, b) => {
      if (sort === "popular") return stats(b).supporters - stats(a).supporters;
      if (sort === "level") return levelFor(stats(b).supporters, stats(b).raised) - levelFor(stats(a).supporters, stats(a).raised);
      return a.startsAt.localeCompare(b.startsAt);
    });
  }, [filters, sort, stats]);
  // Completed events: kept apart, never mixed into the upcoming count.
  const past = useMemo(() => filterEvents(ARCHIVE_EVENTS, { ...filters, statuses: [], price: "any", djWanted: false, afterParty: false, levels: [], date: "any" }), [filters]);
  // Featured: the most supported upcoming event that still needs people, shown big above the grid (only without filters).
  const unfiltered = JSON.stringify(filters) === JSON.stringify(EMPTY_FILTERS);
  const featured = useMemo(() => (unfiltered && sort === "soonest" ? [...list].filter((e) => e.status !== "live").sort((a, b) => stats(b).supporters - stats(a).supporters)[0] ?? null : null), [list, unfiltered, sort, stats]);
  const rest = featured ? list.filter((e) => e.id !== featured.id) : list;
  const covers = useMemo(() => distinctCovers(rest), [rest]);
  const total = list.length + community.length;

  return (
    <div>
      <FilterBar filters={filters} setFilters={setFilters} cities={cities} countFor={countFor} />
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 px-4 md:px-0">
        <p className="min-w-0 text-sm" aria-live="polite" data-testid="events-count" data-ready={communityData || communityError ? "true" : "false"}>
          <b key={total} className="count-flash text-base">{tu("lengthEvents", { length: total })}</b>
          <span className="ml-2 text-mute">{tf("breakdown", { community: community.length, sample: list.length })}</span>
        </p>
        <Link
          href={lhref(`/world${writeWorldUrl({ filters: { ...EMPTY_MAP_FILTERS, q: filters.q, genres: filters.genres, date: filters.date, kinds: filters.kinds }, view: "map", event: null, city: null })}`)}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-acid"
          data-testid="events-to-world"
        >
          <MapPin className="size-4" aria-hidden /> {tf("openOnMap")}
        </Link>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-mute">{tu("sort")}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="min-h-11 rounded-full border border-line bg-surface px-3 font-bold">
            <option value="soonest">{tu("soonest")}</option>
            <option value="popular">{tu("mostSupported")}</option>
            <option value="level">{tu("highestLevel")}</option>
          </select>
        </label>
      </div>

      <section className="mx-4 mt-4 rounded-[20px] border border-line bg-surface p-4 md:mx-0" aria-labelledby="community-parties" data-testid="community-section">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 id="community-parties" className="text-[18px] uppercase">{tp("communityParties")} <span className="text-mute">({community.length})</span></h2>
          <Link href="/world/universes" className="inline-flex min-h-11 items-center text-sm font-bold text-acid underline underline-offset-4">{tp("universes")}</Link>
        </div>
        <p className="mb-3 text-[13px] text-mute">{tf("communitySub")}</p>
        {communityError ? <p className="text-sm text-danger" role="alert">{tf("communityError")}</p> : communityData ? <UpcomingParties limit={50} parties={community} /> : <div className="h-24 animate-pulse rounded-2xl bg-surface-2" />}
      </section>

      <WorldEventsSection filters={filters} />

      {created.length > 0 && (
        <div className="mx-4 mt-4 rounded-3xl border-2 border-acid/50 bg-acid/5 p-4 md:mx-0">
          <div className="text-xs font-extrabold uppercase tracking-widest text-acid">{tu("yourEventsSavedInThis")}</div>
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
          title={tu("noEventsFound")}
          body={tu("text")}
          action={<Button onClick={() => setFilters(EMPTY_FILTERS)}>{tu("clearFilters")}</Button>}
        />
      ) : (
        <>
          {featured && (
            <section aria-label={tu("featuredEvent")} className="mt-4 px-4 md:px-0" data-testid="events-featured">
              <HomeFeatured event={featured} />
            </section>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-2 px-4 md:px-0">
            <h2 className="text-[18px] uppercase">{tf("sampleTitle")} <span className="text-mute">({list.length})</span></h2>
            <DemoBadge label={tu("sampleData")} />
          </div>
          <ul className="mt-4 space-y-3 px-4 md:hidden">
            {rest.map((e) => (
              <li key={e.id} className="cv-auto [contain-intrinsic-block-size:auto_130px]">
                <EventRow event={e} art={covers.get(e.id)} />
              </li>
            ))}
          </ul>
          <ul className={cn("mt-6 hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3")}>
            {rest.map((e) => (
              <li key={e.id} className="flex">
                <EventCard event={e} wide art={covers.get(e.id)} />
              </li>
            ))}
          </ul>
        </>
      )}

      {past.length > 0 && (
        <details className="mx-4 mt-8 rounded-[20px] border border-line bg-surface p-4 md:mx-0" data-testid="events-completed">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-[18px] font-extrabold uppercase">
            <span>{tf("completedTitle")} <span className="text-mute">({past.length})</span></span>
            <span className="text-sm font-bold text-acid">{tf("show")}</span>
          </summary>
          <p className="mt-1 text-[13px] text-mute">{tf("completedSub")}</p>
          <ul className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {past.map((e) => (
              <li key={e.id} className="flex"><EventRow event={e} /></li>
            ))}
          </ul>
        </details>
      )}

      <div className="mx-4 mt-6 md:mx-0">
        <Link href="/events/manage" className="inline-flex min-h-11 items-center text-sm font-bold text-acid underline underline-offset-4" data-testid="link-manage">{to("manageTitle")}</Link>
      </div>

      <Link
        href="/events/create"
        className="hide-on-kb fixed bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom)+16px)] right-4 z-40 inline-flex min-h-14 items-center gap-2 rounded-full border-[3px] border-ink bg-acid px-5 font-extrabold uppercase text-ink shadow-[0_6px_0_#000] lg:bottom-8"
      >
        <Plus className="size-5" aria-hidden /> {tu("create")}
      </Link>
    </div>
  );
}
