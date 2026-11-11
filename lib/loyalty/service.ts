/**
 * FREAK ID & LOYALTY service (Phase 1). Built on the existing accounts (lib/auth) and the verified attendance of the
 * PERSONAL PARTY UNIVERSE (lib/party, ops_attendance). No second membership system, no second database:
 *
 *  - FREAK ID = the existing account + its alien public ID (FREAK-xxxxxxxx).
 *  - The verified event count is computed every time from ops_attendance, so it can never drift from the door records:
 *    one per (event, person), own check-in only, event ended / not cancelled / ≥ 3 QR check-ins, team excluded,
 *    and events an admin excluded after an audit are left out (with a reason, and they can be restored).
 *  - Rules (rank thresholds, discount %, fee rate, cap, minimum fee, 100 % gate) are one admin-editable record.
 *    A change that takes benefits away needs a notice text and starts NOTICE_DAYS later at the earliest.
 */
import { randomUUID } from "node:crypto";
import { toLook } from "@/lib/alien/catalog";
import { getStore as getAuthStore } from "@/lib/auth/store";
import { getOpsStore } from "@/lib/ops/store";
import { OpsError, effectiveLevel, type EventMember, type OpsEvent } from "@/lib/ops/types";
import { isCounted, isVerifiedEvent } from "@/lib/party/stats";
import type { Attendance, PartyAudit } from "@/lib/party/types";
import { ensurePartyDemo, isDemoUser } from "@/lib/party/seed";
import {
  DEFAULT_RULES, NOTICE_DAYS, RANKS, effectiveDiscountPct, feeBreakdown, fullDiscountPending, nextRankOf, progressOf, rankFor, reducesBenefits,
  validateRules, type LoyaltyRules, type Rank,
} from "./rules";

const store = () => getOpsStore();
const auth = () => getAuthStore();
const err = (status: number, code: string, extra?: Record<string, unknown>) => new OpsError(status, code, extra);
const nowIso = () => new Date().toISOString();

async function ready() {
  if (store().kind === "memory") await ensurePartyDemo(store());
}

// ------------------------------------------------------------------ rules

export interface RulesDoc {
  id: "current";
  rules: LoyaltyRules;
  /** A future change that was announced in advance. Applied automatically from `effectiveAt`. */
  scheduled: { rules: LoyaltyRules; effectiveAt: string; notice: string } | null;
  updatedAt: string;
  updatedBy: string;
  version: number;
}

async function rulesDoc(): Promise<RulesDoc> {
  const d = await store().get<RulesDoc>("loyalty_rules", "current");
  if (!d) return { id: "current", rules: DEFAULT_RULES, scheduled: null, updatedAt: "", updatedBy: "", version: 0 };
  if (d.scheduled && Date.parse(d.scheduled.effectiveAt) <= Date.now()) {
    const next: RulesDoc = { ...d, rules: d.scheduled.rules, scheduled: null, updatedAt: nowIso(), version: d.version + 1 };
    try {
      await store().put("loyalty_rules", next, d.version);
    } catch {
      /* someone else applied it first */
    }
    return next;
  }
  return d;
}

export async function currentRules() {
  const d = await rulesDoc();
  return { rules: d.rules, scheduled: d.scheduled };
}

// ------------------------------------------------------------------ verified attendance

export interface Exclusion {
  eventId: string;
  reason: string;
  by: string;
  at: string;
}

export interface VerifiedVisit {
  eventId: string;
  name: string;
  city: string;
  country: string;
  genres: string[];
  startAt: string;
  method: "qr" | "manual";
}

async function teamSet(eventId: string) {
  return new Set((await store().list<EventMember>("members", { eventId })).map((m) => m.userId));
}

/** Every attendance of one person, split into counted (verified), pending (event not verified yet) and excluded. */
export async function attendanceOf(uid: string) {
  await ready();
  const rows = await store().list<Attendance>("attendance", { userId: uid });
  const excluded = new Set((await store().list<Exclusion>("loyalty_exclusions")).map((x) => x.eventId));
  const now = Date.now();
  const verified: VerifiedVisit[] = [];
  let pending = 0;
  let excludedCount = 0;
  for (const a of rows) {
    const e = await store().get<OpsEvent>("events", a.eventId);
    if (!e) continue;
    const team = await teamSet(e.id);
    if (!isCounted(a, team)) continue; // RSVP only, cancelled, waitlist or team member
    const all = await store().list<Attendance>("attendance", { eventId: e.id });
    const facts = { id: e.id, name: e.name, city: e.city, country: e.country, venueName: e.venueName, startAt: e.startAt, endAt: e.endAt, timezone: e.timezone, genres: e.genres, level: effectiveLevel(e), status: e.status, plannedAttendance: e.attendance };
    if (!isVerifiedEvent({ facts, team, published: true }, all, now)) {
      if (e.status !== "cancelled") pending++;
      continue;
    }
    if (excluded.has(e.id)) {
      excludedCount++;
      continue;
    }
    verified.push({ eventId: e.id, name: e.name, city: e.city, country: e.country, genres: e.genres, startAt: e.startAt, method: a.method ?? "qr" });
  }
  verified.sort((x, y) => y.startAt.localeCompare(x.startAt));
  return { verified, pending, excludedCount };
}

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export function placesOf(visits: VerifiedVisit[]) {
  const cities = new Map<string, { city: string; country: string; count: number }>();
  for (const v of visits) {
    const k = `${norm(v.city)}|${norm(v.country)}`;
    const c = cities.get(k) ?? { city: v.city, country: v.country, count: 0 };
    c.count++;
    cities.set(k, c);
  }
  const countries = new Set(visits.map((v) => norm(v.country)));
  return { cities: [...cities.values()].sort((a, b) => b.count - a.count), countryCount: countries.size };
}

// ------------------------------------------------------------------ FREAK ID

export async function freakId(uid: string) {
  const u = await auth().findUserById(uid);
  if (!u) throw err(401, "SIGN_IN_REQUIRED");
  const [alien, profile, { rules, scheduled }, att] = await Promise.all([auth().getAlien(uid), auth().getProfile(uid), currentRules(), attendanceOf(uid)]);
  const count = att.verified.length;
  const rank = rankFor(count, rules);
  const places = placesOf(att.verified);
  return {
    freakId: alien?.publicId ?? null,
    name: profile?.displayName || alien?.name || null,
    username: profile?.username ?? null,
    look: alien ? toLook(alien) : null,
    emailVerified: u.emailVerified,
    verifiedEvents: count,
    pendingEvents: att.pending,
    excludedEvents: att.excludedCount,
    rank: rank.rank,
    discountPct: effectiveDiscountPct(rank.rank, rules),
    fullDiscountPending: fullDiscountPending(rank.rank, rules),
    next: nextRankOf(count, rules),
    progress: progressOf(count, rules),
    cities: places.cities,
    cityCount: places.cities.length,
    countryCount: places.countryCount,
    history: att.verified.slice(0, 50),
    rules,
    scheduled,
  };
}

/** Price quote for a checkout. Always computed here (right before the order is stored), never trusted from the browser. */
export async function quote(uid: string | null, ticketsUsd: number) {
  if (!(ticketsUsd >= 0 && ticketsUsd <= 1_000_000)) throw err(400, "INVALID_AMOUNT");
  const { rules } = await currentRules();
  let count = 0;
  let signedIn = false;
  if (uid) {
    const u = await auth().findUserById(uid);
    // An unverified e-mail address keeps ROOKIE pricing: no benefits for unconfirmed accounts.
    if (u?.emailVerified) {
      signedIn = true;
      count = (await attendanceOf(uid)).verified.length;
    }
  }
  const rank: Rank = signedIn ? rankFor(count, rules).rank : "rookie";
  const b = feeBreakdown(ticketsUsd, rank, rules);
  const next = nextRankOf(count, rules);
  return {
    ...b,
    signedIn,
    verifiedEvents: count,
    // After this event is attended AND verified, how many more are needed for the next rank.
    afterThisEvent: next ? { rank: next.rank, remaining: Math.max(0, next.remaining - 1) } : null,
    quotedAt: nowIso(),
  };
}

// ------------------------------------------------------------------ admin

export async function assertAdmin(uid: string) {
  const u = await auth().findUserById(uid);
  const admins = (process.env.OPS_ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!u || !u.emailVerified || !admins.includes(u.email.toLowerCase())) throw err(403, "FORBIDDEN");
  return u;
}

async function audit(actorId: string, eventId: string | null, action: string, reason: string, meta: PartyAudit["meta"] = {}) {
  await store().insert<PartyAudit>("party_audit", { id: randomUUID(), eventId, actorId, action, reason, meta, at: nowIso() });
}

export async function adminOverview(uid: string) {
  await assertAdmin(uid);
  await ready();
  const d = await rulesDoc();
  // Rank distribution of real accounts with at least one check-in (DEMO attendees are left out; people with none are all ROOKIE).
  const users = new Set((await store().list<Attendance>("attendance")).filter((a) => !!a.checkedInAt && !isDemoUser(a.userId)).map((a) => a.userId));
  const dist: Record<Rank, number> = { rookie: 0, explorer: 0, raver: 0, elite: 0, legend: 0 };
  for (const u of users) dist[rankFor((await attendanceOf(u)).verified.length, d.rules).rank]++;
  const exclusions = await store().list<Exclusion>("loyalty_exclusions");
  const named = await Promise.all(exclusions.map(async (x) => ({ ...x, name: (await store().get<OpsEvent>("events", x.eventId))?.name ?? x.eventId })));
  const log = (await store().list<PartyAudit>("party_audit")).filter((a) => a.action.startsWith("loyalty_")).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 50);
  return { doc: d, distribution: dist, peopleWithCheckins: users.size, exclusions: named, log, noticeDays: NOTICE_DAYS };
}

export async function setRules(uid: string, next: LoyaltyRules, opts: { effectiveAt?: string | null; notice?: string; reason: string }) {
  await assertAdmin(uid);
  try {
    validateRules(next);
  } catch (e) {
    throw err(400, "INVALID_RULES", { rule: (e as Error).message });
  }
  if (opts.reason.trim().length < 5) throw err(400, "REASON_REQUIRED");
  const d = await rulesDoc();
  const rules: LoyaltyRules = { ...next, version: d.rules.version + 1 };
  const reduces = reducesBenefits(d.rules, rules);
  let doc: RulesDoc;
  if (reduces) {
    const at = opts.effectiveAt ? Date.parse(opts.effectiveAt) : NaN;
    if (!(opts.notice && opts.notice.trim().length >= 10)) throw err(400, "NOTICE_REQUIRED");
    if (!(at >= Date.now() + NOTICE_DAYS * 86_400_000 - 60_000)) throw err(400, "NOTICE_TOO_SHORT", { days: NOTICE_DAYS });
    doc = { ...d, scheduled: { rules, effectiveAt: new Date(at).toISOString(), notice: opts.notice.trim() }, updatedAt: nowIso(), updatedBy: uid, version: d.version + 1 };
  } else {
    doc = { ...d, rules, scheduled: d.scheduled, updatedAt: nowIso(), updatedBy: uid, version: d.version + 1 };
  }
  await store().put("loyalty_rules", doc, d.version ? d.version : undefined);
  await audit(uid, null, reduces ? "loyalty_rules_scheduled" : "loyalty_rules", opts.reason.trim(), { version: rules.version });
  return { doc: await rulesDoc(), scheduled: reduces };
}

export async function cancelScheduled(uid: string, reason: string) {
  await assertAdmin(uid);
  if (reason.trim().length < 5) throw err(400, "REASON_REQUIRED");
  const d = await rulesDoc();
  if (!d.scheduled) return { doc: d };
  await store().put("loyalty_rules", { ...d, scheduled: null, updatedAt: nowIso(), updatedBy: uid, version: d.version + 1 }, d.version ? d.version : undefined);
  await audit(uid, null, "loyalty_rules_cancel", reason.trim());
  return { doc: await rulesDoc() };
}

/** Leave an event out of every rank count after an audit (e.g. suspected fake event), or put it back. Always with a reason. */
export async function setExclusion(uid: string, eventId: string, exclude: boolean, reason: string) {
  await assertAdmin(uid);
  await ready();
  if (reason.trim().length < 5) throw err(400, "REASON_REQUIRED");
  if (!(await store().get<OpsEvent>("events", eventId))) throw err(404, "NOT_FOUND");
  if (exclude) await store().put<Exclusion>("loyalty_exclusions", { eventId, reason: reason.trim(), by: uid, at: nowIso() });
  else await store().remove("loyalty_exclusions", eventId);
  await audit(uid, eventId, exclude ? "loyalty_exclude" : "loyalty_restore", reason.trim());
  return { ok: true };
}

export { RANKS };
