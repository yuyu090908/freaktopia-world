/**
 * Genre master for DJ ARENA 2.0 (DJ profiles, tracks, search). One list, used everywhere music is tagged.
 * EVENTS keeps its own sample-event genres (lib/types Genre); the names they share are spelled the same so a
 * filter on one matches the other (see EVENT_GENRE_MATCH).
 */
export const DJ_GENRES = [
  "Tech House", "House", "Deep House", "Bass House", "Afro House", "Melodic House", "Melodic Techno", "Techno",
  "Hard Techno", "Trance", "Drum & Bass", "EDM", "Dance Pop", "Hip-Hop", "R&B", "Other",
] as const;
export type DjGenre = (typeof DJ_GENRES)[number];

export const isDjGenre = (g: string): g is DjGenre => (DJ_GENRES as readonly string[]).includes(g);

/** EVENTS genre → DJ genres that count as a match (for "genre fit" and filters carried between pages). */
export const EVENT_GENRE_MATCH: Record<string, DjGenre[]> = {
  Techno: ["Techno", "Hard Techno", "Melodic Techno"],
  House: ["House", "Deep House", "Tech House", "Bass House", "Melodic House", "Afro House"],
  "Drum & Bass": ["Drum & Bass"],
  "Hip-Hop": ["Hip-Hop", "R&B"],
  "Afro House": ["Afro House"],
  Psytrance: ["Trance"],
  Hardcore: ["Hard Techno"],
  Disco: ["House", "Dance Pop"],
  Garage: ["House", "Bass House"],
};

/** Genre fit between an event's genres and a DJ's genres: share of event genres the DJ covers (0–1). */
export function genreFit(eventGenres: string[], djGenres: string[]) {
  if (!eventGenres.length) return 0;
  const hit = eventGenres.filter((g) => djGenres.includes(g) || (EVENT_GENRE_MATCH[g] ?? []).some((x) => djGenres.includes(x))).length;
  return hit / eventGenres.length;
}

export const MUSICAL_KEYS = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
  "Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "A#m", "Bm",
] as const;
