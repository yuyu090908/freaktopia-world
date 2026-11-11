import type { UnifiedEvent } from "./types";

/**
 * Cross-source duplicates. Merged only when confident:
 *  same normalised title, same local start day, same city, and (same venue OR an artist in common).
 * Different days (multi-night runs, tours) are never merged. Weaker matches become "candidates" for an admin.
 */
const norm = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(the|presents|live|20\d\d)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const dayOf = (e: UnifiedEvent) => {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: e.venueTimezone ?? "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(e.startsAtUtc));
  } catch {
    return e.startsAtUtc.slice(0, 10);
  }
};

const artistNames = (e: UnifiedEvent) => new Set(e.lineup.map((a) => norm(a.name)).filter(Boolean));

export type MatchLevel = "same" | "candidate" | "different";

export function compare(a: UnifiedEvent, b: UnifiedEvent): MatchLevel {
  if (a.id === b.id) return "same";
  if (dayOf(a) !== dayOf(b)) return "different";
  if (norm(a.city) !== norm(b.city) || !norm(a.city)) return "different";
  const titleSame = norm(a.title) === norm(b.title) && !!norm(a.title);
  const venueSame = !!norm(a.venueName) && norm(a.venueName) === norm(b.venueName);
  const an = artistNames(a);
  const shared = [...artistNames(b)].some((n) => an.has(n));
  if (titleSame && (venueSame || shared)) return "same";
  if (titleSame || (venueSame && shared)) return "candidate";
  return "different";
}

/** Source trust when two listings disagree: partner (official organiser) > FREAKTOPIA > external API. */
const RANK: Record<UnifiedEvent["sourceType"], number> = { partner: 3, freaktopia: 2, external: 1 };

export function dedupe(events: UnifiedEvent[]): { events: UnifiedEvent[]; candidates: [string, string][] } {
  const byId = new Map<string, UnifiedEvent>();
  for (const e of events) byId.set(e.id, e); // same source id: the newest copy wins
  const list = [...byId.values()].map((e) => ({ ...e })).sort((a, b) => RANK[b.sourceType] - RANK[a.sourceType]);
  const kept: UnifiedEvent[] = [];
  const candidates: [string, string][] = [];
  for (const e of list) {
    const twin = kept.find((k) => compare(k, e) === "same");
    if (twin) {
      twin.mergedFrom = [...(twin.mergedFrom ?? []), e.id];
      // Fill only what the trusted listing lacks; never overwrite it.
      twin.ticketUrl ??= e.ticketUrl;
      twin.imageUrl ??= e.imageUrl;
      if (twin.locationPrecision !== "venue" && e.locationPrecision === "venue") Object.assign(twin, { latitude: e.latitude, longitude: e.longitude, locationPrecision: "venue" });
      continue;
    }
    for (const k of kept) if (compare(k, e) === "candidate") candidates.push([k.id, e.id]);
    kept.push(e);
  }
  return { events: kept, candidates };
}
