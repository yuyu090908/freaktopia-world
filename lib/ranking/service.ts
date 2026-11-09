/**
 * Ranking service: loads data from the configured source, computes metrics
 * with the engine, caches results and assembles API responses.
 * Server-only.
 */
import { levelFor } from "@/lib/levels";
import type { EventLevel } from "@/lib/types";
import { allDaoSummaries } from "@/lib/dao/api";
import { RANKING_CONFIG } from "./config";
import { computeMetrics, rank } from "./engine";
import { getSource, type RankingSource } from "./source";
import type { EventMetrics, RankableEvent, RankedEntry, RankingCategory, RankingPeriod, RankingQuery, RankingResult } from "./types";

const DAY = 86400000;
const TTL = RANKING_CONFIG.refreshSeconds * 1000;
const memo = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await fn();
  memo.set(key, { at: Date.now(), value });
  if (memo.size > 500) memo.delete(memo.keys().next().value as string);
  return value;
}

/** Metrics for every event at `asOf` for a period (one snapshot). */
async function snapshot(src: RankingSource, period: RankingPeriod, asOf: number) {
  return cached(`${src.mode}:snap:${period}:${asOf}`, async () => {
    const events = await src.events();
    const fx = src.fx();
    const metrics = new Map<string, EventMetrics>();
    for (const ev of events) {
      const act = await src.activity(ev.id);
      if (act) metrics.set(ev.id, computeMetrics(act, period, asOf, fx));
    }
    return { events, metrics };
  });
}

async function levels(src: RankingSource, asOf: number) {
  const { metrics } = await snapshot(src, "all", asOf);
  const map = new Map<string, EventLevel>();
  for (const [id, m] of metrics) map.set(id, levelFor(m.supporters_count, m.funding_usd));
  return map;
}

/** Attach live community DAO stats (demo store) so cards and the DAO ACTIVE filter can use them. */
function withDao(events: RankableEvent[]): RankableEvent[] {
  let daos: ReturnType<typeof allDaoSummaries> = [];
  try {
    daos = allDaoSummaries();
  } catch {
    return events; // DAO data source not configured (production without DB): rank without DAO info.
  }
  const m = new Map(daos.map((d) => [d.eventId, { status: d.status, members: d.members, activeProposals: d.activeProposals, participationRate: d.participationRate, openVotes: d.openVotes }]));
  return events.map((e) => (m.has(e.id) ? { ...e, dao: m.get(e.id) } : e));
}

async function rankAt(src: RankingSource, q: RankingQuery, asOf: number) {
  const [{ events: raw, metrics }, lv] = await Promise.all([snapshot(src, q.period, asOf), levels(src, asOf)]);
  const events = withDao(raw);
  return rank(events, metrics, q.category, q, q.personalization, (id) => lv.get(id) ?? 1);
}

export async function getRankings(q: RankingQuery, srcOverride?: RankingSource): Promise<RankingResult> {
  const src = srcOverride ?? (await getSource());
  const asOf = src.asOf();
  const key = `${src.mode}:rank:${asOf}:${JSON.stringify(q)}`;
  return cached(key, async () => {
    const all = await rankAt(src, q, asOf);
    // Rank movement vs. the same ranking one week earlier.
    const prev = await rankAt(src, q, asOf - 7 * DAY);
    const prevRank = new Map(prev.map((e) => [e.event.id, e.rank]));
    const start = (q.page - 1) * q.pageSize;
    const items: RankedEntry[] = all.slice(start, start + q.pageSize).map((e) => {
      const p = prevRank.get(e.event.id) ?? null;
      const badges = [...e.badges];
      if (p && p > e.rank) badges.push("rising");
      if (!p) badges.push("new");
      return { ...e, previousRank: p, badges };
    });
    return {
      mode: src.mode,
      category: q.category,
      period: q.period,
      calculationVersion: RANKING_CONFIG.calculationVersion,
      generatedAt: new Date().toISOString(),
      asOf: new Date(asOf).toISOString(),
      refreshSeconds: RANKING_CONFIG.refreshSeconds,
      fx: src.fx(),
      total: all.length,
      page: q.page,
      pageSize: q.pageSize,
      items,
    };
  });
}

const HISTORY_CATEGORIES: RankingCategory[] = ["popular", "trending", "tickets", "funded"];

/** Daily rank per category for the last `days` days (from stored snapshots in production). */
export async function getRankingHistory(eventId: string, days = 14, srcOverride?: RankingSource) {
  const src = srcOverride ?? (await getSource());
  const events = await src.events();
  if (!events.some((e) => e.id === eventId)) return null;
  const asOf = src.asOf();
  const points: { date: string; ranks: Partial<Record<RankingCategory, number | null>>; supporters: number }[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const t = asOf - d * DAY;
    const ranks: Partial<Record<RankingCategory, number | null>> = {};
    for (const c of HISTORY_CATEGORIES) {
      const list = await rankAt(src, { category: c, period: c === "trending" ? "7d" : "all", page: 1, pageSize: 999 }, t);
      ranks[c] = list.find((e) => e.event.id === eventId)?.rank ?? null;
    }
    const { metrics } = await snapshot(src, "all", t);
    points.push({ date: new Date(t).toISOString(), ranks, supporters: metrics.get(eventId)?.supporters_count ?? 0 });
  }
  return { mode: src.mode, eventId, calculationVersion: RANKING_CONFIG.calculationVersion, points };
}

/** Lightweight pins for the map: top N of the current ranking. */
export async function getMapPins(q: RankingQuery, limit = 50, srcOverride?: RankingSource) {
  const res = await getRankings({ ...q, page: 1, pageSize: Math.min(limit, RANKING_CONFIG.pageSizeMax) }, srcOverride);
  return {
    mode: res.mode,
    asOf: res.asOf,
    total: res.total,
    pins: res.items.map((e) => ({
      id: e.event.id,
      rank: e.rank,
      name: e.event.name,
      city: e.event.city,
      lat: e.event.lat,
      lng: e.event.lng,
      approximate: e.event.approximateLocation,
      status: e.event.status,
      level: e.event.level,
    })),
  };
}

export interface CompareRow {
  event: RankableEvent & { level: EventLevel };
  metrics: EventMetrics;
  ranks: Partial<Record<RankingCategory, number | null>>;
}

export async function compareEvents(ids: string[], srcOverride?: RankingSource) {
  const src = srcOverride ?? (await getSource());
  const asOf = src.asOf();
  const { events, metrics } = await snapshot(src, "all", asOf);
  const lv = await levels(src, asOf);
  const rows: CompareRow[] = [];
  const missing: string[] = [];
  for (const id of ids) {
    const ev = events.find((e) => e.id === id);
    const m = metrics.get(id);
    if (!ev || !m) {
      missing.push(id);
      continue;
    }
    const ranks: CompareRow["ranks"] = {};
    for (const c of ["popular", "tickets", "funded"] as const) {
      const list = await rankAt(src, { category: c, period: "all", page: 1, pageSize: 999 }, asOf);
      ranks[c] = list.find((e) => e.event.id === id)?.rank ?? null;
    }
    rows.push({ event: { ...ev, level: lv.get(id) ?? 1 }, metrics: m, ranks });
  }
  return { mode: src.mode, asOf: new Date(asOf).toISOString(), rows, missing };
}

export function _clearRankingCache() {
  memo.clear();
}
