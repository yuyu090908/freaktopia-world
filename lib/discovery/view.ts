/**
 * Client-side view helpers for external events on EVENTS (pure, unit tested).
 * The same filters as FREAKTOPIA's own list: search words, city, genres, date (venue time zone) and kind.
 */
import { inDate, kindMatches, type EventFilters } from "@/lib/filters";
import type { UnifiedEvent } from "./types";

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filterUnified(events: UnifiedEvent[], f: Pick<EventFilters, "q" | "place" | "genres" | "date" | "kinds">, now: number, artistId?: string | null): UnifiedEvent[] {
  const words = norm(f.q.trim()).split(/\s+/).filter(Boolean);
  return events.filter((e) => {
    if (words.length) {
      const hay = norm([e.title, e.venueName, e.city, e.countryCode, ...e.genres, ...e.lineup.map((a) => a.name)].filter(Boolean).join(" "));
      if (!words.every((w) => hay.includes(w))) return false;
    }
    if (f.place && norm(e.city ?? "") !== norm(f.place)) return false;
    if (f.genres.length && !e.genres.some((g) => f.genres.some((x) => norm(x) === norm(g)))) return false;
    if (!kindMatches(f.kinds, e.category)) return false;
    if (artistId && !e.artistIds.includes(artistId)) return false;
    return inDate(e.startsAtUtc, e.endsAtUtc, f.date, now, e.venueTimezone);
  });
}

export interface ArtistMatch {
  /** Source-scoped id: two artists with the same name stay two entries. */
  id: string;
  name: string;
  source: string;
  genre: string | null;
  upcoming: number;
  cities: string[];
}

/** Artists whose name matches the search, grouped by their source id (never merged by name). */
export function artistsMatching(events: UnifiedEvent[], q: string): ArtistMatch[] {
  const n = norm(q.trim());
  if (n.length < 2) return [];
  const by = new Map<string, ArtistMatch>();
  for (const e of events)
    for (const a of e.lineup) {
      if (!norm(a.name).includes(n)) continue;
      const x = by.get(a.id) ?? { id: a.id, name: a.name, source: e.sourceName, genre: a.genre, upcoming: 0, cities: [] };
      x.upcoming++;
      if (e.city && !x.cities.includes(e.city)) x.cities.push(e.city);
      by.set(a.id, x);
    }
  return [...by.values()].sort((a, b) => b.upcoming - a.upcoming || a.name.localeCompare(b.name)).slice(0, 12);
}
