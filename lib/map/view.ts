/**
 * Client view model for the world map: search, filters, URL state. Pure functions (unit tested).
 */
import type { EventLevel, Genre } from "@/lib/types";
import { DEMO_NOW, type DateRange } from "@/lib/filters";
import { computeFestivalLevel, type GrowthConfig, type GrowthResult } from "./growth";
import { STATUS_META } from "./landmarks";
import type { MapEventDto } from "./types";
import { isRegionKey, regionOfCountry, type RegionKey } from "./regions";

export interface WorldEvent extends MapEventDto {
  growthResult: GrowthResult;
}

export const FLAG_KEYS = ["live", "upcoming", "confirmed", "funding", "djWanted", "dao", "afterParty", "completed"] as const;
export type FlagKey = (typeof FLAG_KEYS)[number];
/** Shown as chips above the map; the rest live in the filter sheet ("all conditions"). */
export const QUICK_FLAGS: FlagKey[] = ["live", "upcoming", "djWanted", "funding"];
/** Status flags: several = any of them (OR). Feature flags (DJ wanted, DAO, after party) must all match (AND). */
export const STATUS_FLAGS: FlagKey[] = ["live", "upcoming", "confirmed", "funding", "completed"];

export const FLAG_LABEL: Record<FlagKey, string> = {
  live: "Live now",
  upcoming: "Upcoming",
  confirmed: "Confirmed",
  funding: "Funding",
  djWanted: "DJ wanted",
  dao: "DAO active",
  afterParty: "After party",
  completed: "Completed",
};

export interface MapFilters {
  q: string;
  flags: FlagKey[];
  levels: EventLevel[];
  genres: Genre[];
  date: DateRange;
  /** Region focus (display region of the event's country). */
  region?: Exclude<RegionKey, "an"> | null;
}

export const EMPTY_MAP_FILTERS: MapFilters = { q: "", flags: [], levels: [], genres: [], date: "any", region: null };

export function toWorldEvents(events: MapEventDto[], cfg: GrowthConfig, local?: (id: string) => { supporters: number; fundingUsd: number } | undefined): WorldEvent[] {
  return events.map((e) => {
    const extra = local?.(e.id);
    const growth = extra ? { ...e.growth, supporters: extra.supporters, fundingUsd: extra.fundingUsd } : e.growth;
    const growthResult = computeFestivalLevel(growth, cfg);
    return { ...e, growth, growthResult, level: growthResult.level };
  });
}

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function searchText(e: MapEventDto) {
  return norm([e.name, e.city, e.country, e.venue ?? "", ...e.genres, ...e.lineup.map((d) => d.name)].join(" "));
}

export function matchFlag(e: MapEventDto, k: FlagKey, now = DEMO_NOW.getTime()) {
  switch (k) {
    case "live":
      return !!e.live;
    case "upcoming":
      return (e.status === "planning" || e.status === "funding" || e.status === "confirmed") && Date.parse(e.startsAt) > now;
    case "confirmed":
      return e.status === "confirmed" || e.status === "live";
    case "funding":
      return e.status === "funding" || e.status === "planning";
    case "djWanted":
      return e.djRecruiting;
    case "dao":
      return !!e.dao;
    case "afterParty":
      return !!e.afterParty;
    case "completed":
      return e.status === "completed";
  }
}

/** Status flags combine with OR, everything else with AND. Completed events only show with the Completed filter (or a search). */
export function filterWorld<T extends MapEventDto>(events: T[], f: MapFilters, now = DEMO_NOW.getTime()): T[] {
  const q = norm(f.q);
  return events.filter((e) => {
    if (q && !searchText(e).includes(q)) return false;
    if (e.status === "completed" && !f.flags.includes("completed") && !q) return false;
    const st = f.flags.filter((k) => STATUS_FLAGS.includes(k));
    if (st.length && !st.some((k) => matchFlag(e, k, now))) return false;
    for (const k of f.flags) if (!STATUS_FLAGS.includes(k) && !matchFlag(e, k, now)) return false;
    if (f.levels.length && !f.levels.includes(e.level)) return false;
    if (f.genres.length && !e.genres.some((g) => f.genres.includes(g))) return false;
    if (f.region && regionOfCountry(e.country) !== f.region) return false;
    const t = Date.parse(e.startsAt);
    const end = Date.parse(e.endsAt);
    if (f.date === "30d" && (t > now + 30 * 864e5 || end < now)) return false;
    if (f.date === "90d" && (t > now + 90 * 864e5 || end < now)) return false;
    if (f.date === "2027" && !e.startsAt.startsWith("2027")) return false;
    return true;
  });
}

export const filterCount = (f: MapFilters) => f.flags.length + f.levels.length + f.genres.length + (f.date !== "any" ? 1 : 0) + (f.region ? 1 : 0);

export type SuggestionKind = "event" | "city" | "country" | "dj" | "venue" | "genre" | "region";
export interface Suggestion {
  kind: SuggestionKind;
  label: string;
  sub: string;
  eventIds: string[];
}

/** Grouped suggestions for the search box (max 8). */
export function suggest(events: MapEventDto[], query: string): Suggestion[] {
  const q = norm(query);
  if (!q) return [];
  const out: Suggestion[] = [];
  const add = (kind: SuggestionKind, label: string, ids: string[], sub: string) => {
    const ex = out.find((s) => s.kind === kind && s.label === label);
    if (ex) {
      for (const id of ids) if (!ex.eventIds.includes(id)) ex.eventIds.push(id);
      ex.sub = kind === "event" ? ex.sub : `${ex.eventIds.length} event${ex.eventIds.length === 1 ? "" : "s"}`;
    } else out.push({ kind, label, eventIds: [...ids], sub });
  };
  const n = (c: number) => `${c} event${c === 1 ? "" : "s"}`;
  for (const e of events) {
    if (norm(e.name).includes(q)) add("event", e.name, [e.id], `${e.city}, ${e.country}`);
    if (norm(e.city).includes(q)) add("city", e.city, [e.id], n(1));
    if (norm(e.country).includes(q)) add("country", e.country, [e.id], n(1));
    if (e.venue && norm(e.venue).includes(q)) add("venue", e.venue, [e.id], `${e.city}`);
    for (const d of e.lineup) if (norm(d.name).includes(q)) add("dj", d.name, [e.id], n(1));
    for (const g of e.genres) if (norm(g).includes(q)) add("genre", g, [e.id], n(1));
  }
  const order: SuggestionKind[] = ["event", "city", "country", "venue", "dj", "genre"];
  const starts = (s: Suggestion) => (norm(s.label).startsWith(q) ? 0 : 1);
  return out.sort((a, b) => starts(a) - starts(b) || order.indexOf(a.kind) - order.indexOf(b.kind)).slice(0, 8);
}

/** Region suggestions for the search box: matches the localized and the English region name. `label` is the region key. */
export function suggestRegions(events: MapEventDto[], query: string, names: Record<string, string[]>): (Suggestion & { region: Exclude<RegionKey, "an"> })[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const out: (Suggestion & { region: Exclude<RegionKey, "an"> })[] = [];
  for (const [k, list] of Object.entries(names)) {
    if (!isRegionKey(k) || !list.some((n) => norm(n).includes(q))) continue;
    const ids = events.filter((e) => regionOfCountry(e.country) === k).map((e) => e.id);
    out.push({ kind: "region", label: list[0], sub: String(ids.length), eventIds: ids, region: k });
  }
  return out;
}

/* ---------- URL state ---------- */

const GENRE_SET = new Set<string>(["Techno", "House", "Drum & Bass", "Psytrance", "Hip-Hop", "Amapiano", "Disco", "Ambient", "Hardcore", "Afro House", "Garage", "Footwork"]);

export interface WorldUrlState {
  filters: MapFilters;
  view: "map" | "list";
  event: string | null;
  /** City preview open on the globe ("City|Country"). */
  city?: string | null;
}

export function readWorldUrl(p: URLSearchParams): WorldUrlState {
  const flags = (p.get("f") ?? "").split(",").filter((x): x is FlagKey => (FLAG_KEYS as readonly string[]).includes(x));
  const levels = (p.get("lv") ?? "").split(",").map(Number).filter((x): x is EventLevel => x >= 1 && x <= 5 && Number.isInteger(x));
  const genres = p.getAll("g").filter((g): g is Genre => GENRE_SET.has(g));
  const d = p.get("date");
  const date: DateRange = d === "30d" || d === "90d" || d === "2027" ? d : "any";
  return {
    filters: { q: (p.get("q") ?? "").slice(0, 80), flags: [...new Set(flags)], levels: [...new Set(levels)], genres: [...new Set(genres)], date, region: isRegionKey(p.get("rg")) ? (p.get("rg") as Exclude<RegionKey, "an">) : null },
    view: p.get("view") === "list" ? "list" : "map",
    event: p.get("event")?.slice(0, 80) || null,
    city: p.get("city")?.slice(0, 120) || null,
  };
}

export function writeWorldUrl(s: WorldUrlState): string {
  const p = new URLSearchParams();
  if (s.filters.q) p.set("q", s.filters.q);
  if (s.filters.flags.length) p.set("f", s.filters.flags.join(","));
  if (s.filters.levels.length) p.set("lv", [...s.filters.levels].sort().join(","));
  for (const g of s.filters.genres) p.append("g", g);
  if (s.filters.date !== "any") p.set("date", s.filters.date);
  if (s.filters.region) p.set("rg", s.filters.region);
  if (s.view === "list") p.set("view", "list");
  if (s.event) p.set("event", s.event);
  else if (s.city) p.set("city", s.city);
  const str = p.toString();
  return str ? `?${str}` : "";
}

/** Accessible name for a landmark: name and city first, then level and status in words. */
type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * Screen-reader label for a festival marker. With `t` (next-intl, world namespace) and `tx` (fixed labels, see
 * lib/i18n/labels.ts) it is written in the visitor's language; without them (server code, tests) in English.
 */
export function ariaFor(e: WorldEvent, t?: Translate, tx?: (english: string) => string) {
  const s = STATUS_META[e.status];
  if (t && tx) {
    return [
      t("markerAria", { name: e.name, city: e.city, level: e.level, levelName: tx(e.growthResult.name), status: tx(s.label) }),
      e.ranking.badge ? t("markerAriaRank", { rank: e.ranking.rank ?? 0 }) : "",
      e.dao ? t("markerAriaDao") : "",
      e.location.precision === "city" ? t("markerAriaApprox") : "",
    ].join("");
  }
  const rank = e.ranking.badge ? `, rank ${e.ranking.rank} (popular, all time)` : "";
  return `${e.name}, ${e.city} · Level ${e.level} ${e.growthResult.name}, ${s.label}${rank}${e.dao ? ", DAO active" : ""}${e.location.precision === "city" ? ", approximate city location" : ""}`;
}

