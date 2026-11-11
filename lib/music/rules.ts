/**
 * Pure rules for DJ ARENA 2.0 (no storage): who may play a track, when a play counts, how a booking may move,
 * calendar conflicts and the ranking formula. Kept apart so they are unit-tested directly.
 */
import type { AudioTrack, BookingRequest, BookingStatus, DayStatus, DjAvailability, PlayRejectReason, RightsInfo, TrackType } from "./types";
import { THIRD_PARTY_TYPES } from "./types";

// ------------------------------------------------------------------ access

export interface Viewer {
  id: string | null;
  admin?: boolean;
  /** Events where this viewer reviews applications that attached this track (AUDITION ACCESS). */
  auditionForTrack?: boolean;
}

/** May this viewer play / see this track at all? */
export function canPlay(t: AudioTrack, v: Viewer) {
  if (t.processingStatus !== "ready") return false;
  if (v.id && v.id === t.ownerId) return true;
  if (v.admin) return true;
  if (t.publicationStatus !== "published" || t.rightsStatus !== "staff_reviewed") return false;
  if (t.rights.licenseEnds && t.rights.licenseEnds < new Date().toISOString().slice(0, 10)) return false;
  if (t.visibility === "public" || t.visibility === "unlisted") return true;
  if (t.visibility === "audition") return !!v.auditionForTrack;
  return false;
}

/** Listed in search, profiles, rankings and public playlists: only PUBLIC tracks. */
export const isListed = (t: AudioTrack) => canPlay(t, { id: null }) && t.visibility === "public";

/** Downloads: off unless the owner switched them on, the rights allow it and staff reviewed the rights. */
export const canDownload = (t: AudioTrack, v: Viewer) => t.downloadable && t.rights.allowDownload && canPlay(t, v) && (t.rightsStatus === "staff_reviewed" || v.id === t.ownerId);

// ------------------------------------------------------------------ rights questions by type

/** Which rights answers are required before a track can be sent for review. */
export function rightsProblems(type: TrackType, r: RightsInfo): string[] {
  const p: string[] = [];
  const thirdParty = THIRD_PARTY_TYPES.includes(type) || r.usesThirdParty || !r.allOriginal;
  if (THIRD_PARTY_TYPES.includes(type) && r.allOriginal) p.push("typeNeedsThirdParty");
  if (thirdParty) {
    if (!r.licensor.trim()) p.push("licensor");
    if (!r.licenseRef.trim() && !r.documentId) p.push("licenseRef");
    if (!r.territories.trim()) p.push("territories");
  }
  if (!r.allowStreaming) p.push("allowStreaming");
  if (r.statement.trim().length < 10) p.push("statement");
  return p;
}

// ------------------------------------------------------------------ plays

export const PLAY_MIN_SECONDS = 30;
export const PLAY_REPEAT_WINDOW_MS = 30 * 60_000;
export const PLAY_STARTS_PER_HOUR = 60;

/** Seconds of listening needed for a play to count: 30 s, or half of a track shorter than a minute. */
export const qualifyingSeconds = (durationSec: number | null) => Math.max(1, Math.min(PLAY_MIN_SECONDS, Math.floor((durationSec ?? PLAY_MIN_SECONDS * 2) / 2)));

const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|preview|curl|wget|python-requests|httpclient|axios|node-fetch|go-http|java\//i;
export const isBotAgent = (ua: string | null) => !ua || BOT_UA.test(ua);

export interface PlayCheck {
  durationSec: number | null;
  playedSeconds: number;
  /** Wall-clock seconds between the start and finish calls (listening time can't exceed it). */
  elapsedSeconds: number;
  isOwner: boolean;
  userAgent: string | null;
  /** This listener already has a counted play of this track in the last 30 minutes. */
  recentQualified: boolean;
  /** Plays started by this listener in the last hour. */
  startsLastHour: number;
}

export function judgePlay(c: PlayCheck): { qualified: boolean; reason: PlayRejectReason | null } {
  if (isBotAgent(c.userAgent)) return { qualified: false, reason: "bot" };
  if (c.isOwner) return { qualified: false, reason: "owner" };
  if (c.playedSeconds > c.elapsedSeconds + 2) return { qualified: false, reason: "clock" };
  if (c.startsLastHour > PLAY_STARTS_PER_HOUR) return { qualified: false, reason: "rate" };
  if (c.playedSeconds < qualifyingSeconds(c.durationSec)) return { qualified: false, reason: "short" };
  if (c.recentQualified) return { qualified: false, reason: "repeat" };
  return { qualified: true, reason: null };
}

// ------------------------------------------------------------------ booking state machine

export type BookingAction = "send" | "view" | "accept" | "decline" | "counter" | "request_details" | "confirm" | "cancel" | "expire";

/**
 * Allowed moves. ACCEPTED means the DJ agreed to the current terms; only the organizer's final confirmation
 * (of exactly those terms) makes it CONFIRMED. A counter by either side goes back to NEGOTIATING.
 */
const MOVES: Record<BookingAction, { from: BookingStatus[]; to: BookingStatus; by: "dj" | "requester" | "either" | "system" }> = {
  send: { from: ["draft"], to: "sent", by: "requester" },
  view: { from: ["sent"], to: "viewed", by: "dj" },
  accept: { from: ["sent", "viewed", "negotiating"], to: "accepted", by: "dj" },
  decline: { from: ["sent", "viewed", "negotiating", "accepted"], to: "declined", by: "dj" },
  counter: { from: ["sent", "viewed", "negotiating", "accepted"], to: "negotiating", by: "either" },
  request_details: { from: ["sent", "viewed", "negotiating"], to: "negotiating", by: "dj" },
  confirm: { from: ["accepted"], to: "confirmed", by: "requester" },
  cancel: { from: ["draft", "sent", "viewed", "negotiating", "accepted", "confirmed"], to: "cancelled", by: "either" },
  expire: { from: ["sent", "viewed", "negotiating"], to: "expired", by: "system" },
};

export function nextStatus(b: Pick<BookingRequest, "status" | "kind" | "termsVersion" | "djAcceptedVersion">, action: BookingAction, actor: "dj" | "requester" | "system"): BookingStatus | null {
  const m = MOVES[action];
  if (!m.from.includes(b.status)) return null;
  if (m.by !== "either" && m.by !== actor) return null;
  if (b.kind === "inquiry" && ["accept", "confirm", "counter"].includes(action)) return null;
  if (action === "confirm" && b.djAcceptedVersion !== b.termsVersion) return null;
  return m.to;
}

/** Open requests past their answer-by time are EXPIRED (computed on read; nothing runs in the background). */
export const isExpired = (b: Pick<BookingRequest, "status" | "respondBy">, now = new Date()) => ["sent", "viewed", "negotiating"].includes(b.status) && b.respondBy < now.toISOString();

// ------------------------------------------------------------------ calendar

const dayOf = (iso: string) => iso.slice(0, 10);
function daysBetween(startIso: string, endIso: string, padHours: number) {
  const out: string[] = [];
  const s = new Date(Date.parse(startIso) - padHours * 3_600_000);
  const e = new Date(Date.parse(endIso) + padHours * 3_600_000);
  for (let d = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate())); d <= e; d = new Date(d.getTime() + 86_400_000)) out.push(d.toISOString().slice(0, 10));
  return out;
}

export interface Conflict { kind: "booked" | "unavailable" | "tentative" | "booking"; day: string; bookingId?: string }

/**
 * Conflicts for a proposed set: other CONFIRMED bookings whose time (plus the DJ's buffer for travel and set-up)
 * overlaps, and calendar days marked booked / unavailable / private (private shows as "unavailable" to others).
 * A warning, never a guarantee: the DJ still confirms the date.
 */
export function conflictsFor(start: string, end: string, bufferHours: number, days: DjAvailability[], bookings: Pick<BookingRequest, "id" | "status" | "terms">[], selfId?: string): Conflict[] {
  const out: Conflict[] = [];
  const s = Date.parse(start) - bufferHours * 3_600_000;
  const e = Date.parse(end) + bufferHours * 3_600_000;
  for (const b of bookings) {
    if (b.id === selfId || b.status !== "confirmed") continue;
    if (Date.parse(b.terms.performanceStart) < e && Date.parse(b.terms.performanceEnd) > s) out.push({ kind: "booking", day: dayOf(b.terms.performanceStart), bookingId: b.id });
  }
  const want = new Set(daysBetween(start, end, 0));
  for (const d of days) {
    if (!want.has(d.day) || d.bookingId === selfId) continue;
    const k: Conflict["kind"] | null = d.status === "booked" ? "booked" : d.status === "unavailable" || d.status === "private" ? "unavailable" : d.status === "tentative" ? "tentative" : null;
    if (k) out.push({ kind: k, day: d.day });
  }
  return out;
}

/** What others may see of a day: never notes, never why. PRIVATE looks like any unavailable day. */
export function publicDay(d: Pick<DjAvailability, "day" | "status">): { day: string; status: "available" | "tentative" | "unavailable" } | null {
  if (d.status === "available") return { day: d.day, status: "available" };
  if (d.status === "tentative") return { day: d.day, status: "tentative" };
  if (d.status === "booked" || d.status === "unavailable" || d.status === "private") return { day: d.day, status: "unavailable" };
  return null;
}

export const isDayStatus = (s: string): s is DayStatus => ["available", "tentative", "booked", "unavailable", "private"].includes(s);

// ------------------------------------------------------------------ rankings

export const RANK_WINDOW_DAYS = 30;
export interface DjSignals {
  djId: string;
  /** Qualified plays, unique listeners, likes, saves and confirmed bookings in the last 30 days. */
  plays30: number;
  listeners30: number;
  likes30: number;
  saves30: number;
  bookings30: number;
  /** Same unique-listener count for the 30 days before (for growth). */
  listenersPrev30: number;
  /** First public track date (for "rising": DJs who started publishing in the last 90 days). */
  firstPublishedAt: string | null;
}

/**
 * TRENDING score (30 days): unique listeners weigh most, raw plays are dampened (square root) so replaying
 * can't buy rank, and likes/saves/bookings add on top. Growth vs the previous 30 days gives new DJs a lift.
 * No paid placement exists.
 */
export function trendingScore(s: DjSignals) {
  const base = s.listeners30 * 3 + Math.sqrt(s.plays30) * 2 + s.likes30 * 2 + s.saves30 * 3 + s.bookings30 * 5;
  const growth = s.listenersPrev30 > 0 ? Math.min(2, s.listeners30 / s.listenersPrev30) : s.listeners30 > 0 ? 1.5 : 1;
  return Math.round(base * growth * 10) / 10;
}

export type RankBoard = "trending" | "liked" | "saved" | "booked" | "rising";
export function rankDjs(all: DjSignals[], board: RankBoard, now = new Date()) {
  const recent = (s: DjSignals) => !!s.firstPublishedAt && now.getTime() - Date.parse(s.firstPublishedAt) < 90 * 86_400_000;
  const value = (s: DjSignals) =>
    board === "liked" ? s.likes30 : board === "saved" ? s.saves30 : board === "booked" ? s.bookings30 : trendingScore(s);
  return all
    .filter((s) => (board === "rising" ? recent(s) : true))
    .map((s) => ({ ...s, value: value(s) }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value || b.listeners30 - a.listeners30 || a.djId.localeCompare(b.djId));
}
