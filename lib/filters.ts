import { appNow } from "./clock";
import type { EventLevel, FreakEvent, Genre } from "./types";
import { levelFor } from "./levels";
import { fromPrice } from "./event-status";

export type DateRange = "any" | "30d" | "90d" | "2027";

export type StatusFilter = "live" | "confirmed" | "funding";
export type PriceFilter = "any" | "free" | "u30" | "u60";

export interface EventFilters {
  q: string;
  /** City name ("" = anywhere). */
  place: string;
  genres: Genre[];
  /** Event size (festival level). */
  levels: EventLevel[];
  date: DateRange;
  /** Several statuses = any of them (OR). Different filter groups combine with AND. */
  statuses: StatusFilter[];
  /** Lowest price of a ticket on sale. Events without tickets on sale never match a price filter. */
  price: PriceFilter;
  djWanted: boolean;
  afterParty: boolean;
}

export const EMPTY_FILTERS: EventFilters = {
  q: "",
  place: "",
  genres: [],
  levels: [],
  date: "any",
  statuses: [],
  price: "any",
  djWanted: false,
  afterParty: false,
};

/** "Today" for date filters: the app clock (real time unless pinned for tests, see lib/clock). */
export const DEMO_NOW = new Date(appNow());

type Stats = (e: FreakEvent) => { supporters: number; raised: number };

const inDate = (startsAt: string, endsAt: string, d: DateRange, now = DEMO_NOW.getTime()) => {
  const t = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (d === "30d") return t <= now + 30 * 864e5 && end >= now;
  if (d === "90d") return t <= now + 90 * 864e5 && end >= now;
  if (d === "2027") return startsAt.startsWith("2027");
  return true;
};

const PRICE_MAX: Record<PriceFilter, number> = { any: Infinity, free: 0, u30: 30, u60: 60 };

/** Sample events. Within a group (genres, statuses, sizes) any match counts; groups combine with AND. */
export function filterEvents(events: FreakEvent[], f: EventFilters, stats?: Stats) {
  const q = f.q.trim().toLowerCase();
  return events.filter((e) => {
    if (q && ![e.name, e.city, e.country, ...e.genres].join(" ").toLowerCase().includes(q)) return false;
    if (f.place && e.city !== f.place) return false;
    if (f.genres.length && !e.genres.some((g) => f.genres.includes(g))) return false;
    if (f.levels.length) {
      const s = stats ? stats(e) : e;
      if (!f.levels.includes(levelFor(s.supporters, s.raised))) return false;
    }
    if (!inDate(e.startsAt, e.endsAt, f.date)) return false;
    if (f.statuses.length && !f.statuses.includes(e.status as StatusFilter)) return false;
    if (f.price !== "any") {
      const p = fromPrice(e);
      if (p == null || p > PRICE_MAX[f.price]) return false;
    }
    if (f.djWanted && !e.djRecruiting) return false;
    if (f.afterParty && !e.afterPartyId) return false;
    return true;
  });
}

/** A published community party, as the events list and the world map see it. */
export interface CommunityListing { id: string; name: string; city: string; startAt: string; endAt: string; genres: string[] }

/**
 * Community parties with the same filters. They have no sample level, price, DJ call or after-party data,
 * so any of those filters leaves them out instead of guessing. Their status is "confirmed" (published).
 */
export function filterCommunity<T extends CommunityListing>(parties: T[], f: EventFilters): T[] {
  if (f.levels.length || f.price !== "any" || f.djWanted || f.afterParty) return [];
  if (f.statuses.length && !f.statuses.includes("confirmed")) return [];
  const q = f.q.trim().toLowerCase();
  return parties.filter((p) => {
    if (q && ![p.name, p.city, ...p.genres].join(" ").toLowerCase().includes(q)) return false;
    if (f.place && p.city !== f.place) return false;
    if (f.genres.length && !p.genres.some((g) => (f.genres as string[]).includes(g))) return false;
    return inDate(p.startAt, p.endAt, f.date);
  });
}

export const activeFilterCount = (f: EventFilters) =>
  (f.place ? 1 : 0) + f.genres.length + f.levels.length + (f.date !== "any" ? 1 : 0) + f.statuses.length + (f.price !== "any" ? 1 : 0) + [f.djWanted, f.afterParty].filter(Boolean).length;
