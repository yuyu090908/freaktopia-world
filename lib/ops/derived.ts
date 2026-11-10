/**
 * Numbers and warnings derived from real event data (requirements, bookings, agreements, tasks, checks).
 * Pure functions: the service feeds them stored records; tests feed them fixtures.
 */
import { CATALOG_BY_KEY, BUDGET_CATEGORIES } from "./planner";
import type {
  Agreement, Application, Booking, BudgetCategory, BudgetLine, EventMember, Incident, Listing, OpsEvent, Payment, Requirement,
  ReqCategory, SafetyCheck, SafetyKey, ScheduleItem, Task,
} from "./types";
import { effectiveLevel } from "./types";

const t = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);
const overlap = (a0: string, a1: string, b0: string, b1: string) => t(a0) < t(b1) && t(b0) < t(a1);

// ------------------------------------------------------------------ requirement coverage

/** Real progress of one requirement: covered or confirmed = 1, held with an agreement under way = 0.5, otherwise 0. */
export function requirementProgress(r: Requirement, bookings: Booking[]) {
  if (r.status === "not_needed") return null;
  if (r.status === "covered") return 1;
  const mine = bookings.filter((b) => b.requirementIds.includes(r.id) && b.status !== "cancelled");
  const qty = (status: Booking["status"][]) => mine.filter((b) => status.includes(b.status)).reduce((a, b) => a + (b.items.find((i) => i.key === r.key)?.quantity ?? b.quantity), 0);
  const confirmed = Math.min(r.quantity, qty(["confirmed", "completed"]));
  const held = Math.min(r.quantity - confirmed, qty(["held"]));
  return (confirmed + 0.5 * held) / Math.max(1, r.quantity);
}

export function requirementStatus(r: Requirement, bookings: Booking[], openingsFor: Set<string>, proposedFor: Set<string>): Requirement["status"] {
  if (r.status === "not_needed" || r.status === "covered") return r.status;
  const p = requirementProgress(r, bookings) ?? 0;
  if (p >= 1) return "booked";
  if (p > 0 || proposedFor.has(r.id)) return "proposed";
  if (openingsFor.has(r.id)) return "recruiting";
  return "needed";
}

// ------------------------------------------------------------------ safety checks

export const SAFETY_KEYS: SafetyKey[] = ["contracts_complete", "equipment_secured", "staffing_confirmed", "venue_conditions", "permits_insurance", "safety_evacuation_plan", "emergency_contacts"];
export const AUTO_SAFETY: SafetyKey[] = ["contracts_complete", "equipment_secured", "staffing_confirmed"];

export function autoSafety(key: SafetyKey, reqs: Requirement[], bookings: Booking[], agreements: Agreement[]) {
  const live = reqs.filter((r) => r.status !== "not_needed" && r.status !== "covered" && r.kind !== "permit");
  if (key === "contracts_complete") {
    const agreedBookings = new Set(agreements.filter((a) => a.status === "agreed" || a.status === "completed").map((a) => a.bookingId));
    return live.every((r) => {
      const mine = bookings.filter((b) => b.requirementIds.includes(r.id) && b.status !== "cancelled");
      return mine.length > 0 && mine.every((b) => agreedBookings.has(b.id)) && (requirementProgress(r, bookings) ?? 0) >= 1;
    });
  }
  const kind = key === "equipment_secured" ? "equipment" : "crew";
  return live.filter((r) => r.kind === kind).every((r) => (requirementProgress(r, bookings) ?? 0) >= 1);
}

export function safetyView(checks: SafetyCheck[], reqs: Requirement[], bookings: Booking[], agreements: Agreement[]) {
  const rows = SAFETY_KEYS.map((key) => {
    const c = checks.find((x) => x.key === key);
    const auto = AUTO_SAFETY.includes(key);
    const met = auto ? autoSafety(key, reqs, bookings, agreements) : c?.status === "approved";
    return { key, auto, met, approvedBy: c?.approvedBy ?? null, approvedAt: c?.approvedAt ?? null, reference: c?.reference ?? "", dueAt: c?.dueAt ?? null };
  });
  const expertPending = reqs.filter((r) => r.safetyCritical && r.status !== "not_needed" && !r.expertConfirmation).map((r) => r.id);
  // "Approved" is separate from readiness: every manual check approved by a person AND every safety-critical
  // spec confirmed by a qualified professional. The platform never decides whether the event may go ahead.
  const approved = rows.every((r) => r.met) && expertPending.length === 0;
  return { rows, expertPending, approved };
}

// ------------------------------------------------------------------ readiness

export type ReadinessArea = "venue" | "djs" | "sound" | "lighting" | "staff" | "safety";
const AREA_OF: Record<ReqCategory, ReadinessArea | null> = { venue: "venue", dj: "djs", sound: "sound", lighting_video: "lighting", staff: "staff", safety: null };
const TASK_AREA: Record<string, ReadinessArea> = { operations: "venue", dj: "djs", sound: "sound", lighting: "lighting", safety: "safety" };

export function readiness(reqs: Requirement[], bookings: Booking[], tasks: Task[], safety: ReturnType<typeof safetyView>) {
  const areas: { area: ReadinessArea; pct: number; state: "done" | "in_progress" | "not_started" }[] = [];
  const order: ReadinessArea[] = ["venue", "djs", "sound", "lighting", "staff", "safety"];
  for (const area of order) {
    const parts: number[] = [];
    if (area === "safety") {
      const n = safety.rows.length + reqs.filter((r) => r.safetyCritical && r.status !== "not_needed").length;
      const done = safety.rows.filter((r) => r.met).length + reqs.filter((r) => r.safetyCritical && r.status !== "not_needed" && r.expertConfirmation).length;
      parts.push(n ? done / n : 1);
    } else {
      const rs = reqs.filter((r) => AREA_OF[r.category] === area && r.status !== "not_needed");
      if (rs.length) parts.push(rs.reduce((a, r) => a + (requirementProgress(r, bookings) ?? 0), 0) / rs.length);
    }
    const ts = tasks.filter((x) => TASK_AREA[x.area] === area);
    if (ts.length) parts.push(ts.filter((x) => x.status === "done").length / ts.length);
    if (!parts.length) continue;
    const pct = Math.round((100 * parts.reduce((a, b) => a + b, 0)) / parts.length);
    areas.push({ area, pct, state: pct >= 100 ? "done" : pct > 0 ? "in_progress" : "not_started" });
  }
  const overall = areas.length ? Math.round(areas.reduce((a, x) => a + x.pct, 0) / areas.length) : 0;
  return { overall, areas, safetyApproved: safety.approved };
}

// ------------------------------------------------------------------ budget

export interface BudgetRow {
  category: BudgetCategory;
  estimate: number;
  quoted: number;
  contracted: number;
  paid: number;
  overPct: number | null;
  safety: boolean;
}

export function budgetView(e: OpsEvent, lines: BudgetLine[], reqs: Requirement[], apps: Application[], bookings: Booking[], agreements: Agreement[], payments: Payment[]) {
  const catOfReq = new Map(reqs.map((r) => [r.id, CATALOG_BY_KEY.get(r.key)?.budget ?? "contingency"]));
  const rows: BudgetRow[] = BUDGET_CATEGORIES.map((category) => ({ category, estimate: lines.find((l) => l.category === category)?.estimateUsd ?? 0, quoted: 0, contracted: 0, paid: 0, overPct: null, safety: category === "safety_permits" || category === "staff_security" }));
  const row = (c: BudgetCategory) => rows.find((r) => r.category === c)!;
  const catOfApp = (ids: string[]) => catOfReq.get(ids[0] ?? "") ?? "contingency";
  // Quoted: the lowest open quote per requirement set (submitted or shortlisted), not the sum of every bid.
  const best = new Map<string, Application>();
  for (const a of apps.filter((a) => a.status === "submitted" || a.status === "shortlisted")) {
    const k = [...a.requirementIds].sort().join(",");
    if (!best.has(k) || best.get(k)!.priceUsd > a.priceUsd) best.set(k, a);
  }
  for (const a of best.values()) row(catOfApp(a.requirementIds)).quoted += a.priceUsd;
  const bookingReqs = new Map(bookings.map((b) => [b.id, b.requirementIds]));
  for (const ag of agreements.filter((a) => a.status !== "cancelled")) {
    const c = catOfApp(bookingReqs.get(ag.bookingId) ?? []);
    if (ag.status === "agreed" || ag.status === "completed" || ag.status === "changed") row(c).contracted += ag.terms.amountUsd;
    else row(c).quoted += ag.terms.amountUsd; // proposed, not yet agreed by both sides
    row(c).paid += payments.filter((p) => p.agreementId === ag.id).reduce((a, p) => a + p.amountUsd, 0);
  }
  for (const r of rows) {
    const committed = r.contracted + r.quoted;
    r.overPct = r.estimate > 0 && committed > r.estimate ? Math.round(((committed - r.estimate) / r.estimate) * 100) : r.estimate === 0 && committed > 0 ? 100 : null;
  }
  const contracted = rows.reduce((a, r) => a + r.contracted, 0);
  const paid = rows.reduce((a, r) => a + r.paid, 0);
  return { total: e.budgetUsd, rows, contracted, paid, quoted: rows.reduce((a, r) => a + r.quoted, 0), remaining: e.budgetUsd - contracted };
}

// ------------------------------------------------------------------ conflict detection

export type ConflictKind = "double_booking" | "provider_double_booked" | "dj_set_overlap" | "load_in_late" | "power_unconfirmed" | "sound_venue_mismatch" | "key_role_missing" | "permit_overdue";
export interface Conflict {
  kind: ConflictKind;
  severity: "warning" | "critical";
  ref: string | null;
  /** Translation values for the message. */
  values: Record<string, string | number>;
}

export function detectConflicts(input: {
  event: OpsEvent;
  reqs: Requirement[];
  bookings: Booking[]; // this event's
  otherBookings: Booking[]; // other events' bookings of the same listings/providers
  listings: Listing[];
  schedule: ScheduleItem[];
  safety: SafetyCheck[];
  now?: number;
}): Conflict[] {
  const { event, reqs, bookings, otherBookings, listings, schedule, safety } = input;
  const now = input.now ?? Date.now();
  const out: Conflict[] = [];
  const active = (b: Booking) => b.status === "held" || b.status === "confirmed";
  const byId = new Map(listings.map((l) => [l.id, l]));

  // 1. The same gear booked beyond its quantity at the same time (should be prevented at booking; checked again here).
  for (const b of bookings.filter(active)) {
    const l = byId.get(b.listingId);
    if (!l) continue;
    for (const it of b.items) {
      const total = l.items.filter((i) => i.key === it.key).reduce((a, i) => a + i.quantity, 0);
      const used = [...bookings, ...otherBookings].filter((x) => x.listingId === l.id && active(x) && overlap(x.startAt, x.endAt, b.startAt, b.endAt)).reduce((a, x) => a + (x.items.find((i) => i.key === it.key)?.quantity ?? 0), 0);
      if (used > total) out.push({ kind: "double_booking", severity: "critical", ref: b.id, values: { listing: l.title } });
    }
  }
  // 2. A person booked for overlapping times at two events (through different listings).
  for (const b of bookings.filter(active)) {
    const l = byId.get(b.listingId);
    if (!l || (l.type !== "person")) continue;
    const clash = otherBookings.find((x) => x.providerId === b.providerId && active(x) && x.eventId !== event.id && byId.get(x.listingId)?.type === "person" && overlap(x.startAt, x.endAt, b.startAt, b.endAt));
    if (clash) out.push({ kind: "provider_double_booked", severity: "critical", ref: b.id, values: { listing: l.title } });
  }
  // 3. DJ set times overlapping (same performer, or any overlap on a single-stage event).
  const sets = schedule.filter((s) => s.kind === "set").sort((a, b) => t(a.startAt) - t(b.startAt));
  const singleStage = effectiveLevel(event) < 5;
  for (let i = 0; i < sets.length; i++)
    for (let j = i + 1; j < sets.length; j++) {
      const a = sets[i];
      const b = sets[j];
      if (!overlap(a.startAt, a.endAt, b.startAt, b.endAt)) continue;
      if (singleStage || (a.listingId && a.listingId === b.listingId)) out.push({ kind: "dj_set_overlap", severity: a.listingId && a.listingId === b.listingId ? "critical" : "warning", ref: b.id, values: { a: byId.get(a.listingId ?? "")?.title ?? "—", b: byId.get(b.listingId ?? "")?.title ?? "—" } });
    }
  // 4. Load-in finishing after doors.
  const loadIn = schedule.find((s) => s.kind === "load_in");
  const doors = schedule.find((s) => s.kind === "doors");
  if (loadIn && doors && t(loadIn.endAt) > t(doors.startAt)) out.push({ kind: "load_in_late", severity: "critical", ref: loadIn.id, values: {} });
  // 5. Power needed but capacity not confirmed by a qualified person.
  const power = reqs.find((r) => r.key === "power_generator" && r.status !== "not_needed");
  if (power && !power.expertConfirmation) out.push({ kind: "power_unconfirmed", severity: "warning", ref: power.id, values: {} });
  // 6. Sound system booked for a smaller audience than expected.
  for (const r of reqs.filter((r) => r.key === "main_pa"))
    for (const b of bookings.filter((b) => active(b) && b.requirementIds.includes(r.id))) {
      const l = byId.get(b.listingId);
      if (l && l.maxAudience < event.attendance) out.push({ kind: "sound_venue_mismatch", severity: "warning", ref: b.id, values: { listing: l.title, max: l.maxAudience, attendance: event.attendance } });
    }
  // 7. Key people missing (only within 14 days of the event, so early planning isn't flooded).
  if (t(event.startAt) - now < 14 * 86_400_000)
    for (const key of ["event_director", "stage_manager", "security_staff", "medic"]) {
      const r = reqs.find((x) => x.key === key && x.status !== "not_needed");
      if (r && (requirementProgress(r, bookings) ?? 0) < 1) out.push({ kind: "key_role_missing", severity: "critical", ref: r.id, values: { role: key } });
    }
  // 8. Permits / plans past their check date.
  for (const c of safety.filter((c) => c.dueAt && c.status !== "approved" && t(c.dueAt) < now)) out.push({ kind: "permit_overdue", severity: "critical", ref: c.key, values: { check: c.key } });
  return out;
}

export const roleRank: Record<EventMember["role"], number> = { owner: 5, manager: 4, lead: 3, staff: 2, vendor: 1 };

export function incidentNeedsReplacement(i: Incident) {
  return i.status !== "resolved" && (i.type === "staff_shortage" || i.type === "cancellation" || i.type === "equipment_failure") && !!i.requirementId;
}
