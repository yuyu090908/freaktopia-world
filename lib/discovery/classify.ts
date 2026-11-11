import type { EventCategory } from "./types";

/**
 * Rule-based and conservative. A category is only given when the source data says so:
 *  - major_festival: the source itself classifies the event as a festival (never inferred from popularity or name alone)
 *  - dj_show: dance/electronic music with at least one named artist
 *  - club_event: the source names the venue type as a club/nightclub
 *  - otherwise general_music
 */
export interface ClassifyInput {
  /** Explicit festival flag from the source (e.g. Ticketmaster classification "Festival"). */
  sourceSaysFestival: boolean;
  /** Genre / segment names from the source. */
  sourceGenres: string[];
  artistCount: number;
  /** Venue type from the source, if it gives one. */
  venueType?: string | null;
}

const ELECTRONIC = /dance|electronic|edm|house|techno|trance|drum\s*(&|and)\s*bass|dubstep|garage/i;

export function classify(i: ClassifyInput): EventCategory {
  if (i.sourceSaysFestival) return "major_festival";
  if (i.venueType && /night\s*club|club/i.test(i.venueType)) return "club_event";
  if (i.artistCount > 0 && i.sourceGenres.some((g) => ELECTRONIC.test(g))) return "dj_show";
  return "general_music";
}

/** Map source genre names onto FREAKTOPIA's genre names (only exact, known matches; nothing is guessed). */
const GENRE_MAP: [RegExp, string][] = [
  [/tech\s*house/i, "Tech House"],
  [/afro\s*house/i, "Afro House"],
  [/melodic\s*techno/i, "Melodic Techno"],
  [/bass\s*house/i, "Bass House"],
  [/drum\s*(&|and|n)\s*bass|dnb/i, "Drum & Bass"],
  [/trance/i, "Trance"],
  [/techno/i, "Techno"],
  [/\bhouse\b/i, "House"],
  [/dance|electronic|edm/i, "Electronic"],
];

export function normalizeGenres(names: string[]): string[] {
  const out = new Set<string>();
  for (const n of names) {
    const hit = GENRE_MAP.find(([re]) => re.test(n));
    if (hit) out.add(hit[1]);
  }
  return [...out];
}
