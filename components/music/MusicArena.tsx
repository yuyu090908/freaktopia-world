"use client";

/**
 * DJ ARENA 2.0: music-first discovery over real DJ profiles and tracks (lib/music). Top: search, genre,
 * booking filter, trending DJs. Middle: featured DJ, new mixes, popular playlists, open DJ calls from event
 * recruiting. Bottom: every DJ as cards or a list, and by genre. Nothing here is sample data.
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { LayoutGrid, List, Mic2, Pause, Play, Search, SlidersHorizontal, Heart, X } from "lucide-react";
import { AlienAvatar } from "@/components/cards/Cards";
import { Chip } from "@/components/ui/primitives";
import { Input, Select } from "@/components/forms/Fields";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { DJ_GENRES, MUSICAL_KEYS } from "@/lib/music/genres";
import { cn } from "@/lib/utils";
import { usePlayerMaybe } from "./PlayerProvider";
import { TrackRow } from "./TrackActions";
import { BOOKING_COLORS, imageUrl, useMusic, type DjCardDto, type TrackDto } from "./shared";

interface ArenaRes {
  trending: { rank: number; value: number; listeners30: number; dj: DjCardDto }[];
  featured: DjCardDto | null;
  newMixes: TrackDto[];
  playlists: { id: string; title: string; count: number; likes: number; owner?: { stageName: string } }[];
  calls: { openingId: string; event: string; city: string; startAt: string; genres: string[]; budgetUsd: number | null; demo: boolean }[];
  djs: DjCardDto[];
}
interface SearchRes { djs: DjCardDto[]; tracks: TrackDto[]; playlists: { id: string; title: string; owner?: { stageName: string } }[] }

export function MusicArena() {
  const t = useTranslations("music");
  const href = useLocalHref();
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState<string | null>(null);
  const [available, setAvailable] = useState(false);
  const [more, setMore] = useState(false);
  const [city, setCity] = useState("");
  const [bpmMin, setBpmMin] = useState("");
  const [bpmMax, setBpmMax] = useState("");
  const [key, setKey] = useState("");
  const [sort, setSort] = useState<"relevance" | "recent" | "liked" | "trending">("relevance");
  const [newDjs, setNewDjs] = useState(false);
  const [mode, setMode] = useState<"cards" | "list">("cards");
  const [debounced, setDebounced] = useState("");
  const { data: arena, error } = useMusic<ArenaRes>("/api/music/arena");
  const searchUrl = useMemo(() => {
    const sp = new URLSearchParams();
    if (debounced.trim()) sp.set("q", debounced.trim());
    if (genre) sp.set("genre", genre);
    if (available) sp.set("available", "1");
    if (city.trim()) sp.set("city", city.trim());
    if (bpmMin) sp.set("bpmMin", bpmMin);
    if (bpmMax) sp.set("bpmMax", bpmMax);
    if (key) sp.set("key", key);
    if (sort !== "relevance") sp.set("sort", sort);
    if (newDjs) sp.set("new", "1");
    const s = sp.toString();
    return s ? `/api/music/search?${s}` : null;
  }, [debounced, genre, available, city, bpmMin, bpmMax, key, sort, newDjs]);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(id);
  }, [q]);
  const { data: found } = useMusic<SearchRes>(searchUrl);
  const searching = !!searchUrl;
  const reset = () => { setQ(""); setGenre(null); setAvailable(false); setCity(""); setBpmMin(""); setBpmMax(""); setKey(""); setSort("relevance"); setNewDjs(false); };

  return (
    <div className="space-y-8" data-testid="music-arena">
      {/* ---- top: search, genre, booking, trending */}
      <section aria-labelledby="ma-search" className="space-y-2.5">
        <h2 id="ma-search" className="sr-only">{t("searchDjsMusic")}</h2>
        <div role="search" className="relative mx-4 md:mx-0">
          <label htmlFor="music-q" className="sr-only">{t("searchDjsMusic")}</label>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-mute" aria-hidden />
          <input id="music-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} className="h-[52px] w-full rounded-full border-2 border-acid/60 bg-surface pl-12 pr-12 outline-none focus:border-acid" data-testid="music-search" />
          {q && <button type="button" onClick={() => setQ("")} aria-label={t("clear")} className="absolute right-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center"><X className="size-4" aria-hidden /></button>}
        </div>
        <div className="rail !gap-2 md:!px-0" role="group" aria-label={t("genre")}>
          <Chip active={!genre} onClick={() => setGenre(null)}>{t("allGenres")}</Chip>
          {DJ_GENRES.map((g) => <Chip key={g} active={genre === g} onClick={() => setGenre(genre === g ? null : g)} data-testid={`genre-${g}`}>{g}</Chip>)}
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 md:px-0">
          <Chip active={available} onClick={() => setAvailable(!available)} aria-pressed={available} data-testid="filter-available">{t("availableForBooking")}</Chip>
          <Chip active={newDjs} onClick={() => setNewDjs(!newDjs)} aria-pressed={newDjs}>{t("newDjs")}</Chip>
          <Chip active={more} onClick={() => setMore(!more)} aria-expanded={more}><SlidersHorizontal className="mr-1 size-4" aria-hidden />{t("moreFilters")}</Chip>
          {searching && <button type="button" onClick={reset} className="min-h-11 px-2 text-sm font-bold text-acid underline">{t("resetFilters")}</button>}
        </div>
        {more && (
          <div className="mx-4 grid grid-cols-2 gap-2 rounded-2xl border border-line p-3 md:mx-0 md:grid-cols-5" data-testid="more-filters">
            <Input aria-label={t("location")} placeholder={t("location")} value={city} maxLength={60} onChange={(e) => setCity(e.target.value)} data-testid="filter-city" />
            <Input aria-label={t("bpmMin")} placeholder={t("bpmMin")} type="number" inputMode="numeric" value={bpmMin} onChange={(e) => setBpmMin(e.target.value)} data-testid="filter-bpm-min" />
            <Input aria-label={t("bpmMax")} placeholder={t("bpmMax")} type="number" inputMode="numeric" value={bpmMax} onChange={(e) => setBpmMax(e.target.value)} data-testid="filter-bpm-max" />
            <Select aria-label={t("fKey")} value={key} onChange={(e) => setKey(e.target.value)}><option value="">{t("anyKey")}</option>{MUSICAL_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}</Select>
            <Select aria-label={t("sortBy")} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} data-testid="filter-sort">
              {(["relevance", "recent", "liked", "trending"] as const).map((s) => <option key={s} value={s}>{t(`sort.${s}`)}</option>)}
            </Select>
          </div>
        )}
      </section>

      {error && <p role="alert" className="mx-4 text-sm text-coral md:mx-0">{t("loadError")}</p>}
      {!arena && !error && <div className="mx-4 h-40 animate-pulse rounded-3xl bg-surface md:mx-0" aria-busy="true" />}

      {searching ? (
        <section aria-labelledby="ma-results" className="space-y-4 px-4 md:px-0" data-testid="search-results">
          <div className="flex items-center justify-between">
            <h2 id="ma-results" className="text-xl uppercase" aria-live="polite">{found ? t("resultsCount", { djs: found.djs.length, tracks: found.tracks.length }) : t("searching")}</h2>
            <ModeToggle mode={mode} setMode={setMode} />
          </div>
          {found && found.djs.length === 0 && found.tracks.length === 0 && <p className="text-sm text-mute" data-testid="no-results">{t("noResults")}</p>}
          {found && found.djs.length > 0 && <DjList djs={found.djs} mode={mode} />}
          {found && found.tracks.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-extrabold uppercase text-mute">{t("tracks")}</h3>
              <ul className="space-y-2" data-testid="track-results">{found.tracks.map((tr, i) => <li key={tr.id}><TrackRow track={tr} list={found.tracks} index={i} /></li>)}</ul>
            </div>
          )}
          {found && found.playlists.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-extrabold uppercase text-mute">{t("playlists")}</h3>
              <ul className="flex flex-wrap gap-2">{found.playlists.map((p) => <li key={p.id}><Link href={href(`/music/playlists/${p.id}`)} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-bold">{p.title}{p.owner ? ` · ${p.owner.stageName}` : ""}</Link></li>)}</ul>
            </div>
          )}
        </section>
      ) : (
        arena && (
          <>
            {arena.trending.length > 0 && (
              <section aria-labelledby="ma-trend" className="px-4 md:px-0">
                <div className="mb-2 flex items-end justify-between gap-2">
                  <h2 id="ma-trend" className="text-2xl uppercase">{t("trendingDjs")}</h2>
                  <Link href={href("/rankings#dj-rankings")} className="min-h-11 content-center text-sm font-bold text-acid">{t("howRanked")}</Link>
                </div>
                <ol className="overflow-hidden rounded-3xl border border-line" data-testid="trending">
                  {arena.trending.map((r) => (
                    <li key={r.dj.userId} className="border-b border-line bg-surface last:border-b-0">
                      <Link href={href(`/djs/u/${r.dj.slug}`)} className="flex items-center gap-3 p-3">
                        <span className="w-8 text-center font-display text-2xl text-acid">{r.rank}</span>
                        <DjAvatar dj={r.dj} size={44} />
                        <span className="min-w-0 flex-1"><b className="block truncate">{r.dj.stageName}</b><span className="block text-xs text-mute">{r.dj.city} · {t("listeners30", { n: r.listeners30 })}</span></span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* ---- middle */}
            {arena.featured && (
              <section aria-labelledby="ma-feat" className="px-4 md:px-0">
                <h2 id="ma-feat" className="mb-2 text-2xl uppercase">{t("featuredDj")}</h2>
                <DjCard dj={arena.featured} big />
              </section>
            )}
            <section aria-labelledby="ma-new" className="px-4 md:px-0">
              <h2 id="ma-new" className="mb-2 text-2xl uppercase">{t("newMixes")}</h2>
              {arena.newMixes.length === 0 ? (
                <div className="rounded-3xl border-2 border-dashed border-line p-5 text-sm" data-testid="arena-empty">
                  <p className="font-bold">{t("arenaEmpty")}</p>
                  <Link href={href("/profile/dj")} className="mt-2 inline-flex min-h-11 items-center font-bold text-acid underline">{t("becomeFirst")}</Link>
                </div>
              ) : (
                <ul className="space-y-2" data-testid="new-mixes">{arena.newMixes.map((tr, i) => <li key={tr.id}><TrackRow track={tr} list={arena.newMixes} index={i} /></li>)}</ul>
              )}
            </section>
            {arena.playlists.length > 0 && (
              <section aria-labelledby="ma-pl" className="px-4 md:px-0">
                <h2 id="ma-pl" className="mb-2 text-2xl uppercase">{t("popularPlaylists")}</h2>
                <ul className="grid gap-2 md:grid-cols-2">{arena.playlists.map((p) => <li key={p.id}><Link href={href(`/music/playlists/${p.id}`)} className="block rounded-2xl bg-surface-2 p-3 hover:outline hover:outline-acid"><b className="block truncate">{p.title}</b><span className="text-xs text-mute">{p.owner?.stageName} · {t("nTracks", { n: p.count })} · ♥ {p.likes}</span></Link></li>)}</ul>
              </section>
            )}
            {arena.calls.length > 0 && (
              <section aria-labelledby="ma-calls" className="px-4 md:px-0">
                <h2 id="ma-calls" className="mb-2 text-2xl uppercase">{t("openCalls")}</h2>
                <ul className="grid gap-2 md:grid-cols-2" data-testid="open-calls">
                  {arena.calls.map((c) => (
                    <li key={c.openingId} className="rounded-2xl bg-surface-2 p-3 text-sm">
                      <b className="block">{c.event}{c.demo ? " (DEMO)" : ""}</b>
                      <span className="text-mute">{c.city} · {new Date(c.startAt).toLocaleDateString()} · {c.genres.join(", ")}</span>
                      <Link href={href("/profile/work")} className="mt-1 block min-h-11 content-center font-bold text-acid underline">{t("applyWithMusic")}</Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ---- bottom: all DJs, by genre */}
            <section aria-labelledby="ma-all" className="px-4 md:px-0">
              <div className="mb-2 flex items-center justify-between">
                <h2 id="ma-all" className="text-2xl uppercase">{t("allDjs", { n: arena.djs.length })}</h2>
                <ModeToggle mode={mode} setMode={setMode} />
              </div>
              {arena.djs.length === 0 ? <p className="text-sm text-mute">{t("noDjsYet")}</p> : <DjList djs={arena.djs} mode={mode} />}
            </section>
            {arena.djs.length > 0 && (
              <section aria-labelledby="ma-genre" className="px-4 md:px-0">
                <h2 id="ma-genre" className="mb-2 text-2xl uppercase">{t("byGenre")}</h2>
                <div className="space-y-2">
                  {DJ_GENRES.map((g) => {
                    const ds = arena.djs.filter((d) => d.genres.includes(g));
                    if (!ds.length) return null;
                    return (
                      <div key={g} className="flex flex-wrap items-center gap-2 text-sm">
                        <button type="button" onClick={() => setGenre(g)} className="min-h-11 font-extrabold text-acid">{g}</button>
                        {ds.slice(0, 8).map((d) => <Link key={d.userId} href={href(`/djs/u/${d.slug}`)} className="rounded-full border border-line px-3 py-1">{d.stageName}</Link>)}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )
      )}
    </div>
  );
}

function ModeToggle({ mode, setMode }: { mode: "cards" | "list"; setMode: (m: "cards" | "list") => void }) {
  const t = useTranslations("music");
  return (
    <div className="flex gap-1" role="group" aria-label={t("viewMode")}>
      <button type="button" aria-pressed={mode === "cards"} aria-label={t("cards")} onClick={() => setMode("cards")} className={cn("inline-flex size-11 items-center justify-center rounded-full border", mode === "cards" ? "border-acid text-acid" : "border-line")}><LayoutGrid className="size-4" aria-hidden /></button>
      <button type="button" aria-pressed={mode === "list"} aria-label={t("list")} onClick={() => setMode("list")} className={cn("inline-flex size-11 items-center justify-center rounded-full border", mode === "list" ? "border-acid text-acid" : "border-line")} data-testid="mode-list"><List className="size-4" aria-hidden /></button>
    </div>
  );
}

function DjList({ djs, mode }: { djs: DjCardDto[]; mode: "cards" | "list" }) {
  const t = useTranslations("music");
  const href = useLocalHref();
  if (mode === "list")
    return (
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line" data-testid="dj-list">
        {djs.map((d) => (
          <li key={d.userId}>
            <Link href={href(`/djs/u/${d.slug}`)} className="flex items-center gap-3 bg-surface p-2.5" data-testid="dj-list-row">
              <DjAvatar dj={d} size={36} />
              <span className="min-w-0 flex-1 truncate"><b>{d.stageName}</b> <span className="text-xs text-mute">{d.city} · {d.genres.slice(0, 2).join(", ")}</span></span>
              <span className="text-xs tabular-nums text-mute">♥ {d.likes}</span>
              <span className="size-2.5 rounded-full" style={{ background: BOOKING_COLORS[d.bookingStatus] }} title={t(`booking.${d.bookingStatus}`)} aria-label={t(`booking.${d.bookingStatus}`)} />
            </Link>
          </li>
        ))}
      </ul>
    );
  return <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="dj-cards">{djs.map((d) => <li key={d.userId} className="flex"><DjCard dj={d} /></li>)}</ul>;
}

export function DjAvatar({ dj, size }: { dj: Pick<DjCardDto, "imageId" | "look">; size: number }) {
  const img = imageUrl(dj.imageId);
  // eslint-disable-next-line @next/next/no-img-element
  if (img) return <img src={img} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} loading="lazy" />;
  if (dj.look) return <AlienAvatar look={dj.look} size={size} />;
  return <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2" style={{ width: size, height: size }}><Mic2 className="size-1/2 text-acid" aria-hidden /></span>;
}

export function DjCard({ dj, big }: { dj: DjCardDto; big?: boolean }) {
  const t = useTranslations("music");
  const href = useLocalHref();
  const player = usePlayerMaybe();
  const top = dj.topTrack;
  const isCurrent = !!top && player?.current?.id === top.id;
  const c = BOOKING_COLORS[dj.bookingStatus];
  return (
    <article className={cn("flex w-full flex-col rounded-3xl border border-line bg-surface p-3", big && "md:flex-row md:items-center md:gap-4")} data-testid="dj-card">
      <div className="flex items-center gap-3">
        <DjAvatar dj={dj} size={big ? 88 : 56} />
        <div className="min-w-0">
          <Link href={href(`/djs/u/${dj.slug}`)} className="block truncate font-display text-xl uppercase hover:underline">{dj.stageName}</Link>
          <span className="block truncate text-xs text-mute">{[dj.city, dj.country].filter(Boolean).join(", ")} · {dj.genres.slice(0, 3).join(", ")}</span>
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-extrabold uppercase" style={{ color: c }}><span className="size-2 rounded-full" style={{ background: c }} aria-hidden />{t(`booking.${dj.bookingStatus}`)}</span>
        </div>
      </div>
      <div className={cn("mt-3 flex items-center gap-2", big && "md:mt-0 md:flex-1")}>
        {top ? (
          <button
            type="button"
            onClick={() => (isCurrent ? player?.toggle() : player?.play([{ id: top.id, title: top.title, coverId: top.coverId, durationSec: top.durationSec, waveform: top.waveform, liked: false, saved: false, likes: 0, owner: { stageName: dj.stageName, slug: dj.slug } }], 0))}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-surface-2 px-2 text-left text-sm"
            aria-label={t("playTrack", { title: top.title })}
            data-testid="card-play"
          >
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-acid text-ink">{isCurrent && player?.playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}</span>
            <span className="truncate font-bold">{top.title}</span>
          </button>
        ) : (
          <span className="flex-1 text-xs text-mute">{t("noPublicTracks")}</span>
        )}
        <span className="inline-flex items-center gap-1 text-sm tabular-nums text-mute"><Heart className="size-4" aria-hidden />{dj.likes}</span>
      </div>
    </article>
  );
}
