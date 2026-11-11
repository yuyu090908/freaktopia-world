"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Bell, BellRing, CalendarDays, Disc3, Eye, MapPin, Mic2, PartyPopper, Radio, Search, Users, X } from "lucide-react";
import { EventCover } from "@/components/cards/Cards";
import { Chip, DemoBadge, DemoNotice, Tag } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/States";
import { ART } from "@/lib/art";
import { EVENTS } from "@/lib/data";
import { levelFor } from "@/lib/levels";
import { toast, useDemo } from "@/lib/store";
import { fmtCount, useLiveQuery, type Discovery, type DiscoveryEvent } from "@/lib/live/client";
import { fmtInTz, tzLabel } from "@/lib/live/time";
import type { LiveStatus } from "@/lib/live/types";
import { cn } from "@/lib/utils";

const WorldMap = dynamic(() => import("@/components/map/WorldMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0">
      <LoadingSkeleton variant="map" />
    </div>
  ),
});

const CATEGORIES = ["All", "Live Now", "Upcoming", "Tech House", "House", "Techno", "Afro House", "Bass House", "After Party"] as const; // i18n-ignore — ids; labels via CATEGORY_KEY (genre names stay as-is)
type Category = (typeof CATEGORIES)[number];

// Values are translation keys (live namespace).
const SORTS = { soon: "sortSoon", viewers: "sortViewers", supporters: "sortSupporters", name: "sortName" } as const;
const CATEGORY_KEY: Partial<Record<string, string>> = { All: "catAll", "Live Now": "catLiveNow", Upcoming: "catUpcoming", "After Party": "catAfterParty" };
type SortKey = keyof typeof SORTS;

export const STATUS_LABEL: Record<LiveStatus, { label: string; color: string; dark: boolean }> = {
  // label: translation key in the live namespace
  live: { label: "statusLive", color: "#FF625C", dark: true },
  demo_live: { label: "statusDemoLive", color: "#FFAD5B", dark: true },
  upcoming: { label: "statusUpcoming", color: "#2a2a2a", dark: false },
  ended: { label: "statusEnded", color: "#2a2a2a", dark: false },
};

const MAP_KINDS = ["LIVE NOW", "DEMO LIVE", "UPCOMING", "AFTER PARTY", "DJ AUDITION"] as const;
type MapKind = (typeof MAP_KINDS)[number];
const kindOf = (e: DiscoveryEvent): MapKind[] => {
  const k: MapKind[] = [];
  if (e.status === "live") k.push("LIVE NOW");
  if (e.status === "demo_live") k.push("DEMO LIVE");
  if (e.status === "upcoming") k.push("UPCOMING");
  if (e.afterParty) k.push("AFTER PARTY");
  if (e.djAudition) k.push("DJ AUDITION");
  return k;
};

function matches(e: DiscoveryEvent, c: Category) {
  if (c === "All") return true;
  if (c === "Live Now") return e.status === "live" || e.status === "demo_live";
  if (c === "Upcoming") return e.status === "upcoming";
  if (c === "After Party") return !!e.afterParty;
  return e.genres.includes(c);
}

export function LiveDiscovery() {
  const tu = useTranslations("live");
  const q = useLiveQuery<Discovery>("");
  const [cat, setCat] = useState<Category>("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("soon");
  const [mapKind, setMapKind] = useState<MapKind | "ALL">("ALL");
  const [selected, setSelected] = useState<string | null>(null);
  const data = q.state.status === "ok" ? q.state.data : null;

  const list = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    const r = data.events.filter((e) => matches(e, cat) && (!needle || [e.name, e.city, e.country, e.venue ?? "", e.currentDj?.name ?? "", ...e.genres].some((x) => x.toLowerCase().includes(needle))));
    const rank = (s: LiveStatus) => ({ live: 0, demo_live: 1, upcoming: 2, ended: 3 })[s];
    return r.sort((a, b) => {
      if (sort === "viewers") return b.attendance.onlineViewers - a.attendance.onlineViewers || rank(a.status) - rank(b.status);
      if (sort === "supporters") return b.supporters - a.supporters;
      if (sort === "name") return a.name.localeCompare(b.name);
      return rank(a.status) - rank(b.status) || Date.parse(a.startsAt) - Date.parse(b.startsAt);
    });
  }, [data, cat, query, sort]);

  const points = useMemo(() => {
    if (!data) return [];
    return data.events
      .filter((e) => mapKind === "ALL" || kindOf(e).includes(mapKind))
      .map((d) => {
        const ev = EVENTS.find((x) => x.id === d.id)!;
        const k = kindOf(d);
        return { event: ev, level: levelFor(ev.supporters, ev.raised), label: mapKind !== "ALL" ? undefined : k[0] === "DEMO LIVE" ? tu("demoLive4") : k[0] === "LIVE NOW" ? "LIVE" : undefined, labelKind: "status" as const, approximate: d.approximateLocation, dao: d.dao };
      });
  }, [data, mapKind]);

  const sel = data?.events.find((e) => e.id === selected) ?? null;
  const featured = data?.featured ? data.events.find((e) => e.id === data.featured) : null;
  const demo = data ? data.events.filter((e) => e.status === "demo_live") : [];
  const anyOn = !!data && (data.realLiveCount > 0 || demo.length > 0);
  const next = data ? data.nextUp.map((id) => data.events.find((e) => e.id === id)!).filter(Boolean) : [];

  return (
    <div className="mx-auto max-w-6xl pb-8 md:px-6">
      {/* HEADER */}
      <header className="relative overflow-hidden px-4 pb-5 pt-5 md:rounded-b-[32px] md:px-8">
        <div className="absolute inset-0 -z-10 opacity-35" aria-hidden>
          <Image src={ART.panelStage} alt="" fill priority quality={55} sizes="(min-width:1152px) 1100px, 100vw" className="object-cover" style={{ objectPosition: "50% 35%" }} />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/30 via-ink/70 to-ink" />
        </div>
        <div className="flex items-center gap-3">
          <Image src={ART.logo} alt="FREAKTOPIA WORLD" sizes="110px" className="h-9 w-auto" />
          <DemoBadge label={tu("demoData")} />
        </div>
        {/* Says LIVE only when something is on now (a real stream, or the labelled demo simulation). */}
        {anyOn && (
          <div className="mt-4 flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.2em] text-danger" data-testid="live-kicker">
            <span className="size-2 rounded-full bg-danger" aria-hidden /> {data?.realLiveCount ? tu("liveNow") : tu("demoLive")}
          </div>
        )}
        <h1 className="mt-3 text-[28px] uppercase leading-tight drop-shadow-[0_3px_0_#0B0910] sm:text-[40px]">{anyOn ? tu("theWorldIsLive") : tu("title")}</h1>
        <p className="mt-2 max-w-xl text-[15px] text-mute">{tu("dj")}</p>
      </header>

      {q.state.status === "loading" && <LoadingSkeleton variant="list" className="pt-2" /* reserves a screen of height so the footer does not jump when the list arrives */ />}
      {q.state.status === "error" && <ErrorState title={tu("liveDataUnavailable")} body={q.state.error.message} retry={<button type="button" className="min-h-11 rounded-full bg-acid px-5 font-bold text-ink" onClick={() => q.reload()}>{tu("retry")}</button>} />}

      {data && (
        <>
          {/* FEATURED */}
          <section aria-labelledby="featured-h" className="px-4 md:px-0">
            <h2 id="featured-h" className="sr-only">{tu("featured")}</h2>
            {featured ? (
              <FeaturedCard e={featured} />
            ) : (
              <div className="space-y-3">
                {demo.length > 0 ? (
                  <div className="flex items-start gap-2 rounded-2xl border border-line bg-surface p-3 text-sm" data-testid="no-real-live">
                    <Radio className="mt-0.5 size-4 shrink-0 text-mute" aria-hidden />
                    <p>
                      <b>{tu("noFestivalIsStreamingLive")}</b> <span className="text-mute">{tu("onlyEventsWithAConnected")}</span>
                    </p>
                  </div>
                ) : (
                  <div data-testid="no-real-live">
                    <EmptyState title={tu("noFestivalIsStreamingLive")} body={tu("emptyBody")} />
                  </div>
                )}
                {demo.map((e) => <FeaturedCard key={e.id} e={e} />)}
                {next[0] && <NextUp e={next[0]} />}
              </div>
            )}
          </section>

          {/* FILTERS */}
          <section aria-labelledby="browse-h" className="mt-8">
            <h2 id="browse-h" className="px-4 text-[28px] uppercase sm:text-4xl md:px-0">{tu("festivals")}</h2>
            <div className="mt-3 flex flex-col gap-2 px-4 sm:flex-row md:px-0">
              <label className="relative flex-1">
                <span className="sr-only">{tu("searchFestivals")}</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-mute" aria-hidden />
                <input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder={tu("searchFestivalCityDjGenre")} className="min-h-12 w-full rounded-full border-2 border-line bg-surface pl-12 pr-4 text-[16px] outline-none focus:border-acid" />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span className="shrink-0 font-bold text-mute">{tu("sort")}</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="min-h-12 w-full rounded-full border-2 border-line bg-surface px-4 text-[16px] sm:w-auto" aria-label={tu("sortFestivals")}>
                  {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{tu(v)}</option>)}
                </select>
              </label>
            </div>
            <div className="rail mt-3 !gap-2" role="group" aria-label={tu("categories")}>
              {CATEGORIES.map((c) => (
                <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
                  {c === "Live Now" && <span className="size-2 rounded-full bg-coral" aria-hidden />}
                  {CATEGORY_KEY[c] ? tu(CATEGORY_KEY[c]!) : c}
                </Chip>
              ))}
            </div>
            <p className="mt-2 px-4 text-[13px] text-mute md:px-0" aria-live="polite">
              {tu("festivalsCount", { n: list.length })}
              {cat === "Live Now" && data.realLiveCount === 0 && tu("noneStreamingForRealDemo")}
            </p>
            {list.length === 0 ? (
              <EmptyState className="mx-4 mt-4 md:mx-0" title={tu("noValueFestivalsYet", { value: cat === "All" ? "" : (CATEGORY_KEY[cat] ? tu(CATEGORY_KEY[cat]!) : cat) + " " })} body={query ? tu("tryAnotherSearchWord") : tu("nothingInThisCategoryRight")} />
            ) : (
              <ul className="mt-4 grid gap-4 px-4 sm:grid-cols-2 md:px-0 lg:grid-cols-3">
                {list.map((e) => (
                  <li key={e.id} className="min-w-0">
                    <LiveEventCard e={e} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* WORLD MAP */}
          <section aria-labelledby="map-h" className="mt-10">
            <div className="flex items-end justify-between gap-2 px-4 md:px-0">
              <h2 id="map-h" className="text-[28px] uppercase sm:text-4xl">{tu("liveWorldMap")}</h2>
              <Link href="/world" className="inline-flex min-h-11 items-center text-sm font-bold text-acid">{tu("fullMap")}</Link>
            </div>
            <div className="rail mt-3 !gap-2" role="group" aria-label={tu("mapPinTypes")}>
              {(["ALL", ...MAP_KINDS] as const).map((k) => (
                <Chip key={k} active={mapKind === k} onClick={() => { setMapKind(k); setSelected(null); }}>
                  {k === "ALL" ? tu("allPins") : k}
                </Chip>
              ))}
            </div>
            <div className="relative mt-3 h-[380px] overflow-hidden border-y-2 border-line md:h-[460px] md:rounded-[28px] md:border-2" data-testid="live-world-map">
              <WorldMap points={points} selectedId={selected} onSelect={setSelected} focus={0} />
              {sel && <MapSheet e={sel} onClose={() => setSelected(null)} />}
            </div>
            <p className="mt-2 px-4 text-[12px] text-mute md:px-0">{tu("pinsWithAnUnconfirmedVenue")}</p>
          </section>

          <DemoNotice className="mx-4 mt-8 md:mx-0">
            {tu("allFestivalsViewerCountsAnd")}
          </DemoNotice>
        </>
      )}
    </div>
  );
}

function when(e: DiscoveryEvent) {
  return `${fmtInTz(Date.parse(e.startsAt), e.tz, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })} ${tzLabel(Date.parse(e.startsAt), e.tz)}`;
}

function FeaturedCard({ e }: { e: DiscoveryEvent }) {
  const tu = useTranslations("live");
  const s = STATUS_LABEL[e.status];
  return (
    <article className="neon relative overflow-hidden rounded-[28px] border-2 bg-surface" data-testid="featured-live">
      <div className="relative aspect-[16/9] sm:aspect-[21/8]">
        <EventCover id={e.id} priority sizes="(min-width:1152px) 1100px, 100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" aria-hidden />
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          <Tag color={s.color} dark={s.dark}>{tu(s.label)}</Tag>
          {e.status === "demo_live" && <DemoBadge className="!bg-ink" label={tu("demoNotARealStream")} />}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="text-[32px] uppercase leading-none drop-shadow-[0_2px_0_#080808] sm:text-5xl">{e.name}</h3>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-cream/85">
            <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{e.city}{e.venue ? ` · ${e.venue}` : ""}</span>
            {e.currentDj && <span className="inline-flex items-center gap-1"><Disc3 className="size-3.5" aria-hidden />{tu("nowName", { name: e.currentDj.name })} <span className="text-mute">{tu("demoClock")}</span></span>}
          </div>
        </div>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <dl className="grid grid-cols-3 gap-2 text-center">
          <Metric label={tu("viewers")} value={fmtCount(e.attendance.onlineViewers)} hint={tu("demo2")} />
          <Metric label={tu("avatars")} value={fmtCount(e.attendance.publicAvatars)} hint={tu("demo2")} />
          <Metric label={tu("checkedIn")} value={fmtCount(e.attendance.checkedIn)} hint={tu("demo2")} />
        </dl>
        <Link href={`/live/${e.id}`} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-coral px-6 font-extrabold uppercase text-ink shadow-[0_4px_0_0_#9b2f2b]">
          {tu("enterFestival")} <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-surface-2 px-2 py-2">
      <dt className="text-[10px] font-bold uppercase leading-tight tracking-wide text-mute">{label}</dt>
      <dd className="font-display text-lg leading-tight">{value}</dd>
      {hint && <dd className="text-[10px] uppercase text-orange">{hint}</dd>}
    </div>
  );
}

function NextUp({ e }: { e: DiscoveryEvent }) {
  const tu = useTranslations("live");
  return (
    <Link href={`/live/${e.id}`} className="flex min-h-14 items-center gap-3 rounded-3xl border border-line bg-surface p-3 hover:border-cream/30">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-purple/20 text-purple" aria-hidden><CalendarDays className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-extrabold uppercase tracking-wider text-purple">{tu("nextUp")}</span>
        <span className="block truncate font-bold">{e.name} · {e.city}</span>
        <span className="block truncate text-[13px] text-mute">{when(e)}</span>
      </span>
      <ArrowRight className="size-5 shrink-0" aria-hidden />
    </Link>
  );
}

function LiveEventCard({ e }: { e: DiscoveryEvent }) {
  const tu = useTranslations("live");
  const s = STATUS_LABEL[e.status];
  const followed = useDemo((st) => st.followedEvents.includes(e.id));
  const toggleFollow = useDemo((st) => st.toggleFollow);
  const isLive = e.status === "live" || e.status === "demo_live";
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[26px] border border-line bg-surface" data-testid="live-card">
      <Link href={`/live/${e.id}`} className={cn("relative aspect-[5/3] overflow-hidden", isLive ? "block" : "hidden sm:block")} tabIndex={-1} aria-hidden>
        <EventCover id={e.id} sizes="(min-width:1024px) 340px, (min-width:640px) 50vw, 100vw" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-surface to-transparent" />
      </Link>
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex flex-wrap gap-1.5">
          <Tag color={s.color} dark={s.dark}>{tu(s.label)}</Tag>
          {e.afterParty && <Tag color="#A276E9" dark>{tu("afterParty")}</Tag>}
          {e.djAudition && <Tag color="#2a2a2a">{tu("djAudition")}</Tag>}
          {e.dao && <Tag color="#2a2a2a">DAO</Tag>}
        </div>
        <div className="flex items-center gap-3">
          {!isLive && (
            <span className="relative size-14 shrink-0 overflow-hidden rounded-2xl sm:hidden" aria-hidden>
              <EventCover id={e.id} sizes="56px" />
            </span>
          )}
          <h3 className="min-w-0 text-[22px] uppercase leading-none">
            <Link href={`/live/${e.id}`} className="hover:text-acid" data-inline>{e.name}</Link>
          </h3>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-mute">
          <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{e.city}{e.approximateLocation ? tu("approx") : ""}</span>
          <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" aria-hidden />{when(e)}</span>
        </div>
        {e.currentDj && (
          <div className="inline-flex items-center gap-1.5 text-[13px]"><Mic2 className="size-3.5 text-coral" aria-hidden />{tu("nowPlaying2")} <b>{e.currentDj.name}</b> <span className="text-mute">{tu("demo")}</span></div>
        )}
        <div className="flex flex-wrap gap-1.5">{e.genres.map((g) => <Tag key={g}>{g}</Tag>)}</div>
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          {isLive ? (
            <>
              <span className="inline-flex items-center gap-1 rounded-xl bg-surface-2 px-2 py-1.5"><Eye className="size-3.5 text-blue" aria-hidden />{tu("fmtcountOnline", { fmtCount: fmtCount(e.attendance.onlineViewers) })}</span>
              <span className="inline-flex items-center gap-1 rounded-xl bg-surface-2 px-2 py-1.5"><Users className="size-3.5 text-purple" aria-hidden />{tu("fmtcountAvatars", { fmtCount: fmtCount(e.attendance.publicAvatars) })}</span>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1 rounded-xl bg-surface-2 px-2 py-1.5"><Users className="size-3.5 text-acid" aria-hidden />{tu("fmtcountSupporters", { fmtCount: fmtCount(e.supporters) })}</span>
              <span className="inline-flex items-center gap-1 rounded-xl bg-surface-2 px-2 py-1.5"><PartyPopper className="size-3.5 text-orange" aria-hidden />{tu("fmtcountTickets", { fmtCount: fmtCount(e.attendance.ticketsSold) })}</span>
            </>
          )}
        </div>
        <div className="mt-auto grid grid-cols-[1fr_auto] gap-2 pt-1">
          <Link href={`/live/${e.id}`} className={cn("flex min-h-12 items-center justify-center gap-2 rounded-full font-extrabold uppercase", isLive ? "bg-coral text-ink shadow-[0_4px_0_0_#9b2f2b]" : "border-2 border-line")}>
            {isLive ? tu("enterFestival") : tu("previewFestival")} <ArrowRight className="size-4" aria-hidden />
          </Link>
          {!isLive && (
            <button
              type="button"
              aria-pressed={followed}
              aria-label={followed ? tu("stopAlertsForName", { name: e.name }) : tu("remindMeAboutName", { name: e.name })}
              onClick={() => {
                const on = toggleFollow(e.id);
                toast({ title: on ? tu("wellRemindYouDemo") : tu("reminderRemoved"), body: on ? tu("inAppAlertOnlyNo") : undefined });
              }}
              className={cn("inline-flex size-12 items-center justify-center rounded-full border-2", followed ? "border-acid bg-acid text-ink" : "border-line")}
            >
              {followed ? <BellRing className="size-5" aria-hidden /> : <Bell className="size-5" aria-hidden />}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function MapSheet({ e, onClose }: { e: DiscoveryEvent; onClose: () => void }) {
  const tu = useTranslations("live");
  const s = STATUS_LABEL[e.status];
  return (
    <section aria-label={tu("summaryOf", { name: e.name })} className="absolute inset-x-0 bottom-0 z-20 mx-auto max-w-lg rounded-t-[28px] border-2 border-b-0 border-line bg-surface/95 p-4 pt-2 backdrop-blur md:bottom-4 md:left-4 md:right-auto md:w-[380px] md:rounded-[28px] md:border-b-2">
      <div className="mb-2 flex justify-center md:hidden" aria-hidden><span className="h-1.5 w-12 rounded-full bg-cream/30" /></div>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5">
            {kindOf(e).map((k) => <Tag key={k} color={k === "DEMO LIVE" ? "#FFAD5B" : k === "LIVE NOW" ? "#FF625C" : "#2a2a2a"} dark={k === "DEMO LIVE" || k === "LIVE NOW"}>{k}</Tag>)}
          </div>
          <h3 className="mt-2 text-xl uppercase leading-none">{e.name}</h3>
          <p className="mt-1 text-[13px] text-mute">{e.city}{e.approximateLocation ? tu("approximateLocationVenueNotConfirmed") : e.venue ? ` · ${e.venue}` : ""}</p>
          <p className="text-[13px] text-mute">{when(e)}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={tu("closeSummary")} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2"><X className="size-5" /></button>
      </div>
      {e.afterParty && <p className="mt-2 text-[13px]"><PartyPopper className="mr-1 inline size-3.5 text-purple" aria-hidden />{tu("afterParty2")} <b>{e.afterParty.name}</b></p>}
      <p className="sr-only">{tu("statusLabel", { label: tu(s.label) })}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href={`/live/${e.id}`} className="flex min-h-12 items-center justify-center gap-1 rounded-full bg-coral font-extrabold uppercase text-ink">
          {e.status === "demo_live" || e.status === "live" ? tu("enter") : tu("preview2")} <ArrowRight className="size-4" aria-hidden />
        </Link>
        <Link href={`/events/${e.id}`} className="flex min-h-12 items-center justify-center rounded-full border-2 border-line font-extrabold uppercase">{tu("event")}</Link>
      </div>
    </section>
  );
}
