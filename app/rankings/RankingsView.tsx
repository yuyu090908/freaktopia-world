"use client";

import { Tx, useTx } from "@/components/i18n/Tx";
import { useTranslations } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, GitCompareArrows, Landmark, List, Map as MapIcon, RefreshCw, Search, SlidersHorizontal, Sparkles, Trophy, X } from "lucide-react";
import { RankingArt } from "@/components/ranking/RankingArt";
import { RankingRow, TopOneCard, TopSmallCard } from "@/components/ranking/RankingCards";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button, DemoNotice } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { Field, Select, ToggleRow } from "@/components/forms/Fields";
import { EventCard } from "@/components/cards/Cards";
import { ART } from "@/lib/art";
import { EVENTS, ARCHIVE_EVENTS, GENRES, getEvent } from "@/lib/data";
import { useDemo, useIsHydrated } from "@/lib/store";
import { CATEGORY_META, PERIOD_LABEL, PUBLIC_CATEGORIES } from "@/lib/ranking/meta";
import { activeFilterCount, readUrlState, toSearchParams, type UrlState } from "@/lib/ranking/query";
import { REWARDS, earnedRewards } from "@/lib/ranking/rewards";
import type { RankingCategory, RankingResult } from "@/lib/ranking/types";
import { RANKING_PERIODS } from "@/lib/ranking/types";
import { cn } from "@/lib/utils";
import { RankingMap } from "./RankingMap";

const ALL = [...EVENTS, ...ARCHIVE_EVENTS];
const COUNTRIES = Array.from(new Set(ALL.map((e) => e.country))).sort();
const CITIES = Array.from(new Set(ALL.map((e) => `${e.country}|${e.city}`))).sort();

type Load = { status: "loading" } | { status: "error"; message: string; code?: string } | { status: "ok"; data: RankingResult };

/** Build the API query string for a URL state (+ personalization for FOR YOU). */
function apiParams(s: UrlState, page: number, pers?: { genres: string[]; city: string; djs: string[]; follows: string[] }) {
  const p = toSearchParams(s);
  p.delete("view");
  p.set("category", s.category);
  p.set("page", String(page));
  p.set("pageSize", "20");
  if (s.category === "for_you" && pers) {
    if (pers.genres.length) p.set("pg", pers.genres.join(","));
    if (pers.city) p.set("pc", pers.city);
    if (pers.djs.length) p.set("pd", pers.djs.join(","));
    if (pers.follows.length) p.set("pf", pers.follows.join(","));
  }
  return p.toString();
}

export function RankingsView() {
  const tx = useTx();
  const tu = useTranslations("ranking");
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const state = useMemo(() => readUrlState(new URLSearchParams(params.toString())), [params]);
  const hydrated = useIsHydrated();

  const profile = useDemo((s) => s.profile);
  const favorites = useDemo((s) => s.favorites);
  const followed = useDemo((s) => s.followedEvents);
  const personalize = useDemo((s) => s.personalize);
  const setPersonalize = useDemo((s) => s.setPersonalize);
  const compareIds = useDemo((s) => s.compareIds);
  const clearCompare = useDemo((s) => s.clearCompare);
  const support = useDemo((s) => s.support);

  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [extra, setExtra] = useState<RankingResult["items"]>([]);
  const [page, setPage] = useState(1);
  const [moreLoading, setMoreLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState<UrlState>(state);
  const [search, setSearch] = useState(state.q ?? "");
  const [boards, setBoards] = useState<{ popular: string[]; trending: string[]; rising: string[] } | null>(null);

  const pers = useMemo(
    () => ({ genres: profile.favoriteGenres, city: profile.city, djs: favorites, follows: followed }),
    [profile.favoriteGenres, profile.city, favorites, followed],
  );

  const update = useCallback(
    (patch: Partial<UrlState>) => {
      const next = { ...state, ...patch };
      const qs = toSearchParams(next).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [state, router, pathname],
  );

  // If personalization is off, FOR YOU falls back to the public ranking.
  useEffect(() => {
    if (hydrated && state.category === "for_you" && !personalize) update({ category: "popular" });
  }, [hydrated, state.category, personalize, update]);

  // Debounced search → URL
  useEffect(() => setSearch(state.q ?? ""), [state.q]);
  useEffect(() => {
    if ((state.q ?? "") === search) return;
    const t = setTimeout(() => update({ q: search || undefined }), 350);
    return () => clearTimeout(t);
  }, [search, state.q, update]);

  const query = apiParams(state, 1, pers);
  useEffect(() => {
    if (state.category === "for_you" && !hydrated) return;
    const ctl = new AbortController();
    setLoad({ status: "loading" });
    setExtra([]);
    setPage(1);
    fetch(`/api/rankings?${query}`, { signal: ctl.signal, cache: refreshKey ? "no-store" : "default" })
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!r.ok) throw Object.assign(new Error(body?.error?.message ?? `HTTP ${r.status}`), { code: body?.error?.code });
        return body as RankingResult;
      })
      .then((data) => setLoad({ status: "ok", data }))
      .catch((e) => {
        if (e?.name !== "AbortError") setLoad({ status: "error", message: e.message, code: e.code });
      });
    return () => ctl.abort();
  }, [query, refreshKey, hydrated, state.category]);

  // Side boards for "recommended", rewards and alerts (public, all-time).
  useEffect(() => {
    const get = (qs: string) => fetch(`/api/rankings?${qs}`).then((r) => (r.ok ? (r.json() as Promise<RankingResult>) : null));
    Promise.all([get("category=popular&pageSize=10"), get("category=trending&period=7d&pageSize=10")])
      .then(([p, t]) =>
        setBoards({
          popular: p?.items.map((i) => i.event.id) ?? [],
          trending: t?.items.map((i) => i.event.id) ?? [],
          rising: (t?.items ?? []).filter((i) => i.event.status !== "ended").slice(0, 6).map((i) => i.event.id),
        }),
      )
      .catch(() => setBoards({ popular: [], trending: [], rising: [] }));
  }, [refreshKey]);

  const loadMore = async () => {
    setMoreLoading(true);
    try {
      const r = await fetch(`/api/rankings?${apiParams(state, page + 1, pers)}`);
      if (r.ok) {
        const d = (await r.json()) as RankingResult;
        setExtra((x) => [...x, ...d.items]);
        setPage((p) => p + 1);
      }
    } finally {
      setMoreLoading(false);
    }
  };

  const openFilters = () => {
    setDraft(state);
    setSheet(true);
  };
  const filterCount = activeFilterCount(state);
  const cats: RankingCategory[] = hydrated && personalize ? ["for_you", ...PUBLIC_CATEGORIES] : PUBLIC_CATEGORIES;
  const data = load.status === "ok" ? load.data : null;
  const items = data ? [...data.items, ...extra] : [];
  const top = items.slice(0, 3);
  const rest = items.slice(3);
  const meta = CATEGORY_META[state.category];
  const rewards = boards
    ? earnedRewards({
        supported: Object.keys(support),
        followed,
        popularTop10: boards.popular,
        popularTop3: boards.popular.slice(0, 3),
        trendingTop10: boards.trending,
      })
    : {};

  const chip = (active: boolean) =>
    cn(
      "inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-4 text-sm font-extrabold uppercase transition-colors",
      active ? "border-acid bg-acid text-ink shadow-[0_0_16px_-2px_rgba(182,240,92,0.6)]" : "border-cream/25 bg-ink/70 text-cream hover:border-cream/60",
    );

  const activeChips: { label: string; clear: Partial<UrlState> }[] = [
    state.period !== "all" && { label: tx(PERIOD_LABEL[state.period]), clear: { period: "all" as const } },
    state.country && { label: state.country, clear: { country: undefined, city: undefined } },
    state.city && { label: state.city, clear: { city: undefined } },
    state.genre && { label: state.genre, clear: { genre: undefined } },
    state.status && { label: state.status, clear: { status: undefined } },
    state.price && { label: state.price, clear: { price: undefined } },
    state.level && { label: `LV.${state.level}`, clear: { level: undefined } },
    state.dj && { label: tu("djRecruiting"), clear: { dj: undefined } },
    state.ap && { label: tu("afterParty"), clear: { ap: undefined } },
    state.dao && { label: tu("daoActive"), clear: { dao: undefined } },
  ].filter(Boolean) as { label: string; clear: Partial<UrlState> }[];

  return (
    <div className="mx-auto max-w-6xl md:px-6">
      {/* TITLE + ART */}
      <header className="px-4 pt-4 md:px-0 md:pt-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-acid">{tu("festivalDiscoveryEngine")}</p>
        <h1 className="mt-1 text-[46px] uppercase leading-[0.88] sm:text-7xl">
          {tu("world")} <span className="text-acid glow-text">{tu("ranking")}</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-mute">{tu("text")}</p>
      </header>
      <div className="mx-4 mt-4 overflow-hidden rounded-[28px] border-2 border-purple/50 bg-ink/60 shadow-[0_0_36px_-12px_rgba(162,118,233,0.7)] md:mx-0">
        <RankingArt className="block h-auto w-full" />
      </div>

      {/* CATEGORIES */}
      <nav aria-label={tu("rankingCategories")} className="rail mt-5 !gap-2 md:!px-0">
        {cats.map((c) => (
          <button key={c} type="button" aria-pressed={state.category === c} onClick={() => update({ category: c })} className={chip(state.category === c)}>
            {c === "for_you" && <Sparkles className="size-4" aria-hidden />}
            <Tx>{CATEGORY_META[c].label}</Tx>
          </button>
        ))}
        <button type="button" aria-pressed={!!state.dao} onClick={() => update({ dao: state.dao ? undefined : true })} className={chip(!!state.dao)}>
          <Landmark className="size-4" aria-hidden />
          {tu("daoActive")}
        </button>
      </nav>
      <p className="mt-2 px-4 text-xs text-mute md:px-0">
        <span className="font-bold text-cream"><Tx>{meta.label}</Tx>:</span> <Tx>{meta.desc}</Tx>
        {state.category === "for_you" && tu("text6")}
      </p>

      {/* SEARCH + FILTERS */}
      <div className="mt-4 flex gap-2 px-4 md:px-0">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{tu("searchRankings")}</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-mute" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tu("eventCityOrGenre")}
            className="h-12 w-full rounded-full border-2 border-purple/40 bg-ink/70 pl-12 pr-4 text-base outline-none focus:border-acid"
          />
        </label>
        <button type="button" onClick={openFilters} className="relative inline-flex h-12 shrink-0 items-center gap-2 rounded-full border-2 border-cream/25 bg-ink/70 px-4 font-extrabold uppercase hover:border-cream/60" aria-label={tu("filtersValue", { value: filterCount ? tu("filtercountActive", { filterCount }) : "" })}>
          <SlidersHorizontal className="size-5" aria-hidden />
          <span className="hidden min-[400px]:inline">{tu("filters")}</span>
          {filterCount > 0 && <span className="flex size-6 items-center justify-center rounded-full bg-acid text-xs text-ink">{filterCount}</span>}
        </button>
      </div>
      {activeChips.length > 0 && (
        <div className="rail mt-3 !gap-2 md:!px-0">
          {activeChips.map((c) => (
            <button key={c.label} type="button" onClick={() => update(c.clear)} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-surface-2 px-3 text-sm font-bold capitalize" aria-label={tu("removeFilterLabel", { label: c.label })}>
              <Tx>{c.label}</Tx> <X className="size-4" aria-hidden />
            </button>
          ))}
        </div>
      )}

      {/* VIEW + STATUS */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 px-4 md:px-0">
        <div className="inline-flex rounded-full border-2 border-line p-1" role="group" aria-label={tu("view")}>
          {(["list", "map"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={state.view === v} onClick={() => update({ view: v })} className={cn("inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-extrabold uppercase", state.view === v ? "bg-cream text-ink" : "text-cream/80")}>
              {v === "list" ? <List className="size-4" aria-hidden /> : <MapIcon className="size-4" aria-hidden />} {v === "list" ? tu("list") : tu("mapView")}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setRefreshKey((k) => k + 1)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-acid hover:bg-surface" aria-label={tu("refreshRanking")}>
          <RefreshCw className={cn("size-4", load.status === "loading" && "animate-spin")} aria-hidden /> {tu("refresh")}
        </button>
      </div>
      {data && (
        <p className="mt-2 px-4 text-[12px] text-mute md:px-0" aria-live="polite">
          {tu("totalEventsValueAggregatedTolocaleti", { total: data.total, value: tx(PERIOD_LABEL[data.period]), toLocaleTimeString: new Date(data.generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }), replace: new Date(data.asOf).toISOString().slice(0, 16).replace("T", " "), round: Math.round(data.refreshSeconds / 60), calculationVersion: data.calculationVersion })}
        </p>
      )}
      {data?.mode === "demo" && (
        <DemoNotice className="mx-4 mt-3 md:mx-0">
          <strong>{tu("demoRanking")}</strong> {tu("allEventsAndNumbersAre")}
        </DemoNotice>
      )}

      {/* RESULTS */}
      <section aria-labelledby="rk-results" className="mt-5">
        <h2 id="rk-results" className="sr-only">{tu("categoryRanking", { label: tx(meta.label) })}</h2>
        {state.view === "map" ? (
          <RankingMap apiQuery={apiParams(state, 1, pers)} category={state.category} />
        ) : load.status === "loading" ? (
          <div className="space-y-3 px-4 md:px-0" role="status" aria-label={tu("loadingRanking")}>
            <div className="skeleton aspect-[16/10] rounded-[28px] sm:aspect-[16/8]" />
            <div className="skeleton h-40 rounded-[24px]" />
            <div className="skeleton h-40 rounded-[24px]" />
          </div>
        ) : load.status === "error" ? (
          <div className="mx-4 rounded-3xl border-2 border-coral/50 bg-coral/10 p-5 md:mx-0" role="alert">
            <h3 className="text-xl uppercase">{load.code === "DATA_SOURCE_NOT_CONFIGURED" ? tu("noProductionDataYet") : tu("rankingUnavailable")}</h3>
            <p className="mt-2 text-sm text-cream/85">{load.message}</p>
            <Button className="mt-4" onClick={() => setRefreshKey((k) => k + 1)}>{tu("tryAgain")}</Button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            className="mx-4 md:mx-0"
            title={state.category === "for_you" ? tu("noMatchesYet") : tu("noEventsHere")}
            body={state.category === "for_you" ? tu("dj") : tu("text2")}
            action={<Button onClick={() => router.replace(pathname, { scroll: false })}>{tu("resetRanking")}</Button>}
          />
        ) : (
          <>
            {top[0] && (
              <div className="px-4 md:px-0">
                <TopOneCard e={top[0]} category={state.category} />
              </div>
            )}
            {top.length > 1 && (
              <div className="rail mt-3 sm:!grid sm:grid-cols-2 sm:!overflow-visible md:!px-0" role="list" aria-label={tu("rank2And3")}>
                {top.slice(1).map((e) => (
                  <div role="listitem" key={e.event.id} className="flex">
                    <TopSmallCard e={e} category={state.category} />
                  </div>
                ))}
              </div>
            )}
            {rest.length > 0 && (
              <ol className="mt-5 grid gap-2 px-4 md:grid-cols-2 md:px-0 [&>*]:min-w-0" aria-label={tu("rank4AndBelow")}>
                {rest.map((e) => (
                  <li key={e.event.id}>
                    <RankingRow e={e} category={state.category} />
                  </li>
                ))}
              </ol>
            )}
            {data && items.length < data.total && (
              <div className="mt-4 px-4 md:px-0">
                <Button variant="ghost" className="w-full" onClick={loadMore} disabled={moreLoading}>
                  {moreLoading ? tu("loading") : tu("showMoreValue", { value: data.total - items.length })}
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      {/* RECOMMENDED */}
      {boards && boards.rising.length > 0 && (
        <section aria-labelledby="rk-rising" className="mt-12">
          <div className="px-4 md:px-0">
            <h2 id="rk-rising" className="text-[28px] uppercase sm:text-4xl">{tu("risingPicks")}</h2>
            <p className="mt-1 text-sm text-mute">{tu("n7")}</p>
          </div>
          <div className="rail mt-4 pb-2 md:!px-0" role="list" aria-label={tu("recommendedEvents")}>
            {boards.rising.map((id) => {
              const ev = getEvent(id);
              return ev ? (
                <div role="listitem" key={id} className="flex">
                  <EventCard event={ev} />
                </div>
              ) : null;
            })}
          </div>
        </section>
      )}

      {/* REWARDS */}
      <section aria-labelledby="rk-rewards" className="mt-12 px-4 md:px-0">
        <h2 id="rk-rewards" className="text-[28px] uppercase sm:text-4xl">{tu("rankingRewards")}</h2>
        <p className="mt-1 text-sm text-mute">{tu("nft")}</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {REWARDS.map((r) => {
            const earned = r.who === "user" && rewards[r.id];
            return (
              <li key={r.id} className={cn("flex items-center gap-3 rounded-2xl border-2 p-3", earned ? "border-acid bg-acid/10" : "border-line bg-surface/80")}>
                <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", earned ? "bg-acid text-ink" : "bg-surface-2 text-mute")}>
                  <Trophy className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <div className="font-bold">{r.name}</div>
                  <div className="text-xs text-mute"><Tx>{r.desc}</Tx></div>
                </div>
                <span className="ml-auto shrink-0 text-[11px] font-extrabold uppercase">{r.who === "event" ? <span className="text-blue">{tu("events")}</span> : earned ? <span className="text-acid">{tu("earned")}</span> : <span className="text-mute">{tu("locked")}</span>}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* MAP CTA */}
      <section aria-labelledby="rk-map" className="mt-12 px-4 md:px-0">
        <Link href="/world" className="group relative block overflow-hidden rounded-[28px] border-2 border-blue/60 shadow-[0_0_30px_-10px_#55BCEB]">
          <Image src={ART.mapCities} alt="" sizes="(min-width:1152px) 1100px, 100vw" className="h-44 w-full object-cover transition-transform duration-700 group-hover:scale-[1.03] sm:h-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" aria-hidden />
          <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
            <h2 id="rk-map" className="text-2xl uppercase sm:text-4xl">{tu("exploreTheWorldMap")}</h2>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-acid text-ink"><ArrowRight className="size-5" aria-hidden /></span>
          </div>
        </Link>
      </section>

      {/* COMPARE TRAY */}
      {hydrated && compareIds.length > 0 && (
        <>
          <div className="h-20" aria-hidden />
          <div className="sticky-cta fixed inset-x-0 z-40 border-t border-blue/40 bg-ink px-4 py-3">
            <div className="mx-auto flex max-w-6xl items-center gap-2">
              <GitCompareArrows className="size-5 shrink-0 text-blue" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{compareIds.length}/3 selected</span>
              <button type="button" onClick={clearCompare} className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold text-mute">{tu("clear")}</button>
              {compareIds.length >= 2 ? (
                <Link href={`/rankings/compare?ids=${compareIds.join(",")}`} className="inline-flex min-h-12 items-center gap-1.5 rounded-full bg-blue px-5 font-extrabold uppercase text-ink">
                  {tu("compare")} <ArrowRight className="size-4" aria-hidden />
                </Link>
              ) : (
                <span className="text-xs text-mute">{tu("pick1More")}</span>
              )}
            </div>
          </div>
        </>
      )}

      {/* FILTER SHEET */}
      <BottomSheet
        open={sheet}
        onClose={() => setSheet(false)}
        title={tu("rankingFilters")}
        footer={
          <div className="flex gap-2 pb-1">
            <Button variant="ghost" className="flex-1" onClick={() => setDraft({ category: state.category, period: "all", view: state.view, q: state.q })}>{tu("reset")}</Button>
            <Button
              className="flex-[1.4]"
              onClick={() => {
                update({ ...draft, category: state.category, view: state.view, q: state.q });
                setSheet(false);
              }}
            >
              {tu("showResults")}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-sm font-bold">{tu("period")}</legend>
            <div className="grid grid-cols-4 gap-1.5">
              {RANKING_PERIODS.map((p) => (
                <button key={p} type="button" aria-pressed={draft.period === p} onClick={() => setDraft({ ...draft, period: p })} className={cn("min-h-11 rounded-full border-2 text-[13px] font-extrabold", draft.period === p ? "border-acid bg-acid text-ink" : "border-line")}>
                  {p === "all" ? tu("all") : p.toUpperCase()}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={tu("country")} id="rk-country">
              <Select id="rk-country" value={draft.country ?? ""} onChange={(e) => setDraft({ ...draft, country: e.target.value || undefined, city: undefined })}>
                <option value="">{tu("world")}</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label={tu("city")} id="rk-city">
              <Select id="rk-city" value={draft.city ?? ""} onChange={(e) => setDraft({ ...draft, city: e.target.value || undefined })}>
                <option value="">{tu("allCities")}</option>
                {CITIES.filter((c) => !draft.country || c.startsWith(draft.country + "|")).map((c) => {
                  const city = c.split("|")[1];
                  return <option key={c} value={city}>{city}</option>;
                })}
              </Select>
            </Field>
            <Field label={tu("musicGenre")} id="rk-genre">
              <Select id="rk-genre" value={draft.genre ?? ""} onChange={(e) => setDraft({ ...draft, genre: (e.target.value || undefined) as UrlState["genre"] })}>
                <option value="">{tu("allGenres")}</option>
                {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
              </Select>
            </Field>
            <Field label={tu("eventLevel")} id="rk-level">
              <Select id="rk-level" value={draft.level ?? ""} onChange={(e) => setDraft({ ...draft, level: e.target.value ? Number(e.target.value) : undefined })}>
                <option value="">{tu("anyLevel")}</option>
                {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>LV.{l}</option>)}
              </Select>
            </Field>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-bold">{tu("status")}</legend>
            <div className="grid grid-cols-4 gap-1.5">
              {([undefined, "upcoming", "live", "completed"] as const).map((s) => (
                <button key={s ?? "any"} type="button" aria-pressed={draft.status === s} onClick={() => setDraft({ ...draft, status: s })} className={cn("min-h-11 rounded-full border-2 text-[12px] font-extrabold uppercase", draft.status === s ? "border-acid bg-acid text-ink" : "border-line")}>
                  {s ?? tu("any")}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-bold">{tu("price")}</legend>
            <div className="grid grid-cols-3 gap-1.5">
              {([undefined, "free", "paid"] as const).map((s) => (
                <button key={s ?? "any"} type="button" aria-pressed={draft.price === s} onClick={() => setDraft({ ...draft, price: s })} className={cn("min-h-11 rounded-full border-2 text-[12px] font-extrabold uppercase", draft.price === s ? "border-acid bg-acid text-ink" : "border-line")}>
                  {s ?? tu("any")}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="space-y-2">
            <ToggleRow checked={!!draft.dj} onChange={(v) => setDraft({ ...draft, dj: v || undefined })} label={tu("djRecruiting")} sub={tu("dj2")} />
            <ToggleRow checked={!!draft.ap} onChange={(v) => setDraft({ ...draft, ap: v || undefined })} label={tu("afterPartyAvailable")} sub={tu("text3")} />
            <ToggleRow checked={!!draft.dao} onChange={(v) => setDraft({ ...draft, dao: v || undefined })} label={tu("daoActive")} sub={tu("dao")} />
            <ToggleRow checked={personalize} onChange={setPersonalize} label={tu("personalizedForYou")} sub={tu("dj3")} />
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
