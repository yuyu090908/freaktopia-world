/**
 * Pure ranking engine. No I/O: give it events + raw activity, get rankings.
 * Runs on the server (route handlers / server components) only.
 */
import { levelFor } from "@/lib/levels";
import type { EventLevel } from "@/lib/types";
import { PERIOD_MS, RANKING_CONFIG, toUsd } from "./config";
import type {
  CheckInRecord,
  EventActivity,
  EventMetrics,
  FxRate,
  PaymentRecord,
  PresenceRecord,
  RankableEvent,
  RankedEntry,
  RankingCategory,
  RankingFilters,
  RankingPeriod,
  Personalization,
  SupporterRecord,
  TicketRecord,
  Currency,
} from "./types";

type Cfg = typeof RANKING_CONFIG;

export interface Window {
  start: number | null;
  end: number;
}

export function windowFor(period: RankingPeriod, now: number): Window {
  const ms = PERIOD_MS[period];
  return { start: ms === null ? null : now - ms, end: now };
}

const inWindow = (t: number, w: Window) => t <= w.end && (w.start === null || t > w.start);

/* ---------------- anti-fraud ---------------- */

/**
 * Burst detection: an IP hash that produced more than `burstPerIp` supports
 * inside any `burstWindowMs` slice is treated as suspicious (held).
 */
export function detectBurstIps(records: SupporterRecord[], cfg: Cfg["antiFraud"] = RANKING_CONFIG.antiFraud): Set<string> {
  const byIp = new Map<string, number[]>();
  for (const r of records) {
    const list = byIp.get(r.ipHash);
    if (list) list.push(r.createdAt);
    else byIp.set(r.ipHash, [r.createdAt]);
  }
  const flagged = new Set<string>();
  for (const [ip, times] of byIp) {
    if (times.length <= cfg.burstPerIp) continue;
    times.sort((a, b) => a - b);
    for (let i = 0, j = 0; j < times.length; j++) {
      while (times[j] - times[i] > cfg.burstWindowMs) i++;
      if (j - i + 1 > cfg.burstPerIp) {
        flagged.add(ip);
        break;
      }
    }
  }
  return flagged;
}

/**
 * Unique valid supporters up to `until`: one per user (earliest support wins),
 * excluding bot/held records and burst IPs. Wallet addresses are ignored for
 * counting: several wallets of one user are still one person.
 */
export function uniqueSupporters(records: SupporterRecord[], until: number, burstIps: Set<string> = new Set()) {
  const first = new Map<string, number>();
  let duplicates = 0;
  let flagged = 0;
  for (const r of records) {
    if (r.createdAt > until) continue;
    if (r.fraud !== "clear" || burstIps.has(r.ipHash)) {
      flagged++;
      continue;
    }
    const prev = first.get(r.userId);
    if (prev === undefined) first.set(r.userId, r.createdAt);
    else {
      duplicates++;
      if (r.createdAt < prev) first.set(r.userId, r.createdAt);
    }
  }
  return { firstSupport: first, duplicates, flagged };
}

/** Valid sold tickets in the window (refunded / void / fraud excluded, ids de-duplicated). */
export function validTickets(tickets: TicketRecord[], w: Window) {
  const seen = new Set<string>();
  const valid: TicketRecord[] = [];
  let invalid = 0;
  for (const t of tickets) {
    if (!inWindow(t.soldAt, w)) continue;
    if (t.status !== "valid") {
      invalid++;
      continue;
    }
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    valid.push(t);
  }
  return { valid, invalid };
}

/** Checked-in attendees: one per valid ticket, duplicate scans removed. */
export function checkedIn(scans: CheckInRecord[], validTicketIds: Set<string>, w: Window) {
  const tickets = new Set<string>();
  let duplicates = 0;
  for (const s of scans) {
    if (!inWindow(s.scannedAt, w) || !validTicketIds.has(s.ticketId)) continue;
    if (tickets.has(s.ticketId)) duplicates++;
    else tickets.add(s.ticketId);
  }
  return { count: tickets.size, duplicates };
}

/**
 * Currently present = a fresh presence ping (within TTL) and not checked out.
 * Checking in alone never makes someone "present".
 */
export function presentNow(presence: PresenceRecord[], now: number, ttlMs: number = RANKING_CONFIG.presenceTtlMs) {
  const present = new Set<string>();
  const avatars = new Set<string>();
  for (const p of presence) {
    if (p.checkedOut || p.lastSeenAt > now || now - p.lastSeenAt > ttlMs) continue;
    present.add(p.userId);
    if (p.avatarPublic && p.profilePublic) avatars.add(p.userId);
  }
  return { present: present.size, publicAvatars: avatars.size };
}

/** Secured funding: captured payments only, kept per currency and converted with the recorded rate. */
export function securedFunding(payments: PaymentRecord[], w: Window, fx: FxRate[]) {
  const byCurrency: Partial<Record<Currency, number>> = {};
  let usd = 0;
  let uncaptured = 0;
  for (const p of payments) {
    if (!inWindow(p.createdAt, w)) continue;
    if (p.status !== "captured") {
      uncaptured++;
      continue;
    }
    byCurrency[p.currency] = (byCurrency[p.currency] ?? 0) + p.amount;
    usd += toUsd(p.amount, p.currency, fx);
  }
  return { byCurrency, usd: Math.round(usd), uncaptured };
}

/** Trending score: log of new supporters + smoothed, capped growth rate. */
export function trendingScore(newSupporters: number, base: number, cfg: Cfg["trending"] = RANKING_CONFIG.trending) {
  const growth = Math.min(cfg.rateCap, newSupporters / (base + cfg.smoothing));
  const eligible = base + newSupporters >= cfg.minSample && newSupporters >= cfg.minNew;
  const score = eligible ? cfg.logWeight * Math.log10(1 + newSupporters) + cfg.rateWeight * growth : 0;
  return { growth, score: Math.round(score * 10000) / 10000, eligible };
}

export function computeMetrics(activity: EventActivity, period: RankingPeriod, now: number, fx: FxRate[], cfg: Cfg = RANKING_CONFIG): EventMetrics {
  // Trending over "all time" is meaningless: use 7 days.
  const w = windowFor(period, now);
  const trendWindow = period === "all" ? windowFor("7d", now) : w;
  const burst = detectBurstIps(activity.supporters, cfg.antiFraud);
  const sup = uniqueSupporters(activity.supporters, now, burst);
  let newInPeriod = 0;
  let newInTrend = 0;
  for (const t of sup.firstSupport.values()) {
    if (inWindow(t, w)) newInPeriod++;
    if (inWindow(t, trendWindow)) newInTrend++;
  }
  const baseTrend = sup.firstSupport.size - newInTrend;
  const trend = trendingScore(newInTrend, baseTrend, cfg.trending);

  const interested = new Set(activity.interests.filter((i) => i.createdAt <= now).map((i) => i.userId)).size;
  const tix = validTickets(activity.tickets, w);
  const allValid = validTickets(activity.tickets, { start: null, end: now });
  const ids = new Set(allValid.valid.map((t) => t.id));
  const scans = checkedIn(activity.checkIns, ids, w);
  const pres = presentNow(activity.presence, now, cfg.presenceTtlMs);
  const fund = securedFunding(activity.payments, w, fx);

  return {
    supporters_count: sup.firstSupport.size,
    interested_count: interested,
    tickets_sold: tix.valid.length,
    checked_in_count: scans.count,
    currently_present_count: pres.present,
    public_avatar_count: pres.publicAvatars,
    funding_usd: fund.usd,
    funding_by_currency: fund.byCurrency,
    new_supporters: newInPeriod,
    base_supporters: sup.firstSupport.size - newInPeriod,
    growth_rate: Math.round(trend.growth * 1000) / 1000,
    trending_score: trend.score,
    excluded: {
      duplicate_supports: sup.duplicates,
      flagged_supports: sup.flagged,
      invalid_tickets: tix.invalid,
      uncaptured_payments: fund.uncaptured,
      duplicate_scans: scans.duplicates,
    },
  };
}

/* ---------------- filters ---------------- */

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function matchesFilters(ev: RankableEvent, level: EventLevel, f: RankingFilters) {
  if (f.q) {
    const q = norm(f.q.trim());
    const hay = norm([ev.name, ev.city, ev.country, ...ev.genres].join(" "));
    if (q && !hay.includes(q)) return false;
  }
  if (f.country && norm(ev.country) !== norm(f.country)) return false;
  if (f.city && norm(ev.city) !== norm(f.city)) return false;
  if (f.genre && !ev.genres.includes(f.genre)) return false;
  if (f.status === "upcoming" && !(ev.status === "funding" || ev.status === "confirmed")) return false;
  if (f.status === "live" && ev.status !== "live") return false;
  if (f.status === "completed" && ev.status !== "ended") return false;
  if (f.price === "free" && ev.minPrice > 0) return false;
  if (f.price === "paid" && ev.minPrice === 0) return false;
  if (f.level && level !== f.level) return false;
  if (f.djRecruiting && !ev.djRecruiting) return false;
  if (f.afterParty && !ev.afterParty) return false;
  if (f.daoActive && !(ev.dao && ev.dao.status !== "archived")) return false;
  return true;
}

/* ---------------- scoring ---------------- */

export interface Scored {
  eligible: boolean;
  score: number;
  primary: RankedEntry["primary"];
}

export function personalMatch(ev: RankableEvent, p: Personalization) {
  const genre = ev.genres.filter((g) => p.genres.includes(g)).length;
  const city = p.cities.some((c) => norm(c) === norm(ev.city)) ? 1 : 0;
  const djs = ev.lineup.filter((d) => p.djIds.includes(d)).length;
  const followed = p.followedEventIds.includes(ev.id) ? 1 : 0;
  return 5 * followed + 3 * genre + 2 * city + 2 * djs;
}

export function scoreFor(category: RankingCategory, ev: RankableEvent, m: EventMetrics, period: RankingPeriod, p?: Personalization): Scored {
  const upcoming = ev.status === "funding" || ev.status === "confirmed";
  switch (category) {
    case "popular": {
      const v = period === "all" ? m.supporters_count : m.new_supporters;
      return { eligible: v > 0, score: v, primary: { key: period === "all" ? "supporters_count" : "new_supporters", value: v } };
    }
    case "attended":
      return { eligible: (ev.status === "ended" || ev.status === "live") && m.checked_in_count > 0, score: m.checked_in_count, primary: { key: "checked_in_count", value: m.checked_in_count } };
    case "trending":
      return { eligible: m.trending_score > 0, score: m.trending_score, primary: { key: "growth_rate", value: m.growth_rate } };
    case "funded":
      return { eligible: m.funding_usd > 0, score: m.funding_usd, primary: { key: "funding_usd", value: m.funding_usd } };
    case "live":
      // LIVE requires both the status and fresh presence evidence.
      return { eligible: ev.status === "live" && m.currently_present_count > 0, score: m.currently_present_count, primary: { key: "currently_present_count", value: m.currently_present_count } };
    case "dj_wanted":
      return { eligible: ev.djRecruiting && upcoming, score: m.supporters_count, primary: { key: "supporters_count", value: m.supporters_count } };
    case "after_party":
      return { eligible: !!ev.afterParty, score: ev.afterParty?.sold ?? 0, primary: { key: "after_party_sold", value: ev.afterParty?.sold ?? 0 } };
    case "tickets":
      return { eligible: m.tickets_sold > 0, score: m.tickets_sold, primary: { key: "tickets_sold", value: m.tickets_sold } };
    case "for_you": {
      if (!p) return { eligible: false, score: 0, primary: { key: "match", value: 0 } };
      const match = personalMatch(ev, p);
      const score = match + Math.log10(1 + m.supporters_count) / 10;
      return { eligible: match > 0 && ev.status !== "ended", score: Math.round(score * 1000) / 1000, primary: { key: "match", value: match } };
    }
  }
}

/**
 * Fixed tie-break order: score desc → supporters desc → earlier start → id asc.
 * Deterministic, so the same data always yields the same order.
 */
export function compareRanked(a: { score: number; ev: RankableEvent; m: EventMetrics }, b: { score: number; ev: RankableEvent; m: EventMetrics }) {
  return (
    b.score - a.score ||
    b.m.supporters_count - a.m.supporters_count ||
    Date.parse(a.ev.startsAt) - Date.parse(b.ev.startsAt) ||
    (a.ev.id < b.ev.id ? -1 : a.ev.id > b.ev.id ? 1 : 0)
  );
}

export function rank(
  events: RankableEvent[],
  metrics: Map<string, EventMetrics>,
  category: RankingCategory,
  filters: RankingFilters,
  personalization?: Personalization,
  /** Event level is always all-time; pass it when `metrics` are period-scoped. */
  levelOf?: (id: string) => EventLevel,
): RankedEntry[] {
  const rows: { ev: RankableEvent; m: EventMetrics; level: EventLevel; s: Scored; score: number }[] = [];
  for (const ev of events) {
    const m = metrics.get(ev.id);
    if (!m) continue;
    const level = levelOf ? levelOf(ev.id) : levelFor(m.supporters_count, m.funding_usd);
    if (!matchesFilters(ev, level, filters)) continue;
    const s = scoreFor(category, ev, m, filters.period, personalization);
    if (!s.eligible) continue;
    rows.push({ ev, m, level, s, score: s.score });
  }
  rows.sort(compareRanked);
  return rows.map((r, i) => ({
    rank: i + 1,
    previousRank: null,
    event: { ...r.ev, level: r.level },
    metrics: r.m,
    score: r.score,
    primary: r.s.primary,
    badges: i === 0 ? ["top1"] : i < 3 ? ["top3"] : i < 10 ? ["top10"] : [],
  }));
}
