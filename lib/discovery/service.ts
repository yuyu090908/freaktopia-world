/**
 * Discovery engine: sync (fetch → validate → normalise → classify → locate → change-detect → store) and
 * the public read path for WORLD and EVENTS. Storage is the existing ops store (PostgreSQL when DATABASE_URL
 * is set, otherwise in memory); see db/migrations/0011_global_discovery.sql.
 *
 * Nothing external is served unless its source is connected AND approved right now. When no source is
 * connected the public list is simply empty; FREAKTOPIA's own events are unaffected.
 */
import { randomUUID } from "node:crypto";
import { appNow } from "@/lib/clock";
import { getOpsStore } from "@/lib/ops/store";
import { bandsintown } from "./adapters/bandsintown";
import { internalEvents } from "./adapters/internal";
import { ticketmaster } from "./adapters/ticketmaster";
import { redact, type Fetcher, type SourceAdapter } from "./adapters/types";
import { compare, dedupe } from "./dedupe";
import { inWhen, type WhenFilter } from "./time";
import { artistsMatching } from "./view";
import type { ChangeRecord, EventCategory, SourceStatus, UnifiedEvent } from "./types";

export const ADAPTERS: SourceAdapter[] = [ticketmaster, bandsintown];
const adapterOf = (id: string) => ADAPTERS.find((a) => a.id === id) ?? null;

const DEFAULT_INTERVALS = { within48h: 2, within30d: 8, later: 24 };
/** How far ahead a sync looks. */
const HORIZON_DAYS = 180;

interface SourceRecord {
  id: string;
  paused: boolean;
  intervals: typeof DEFAULT_INTERVALS;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  errorCount: number;
  invalidCount: number;
}

const store = () => getOpsStore();

async function sourceRecord(id: string): Promise<SourceRecord> {
  return (await store().get<SourceRecord>("discovery_sources", id)) ?? { id, paused: false, intervals: { ...DEFAULT_INTERVALS }, lastSyncAt: null, lastSuccessAt: null, lastError: null, errorCount: 0, invalidCount: 0 };
}
const saveSource = (r: SourceRecord) => store().put("discovery_sources", r);

const cached = async (sourceName?: string) => {
  const all = await store().list<UnifiedEvent>("discovery_events", sourceName ? { sourceName } : undefined);
  return all;
};

export async function sourceStatuses(): Promise<SourceStatus[]> {
  const events = await cached();
  return Promise.all(
    ADAPTERS.map(async (a) => {
      const r = await sourceRecord(a.id);
      const st = a.state();
      return {
        id: a.id,
        name: a.name,
        sourceType: a.sourceType,
        state: st !== "connected" ? st : r.paused ? "paused" : r.lastError && r.errorCount > 0 ? "error" : "connected",
        needs: a.needs,
        termsUrl: a.termsUrl,
        regions: a.regions(),
        paused: r.paused,
        lastSyncAt: r.lastSyncAt,
        lastSuccessAt: r.lastSuccessAt,
        lastError: r.lastError,
        errorCount: r.errorCount,
        eventCount: events.filter((e) => e.sourceName === a.name).length,
        intervals: r.intervals,
      } satisfies SourceStatus;
    }),
  );
}

/* ------------------------------------------------------------------ sync */

const changedFields = (a: UnifiedEvent, b: UnifiedEvent): ChangeRecord["fields"] => {
  const f: ChangeRecord["fields"] = [];
  if (a.startsAtUtc !== b.startsAtUtc || a.endsAtUtc !== b.endsAtUtc) f.push("date");
  if (a.venueName !== b.venueName || a.latitude !== b.latitude || a.longitude !== b.longitude) f.push("venue");
  if (a.artistIds.join() !== b.artistIds.join()) f.push("lineup");
  if (a.externalStatus !== b.externalStatus) f.push("status");
  if (a.ticketUrl !== b.ticketUrl || JSON.stringify(a.priceRange) !== JSON.stringify(b.priceRange)) f.push("tickets");
  return f;
};

export interface SyncResult {
  source: string;
  skipped?: "not_configured" | "unapproved" | "paused";
  fetched: number;
  stored: number;
  invalid: number;
  removed: number;
  changes: number;
  error?: string;
}

export async function syncSource(id: string, fetcher: Fetcher = fetch, now = appNow()): Promise<SyncResult> {
  const a = adapterOf(id);
  if (!a) throw new Error("UNKNOWN_SOURCE");
  const r = await sourceRecord(id);
  const st = a.state();
  if (st !== "connected") return { source: id, skipped: st, fetched: 0, stored: 0, invalid: 0, removed: 0, changes: 0 };
  if (r.paused) return { source: id, skipped: "paused", fetched: 0, stored: 0, invalid: 0, removed: 0, changes: 0 };
  const at = new Date(now).toISOString();
  r.lastSyncAt = at;
  try {
    const raw = await a.fetchEvents({ from: at, to: new Date(now + HORIZON_DAYS * 864e5).toISOString() }, fetcher);
    const normalized = raw.map((x) => a.normalize(x, at));
    const valid = normalized.filter((e): e is UnifiedEvent => !!e);
    const { events } = dedupe(valid); // same source listed twice
    const before = new Map((await cached(a.name)).map((e) => [e.id, e]));
    let changes = 0;
    for (const e of events) {
      const old = before.get(e.id);
      if (old) {
        e.hidden = old.hidden; // admin moderation survives a refresh
        const fields = changedFields(old, e);
        if (fields.length) {
          changes++;
          const pick = (x: UnifiedEvent) => ({ startsAtUtc: x.startsAtUtc, venueName: x.venueName, artistIds: x.artistIds, externalStatus: x.externalStatus, ticketUrl: x.ticketUrl });
          await store().insert<ChangeRecord>("discovery_changes", { id: randomUUID(), eventId: e.id, at, fields, before: pick(old), after: pick(e) });
        }
      }
      await store().put("discovery_events", e);
      before.delete(e.id);
    }
    // Listings the source no longer returns inside the window are removed (the source is the authority).
    for (const gone of before.values()) await store().remove("discovery_events", gone.id);
    Object.assign(r, { lastSuccessAt: at, lastError: null, errorCount: 0, invalidCount: normalized.length - valid.length });
    await saveSource(r);
    return { source: id, fetched: raw.length, stored: events.length, invalid: normalized.length - valid.length, removed: before.size, changes };
  } catch (e) {
    r.lastError = redact((e as Error).message ?? "error").slice(0, 300);
    r.errorCount += 1;
    await saveSource(r);
    return { source: id, fetched: 0, stored: 0, invalid: 0, removed: 0, changes: 0, error: r.lastError };
  }
}

/** Is a source due for a refresh? Events in the next 48 hours refresh most often. */
export function isStale(r: Pick<SourceRecord, "lastSuccessAt" | "intervals">, events: UnifiedEvent[], now: number) {
  if (!r.lastSuccessAt) return true;
  const age = (now - Date.parse(r.lastSuccessAt)) / 36e5;
  const soonest = Math.min(...events.map((e) => Date.parse(e.startsAtUtc)), Infinity);
  const h = soonest - now <= 48 * 36e5 ? r.intervals.within48h : soonest - now <= 30 * 864e5 ? r.intervals.within30d : r.intervals.later;
  return age >= h;
}

let refreshing: Promise<unknown> | null = null;
/** Refresh stale, connected sources. Readers don't wait for it: they get the cache and the next request sees fresh data. */
export function refreshInBackground(now = appNow()) {
  if (refreshing) return;
  refreshing = (async () => {
    for (const a of ADAPTERS) {
      if (a.state() !== "connected") continue;
      const r = await sourceRecord(a.id);
      if (r.paused || !isStale(r, await cached(a.name), now)) continue;
      await syncSource(a.id, fetch, now);
    }
  })()
    .catch((e) => console.error("[discovery] refresh", redact(String(e))))
    .finally(() => {
      refreshing = null;
    });
}

/* ------------------------------------------------------------------ read */

export interface DiscoveryQuery {
  q?: string;
  city?: string;
  /** Source-scoped artist id, e.g. "ticketmaster:K8vZ…". */
  artist?: string;
  when?: WhenFilter;
  category?: EventCategory;
  genre?: string;
  limit?: number;
}

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function matches(e: UnifiedEvent, q: DiscoveryQuery, now: number) {
  if (q.q) {
    const hay = norm([e.title, e.venueName, e.city, e.countryCode, ...e.genres, ...e.lineup.map((a) => a.name)].filter(Boolean).join(" "));
    if (!norm(q.q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) return false;
  }
  if (q.city && norm(e.city ?? "") !== norm(q.city)) return false;
  if (q.artist && !e.artistIds.includes(q.artist)) return false;
  if (q.category && e.category !== q.category) return false;
  if (q.genre && !e.genres.some((g) => norm(g) === norm(q.genre!))) return false;
  return inWhen(e.startsAtUtc, e.endsAtUtc, e.venueTimezone, q.when ?? "any", now);
}

/** Events anyone may see: connected + approved source, not hidden, not cancelled, not over, not a duplicate of a FREAKTOPIA event. */
export async function publicEvents(q: DiscoveryQuery = {}, now = appNow()): Promise<{ events: UnifiedEvent[]; sources: Pick<SourceStatus, "id" | "name" | "state" | "lastSuccessAt">[] }> {
  const statuses = await sourceStatuses();
  const live = new Set(statuses.filter((s) => s.state === "connected" || s.state === "error").map((s) => s.name));
  const internal = internalEvents(new Date(now).toISOString());
  const list = (await cached())
    .filter((e) => live.has(e.sourceName) && !e.hidden && e.externalStatus !== "cancelled")
    .filter((e) => Date.parse(e.endsAtUtc ?? e.startsAtUtc) + (e.endsAtUtc ? 0 : 12 * 36e5) >= now)
    .filter((e) => !internal.some((i) => compare(i, e) === "same"))
    .filter((e) => matches(e, q, now))
    .sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc))
    .slice(0, Math.min(q.limit ?? 500, 1000));
  if (live.size) refreshInBackground(now);
  return { events: list, sources: statuses.map(({ id, name, state, lastSuccessAt }) => ({ id, name, state, lastSuccessAt })) };
}

/** Artists matching a name, kept apart by their source id (two "DJ X" stay two). */
export async function findArtists(name: string, now = appNow()) {
  if (norm(name.trim()).length < 2) return [];
  const { events } = await publicEvents({}, now);
  return artistsMatching(events, name);
}

/* ------------------------------------------------------------------ admin */

export async function quality(now = appNow()) {
  const all = await cached();
  const internal = internalEvents(new Date(now).toISOString());
  const { candidates } = dedupe([...internal, ...all]);
  const brief = (e: UnifiedEvent) => ({ id: e.id, title: e.title, city: e.city, startsAtUtc: e.startsAtUtc, source: e.sourceName, hidden: !!e.hidden });
  const changes = (await store().list<ChangeRecord>("discovery_changes")).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 50);
  const byId = new Map([...internal, ...all].map((e) => [e.id, e]));
  return {
    duplicates: candidates.map(([a, b]) => ({ a: brief(byId.get(a)!), b: brief(byId.get(b)!) })),
    timeTbd: all.filter((e) => e.timeTbd).map(brief),
    noVenue: all.filter((e) => !e.venueName).map(brief),
    noLocation: all.filter((e) => e.latitude == null).map(brief),
    approximateLocation: all.filter((e) => e.locationPrecision === "city").map(brief),
    cancelled: all.filter((e) => e.externalStatus === "cancelled" || e.externalStatus === "postponed").map(brief),
    hidden: all.filter((e) => e.hidden).map(brief),
    changes,
  };
}

export async function setPaused(id: string, paused: boolean) {
  if (!adapterOf(id)) throw new Error("UNKNOWN_SOURCE");
  const r = await sourceRecord(id);
  r.paused = paused;
  await saveSource(r);
}

export async function setIntervals(id: string, intervals: SourceRecord["intervals"]) {
  if (!adapterOf(id)) throw new Error("UNKNOWN_SOURCE");
  const r = await sourceRecord(id);
  r.intervals = intervals;
  await saveSource(r);
}

export async function setHidden(eventId: string, hidden: boolean) {
  const e = await store().get<UnifiedEvent>("discovery_events", eventId);
  if (!e) throw new Error("NOT_FOUND");
  e.hidden = hidden;
  await store().put("discovery_events", e);
}

/** Data-removal request from a source: drop everything cached from it and pause it. */
export async function purgeSource(id: string) {
  const a = adapterOf(id);
  if (!a) throw new Error("UNKNOWN_SOURCE");
  const list = await cached(a.name);
  for (const e of list) await store().remove("discovery_events", e.id);
  await setPaused(id, true);
  return list.length;
}
