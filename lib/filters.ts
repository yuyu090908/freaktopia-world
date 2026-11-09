import type { EventLevel, FreakEvent, Genre } from "./types";
import { levelFor } from "./levels";

export type DateRange = "any" | "30d" | "90d" | "2027";

export interface EventFilters {
  q: string;
  genres: Genre[];
  levels: EventLevel[];
  date: DateRange;
  confirmed: boolean;
  djWanted: boolean;
  liveNow: boolean;
  afterParty: boolean;
}

export const EMPTY_FILTERS: EventFilters = {
  q: "",
  genres: [],
  levels: [],
  date: "any",
  confirmed: false,
  djWanted: false,
  liveNow: false,
  afterParty: false,
};

/** Demo "today" so the sample data stays meaningful. */
export const DEMO_NOW = new Date("2026-11-09T12:00:00Z");

export const DATE_LABELS: Record<DateRange, string> = {
  any: "Any date",
  "30d": "Next 30 days",
  "90d": "Next 3 months",
  "2027": "2027",
};

type Stats = (e: FreakEvent) => { supporters: number; raised: number };

export function filterEvents(events: FreakEvent[], f: EventFilters, stats?: Stats) {
  const q = f.q.trim().toLowerCase();
  return events.filter((e) => {
    if (q && ![e.name, e.city, e.country, ...e.genres].join(" ").toLowerCase().includes(q)) return false;
    if (f.genres.length && !e.genres.some((g) => f.genres.includes(g))) return false;
    if (f.levels.length) {
      const s = stats ? stats(e) : e;
      if (!f.levels.includes(levelFor(s.supporters, s.raised))) return false;
    }
    const t = new Date(e.startsAt).getTime();
    const now = DEMO_NOW.getTime();
    if (f.date === "30d" && (t > now + 30 * 864e5 || new Date(e.endsAt).getTime() < now)) return false;
    if (f.date === "90d" && (t > now + 90 * 864e5 || new Date(e.endsAt).getTime() < now)) return false;
    if (f.date === "2027" && !e.startsAt.startsWith("2027")) return false;
    if (f.confirmed && !(e.status === "confirmed" || e.status === "live")) return false;
    if (f.djWanted && !e.djRecruiting) return false;
    if (f.liveNow && e.status !== "live") return false;
    if (f.afterParty && !e.afterPartyId) return false;
    return true;
  });
}

export const activeFilterCount = (f: EventFilters) =>
  f.genres.length + f.levels.length + (f.date !== "any" ? 1 : 0) + [f.confirmed, f.djWanted, f.liveNow, f.afterParty].filter(Boolean).length;
