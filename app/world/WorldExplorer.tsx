"use client";

import { Tx } from "@/components/i18n/Tx";
/**
 * FREAKTOPIA WORLD 7.0 — "THE PLANET IS ONE GIANT FESTIVAL".
 *
 * Fullscreen map first: compact search + chips on top, camera controls on the right,
 * Map/List toggle at the bottom, festival details in a right panel (desktop) or a
 * swipeable bottom sheet (phone). Filters, view and the selected festival live in the URL.
 */
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, CalendarDays, Disc3, Globe2, Home, Info, List, LocateFixed, Map as MapIcon, MapPin, Minus, Music2, Orbit, Plus, Search, Settings2, SlidersHorizontal, X } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Chip, DemoBadge } from "@/components/ui/primitives";
import { EmptyState, LoadingSkeleton } from "@/components/ui/States";
import { EventBottomSheet, EventSidePanel, LevelPill, StatusPill } from "@/components/world/EventPanel";
import { LiteWorldMap } from "@/components/world/LiteWorldMap";
import type { CameraPadding, FestivalWorldMapHandle } from "@/components/world/FestivalWorldMap";
import { GENRES } from "@/lib/data";
import { DATE_LABELS, type DateRange } from "@/lib/filters";
import { DEFAULT_GROWTH_CONFIG, LEVEL_COLORS, normalizeConfig } from "@/lib/map/growth";
import { STATUS_META, landmarkSvg, type MapStatus } from "@/lib/map/landmarks";
import type { WorldMapResponse } from "@/lib/map/types";
import { EMPTY_MAP_FILTERS, FLAG_KEYS, FLAG_LABEL, filterCount, filterWorld, readWorldUrl, suggest, toWorldEvents, writeWorldUrl, type MapFilters, type Suggestion, type WorldEvent } from "@/lib/map/view";
import { useDemo } from "@/lib/store";
import type { EventLevel, Genre } from "@/lib/types";
import { cn, fmtDate } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/config";
import { formatEventDate } from "@/lib/i18n/format";
import { Alien } from "@/components/art/Alien";
import { useAuth } from "@/lib/auth/client";

const FestivalWorldMap = dynamic(() => import("@/components/world/FestivalWorldMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-[#070A12]">
      <LoadingSkeleton variant="map" />
    </div>
  ),
});

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ok"; data: WorldMapResponse };

interface Device {
  webgl: boolean;
  lowPower: boolean;
  reducedMotion: boolean;
  desktop: boolean;
  renderer: "auto" | "lite" | "flat" | "rich";
  remoteTiles: boolean;
}

function detectDevice(): Device {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  let webgl = false;
  try {
    const c = document.createElement("canvas");
    webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webgl = false;
  }
  const p = new URLSearchParams(location.search);
  const r = p.get("renderer");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lowPower = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 2 || !!nav.connection?.saveData;
  return {
    webgl,
    lowPower,
    reducedMotion,
    desktop: matchMedia("(min-width: 1024px)").matches,
    renderer: r === "lite" || r === "flat" || r === "rich" ? r : "auto",
    remoteTiles: process.env.NEXT_PUBLIC_MAP_TILES !== "off" && p.get("tiles") !== "off",
  };
}

const SUGGEST_ICON: Record<Suggestion["kind"], React.ReactNode> = {
  event: <Disc3 className="size-4" aria-hidden />,
  city: <MapPin className="size-4" aria-hidden />,
  country: <Globe2 className="size-4" aria-hidden />,
  venue: <Building2 className="size-4" aria-hidden />,
  dj: <Music2 className="size-4" aria-hidden />,
  genre: <Music2 className="size-4" aria-hidden />,
};

export function WorldExplorer() {
  const tu = useTranslations("world");
  const t = useTranslations("world");
  const tc = useTranslations("common");
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [filters, setFilters] = useState<MapFilters>(EMPTY_MAP_FILTERS);
  const [view, setView] = useState<"map" | "list">("map");
  const [selected, setSelected] = useState<string | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [sheetH, setSheetH] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [canLocate, setCanLocate] = useState(false);
  const [urlReady, setUrlReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const mapRef = useRef<FestivalWorldMapHandle | null>(null);
  const liteRef = useRef<FestivalWorldMapHandle | null>(null);

  const support = useDemo((s) => s.support);
  const sim = useDemo((s) => s.sim);
  const growthCfg = useDemo((s) => s.mapGrowthConfig);
  const orders = useDemo((s) => s.orders);

  /* The signed-in user's alien at events they joined (tickets or support), only with map presence turned on. */
  const me = useAuth((s) => s.me);
  const meBox = useRef<HTMLDivElement>(null);
  const [meSvg, setMeSvg] = useState<string | null>(null);
  const showMe = Boolean(me?.alien && me.privacy.mapPresence);
  useEffect(() => {
    setMeSvg(showMe ? meBox.current?.innerHTML ?? null : null);
  }, [showMe, me?.alien?.look]);
  const joinedIds = useMemo(() => new Set([...orders.map((o) => o.eventId), ...Object.keys(support)]), [orders, support]);
  const meProp = useMemo(() => (meSvg && me?.alien ? { svg: meSvg, label: t("myAlienHere"), ids: joinedIds } : null), [meSvg, me?.alien, joinedIds, t]);

  /* device + URL (client only) */
  useEffect(() => {
    const d = detectDevice();
    setDevice(d);
    const u = readWorldUrl(new URLSearchParams(location.search));
    setFilters(u.filters);
    setView(u.view);
    setSelected(u.event);
    setUrlReady(true);
    const mq = matchMedia("(min-width: 1024px)");
    const onMq = () => setDevice((x) => (x ? { ...x, desktop: mq.matches } : x));
    mq.addEventListener("change", onMq);
    // My Location only appears when the browser already granted permission (never prompts on load).
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((p) => {
        setCanLocate(p.state === "granted");
        p.onchange = () => setCanLocate(p.state === "granted");
      })
      .catch(() => {});
    const onPop = () => {
      const s = readWorldUrl(new URLSearchParams(location.search));
      setFilters(s.filters);
      setView(s.view);
      setSelected(s.event);
    };
    addEventListener("popstate", onPop);
    return () => {
      mq.removeEventListener("change", onMq);
      removeEventListener("popstate", onPop);
    };
  }, []);

  /* data */
  useEffect(() => {
    const ac = new AbortController();
    setLoad({ status: "loading" });
    fetch("/api/map", { signal: ac.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => null))?.error?.message ?? `HTTP ${r.status}`);
        return r.json() as Promise<WorldMapResponse>;
      })
      .then((data) => setLoad({ status: "ok", data }))
      .catch((e: Error) => !ac.signal.aborted && setLoad({ status: "error", message: e.message }));
    return () => ac.abort();
  }, [retry]);

  const cfg = useMemo(() => (growthCfg ? normalizeConfig(growthCfg) : DEFAULT_GROWTH_CONFIG), [growthCfg]);
  const all: WorldEvent[] = useMemo(() => {
    if (load.status !== "ok") return [];
    return toWorldEvents(load.data.events, cfg, (id) => {
      const s = sim[id];
      const base = load.data.events.find((e) => e.id === id)!;
      const sp = support[id];
      if (!s && !sp) return undefined;
      return { supporters: s?.supporters ?? base.growth.supporters + (sp?.supporters ?? 0), fundingUsd: s?.raised ?? base.growth.fundingUsd + (sp?.raised ?? 0) };
    });
  }, [load, cfg, sim, support]);
  const results = useMemo(() => filterWorld(all, filters), [all, filters]);
  const sel = all.find((e) => e.id === selected) ?? null;

  /* URL sync (replace while typing; filters are shareable) */
  const firstPush = useRef(true);
  useEffect(() => {
    if (!urlReady) return;
    const qs = writeWorldUrl({ filters, view, event: selected });
    if (qs === location.search || (qs === "" && location.search === "")) return;
    const url = `${location.pathname}${qs}`;
    if (firstPush.current) {
      firstPush.current = false;
      history.replaceState(history.state, "", url);
    } else history.replaceState(history.state, "", url);
  }, [filters, view, selected, urlReady]);

  // When filters change, bring the matching festivals into view (a few results only).
  const filterKey = `${filters.flags.join()}|${filters.levels.join()}|${filters.genres.join()}|${filters.date}`;
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    if (load.status !== "ok" || !urlReady) return;
    const first = lastKey.current === null;
    const changed = lastKey.current !== filterKey;
    lastKey.current = filterKey;
    if (first || !changed || selected) return;
    if (results.length >= 1 && results.length <= 8) setTimeout(() => (lite ? liteRef.current : mapRef.current)?.flyToEvents(results.map((r) => r.id)), 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, load.status, urlReady]);

  const select = useCallback((id: string | null) => {
    setSelected(id);
    setExpanded(false);
    if (id) setView("map");
  }, []);

  const desktop = !!device?.desktop;
  const padding: CameraPadding = useMemo(
    () => ({ top: desktop ? 140 : sel ? 210 : 112, left: desktop ? 24 : 0, right: desktop && sel ? 430 : 0, bottom: !desktop && sel ? Math.min(sheetH, 420) : desktop ? 24 : 60 }),
    [desktop, sel, sheetH],
  );
  const lite = device ? device.renderer === "lite" || !device.webgl : false;
  const rich = device ? device.renderer === "rich" || (device.renderer === "auto" && !device.lowPower) : false;
  const ctl = () => (lite ? liteRef.current : mapRef.current);

  const flyTo = (ids: string[]) => ctl()?.flyToEvents(ids);

  const onSuggestion = (s: Suggestion) => {
    if (s.kind === "event") {
      setFilters((f) => ({ ...f, q: "" }));
      select(s.eventIds[0]);
      return;
    }
    setFilters((f) => ({ ...f, q: s.label }));
    select(null);
    setView("map");
    setTimeout(() => flyTo(s.eventIds), 50);
  };

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => mapRef.current?.flyToPoint(p.coords.longitude, p.coords.latitude, 6),
      () => setCanLocate(false),
      { maximumAge: 600_000, timeout: 8000 },
    );
  };

  return (
    <div className="fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] top-[calc(60px+env(safe-area-inset-top))] overflow-hidden bg-[#070A12] lg:bottom-0" data-testid="world-explorer">
      <style>{`body{overflow:hidden}`}</style>
      <h1 className="sr-only">{t("title")}: {t("lead")}</h1>
      {showMe && me?.alien && (
        <div ref={meBox} hidden aria-hidden>
          <Alien look={me.alien.look} />
        </div>
      )}

      {/* map */}
      {device && load.status === "ok" && (lite ? <LiteWorldMap events={results} selectedId={selected} onSelect={select} zoomRef={liteRef as never} /> : <FestivalWorldMap ref={mapRef} events={results} selectedId={selected} onSelect={select} rich={rich} animate={rich && !device.reducedMotion} reducedMotion={device.reducedMotion} padding={padding} remoteTiles={device.remoteTiles} me={meProp} />)}
      {(load.status === "loading" || !device) && (
        <div className="absolute inset-0">
          <LoadingSkeleton variant="map" />
        </div>
      )}
      {load.status === "error" && (
        <div className="absolute inset-x-4 top-1/2 z-10 mx-auto max-w-sm -translate-y-1/2">
          <EmptyState title={t("loadFailed")} body={load.message} className="bg-ink/90" />
          <button type="button" onClick={() => setRetry((n) => n + 1)} className="mx-auto mt-3 flex min-h-11 items-center rounded-full bg-acid px-5 font-extrabold uppercase text-ink">
            {tc("retry")}
          </button>
        </div>
      )}

      {/* top: search + chips */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-[#070A12]/90 via-[#070A12]/45 to-transparent pb-8 pt-2.5">
        <div className="pointer-events-auto mx-auto flex max-w-3xl items-center gap-2 px-3 md:px-4">
          <SearchBox events={all} value={filters.q} onChange={(q) => setFilters((f) => ({ ...f, q }))} onPick={onSuggestion} onSubmit={() => flyTo(results.map((r) => r.id))} />
          <button type="button" onClick={() => setFiltersOpen(true)} className="relative inline-flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-line bg-[#0D121B]/90 backdrop-blur" aria-label={`${t("filters")}${filterCount(filters) ? ` (${filterCount(filters)})` : ""}`}>
            <SlidersHorizontal className="size-5" aria-hidden />
            {filterCount(filters) > 0 && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-acid text-[11px] font-black text-ink">{filterCount(filters)}</span>}
          </button>
        </div>
        <div className="pointer-events-auto mx-auto mt-2 max-w-3xl">
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 pb-1 md:px-4" role="group" aria-label={t("quickFilters")}>
            {FLAG_KEYS.map((k) => {
              const on = filters.flags.includes(k);
              return (
                <Chip key={k} active={on} onClick={() => setFilters((f) => ({ ...f, flags: on ? f.flags.filter((x) => x !== k) : [...f.flags, k] }))} className="min-h-10 bg-[#0D121B]/85 px-3.5 text-[13px] backdrop-blur">
                  {k === "live" && <span className={cn("size-2 rounded-full", on ? "bg-ink" : "bg-coral")} aria-hidden />}
                  {t(`chips.${k}`)}
                </Chip>
              );
            })}
          </div>
        </div>
        <div className="pointer-events-auto mx-auto mt-1.5 flex max-w-3xl items-center gap-2 px-3 md:px-4">
          <span className="rounded-full bg-[#0D121B]/85 px-3 py-1 text-xs font-bold" aria-live="polite" data-testid="world-count">
            {t("count", { count: results.length })}
          </span>
          <DemoBadge label={tc("sampleEvents")} className="bg-[#0D121B]/85" />
          {filterCount(filters) + (filters.q ? 1 : 0) > 0 && (
            <button type="button" onClick={() => setFilters(EMPTY_MAP_FILTERS)} className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-xs font-bold text-mute hover:text-cream">
              <X className="size-3.5" aria-hidden /> {tc("clear")}
            </button>
          )}
        </div>
      </div>

      {/* right: camera controls */}
      {view === "map" && load.status === "ok" && (
        <div className={cn("absolute z-20 flex flex-col gap-2", desktop ? (sel ? "right-[436px] top-[132px]" : "right-4 top-[132px]") : "right-3 top-[132px]")} role="group" aria-label={t("controls")}>
          <MapBtn label={t("zoomIn")} onClick={() => ctl()?.zoomIn()}>
            <Plus className="size-5" />
          </MapBtn>
          <MapBtn label={t("zoomOut")} onClick={() => ctl()?.zoomOut()}>
            <Minus className="size-5" />
          </MapBtn>
          <MapBtn
            label={t("resetView")}
            onClick={() => {
              select(null);
              ctl()?.reset();
            }}
          >
            <Home className="size-5" />
          </MapBtn>
          {canLocate && !lite && (
            <MapBtn label={t("myLocation")} onClick={locate}>
              <LocateFixed className="size-5" />
            </MapBtn>
          )}
          <MapBtn label={t("legend")} onClick={() => setLegendOpen((v) => !v)} pressed={legendOpen}>
            <Info className="size-5" />
          </MapBtn>
        </div>
      )}

      {legendOpen && view === "map" && <Legend onClose={() => setLegendOpen(false)} desktop={desktop} />}

      {/* empty */}
      {load.status === "ok" && results.length === 0 && (
        <div className="absolute inset-x-4 top-1/2 z-10 mx-auto max-w-sm -translate-y-1/2">
          <EmptyState title={t("emptyTitle")} body={t("emptyBody")} className="bg-ink/90" />
        </div>
      )}

      {/* list view */}
      {view === "list" && load.status === "ok" && <ListView events={results} onPick={(id) => select(id)} />}

      {/* bottom: Map/List toggle */}
      {!(sel && !desktop) && load.status === "ok" && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 rounded-full border-2 border-line bg-[#0D121B]/92 p-1 shadow-[0_8px_30px_rgba(0,0,0,.5)] backdrop-blur" role="group" aria-label={t("view")}>
          <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")} className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-extrabold uppercase", view === "map" && "bg-acid text-ink")}>
            <MapIcon className="size-4" aria-hidden /> {t("mapView")}
          </button>
          <button
            type="button"
            aria-pressed={view === "list"}
            onClick={() => {
              setView("list");
              setSelected(null);
            }}
            className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-extrabold uppercase", view === "list" && "bg-acid text-ink")}
          >
            <List className="size-4" aria-hidden /> {t("listView")}
          </button>
        </div>
      )}

      {/* selected */}
      {sel && view === "map" && (desktop ? <EventSidePanel e={sel} onClose={() => select(null)} /> : <EventBottomSheet e={sel} onClose={() => select(null)} expanded={expanded} setExpanded={setExpanded} onHeight={setSheetH} />)}

      <FilterSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} filters={filters} setFilters={setFilters} count={results.length} />
    </div>
  );
}

function MapBtn({ label, onClick, children, pressed }: { label: string; onClick: () => void; children: React.ReactNode; pressed?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} aria-pressed={pressed} className={cn("inline-flex size-11 items-center justify-center rounded-2xl border-2 border-line bg-[#0D121B]/90 text-cream shadow-[0_6px_20px_rgba(0,0,0,.45)] backdrop-blur hover:border-cream/50", pressed && "border-acid text-acid")}>
      {children}
    </button>
  );
}

function SearchBox({ events, value, onChange, onPick, onSubmit }: { events: WorldEvent[]; value: string; onChange: (q: string) => void; onPick: (s: Suggestion) => void; onSubmit: () => void }) {
  const t = useTranslations("world");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const items = useMemo(() => suggest(events, value), [events, value]);
  const show = open && items.length > 0;
  return (
    <form
      role="search"
      className="relative min-w-0 flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (show && active >= 0) onPick(items[active]);
        else onSubmit();
        setOpen(false);
        (document.activeElement as HTMLElement | null)?.blur();
      }}
    >
      <label className="flex h-12 items-center gap-2 rounded-full border-2 border-line bg-[#0D121B]/90 px-4 backdrop-blur focus-within:border-acid">
        <Search className="size-5 shrink-0 text-mute" aria-hidden />
        <span className="sr-only">{t("searchLabel")}</span>
        <input
          type="search"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(items.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(-1, a - 1));
            } else if (e.key === "Escape") setOpen(false);
          }}
          placeholder={t("searchPlaceholder")}
          className="wm-search min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-mute focus-visible:outline-none"
          role="combobox"
          aria-expanded={show}
          aria-controls="world-suggest"
          aria-activedescendant={active >= 0 ? `ws-${active}` : undefined}
          aria-autocomplete="list"
          enterKeyHint="search"
        />
        {value && (
          <button type="button" onClick={() => onChange("")} aria-label={tc("clear")} className="-mr-2 inline-flex size-9 items-center justify-center rounded-full text-mute hover:text-cream">
            <X className="size-4" />
          </button>
        )}
      </label>
      {show && (
        <ul id="world-suggest" role="listbox" aria-label={t("suggestions")} className="absolute inset-x-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-2xl border-2 border-line bg-[#0D121B] shadow-[0_16px_40px_rgba(0,0,0,.6)]">
          {items.map((s, i) => (
            <li
              key={`${s.kind}:${s.label}`}
              id={`ws-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(s);
                setOpen(false);
              }}
              className={cn("flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2", i === active ? "bg-surface-2" : "hover:bg-surface-2")}
            >
              <span className="text-mute">{SUGGEST_ICON[s.kind]}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold"><Tx>{s.label}</Tx></span>
                <span className="block truncate text-[12px] text-mute">
                  {t(`kinds.${s.kind}`)} · {s.sub}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

function ListView({ events, onPick }: { events: WorldEvent[]; onPick: (id: string) => void }) {
  const tu = useTranslations("world");
  const t = useTranslations("world");
  const locale = useLocale() as Locale;
  const sorted = [...events].sort((a, b) => (b.live ? 1 : 0) - (a.live ? 1 : 0) || Date.parse(a.startsAt) - Date.parse(b.startsAt));
  return (
    <div className="absolute inset-0 z-10 overflow-y-auto bg-[#070A12]/96 px-3 pb-28 pt-[150px] md:px-4" data-testid="world-list">
      <ul className="mx-auto max-w-3xl space-y-2">
        {sorted.map((e) => (
          <li key={e.id}>
            <button type="button" onClick={() => onPick(e.id)} className="flex w-full items-center gap-3 rounded-2xl border-2 border-line bg-[#0D121B] p-2.5 text-left hover:border-cream/40">
              <span className="size-16 shrink-0" aria-hidden dangerouslySetInnerHTML={{ __html: landmarkSvg({ type: e.landmark.type, level: e.level, status: e.status, palette: e.palette, fundingPct: e.goalUsd ? e.growth.fundingUsd / e.goalUsd : 0, animate: false, rank: e.ranking.badge ? (e.ranking.rank as 1 | 2 | 3) : null }) }} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <StatusPill status={e.status} />
                  <LevelPill e={e} />
                  {e.ranking.badge && <span className="rounded-full bg-[#E8C66A] px-2 py-0.5 text-[11px] font-extrabold text-ink">{tu("top")} {e.ranking.rank}</span>}
                </span>
                <span className="mt-1 block truncate font-display text-lg uppercase leading-tight">{e.name}</span>
                <span className="block truncate text-[12px] text-mute">
                  {e.city}, {e.country} · {formatEventDate(locale, e.startsAt, "UTC", { month: "short", day: "numeric", year: "numeric" })} · {e.genres.join(" / ")}
                </span>
              </span>
              <MapPin className="size-5 shrink-0 text-acid" aria-label={t("showOnMap")} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const STATUS_ORDER: MapStatus[] = ["planning", "funding", "confirmed", "live", "completed", "cancelled"];

function Legend({ onClose, desktop }: { onClose: () => void; desktop: boolean }) {
  const cfg = DEFAULT_GROWTH_CONFIG;
  const t = useTranslations("world");
  const ts = useTranslations("status");
  const tl = useTranslations("levels");
  const tp = useTranslations("party");
  return (
    <section aria-label={t("legend")} className={cn("absolute z-30 w-[300px] rounded-3xl border-2 border-line bg-[#0D121B]/96 p-4 shadow-[0_16px_40px_rgba(0,0,0,.6)] backdrop-blur", desktop ? "right-[72px] top-[132px]" : "right-16 top-[132px] max-w-[calc(100%-80px)]")}>
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-extrabold uppercase">{t("legendTitle")}</h2>
        <button type="button" onClick={onClose} aria-label={t("closeLegend")} className="inline-flex size-9 items-center justify-center rounded-full bg-surface-2">
          <X className="size-4" />
        </button>
      </div>
      <ul className="mt-2 space-y-1 text-[12px]">
        {STATUS_ORDER.map((s) => (
          <li key={s} className="flex items-center gap-2">
            <span className="grid size-5 place-items-center rounded-full text-[10px] font-black text-ink" style={{ background: STATUS_META[s].color }} aria-hidden>
              {STATUS_META[s].glyph}
            </span>
            <b className="uppercase">{s === "live" ? ts("demoLive") : ts(s)}</b> <span className="truncate text-mute">{ts(`hint.${s}`)}</span>
          </li>
        ))}
      </ul>
      <ul className="mt-3 space-y-1 text-[12px]">
        {cfg.levels.map((l) => (
          <li key={l.level} className="flex items-center gap-2">
            <span className="rounded-full px-1.5 text-[10px] font-black text-ink" style={{ background: LEVEL_COLORS[l.level] }}>
              LV.{l.level}
            </span>
            <b>{tl(String(l.level))}</b>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-mute">{t("legendNote")}</p>
      <Link href="/world/levels" className="mt-2 inline-flex min-h-10 items-center gap-1 text-[12px] font-bold text-acid">
        <Settings2 className="size-4" aria-hidden /> {t("levelRules")}
      </Link>
      <Link href="/world/universes" className="ml-3 mt-2 inline-flex min-h-10 items-center gap-1 text-[12px] font-bold text-acid" data-testid="link-universes">
        <Orbit className="size-4" aria-hidden /> {tp("universes")}
      </Link>
    </section>
  );
}

function FilterSheet({ open, onClose, filters, setFilters, count }: { open: boolean; onClose: () => void; filters: MapFilters; setFilters: (f: MapFilters | ((f: MapFilters) => MapFilters)) => void; count: number }) {
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const t = useTranslations("world");
  const tc = useTranslations("common");
  const tl = useTranslations("levels");
  const tp = useTranslations("party");
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t("filters")}
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={() => setFilters(EMPTY_MAP_FILTERS)} className="min-h-12 flex-1 rounded-full border-2 border-line font-extrabold uppercase">
            {tc("clear")}
          </button>
          <button type="button" onClick={onClose} className="min-h-12 flex-[2] rounded-full bg-acid font-extrabold uppercase text-ink">
            {t("showResults", { count })}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-[13px] font-extrabold uppercase">{t("statusFeatures")}</legend>
          <div className="flex flex-wrap gap-2">
            {FLAG_KEYS.map((k) => (
              <Chip key={k} active={filters.flags.includes(k)} onClick={() => setFilters((f) => ({ ...f, flags: toggle(f.flags, k) }))}>
                {t(`chips.${k}`)}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-[13px] font-extrabold uppercase">{tl("festivalLevel")}</legend>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_GROWTH_CONFIG.levels.map((l) => (
              <Chip key={l.level} active={filters.levels.includes(l.level)} onClick={() => setFilters((f) => ({ ...f, levels: toggle(f.levels, l.level as EventLevel) }))}>
                LV.{l.level} {tl(String(l.level))}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 inline-flex items-center gap-1 text-[13px] font-extrabold uppercase">
            <CalendarDays className="size-4" aria-hidden /> {t("date")}
          </legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(DATE_LABELS) as DateRange[]).map((d) => (
              <Chip key={d} active={filters.date === d} onClick={() => setFilters((f) => ({ ...f, date: d }))}>
                {t(`dates.${d}`)}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-[13px] font-extrabold uppercase">{t("genre")}</legend>
          <div className="flex flex-wrap gap-2">
            {GENRES.map((g: Genre) => (
              <Chip key={g} active={filters.genres.includes(g)} onClick={() => setFilters((f) => ({ ...f, genres: toggle(f.genres, g) }))}>
                {g}
              </Chip>
            ))}
          </div>
        </fieldset>
      </div>
    </BottomSheet>
  );
}
