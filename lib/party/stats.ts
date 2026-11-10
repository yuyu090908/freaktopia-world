/**
 * Pure, recomputable figures for a PERSONAL PARTY UNIVERSE. Everything is derived from the normalized
 * attendance rows, so the same inputs always give the same numbers (no stored counters to drift or inflate).
 *
 * Definitions (spec §6):
 *   Total Events       – verified held events (ended, not cancelled, ≥ MIN_QR_CHECKINS door scans by accounts outside the team)
 *   Total Attendance   – counted attendance rows over those events (one per person per event; re-entry never adds)
 *   Unique Visitors    – distinct counted accounts
 *   Returning Visitors – distinct accounts counted at 2 or more different events
 *   Average Rating     – mean of reviews by counted attendees of verified events
 *   Guests             – organizer-reported people without a confirmable account check-in: separate, never added above
 */
import type { Attendance, EventFacts, EventReview, Media, PartyTheme } from "./types";

export const MIN_QR_CHECKINS = 3;
/** Door scans are accepted from 6 h before the start until 6 h after the end. */
export const ENTRY_EARLY_MS = 6 * 3_600_000;
export const ENTRY_LATE_MS = 6 * 3_600_000;
/** PARTY IMPACT needs at least this much evidence; below it no score is shown. */
export const MIN_REVIEWS_FOR_SCORE = 5;
export const MIN_UNIQUE_FOR_SCORE = 10;

export const IMPACT_WEIGHTS = { satisfaction: 0.35, community: 0.25, engagement: 0.15, consistency: 0.15, scale: 0.1 } as const;
export type ImpactPart = keyof typeof IMPACT_WEIGHTS;

export interface EventInput {
  facts: EventFacts;
  /** Event team (owner, managers, staff…): never counted as attendees. */
  team: Set<string>;
  published: boolean;
  demo?: boolean;
}

export const isCounted = (a: Pick<Attendance, "status" | "checkedInAt" | "userId">, team: Set<string>) =>
  a.status !== "cancelled" && !!a.checkedInAt && !team.has(a.userId);

export function isEnded(f: Pick<EventFacts, "endAt">, now: number) {
  return Date.parse(f.endAt) < now;
}

/** A past event counts only with real door scans from enough distinct accounts: no "held" claim without evidence. */
export function isVerifiedEvent(e: EventInput, rows: Attendance[], now: number) {
  if (e.facts.status === "cancelled" || !isEnded(e.facts, now)) return false;
  const qr = new Set(rows.filter((a) => a.eventId === e.facts.id && isCounted(a, e.team) && a.method === "qr").map((a) => a.userId));
  return qr.size >= MIN_QR_CHECKINS;
}

export interface EventFigures {
  eventId: string;
  verified: boolean;
  ended: boolean;
  counted: number;
  qrCount: number;
  manualCount: number;
  rating: number | null;
  reviewCount: number;
}

export function eventFigures(e: EventInput, rows: Attendance[], reviews: EventReview[], now: number): EventFigures {
  const mine = rows.filter((a) => a.eventId === e.facts.id && isCounted(a, e.team));
  const verified = isVerifiedEvent(e, rows, now);
  const counted = new Set(mine.map((a) => a.userId));
  const rs = reviews.filter((r) => r.eventId === e.facts.id && counted.has(r.userId));
  return {
    eventId: e.facts.id,
    verified,
    ended: isEnded(e.facts, now),
    counted: verified ? counted.size : 0,
    qrCount: mine.filter((a) => a.method === "qr").length,
    manualCount: mine.filter((a) => a.method === "manual").length,
    rating: verified && rs.length ? round1(rs.reduce((s, r) => s + r.rating, 0) / rs.length) : null,
    reviewCount: verified ? rs.length : 0,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface WorldStats {
  totalEvents: number;
  totalAttendance: number;
  uniqueVisitors: number;
  returningVisitors: number;
  averageRating: number | null;
  reviewCount: number;
  guests: number;
  cities: number;
  genres: string[];
  /** Visits per counted account (over verified events). */
  visits: Map<string, number>;
  /** Share of counted rows confirmed by hand instead of a door scan (shown for transparency). */
  manualShare: number;
  largestEvent: number;
  firstEventAt: string | null;
  activeMonths: number;
}

export function worldStats(events: EventInput[], rows: Attendance[], reviews: EventReview[], guests: Map<string, number>, now: number): WorldStats {
  const verified = events.filter((e) => isVerifiedEvent(e, rows, now));
  const visits = new Map<string, number>();
  let total = 0;
  let manual = 0;
  let largest = 0;
  const ratings: number[] = [];
  for (const e of verified) {
    const counted = rows.filter((a) => a.eventId === e.facts.id && isCounted(a, e.team));
    const people = new Set(counted.map((a) => a.userId));
    total += people.size;
    largest = Math.max(largest, people.size);
    manual += counted.filter((a) => a.method === "manual").length;
    for (const u of people) visits.set(u, (visits.get(u) ?? 0) + 1);
    for (const r of reviews) if (r.eventId === e.facts.id && people.has(r.userId)) ratings.push(r.rating);
  }
  const months = new Set(verified.map((e) => e.facts.startAt.slice(0, 7)));
  const sorted = [...verified].sort((a, b) => a.facts.startAt.localeCompare(b.facts.startAt));
  return {
    totalEvents: verified.length,
    totalAttendance: total,
    uniqueVisitors: visits.size,
    returningVisitors: [...visits.values()].filter((v) => v >= 2).length,
    averageRating: ratings.length ? round1(ratings.reduce((s, r) => s + r, 0) / ratings.length) : null,
    reviewCount: ratings.length,
    guests: verified.reduce((s, e) => s + (guests.get(e.facts.id) ?? 0), 0),
    cities: new Set(verified.map((e) => `${e.facts.country}:${e.facts.city}`)).size,
    genres: [...new Set(verified.flatMap((e) => e.facts.genres))],
    visits,
    manualShare: total ? round1((manual / total) * 100) / 100 : 0,
    largestEvent: largest,
    firstEventAt: sorted[0]?.facts.startAt ?? null,
    activeMonths: months.size,
  };
}

// ------------------------------------------------------------------ PARTY IMPACT SCORE

export interface Impact {
  /** 0–100, or null while there isn't enough evidence ("insufficient data"). */
  score: number | null;
  status: "ok" | "insufficient";
  confidence: "low" | "medium" | "high" | null;
  parts: Record<ImpactPart, number | null>;
  reviewCount: number;
}

/**
 * An estimate of how well past parties were received, not a verdict on how fun they are.
 * Size is only 10 % and log-scaled; satisfaction is a Bayesian mean (pulled toward 3.5 until there are
 * enough reviews), so a small party with happy guests can score as well as a large one.
 */
export function partyImpact(s: WorldStats, engagedPeople: number): Impact {
  const parts: Record<ImpactPart, number | null> = { satisfaction: null, community: null, engagement: null, consistency: null, scale: null };
  if (s.totalEvents === 0 || s.reviewCount < MIN_REVIEWS_FOR_SCORE || s.uniqueVisitors < MIN_UNIQUE_FOR_SCORE) {
    return { score: null, status: "insufficient", confidence: null, parts, reviewCount: s.reviewCount };
  }
  const PRIOR = 3.5;
  const PRIOR_W = 5;
  const bayes = ((s.averageRating ?? PRIOR) * s.reviewCount + PRIOR * PRIOR_W) / (s.reviewCount + PRIOR_W);
  parts.satisfaction = clamp(((bayes - 1) / 4) * 100);
  // Returning share: 40 % of guests coming back is treated as full marks. Needs at least two events.
  parts.community = s.totalEvents >= 2 ? clamp((s.returningVisitors / s.uniqueVisitors / 0.4) * 100) : null;
  parts.engagement = clamp((engagedPeople / s.uniqueVisitors / 0.3) * 100);
  parts.consistency = clamp((Math.log2(1 + s.totalEvents) / Math.log2(13)) * 70 + Math.min(1, s.activeMonths / 6) * 30);
  const avg = s.totalAttendance / s.totalEvents;
  parts.scale = clamp((Math.log10(1 + avg) / Math.log10(2001)) * 100);
  let sum = 0;
  let w = 0;
  for (const k of Object.keys(IMPACT_WEIGHTS) as ImpactPart[]) {
    if (parts[k] == null) continue;
    sum += parts[k]! * IMPACT_WEIGHTS[k];
    w += IMPACT_WEIGHTS[k];
  }
  const confidence = s.reviewCount >= 50 && s.totalEvents >= 3 ? "high" : s.reviewCount >= 15 ? "medium" : "low";
  return { score: Math.round(sum / w), status: "ok", confidence, parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v == null ? null : Math.round(v)])) as Impact["parts"], reviewCount: s.reviewCount };
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

// ------------------------------------------------------------------ world growth (presentation only)

export type MilestoneKey = "first_party" | "five_parties" | "ten_parties" | "returning_crowd" | "big_stage" | "two_cities" | "genre_areas";
export interface Growth {
  stage: 0 | 1 | 2 | 3 | 4 | 5;
  milestones: { key: MilestoneKey; reached: boolean }[];
  /** One area per theme the organizer has actually hosted. */
  areas: PartyTheme[];
}

/** Stages only show verified history; they say nothing about popularity or trustworthiness. */
export function growth(s: WorldStats, themes: PartyTheme[]): Growth {
  const community = s.totalEvents >= 2 && s.returningVisitors >= 5;
  const big = s.largestEvent >= 500;
  let stage: Growth["stage"] = 0;
  if (s.totalEvents >= 1) stage = 1;
  if (s.totalEvents >= 2) stage = 2;
  if (stage === 2 && community) stage = 3;
  if (stage === 3 && big) stage = 4;
  if (stage === 4 && s.totalEvents >= 10 && s.cities >= 2) stage = 5;
  const areas = [...new Set(themes)].filter((t) => t !== "default");
  return {
    stage,
    milestones: [
      { key: "first_party", reached: s.totalEvents >= 1 },
      { key: "five_parties", reached: s.totalEvents >= 5 },
      { key: "ten_parties", reached: s.totalEvents >= 10 },
      { key: "returning_crowd", reached: community },
      { key: "big_stage", reached: big },
      { key: "two_cities", reached: s.cities >= 2 },
      { key: "genre_areas", reached: areas.length >= 2 },
    ],
    areas,
  };
}

export function themeFor(genres: string[], level: number): PartyTheme {
  if (level >= 5) return "festival";
  const g = genres.map((x) => x.toLowerCase());
  if (g.some((x) => x.includes("afro"))) return "afro_house";
  if (g.some((x) => x.includes("melodic") || x.includes("progressive") || x.includes("ambient"))) return "melodic_techno";
  if (g.some((x) => x.includes("tech house") || x === "house" || x.includes("techno") || x.includes("minimal"))) return "tech_house";
  if (level >= 4) return "festival";
  return "default";
}

/** People who left a review or posted a visible photo/video: the "engagement" signal. */
export function engagedPeople(reviews: EventReview[], media: Media[], counted: Set<string>) {
  const s = new Set<string>();
  for (const r of reviews) if (counted.has(r.userId)) s.add(r.userId);
  for (const m of media) if (m.kind === "attendee" && m.visibility !== "hidden" && counted.has(m.uploaderId)) s.add(m.uploaderId);
  return s.size;
}

// ------------------------------------------------------------------ anomaly detection (for admins)

export type AnomalyKind = "manual_share" | "over_capacity" | "late_or_early_scans" | "review_burst" | "new_account_crowd" | "double_presence" | "repeat_scans";
export interface Anomaly {
  eventId: string;
  kind: AnomalyKind;
  value: number;
}

export function detectAnomalies(
  e: EventInput,
  rows: Attendance[],
  logs: { result: string; at: string; userId: string | null }[],
  reviews: EventReview[],
  accountCreated: Map<string, string>,
  otherEventsSameTime: Attendance[],
): Anomaly[] {
  const out: Anomaly[] = [];
  const counted = rows.filter((a) => a.eventId === e.facts.id && isCounted(a, e.team));
  if (counted.length >= 5) {
    const manual = counted.filter((a) => a.method === "manual").length / counted.length;
    if (manual > 0.5) out.push({ eventId: e.facts.id, kind: "manual_share", value: Math.round(manual * 100) });
  }
  if (e.facts.plannedAttendance > 0 && counted.length > e.facts.plannedAttendance * 1.5 && counted.length >= 20) {
    out.push({ eventId: e.facts.id, kind: "over_capacity", value: counted.length });
  }
  const early = logs.filter((l) => l.result === "not_entry_time").length;
  if (early >= 5) out.push({ eventId: e.facts.id, kind: "late_or_early_scans", value: early });
  const dup = logs.filter((l) => l.result === "duplicate").length;
  if (dup >= 10 && dup > counted.length) out.push({ eventId: e.facts.id, kind: "repeat_scans", value: dup });
  const rs = reviews.filter((r) => r.eventId === e.facts.id).map((r) => Date.parse(r.at)).sort((a, b) => a - b);
  for (let i = 0; i + 9 < rs.length; i++) {
    if (rs[i + 9] - rs[i] <= 5 * 60_000) {
      out.push({ eventId: e.facts.id, kind: "review_burst", value: 10 });
      break;
    }
  }
  if (counted.length >= 10) {
    const start = Date.parse(e.facts.startAt);
    const fresh = counted.filter((a) => {
      const c = accountCreated.get(a.userId);
      return c ? start - Date.parse(c) < 7 * 86_400_000 : false;
    }).length;
    if (fresh / counted.length > 0.8) out.push({ eventId: e.facts.id, kind: "new_account_crowd", value: Math.round((fresh / counted.length) * 100) });
  }
  const here = new Set(counted.map((a) => a.userId));
  const elsewhere = new Set(otherEventsSameTime.filter((a) => a.checkedInAt && a.status !== "cancelled" && here.has(a.userId)).map((a) => a.userId));
  if (elsewhere.size >= 3) out.push({ eventId: e.facts.id, kind: "double_presence", value: elsewhere.size });
  return out;
}
