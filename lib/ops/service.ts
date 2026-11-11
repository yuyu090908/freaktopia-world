/**
 * Event operations service: the only place that changes ops data. Every function takes the acting user id
 * and checks event membership and role first (lib/ops/permissions.ts). Contracts, bookings, payments and
 * safety approvals require an explicit `confirm: true` from the person acting; nothing is signed, booked,
 * paid or approved automatically. Suggestions (planner, matching, alternatives, replacements) never act
 * on their own.
 */
import { randomUUID } from "node:crypto";
import { getStore as getAuthStore } from "@/lib/auth/store";
import { findCity } from "./geo";
import { rankCandidates } from "./matching";
import { budgetSplit, CATALOG_BY_KEY, levelFor, planRequirements, quantities, scheduleTemplate, TASK_TEMPLATES, TEMPLATE_BY_ID } from "./planner";
import { budgetView, detectConflicts, readiness, requirementStatus, safetyView, SAFETY_KEYS, AUTO_SAFETY, incidentNeedsReplacement } from "./derived";
import { can, canEditTask, canOpenDocument, canReadThread, type OpsAction } from "./permissions";
import { getOpsStore } from "./store";
import { ensureDemoSeed } from "./seed";
import {
  OpsError, effectiveLevel,
  type Agreement, type AgreementTerms, type Application, type Area, type Booking, type BudgetCategory, type BudgetLine, type DocAudience, type DocKind,
  type DocumentMeta, type EventMember, type Handover, type Incident, type IncidentType, type Listing, type ListingItem, type ListingType, type MemberRole,
  type Message, type Notification, type Opening, type OpeningKind, type OpsEvent, type Organization, type Payment, type ProviderRole, type Requirement,
  type Review, type SafetyCheck, type SafetyKey, type ScaleLevel, type ScheduleItem, type ScheduleKind, type Setting, type Severity, type Task,
  type TaskStatus, type TemplateId, type WorkProfile,
} from "./types";

const store = () => getOpsStore();
const id = () => randomUUID();
const nowIso = () => new Date().toISOString();
const deny = (code = "FORBIDDEN") => new OpsError(403, code);
const notFound = () => new OpsError(404, "NOT_FOUND");

async function ready() {
  if (store().kind === "memory") await ensureDemoSeed(store());
}

// ------------------------------------------------------------------ accounts

async function verifiedUser(uid: string) {
  const u = await getAuthStore().findUserById(uid);
  if (!u) throw new OpsError(401, "SIGN_IN_REQUIRED");
  if (!u.emailVerified) throw new OpsError(403, "EMAIL_NOT_VERIFIED");
  return u;
}

export async function displayNameOf(uid: string) {
  const [wp, prof, alien] = await Promise.all([store().get<WorkProfile>("profiles", uid), getAuthStore().getProfile(uid).catch(() => null), getAuthStore().getAlien(uid).catch(() => null)]);
  return wp?.displayName || prof?.displayName || alien?.name || "—";
}

async function notify(userId: string, eventId: string | null, key: string, values: Record<string, string | number>, dedupeKey: string) {
  const n: Notification = { id: id(), userId, eventId, key, values, dedupeKey, read: false, at: nowIso() };
  return store().notifyOnce(n);
}

async function managersOf(eventId: string) {
  return (await store().list<EventMember>("members", { eventId })).filter((m) => m.role === "owner" || m.role === "manager");
}

// ------------------------------------------------------------------ membership

async function memberOf(eventId: string, uid: string) {
  return store().get<EventMember>("members", `${eventId}:${uid}`);
}

async function access(eventId: string, uid: string, action: OpsAction = "read_event") {
  await ready();
  const [event, member] = await Promise.all([store().get<OpsEvent>("events", eventId), memberOf(eventId, uid)]);
  if (!event || !member) throw notFound(); // never reveal that a private event exists
  if (!can(member, action)) throw deny();
  return { event, member };
}

// ------------------------------------------------------------------ work profiles, organizations, listings

export interface WorkProfileInput {
  roles?: ProviderRole[];
  displayName?: string;
  regions?: string[];
  services?: string[];
  bio?: string;
  maxEventSize?: number;
  pastWork?: string[];
  credentials?: string[];
}

export async function getWorkProfile(uid: string) {
  await ready();
  return store().get<WorkProfile>("profiles", uid);
}

export async function saveWorkProfile(uid: string, input: WorkProfileInput) {
  await ready();
  await verifiedUser(uid);
  const cur = await store().get<WorkProfile>("profiles", uid);
  const base: WorkProfile = cur ?? { userId: uid, roles: ["attendee"], displayName: await displayNameOf(uid), regions: [], services: [], bio: "", maxEventSize: 0, pastWork: [], identity: "unverified", business: "unverified", credentials: [], organizationId: null, demo: false, updatedAt: nowIso() };
  const next: WorkProfile = { ...base, ...Object.fromEntries(Object.entries(input).filter(([k]) => k !== "credentials")), updatedAt: nowIso() } as WorkProfile;
  if (input.services) next.services = input.services.filter((k) => CATALOG_BY_KEY.has(k));
  if (input.credentials) {
    // Self-declared credentials start as pending; only a platform reviewer (OPS_ADMIN_EMAILS) can mark them verified.
    next.credentials = input.credentials.map((key) => base.credentials.find((c) => c.key === key) ?? { key, status: "pending" as const });
  }
  next.identity = base.identity;
  next.business = base.business;
  await store().put("profiles", next);
  return next;
}

/** Platform reviewer only (accounts listed in OPS_ADMIN_EMAILS). */
export async function verifyCredential(adminUid: string, userId: string, key: string, status: "verified" | "unverified") {
  const admin = await verifiedUser(adminUid);
  const allowed = (process.env.OPS_ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!allowed.includes(admin.email.toLowerCase())) throw deny();
  const p = await store().get<WorkProfile>("profiles", userId);
  if (!p) throw notFound();
  p.credentials = p.credentials.filter((c) => c.key !== key).concat({ key, status });
  await store().put("profiles", p);
  return p;
}

export async function createOrganization(uid: string, input: { name: string; kind: string }) {
  await ready();
  await verifiedUser(uid);
  const org: Organization = { id: id(), ownerId: uid, name: input.name, kind: input.kind, verification: "unverified", demo: false };
  await store().insert("organizations", org);
  const wp = await saveWorkProfile(uid, {});
  if (!wp.roles.includes("company")) wp.roles.push("company");
  wp.organizationId = org.id;
  await store().put("profiles", wp);
  return org;
}

export interface ListingInput {
  type: ListingType;
  title: string;
  items: ListingItem[];
  city: string;
  priceUsd: number;
  deposit?: number;
  insurance?: string;
  damageTerms?: string;
  delivery?: boolean;
  setup?: boolean;
  operatorIncluded?: boolean;
  maxAudience?: number;
  availability?: { from: string; to: string }[];
  photoIds?: string[];
  active?: boolean;
}

function listingFrom(uid: string, orgId: string | null, input: ListingInput, base?: Listing): Listing {
  const city = findCity(input.city);
  if (!city) throw new OpsError(400, "UNKNOWN_CITY");
  const items = input.items.filter((i) => CATALOG_BY_KEY.has(i.key) && i.quantity > 0);
  if (!items.length) throw new OpsError(400, "NO_ITEMS");
  return {
    id: base?.id ?? id(), ownerId: uid, organizationId: base?.organizationId ?? orgId, type: input.type, title: input.title, items,
    city: city.name, country: city.country, lat: city.lat, lng: city.lng, priceUsd: input.priceUsd, deposit: input.deposit ?? 0,
    insurance: input.insurance ?? "", damageTerms: input.damageTerms ?? "", delivery: !!input.delivery, setup: !!input.setup,
    operatorIncluded: !!input.operatorIncluded, maxAudience: input.maxAudience ?? 100, photoIds: input.photoIds ?? base?.photoIds ?? [],
    availability: input.availability ?? [], active: input.active ?? true, demo: false, createdAt: base?.createdAt ?? nowIso(),
  };
}

export async function createListing(uid: string, input: ListingInput) {
  await ready();
  await verifiedUser(uid);
  const wp = await saveWorkProfile(uid, {});
  const l = listingFrom(uid, wp.organizationId, input);
  await store().insert("listings", l);
  const role: ProviderRole = l.type === "equipment" ? "equipment_owner" : l.type === "company" || l.type === "package" ? "company" : "staff";
  if (!wp.roles.includes(role)) await saveWorkProfile(uid, { roles: [...wp.roles, role] });
  return l;
}

export async function updateListing(uid: string, listingId: string, input: ListingInput) {
  await ready();
  const cur = await store().get<Listing>("listings", listingId);
  if (!cur || cur.ownerId !== uid) throw notFound();
  const next = listingFrom(uid, cur.organizationId, input, cur);
  await store().put("listings", next);
  return next;
}

export async function myListings(uid: string) {
  await ready();
  return store().list<Listing>("listings", { ownerId: uid });
}

export async function publicListing(listingId: string) {
  await ready();
  const l = await store().get<Listing>("listings", listingId);
  if (!l || !l.active) throw notFound();
  return l;
}

/** Public trust view: verification states and work reviews (separate from popularity rankings). */
export async function providerTrust(userId: string) {
  await ready();
  const [wp, reviews, agreements] = await Promise.all([store().get<WorkProfile>("profiles", userId), store().list<Review>("reviews", { rateeId: userId }), store().list<Agreement>("agreements", { providerId: userId })]);
  const avg = (k: keyof Review["scores"]) => (reviews.length ? Math.round((reviews.reduce((a, r) => a + r.scores[k], 0) / reviews.length) * 10) / 10 : null);
  return {
    profile: wp ? { displayName: wp.displayName, roles: wp.roles, regions: wp.regions, services: wp.services, bio: wp.bio, maxEventSize: wp.maxEventSize, pastWork: wp.pastWork, identity: wp.identity, business: wp.business, credentials: wp.credentials, demo: wp.demo } : null,
    reviews: { count: reviews.length, overall: avg("overall"), punctuality: avg("punctuality"), communication: avg("communication"), delivery: avg("delivery"), quality: avg("quality") },
    completedJobs: agreements.filter((a) => a.status === "completed").length,
  };
}

// ------------------------------------------------------------------ events

export interface EventInput {
  name: string;
  city: string;
  venueName: string;
  setting: Setting;
  startAt: string;
  endAt: string;
  genres: string[];
  attendance: number;
  budgetUsd: number;
  ticketing: boolean;
  djs: boolean;
  streaming: boolean;
  templateId: TemplateId;
  ownedEquipment: string[];
  venueFacilities: string[];
  services: string[];
  levelOverride?: ScaleLevel | null;
}

function validTimes(startAt: string, endAt: string) {
  const s = Date.parse(startAt);
  const e = Date.parse(endAt);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) throw new OpsError(400, "INVALID_TIMES");
  if (e - s > 7 * 86_400_000) throw new OpsError(400, "EVENT_TOO_LONG");
}

export async function createEvent(uid: string, input: EventInput) {
  await ready();
  await verifiedUser(uid);
  validTimes(input.startAt, input.endAt);
  if (!TEMPLATE_BY_ID.has(input.templateId)) throw new OpsError(400, "UNKNOWN_TEMPLATE");
  const city = findCity(input.city);
  const t = nowIso();
  const e: OpsEvent = {
    id: id(), ownerId: uid, name: input.name, country: city?.country ?? "", city: city?.name ?? input.city, lat: city?.lat ?? null, lng: city?.lng ?? null,
    venueName: input.venueName, setting: input.setting, startAt: new Date(input.startAt).toISOString(), endAt: new Date(input.endAt).toISOString(),
    timezone: city?.tz ?? "UTC", genres: input.genres.slice(0, 5), attendance: Math.max(1, Math.floor(input.attendance)), autoLevel: levelFor(input.attendance),
    levelOverride: input.levelOverride ?? null, budgetUsd: Math.max(0, input.budgetUsd), ticketing: input.ticketing, djs: input.djs, streaming: input.streaming,
    templateId: input.templateId, ownedEquipment: input.ownedEquipment.filter((k) => CATALOG_BY_KEY.has(k)), venueFacilities: input.venueFacilities.filter((k) => CATALOG_BY_KEY.has(k)),
    services: input.services.filter((k) => CATALOG_BY_KEY.has(k)), status: "planning", publicEventId: null, createdAt: t, updatedAt: t, version: 0,
  };
  await store().insert("events", e);
  const level = effectiveLevel(e);
  await store().insert<EventMember>("members", { eventId: e.id, userId: uid, role: "owner", area: "general", displayName: await displayNameOf(uid), addedAt: t });
  for (const r of planRequirements({ ...e, level }, id)) await store().insert("requirements", r);
  const split = budgetSplit(e.budgetUsd, level, e.djs);
  for (const [category, estimateUsd] of Object.entries(split)) await store().put<BudgetLine>("budget", { eventId: e.id, category: category as BudgetCategory, estimateUsd });
  const start = Date.parse(e.startAt);
  for (const key of SAFETY_KEYS) {
    const due = key === "permits_insurance" ? 30 : key === "safety_evacuation_plan" ? 21 : key === "emergency_contacts" ? 3 : key === "venue_conditions" ? 14 : 7;
    await store().put<SafetyCheck>("safety", { eventId: e.id, key, auto: AUTO_SAFETY.includes(key), status: "open", approvedBy: null, approvedAt: null, reference: "", dueAt: new Date(start - due * 86_400_000).toISOString() });
  }
  const reqs = await store().list<Requirement>("requirements", { eventId: e.id });
  for (const tt of TASK_TEMPLATES.filter((x) => x.when({ ...e, level }))) {
    await store().insert<Task>("tasks", {
      id: id(), eventId: e.id, title: "", templateKey: tt.key, area: tt.area, assigneeId: null, dueAt: new Date(start - tt.daysBefore * 86_400_000).toISOString(),
      status: "todo", requirementId: reqs.find((r) => r.key === tt.requirementKey)?.id ?? null, createdBy: uid, updatedAt: t,
    });
  }
  for (const s of scheduleTemplate({ ...e, level })) await store().insert<ScheduleItem>("schedule", { id: id(), eventId: e.id, ...s, listingId: null, note: "" });
  await notify(uid, e.id, "notif.eventCreated", { name: e.name }, `event-created:${e.id}`);
  return e;
}

const REPLAN_FIELDS: (keyof EventInput)[] = ["attendance", "setting", "djs", "streaming", "ticketing", "templateId", "ownedEquipment", "venueFacilities", "services", "levelOverride", "budgetUsd"];

/** Edits the event. Changing size or features re-plans requirements without touching anything booked or confirmed. */
export async function updateEvent(uid: string, eventId: string, patch: Partial<EventInput>, expectedVersion: number) {
  const { event } = await access(eventId, uid, "edit_event");
  const next: OpsEvent = { ...event, ...patch, updatedAt: nowIso(), version: event.version + 1 } as OpsEvent;
  if (patch.startAt || patch.endAt) validTimes(next.startAt, next.endAt);
  if (patch.city) {
    const c = findCity(patch.city);
    Object.assign(next, { city: c?.name ?? patch.city, country: c?.country ?? "", lat: c?.lat ?? null, lng: c?.lng ?? null, timezone: c?.tz ?? "UTC" });
  }
  next.autoLevel = levelFor(next.attendance);
  await store().put("events", next, expectedVersion);
  if (REPLAN_FIELDS.some((f) => f in patch)) await replan(next);
  return next;
}

async function replan(e: OpsEvent) {
  const level = effectiveLevel(e);
  const q = quantities({ ...e, level });
  const reqs = await store().list<Requirement>("requirements", { eventId: e.id });
  const bookings = await store().list<Booking>("bookings", { eventId: e.id });
  const touched = new Set(bookings.filter((b) => b.status !== "cancelled").flatMap((b) => b.requirementIds));
  for (const r of reqs) {
    if (r.source === "organizer" || touched.has(r.id) || r.expertConfirmation) continue;
    const n = q[r.key] ?? 0;
    const coveredBy = e.ownedEquipment.includes(r.key) ? "owner" : e.venueFacilities.includes(r.key) ? "venue" : null;
    // Safety-critical items are never dropped automatically.
    const status: Requirement["status"] = n <= 0 && !r.safetyCritical ? "not_needed" : coveredBy ? "covered" : r.status === "covered" || r.status === "not_needed" ? "needed" : r.status;
    await store().put("requirements", { ...r, quantity: n > 0 ? n : r.quantity, coveredBy, status });
  }
  const have = new Set(reqs.map((r) => r.key));
  for (const r of planRequirements({ ...e, level }, id)) if (!have.has(r.key)) await store().insert("requirements", r);
  const lines = await store().list<BudgetLine>("budget", { eventId: e.id });
  const split = budgetSplit(e.budgetUsd, level, e.djs);
  for (const l of lines) await store().put("budget", { ...l, estimateUsd: split[l.category] });
}

export async function myEvents(uid: string) {
  await ready();
  const ms = await store().list<EventMember>("members", { userId: uid });
  const out = [];
  for (const m of ms) {
    const e = await store().get<OpsEvent>("events", m.eventId);
    if (e) out.push({ event: e, role: m.role, level: effectiveLevel(e) });
  }
  return out.sort((a, b) => Date.parse(a.event.startAt) - Date.parse(b.event.startAt));
}

// ------------------------------------------------------------------ the management view (role-filtered)

export async function eventView(uid: string, eventId: string) {
  const { event, member } = await access(eventId, uid);
  const s = store();
  const [reqs, openings, apps, bookings, agreements, members, tasks, docs, schedule, lines, payments, checks, incidents, handovers, reviews] = await Promise.all([
    s.list<Requirement>("requirements", { eventId }), s.list<Opening>("openings", { eventId }), s.list<Application>("applications", { eventId }),
    s.list<Booking>("bookings", { eventId }), s.list<Agreement>("agreements", { eventId }), s.list<EventMember>("members", { eventId }),
    s.list<Task>("tasks", { eventId }), s.list<DocumentMeta>("documents", { eventId }), s.list<ScheduleItem>("schedule", { eventId }),
    s.list<BudgetLine>("budget", { eventId }), s.list<Payment>("payments", { eventId }), s.list<SafetyCheck>("safety", { eventId }),
    s.list<Incident>("incidents", { eventId }), s.list<Handover>("handovers", { eventId }), s.list<Review>("reviews", { eventId }),
  ]);
  const listingIds = [...new Set(bookings.map((b) => b.listingId).concat(apps.map((a) => a.listingId ?? "").filter(Boolean)).concat(openings.map((o) => o.targetListingId ?? "").filter(Boolean)))];
  const listings = (await Promise.all(listingIds.map((lid) => s.get<Listing>("listings", lid)))).filter((l): l is Listing => !!l);
  const otherBookings = (await Promise.all(listings.map((l) => s.list<Booking>("bookings", { listingId: l.id })))).flat().filter((b) => b.eventId !== eventId);
  const providerBookings = (await Promise.all([...new Set(bookings.map((b) => b.providerId))].map((p) => s.list<Booking>("bookings", { providerId: p })))).flat().filter((b) => b.eventId !== eventId);
  const otherListings = (await Promise.all([...new Set(providerBookings.map((b) => b.listingId))].filter((x) => !listingIds.includes(x)).map((lid) => s.get<Listing>("listings", lid)))).filter((l): l is Listing => !!l);
  const openFor = new Set(openings.filter((o) => o.status === "open").flatMap((o) => o.requirementIds));
  const proposedFor = new Set(apps.filter((a) => a.status === "submitted" || a.status === "shortlisted").flatMap((a) => a.requirementIds));
  const reqsLive = reqs.map((r) => ({ ...r, status: requirementStatus(r, bookings, openFor, proposedFor) }));
  const safety = safetyView(checks, reqsLive, bookings, agreements);
  const ready_ = readiness(reqsLive, bookings, tasks, safety);
  const conflicts = detectConflicts({ event, reqs: reqsLive, bookings, otherBookings: [...otherBookings, ...providerBookings], listings: [...listings, ...otherListings], schedule, safety: checks });
  const money = can(member, "read_budget");
  const mineOnly = !can(member, "read_applications");
  const myBookingIds = new Set(bookings.filter((b) => b.providerId === uid).map((b) => b.id));
  return {
    event: money ? event : { ...event, budgetUsd: null },
    level: effectiveLevel(event),
    me: { userId: uid, role: member.role, area: member.area, can: Object.fromEntries((["edit_event", "manage_members", "manage_managers", "edit_requirements", "recruit", "decide_applications", "read_budget", "edit_budget", "record_payment", "sign_agreement", "approve_safety", "confirm_expert", "manage_incidents", "edit_schedule", "manage_all_tasks", "upload_documents", "record_handover"] as OpsAction[]).map((a) => [a, can(member, a)])) },
    readiness: ready_,
    safety,
    conflicts: money || member.role === "lead" ? conflicts : [],
    requirements: can(member, "read_requirements") ? reqsLive : reqsLive.filter((r) => bookings.some((b) => myBookingIds.has(b.id) && b.requirementIds.includes(r.id))),
    /** What an incident can point at: names only (no quantities, specs or money), for anyone who may report. */
    incidentTargets: can(member, "report_incident") ? reqsLive.map((r) => ({ id: r.id, key: r.key })) : [],
    openings: can(member, "recruit") ? openings : [],
    applications: mineOnly ? apps.filter((a) => a.applicantId === uid) : apps,
    bookings: mineOnly ? bookings.filter((b) => b.providerId === uid) : bookings,
    agreements: money ? agreements : agreements.filter((a) => a.providerId === uid),
    listings,
    members,
    tasks,
    documents: docs.filter((d) => canOpenDocument(member, d.audience)),
    schedule: schedule.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt)),
    budget: money ? budgetView(event, lines, reqsLive, apps, bookings, agreements, payments) : null,
    payments: money ? payments : [],
    incidents,
    handovers: can(member, "record_handover") && member.role !== "vendor" ? handovers : handovers.filter((h) => myBookingIds.has(h.bookingId)),
    reviews: reviews.filter((r) => r.raterId === uid || r.rateeId === uid),
    threads: (["general", "sound", "lighting", "operations", "dj", "safety"] as Area[]).filter((a) => canReadThread(member, a)),
  };
}

// ------------------------------------------------------------------ requirements

export async function updateRequirement(uid: string, eventId: string, reqId: string, patch: { quantity?: number; note?: string; notNeeded?: boolean; expertName?: string }) {
  const { member } = await access(eventId, uid, "edit_requirements");
  const r = await store().get<Requirement>("requirements", reqId);
  if (!r || r.eventId !== eventId) throw notFound();
  const next = { ...r };
  if (patch.note != null) next.note = patch.note;
  if (patch.notNeeded != null) {
    if (patch.notNeeded && r.safetyCritical) throw new OpsError(400, "SAFETY_ITEM_REQUIRED");
    next.status = patch.notNeeded ? "not_needed" : "needed";
  }
  if (patch.quantity != null) {
    // Lowering a safety-critical quantity below the planner's guide needs a named qualified person.
    if (r.safetyCritical && patch.quantity < r.quantity && !patch.expertName?.trim()) throw new OpsError(400, "EXPERT_CONFIRMATION_REQUIRED");
    next.quantity = Math.max(1, Math.floor(patch.quantity));
  }
  if (patch.expertName?.trim()) {
    if (!can(member, "confirm_expert")) throw deny();
    next.expertConfirmation = { by: patch.expertName.trim().slice(0, 120), at: nowIso() };
  }
  await store().put("requirements", next);
  return next;
}

export async function addRequirement(uid: string, eventId: string, key: string, quantity: number) {
  await access(eventId, uid, "edit_requirements");
  const c = CATALOG_BY_KEY.get(key);
  if (!c) throw new OpsError(400, "UNKNOWN_REQUIREMENT");
  const r: Requirement = { id: id(), eventId, key, category: c.category, kind: c.kind, quantity: Math.max(1, Math.floor(quantity)), unit: c.unit, safetyCritical: !!c.safetyCritical, credential: c.credential ?? null, source: "organizer", status: "needed", coveredBy: null, note: "", expertConfirmation: null };
  await store().insert("requirements", r);
  return r;
}

// ------------------------------------------------------------------ matching

async function matchContext(listings: Listing[]) {
  const s = store();
  const bookings = (await Promise.all(listings.map((l) => s.list<Booking>("bookings", { listingId: l.id })))).flat();
  const owners = [...new Set(listings.map((l) => l.ownerId))];
  const profiles = new Map((await Promise.all(owners.map((o) => s.get<WorkProfile>("profiles", o)))).filter((p): p is WorkProfile => !!p).map((p) => [p.userId, p]));
  const reviews = (await Promise.all(owners.map((o) => s.list<Review>("reviews", { rateeId: o })))).flat();
  return { bookings, profiles, reviews };
}

export async function candidates(uid: string, eventId: string, reqId: string, excludeProviders: string[] = []) {
  const { event } = await access(eventId, uid, "recruit");
  const r = await store().get<Requirement>("requirements", reqId);
  if (!r || r.eventId !== eventId) throw notFound();
  const all = (await store().list<Listing>("listings", {})).filter((l) => l.items.some((i) => i.key === r.key) && !excludeProviders.includes(l.ownerId) && l.ownerId !== uid);
  const ctx = await matchContext(all);
  const line = await store().get<BudgetLine>("budget", `${eventId}:${CATALOG_BY_KEY.get(r.key)?.budget ?? "contingency"}`);
  const res = rankCandidates(event, r, all, { ...ctx, budgetUsd: line?.estimateUsd ?? null });
  const view = (m: (typeof res.eligible)[number]) => ({ listing: m.listing, score: m.score, parts: m.parts, freeQuantity: m.freeQuantity, distanceKm: m.distanceKm, rating: m.rating, excluded: m.excluded, verified: ctx.profiles.get(m.listing.ownerId)?.credentials ?? [], providerName: ctx.profiles.get(m.listing.ownerId)?.displayName ?? null });
  return { requirement: r, eligible: res.eligible.slice(0, 12).map(view), excluded: res.excluded.slice(0, 12).map(view) };
}

// ------------------------------------------------------------------ recruiting

export async function createOpening(uid: string, eventId: string, input: { kind: OpeningKind; requirementIds: string[]; targetListingId?: string | null; slots?: number; budgetUsd?: number | null; message?: string }) {
  const { event } = await access(eventId, uid, "recruit");
  const reqs = await store().list<Requirement>("requirements", { eventId });
  const ids = input.requirementIds.filter((x) => reqs.some((r) => r.id === x));
  if (!ids.length) throw new OpsError(400, "NO_REQUIREMENTS");
  let target: Listing | null = null;
  if (input.kind !== "open") {
    target = input.targetListingId ? await store().get<Listing>("listings", input.targetListingId) : null;
    if (!target || !target.active) throw new OpsError(400, "UNKNOWN_LISTING");
    if (target.ownerId === uid) throw new OpsError(400, "OWN_LISTING");
  }
  const o: Opening = { id: id(), eventId, kind: input.kind, requirementIds: ids, targetListingId: target?.id ?? null, slots: Math.max(1, input.slots ?? 1), budgetUsd: input.budgetUsd ?? null, message: (input.message ?? "").slice(0, 2000), status: "open", createdBy: uid, createdAt: nowIso() };
  await store().insert("openings", o);
  if (target) await notify(target.ownerId, null, input.kind === "quote" ? "notif.quoteRequested" : "notif.offerReceived", { event: event.name }, `opening:${o.id}`);
  if (event.status === "planning") await store().put("events", { ...event, status: "recruiting", version: event.version + 1 });
  return o;
}

/** What a provider can see and apply to: open calls, and offers / quote requests sent to their listings. */
export async function opportunities(uid: string) {
  await ready();
  const mine = await store().list<Listing>("listings", { ownerId: uid });
  const myIds = new Set(mine.map((l) => l.id));
  const all = (await store().list<Opening>("openings", {})).filter((o) => o.status === "open" && (o.kind === "open" || (o.targetListingId && myIds.has(o.targetListingId))));
  const out = [];
  for (const o of all) {
    const e = await store().get<OpsEvent>("events", o.eventId);
    if (!e || e.ownerId === uid || e.status === "cancelled") continue;
    const reqs = (await store().list<Requirement>("requirements", { eventId: e.id })).filter((r) => o.requirementIds.includes(r.id));
    const applied = (await store().list<Application>("applications", { openingId: o.id, applicantId: uid })).find((a) => a.status !== "withdrawn");
    out.push({
      opening: o,
      // Only what a provider needs to decide: no budget lines, members or internal notes.
      event: { id: e.id, name: e.name, city: e.city, country: e.country, startAt: e.startAt, endAt: e.endAt, timezone: e.timezone, attendance: e.attendance, level: effectiveLevel(e), setting: e.setting },
      requirements: reqs.map((r) => ({ id: r.id, key: r.key, quantity: r.quantity, unit: r.unit, credential: r.credential })),
      myApplication: applied ?? null,
    });
  }
  return out;
}

export interface ApplyInput {
  listingId: string;
  requirementIds?: string[];
  priceUsd: number;
  items?: ListingItem[];
  portfolio?: string;
  availableFrom?: string | null;
  availableTo?: string | null;
  message?: string;
  quoteDocumentId?: string | null;
  /** DJ ARENA tracks to attach (own, reviewed, not private). */
  trackIds?: string[];
}

export async function apply(uid: string, openingId: string, input: ApplyInput) {
  await ready();
  await verifiedUser(uid);
  const o = await store().get<Opening>("openings", openingId);
  if (!o || o.status !== "open") throw notFound();
  const e = await store().get<OpsEvent>("events", o.eventId);
  if (!e) throw notFound();
  if (e.ownerId === uid) throw new OpsError(400, "OWN_EVENT");
  const l = await store().get<Listing>("listings", input.listingId);
  if (!l || l.ownerId !== uid) throw new OpsError(400, "UNKNOWN_LISTING");
  if (o.kind !== "open" && o.targetListingId !== l.id) throw deny();
  const prev = (await store().list<Application>("applications", { openingId, applicantId: uid })).find((a) => !["withdrawn", "rejected", "declined"].includes(a.status));
  if (prev) throw new OpsError(409, "ALREADY_APPLIED");
  const reqIds = (input.requirementIds?.length ? input.requirementIds : o.requirementIds).filter((x) => o.requirementIds.includes(x));
  const reqs = (await store().list<Requirement>("requirements", { eventId: e.id })).filter((r) => reqIds.includes(r.id));
  if (!reqs.length || !reqs.every((r) => l.items.some((i) => i.key === r.key))) throw new OpsError(400, "LISTING_DOES_NOT_PROVIDE");
  const trackIds = [...new Set(input.trackIds ?? [])].slice(0, 3);
  if (trackIds.length) await (await import("@/lib/music/service")).assertAttachable(uid, trackIds);
  const a: Application = {
    id: id(), eventId: e.id, openingId, applicantId: uid, listingId: l.id, requirementIds: reqIds, priceUsd: Math.max(0, input.priceUsd),
    items: input.items?.length ? input.items : reqs.map((r) => ({ key: r.key, quantity: Math.min(r.quantity, l.items.filter((i) => i.key === r.key).reduce((s, i) => s + i.quantity, 0)), model: l.items.find((i) => i.key === r.key)?.model ?? "" })),
    portfolio: (input.portfolio ?? "").slice(0, 2000), availableFrom: input.availableFrom ?? null, availableTo: input.availableTo ?? null, message: (input.message ?? "").slice(0, 2000),
    quoteDocumentId: input.quoteDocumentId ?? null, ...(trackIds.length ? { trackIds } : {}), status: "submitted", createdAt: nowIso(),
  };
  await store().insert("applications", a);
  for (const m of await managersOf(e.id)) await notify(m.userId, e.id, "notif.newApplication", { event: e.name }, `application:${a.id}:${m.userId}`);
  return a;
}

export async function withdraw(uid: string, appId: string) {
  await ready();
  const a = await store().get<Application>("applications", appId);
  if (!a || a.applicantId !== uid) throw notFound();
  if (a.status === "accepted") throw new OpsError(400, "ALREADY_ACCEPTED");
  const next = { ...a, status: (await store().get<Opening>("openings", a.openingId))?.kind === "open" ? "withdrawn" : "declined" } as Application;
  await store().put("applications", next);
  return next;
}

export async function setApplicationStatus(uid: string, eventId: string, appId: string, status: "under_review" | "shortlisted" | "interview" | "rejected") {
  await access(eventId, uid, "decide_applications");
  const a = await store().get<Application>("applications", appId);
  if (!a || a.eventId !== eventId) throw notFound();
  if (a.status === "accepted") throw new OpsError(400, "ALREADY_ACCEPTED");
  const next = { ...a, status };
  await store().put("applications", next);
  if (status === "rejected") await notify(a.applicantId, null, "notif.applicationRejected", {}, `app-rejected:${a.id}`);
  return next;
}

/**
 * Hires an applicant: holds the listing's capacity (atomic, no double booking) and proposes an agreement that
 * the provider must accept. Requires an explicit confirmation from the organizer.
 */
export async function accept(uid: string, eventId: string, appId: string, input: { confirm: boolean; terms?: Partial<AgreementTerms> }) {
  const { event } = await access(eventId, uid, "decide_applications");
  if (!input.confirm) throw new OpsError(400, "CONFIRMATION_REQUIRED");
  const a = await store().get<Application>("applications", appId);
  if (!a || a.eventId !== eventId) throw notFound();
  if (!["submitted", "under_review", "shortlisted", "interview"].includes(a.status)) throw new OpsError(400, "NOT_OPEN");
  const l = a.listingId ? await store().get<Listing>("listings", a.listingId) : null;
  if (!l) throw new OpsError(400, "UNKNOWN_LISTING");
  const reqs = (await store().list<Requirement>("requirements", { eventId })).filter((r) => a.requirementIds.includes(r.id));
  const items = reqs.map((r) => ({ key: r.key, quantity: Math.max(1, Math.min(r.quantity, a.items.find((i) => i.key === r.key)?.quantity ?? r.quantity)) }));
  const b: Booking = { id: id(), eventId, listingId: l.id, applicationId: a.id, providerId: l.ownerId, requirementIds: a.requirementIds, items, quantity: Math.max(...items.map((i) => i.quantity)), startAt: event.startAt, endAt: event.endAt, status: "held", createdAt: nowIso() };
  await store().bookAtomically(b, (existing) => {
    for (const it of items) {
      const total = l.items.filter((i) => i.key === it.key).reduce((s, i) => s + i.quantity, 0);
      const used = existing.filter((x) => (x.status === "held" || x.status === "confirmed") && Date.parse(x.startAt) < Date.parse(b.endAt) && Date.parse(b.startAt) < Date.parse(x.endAt)).reduce((s, x) => s + (x.items.find((i) => i.key === it.key)?.quantity ?? 0), 0);
      if (used + it.quantity > total) throw new OpsError(409, "BOOKING_CONFLICT", { key: it.key, free: Math.max(0, total - used) });
    }
  });
  const terms: AgreementTerms = { scope: input.terms?.scope ?? a.message.slice(0, 500), amountUsd: input.terms?.amountUsd ?? a.priceUsd, dueAt: input.terms?.dueAt ?? event.startAt, cancellation: input.terms?.cancellation ?? "", liability: input.terms?.liability ?? "" };
  const t = nowIso();
  const ag: Agreement = { id: id(), eventId, bookingId: b.id, organizerId: uid, providerId: l.ownerId, terms, status: "proposed", organizerAcceptedAt: t, providerAcceptedAt: null, history: [{ at: t, by: uid, action: "proposed", terms }], version: 0 };
  await store().insert("agreements", ag);
  await store().put("applications", { ...a, status: "accepted" });
  const opening = await store().get<Opening>("openings", a.openingId);
  if (opening) {
    const accepted = (await store().list<Application>("applications", { openingId: opening.id })).filter((x) => x.status === "accepted").length;
    if (accepted >= opening.slots) await store().put("openings", { ...opening, status: "filled" });
  }
  await notify(l.ownerId, eventId, "notif.hired", { event: event.name }, `hired:${ag.id}`);
  return { booking: b, agreement: ag };
}

async function agreementFor(uid: string, agreementId: string) {
  await ready();
  const ag = await store().get<Agreement>("agreements", agreementId);
  if (!ag) throw notFound();
  const member = await memberOf(ag.eventId, uid);
  const organizerSide = !!member && can(member, "sign_agreement");
  if (ag.providerId !== uid && !organizerSide) throw notFound();
  return { ag, organizerSide, providerSide: ag.providerId === uid };
}

async function setBooking(bookingId: string, status: Booking["status"]) {
  const b = await store().get<Booking>("bookings", bookingId);
  if (b) await store().put("bookings", { ...b, status });
  return b;
}

/** Provider (or organizer, after a change by the provider) accepts the current terms. */
export async function acceptAgreement(uid: string, agreementId: string, input: { confirm: boolean; version: number }) {
  if (!input.confirm) throw new OpsError(400, "CONFIRMATION_REQUIRED");
  const { ag, organizerSide, providerSide } = await agreementFor(uid, agreementId);
  if (ag.status !== "proposed" && ag.status !== "changed") throw new OpsError(400, "NOT_OPEN");
  const t = nowIso();
  const next: Agreement = { ...ag, version: ag.version + 1, history: [...ag.history, { at: t, by: uid, action: "accepted", terms: ag.terms }] };
  if (providerSide) next.providerAcceptedAt = t;
  if (organizerSide && !providerSide) next.organizerAcceptedAt = t;
  if (next.providerAcceptedAt && next.organizerAcceptedAt) next.status = "agreed";
  await store().put("agreements", next, input.version);
  if (next.status === "agreed") {
    const b = await setBooking(ag.bookingId, "confirmed");
    // The provider joins the event's operations space (vendor for companies/gear, staff for people).
    const l = b ? await store().get<Listing>("listings", b.listingId) : null;
    if (!(await memberOf(ag.eventId, ag.providerId))) {
      const area = l ? CATALOG_BY_KEY.get(l.items[0]?.key ?? "")?.area ?? "general" : "general";
      await store().insert<EventMember>("members", { eventId: ag.eventId, userId: ag.providerId, role: l?.type === "person" ? "staff" : "vendor", area, displayName: await displayNameOf(ag.providerId), addedAt: t });
    }
    await notify(ag.organizerId, ag.eventId, "notif.agreementAgreed", {}, `agreed:${ag.id}:${next.version}`);
  }
  return next;
}

export async function changeAgreement(uid: string, agreementId: string, input: { terms: Partial<AgreementTerms>; version: number }) {
  const { ag, providerSide } = await agreementFor(uid, agreementId);
  if (ag.status === "cancelled" || ag.status === "completed") throw new OpsError(400, "NOT_OPEN");
  const terms = { ...ag.terms, ...input.terms };
  const t = nowIso();
  // A change needs the other side's acceptance again.
  const next: Agreement = { ...ag, terms, status: "changed", version: ag.version + 1, organizerAcceptedAt: providerSide ? null : t, providerAcceptedAt: providerSide ? t : null, history: [...ag.history, { at: t, by: uid, action: "changed", terms }] };
  await store().put("agreements", next, input.version);
  await notify(providerSide ? ag.organizerId : ag.providerId, ag.eventId, "notif.agreementChanged", {}, `changed:${ag.id}:${next.version}`);
  return next;
}

export async function cancelAgreement(uid: string, agreementId: string, input: { confirm: boolean; version: number; reason?: string }) {
  if (!input.confirm) throw new OpsError(400, "CONFIRMATION_REQUIRED");
  const { ag, providerSide } = await agreementFor(uid, agreementId);
  if (ag.status === "cancelled" || ag.status === "completed") throw new OpsError(400, "NOT_OPEN");
  const t = nowIso();
  const next: Agreement = { ...ag, status: "cancelled", version: ag.version + 1, history: [...ag.history, { at: t, by: uid, action: "cancelled", terms: ag.terms }] };
  await store().put("agreements", next, input.version);
  const b = await setBooking(ag.bookingId, "cancelled");
  // A cancellation is logged as an incident so replacements can be proposed (the organizer still decides).
  await store().insert<Incident>("incidents", { id: id(), eventId: ag.eventId, type: "cancellation", severity: "high", description: (input.reason ?? "").slice(0, 1000), reportedBy: uid, assigneeId: ag.organizerId, status: "open", requirementId: b?.requirementIds[0] ?? null, bookingId: ag.bookingId, at: t, updatedAt: t });
  await notify(providerSide ? ag.organizerId : ag.providerId, ag.eventId, "notif.agreementCancelled", {}, `cancelled:${ag.id}`);
  return next;
}

export async function completeAgreement(uid: string, agreementId: string, input: { version: number }) {
  const { ag, organizerSide } = await agreementFor(uid, agreementId);
  if (!organizerSide) throw deny();
  if (ag.status !== "agreed") throw new OpsError(400, "NOT_OPEN");
  const next: Agreement = { ...ag, status: "completed", version: ag.version + 1, history: [...ag.history, { at: nowIso(), by: uid, action: "completed", terms: ag.terms }] };
  await store().put("agreements", next, input.version);
  await setBooking(ag.bookingId, "completed");
  return next;
}

/** Agreements and applications of the provider side (for /profile/work). */
export async function myWork(uid: string) {
  await ready();
  const [apps, agreements] = await Promise.all([store().list<Application>("applications", { applicantId: uid }), store().list<Agreement>("agreements", { providerId: uid })]);
  const names = new Map<string, string>();
  for (const eid of new Set([...apps.map((a) => a.eventId), ...agreements.map((a) => a.eventId)])) names.set(eid, (await store().get<OpsEvent>("events", eid))?.name ?? "—");
  return { applications: apps.map((a) => ({ ...a, eventName: names.get(a.eventId) })), agreements: agreements.map((a) => ({ ...a, eventName: names.get(a.eventId) })) };
}

// ------------------------------------------------------------------ team

export async function inviteMember(uid: string, eventId: string, input: { email: string; role: MemberRole; area: Area }) {
  const { member } = await access(eventId, uid, "manage_members");
  if (input.role === "owner") throw deny();
  if (input.role === "manager" && !can(member, "manage_managers")) throw deny();
  const u = await getAuthStore().findUserByEmail(input.email.trim().toLowerCase());
  // Same answer whether or not the address has an account, so invites can't be used to probe emails.
  if (!u || !u.emailVerified) return { invited: false };
  const existing = await memberOf(eventId, u.id);
  const m: EventMember = { eventId, userId: u.id, role: input.role, area: input.area, displayName: await displayNameOf(u.id), addedAt: existing?.addedAt ?? nowIso() };
  if (existing?.role === "owner") throw deny();
  await store().put("members", m);
  await notify(u.id, eventId, "notif.addedToTeam", {}, `member:${eventId}:${u.id}`);
  return { invited: true };
}

export async function removeMember(uid: string, eventId: string, userId: string) {
  const { member } = await access(eventId, uid, "manage_members");
  const target = await memberOf(eventId, userId);
  if (!target || target.role === "owner") throw deny();
  if (target.role === "manager" && !can(member, "manage_managers")) throw deny();
  await store().remove("members", `${eventId}:${userId}`);
}

// ------------------------------------------------------------------ chat, tasks, files, schedule

export async function messages(uid: string, eventId: string, thread: Area) {
  const { member } = await access(eventId, uid);
  if (!canReadThread(member, thread)) throw deny();
  return (await store().list<Message>("messages", { eventId, thread })).sort((a, b) => a.at.localeCompare(b.at)).slice(-200);
}

export async function postMessage(uid: string, eventId: string, thread: Area, body: string) {
  const { member } = await access(eventId, uid);
  if (!canReadThread(member, thread)) throw deny();
  const text = body.trim().slice(0, 2000);
  if (!text) throw new OpsError(400, "EMPTY");
  const m: Message = { id: id(), eventId, thread, authorId: uid, authorName: member.displayName, body: text, at: nowIso() };
  await store().insert("messages", m);
  return m;
}

export async function saveTask(uid: string, eventId: string, input: { id?: string; title?: string; area?: Area; assigneeId?: string | null; dueAt?: string | null; status?: TaskStatus }) {
  const { member } = await access(eventId, uid);
  if (input.id) {
    const cur = await store().get<Task>("tasks", input.id);
    if (!cur || cur.eventId !== eventId) throw notFound();
    if (!canEditTask(member, cur)) throw deny();
    const onlyStatus = !can(member, "manage_all_tasks") && !(member.role === "lead" && cur.area === member.area);
    const next: Task = onlyStatus ? { ...cur, status: input.status ?? cur.status, updatedAt: nowIso() } : { ...cur, ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)), updatedAt: nowIso() } as Task;
    if (next.assigneeId && !(await memberOf(eventId, next.assigneeId))) throw new OpsError(400, "NOT_A_MEMBER");
    await store().put("tasks", next);
    return next;
  }
  const area = input.area ?? member.area;
  if (!can(member, "manage_all_tasks") && !(member.role === "lead" && area === member.area)) throw deny();
  if (input.assigneeId && !(await memberOf(eventId, input.assigneeId))) throw new OpsError(400, "NOT_A_MEMBER");
  const title = (input.title ?? "").trim().slice(0, 200);
  if (!title) throw new OpsError(400, "EMPTY");
  const t: Task = { id: id(), eventId, title, templateKey: null, area, assigneeId: input.assigneeId ?? null, dueAt: input.dueAt ?? null, status: input.status ?? "todo", requirementId: null, createdBy: uid, updatedAt: nowIso() };
  await store().insert("tasks", t);
  if (t.assigneeId && t.assigneeId !== uid) await notify(t.assigneeId, eventId, "notif.taskAssigned", { title }, `task:${t.id}:${t.assigneeId}`);
  return t;
}

const MAX_FILE = 5 * 1024 * 1024;
const MIME_OK = /^(application\/pdf|image\/(png|jpeg|webp)|text\/(plain|csv)|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet))$/;

export async function uploadDocument(uid: string, eventId: string, input: { name: string; kind: DocKind; audience: DocAudience; mime: string; data: Buffer }) {
  const { member } = await access(eventId, uid, "upload_documents");
  if (input.data.length > MAX_FILE) throw new OpsError(413, "FILE_TOO_LARGE");
  if (!MIME_OK.test(input.mime)) throw new OpsError(415, "FILE_TYPE");
  if (!canOpenDocument(member, input.audience)) throw deny(); // can't upload into a room you can't open
  const d: DocumentMeta = { id: id(), eventId, name: input.name.slice(0, 160), kind: input.kind, mime: input.mime, size: input.data.length, audience: input.kind === "contract" && input.audience === "team" ? "managers" : input.audience, uploadedBy: uid, at: nowIso() };
  await store().putBlob(d.id, eventId, input.mime, input.data);
  await store().insert("documents", d);
  return d;
}

/** Quote attachments from providers who aren't members yet are stored against the opening's event, visible to managers. */
export async function uploadQuote(uid: string, openingId: string, input: { name: string; mime: string; data: Buffer }) {
  await ready();
  await verifiedUser(uid);
  const o = await store().get<Opening>("openings", openingId);
  if (!o || o.status !== "open") throw notFound();
  if (input.data.length > MAX_FILE) throw new OpsError(413, "FILE_TOO_LARGE");
  if (!MIME_OK.test(input.mime)) throw new OpsError(415, "FILE_TYPE");
  const d: DocumentMeta = { id: id(), eventId: o.eventId, name: input.name.slice(0, 160), kind: "quote", mime: input.mime, size: input.data.length, audience: "managers", uploadedBy: uid, at: nowIso() };
  await store().putBlob(d.id, o.eventId, input.mime, input.data);
  await store().insert("documents", d);
  return d;
}

export async function readDocument(uid: string, docId: string) {
  await ready();
  const d = await store().get<DocumentMeta>("documents", docId);
  if (!d) throw notFound();
  const m = await memberOf(d.eventId, uid);
  if (d.uploadedBy !== uid && !canOpenDocument(m, d.audience)) throw notFound();
  const blob = await store().getBlob(d.id);
  if (!blob) throw notFound();
  return { meta: d, blob };
}

export async function saveScheduleItem(uid: string, eventId: string, input: { id?: string; kind: ScheduleKind; startAt: string; endAt: string; listingId?: string | null; note?: string }) {
  await access(eventId, uid, "edit_schedule");
  if (!Number.isFinite(Date.parse(input.startAt)) || !Number.isFinite(Date.parse(input.endAt)) || Date.parse(input.endAt) < Date.parse(input.startAt)) throw new OpsError(400, "INVALID_TIMES");
  const item: ScheduleItem = { id: input.id ?? id(), eventId, kind: input.kind, startAt: new Date(input.startAt).toISOString(), endAt: new Date(input.endAt).toISOString(), listingId: input.listingId ?? null, note: (input.note ?? "").slice(0, 300) };
  if (input.id) {
    const cur = await store().get<ScheduleItem>("schedule", input.id);
    if (!cur || cur.eventId !== eventId) throw notFound();
    await store().put("schedule", item);
  } else await store().insert("schedule", item);
  return item;
}

export async function deleteScheduleItem(uid: string, eventId: string, itemId: string) {
  await access(eventId, uid, "edit_schedule");
  const cur = await store().get<ScheduleItem>("schedule", itemId);
  if (!cur || cur.eventId !== eventId) throw notFound();
  await store().remove("schedule", itemId);
}

// ------------------------------------------------------------------ budget

export async function setBudgetEstimate(uid: string, eventId: string, category: BudgetCategory, estimateUsd: number) {
  await access(eventId, uid, "edit_budget");
  const line: BudgetLine = { eventId, category, estimateUsd: Math.max(0, Math.round(estimateUsd)) };
  await store().put("budget", line);
  return line;
}

/**
 * For a category over its estimate: other eligible providers for the same requirements, cheaper than the current
 * quote. Safety-relevant requirements are never offered as "drop it": only as same-spec alternatives.
 */
export async function budgetAlternatives(uid: string, eventId: string, category: BudgetCategory) {
  await access(eventId, uid, "read_budget");
  const reqs = (await store().list<Requirement>("requirements", { eventId })).filter((r) => (CATALOG_BY_KEY.get(r.key)?.budget ?? "contingency") === category && r.status !== "not_needed" && r.status !== "covered");
  const apps = await store().list<Application>("applications", { eventId });
  const out = [];
  for (const r of reqs) {
    const current = apps.filter((a) => a.requirementIds.includes(r.id) && ["submitted", "shortlisted", "accepted"].includes(a.status)).sort((a, b) => a.priceUsd - b.priceUsd)[0];
    const c = await candidates(uid, eventId, r.id, current ? [current.applicantId] : []);
    const cheaper = c.eligible.filter((m) => !current || m.listing.priceUsd < current.priceUsd).slice(0, 3);
    out.push({ requirement: r, currentPrice: current?.priceUsd ?? null, alternatives: cheaper, safetyCritical: r.safetyCritical });
  }
  return out;
}

export async function recordPayment(uid: string, eventId: string, input: { agreementId: string; amountUsd: number; note?: string; confirm: boolean }) {
  await access(eventId, uid, "record_payment");
  if (!input.confirm) throw new OpsError(400, "CONFIRMATION_REQUIRED");
  const ag = await store().get<Agreement>("agreements", input.agreementId);
  if (!ag || ag.eventId !== eventId || !["agreed", "completed"].includes(ag.status)) throw new OpsError(400, "AGREEMENT_NOT_AGREED");
  const paid = (await store().list<Payment>("payments", { eventId, agreementId: ag.id })).reduce((a, p) => a + p.amountUsd, 0);
  if (input.amountUsd <= 0 || paid + input.amountUsd > ag.terms.amountUsd) throw new OpsError(400, "AMOUNT_EXCEEDS_AGREEMENT");
  const p: Payment = { id: id(), eventId, agreementId: ag.id, amountUsd: input.amountUsd, note: (input.note ?? "").slice(0, 300), recordedBy: uid, at: nowIso() };
  await store().insert("payments", p);
  return p;
}

// ------------------------------------------------------------------ safety

export async function approveSafety(uid: string, eventId: string, key: SafetyKey, input: { approve: boolean; reference: string; confirm: boolean }) {
  await access(eventId, uid, "approve_safety");
  if (AUTO_SAFETY.includes(key)) throw new OpsError(400, "AUTO_CHECK");
  if (!input.confirm) throw new OpsError(400, "CONFIRMATION_REQUIRED");
  const cur = await store().get<SafetyCheck>("safety", `${eventId}:${key}`);
  if (!cur) throw notFound();
  if (input.approve && !input.reference.trim()) throw new OpsError(400, "REFERENCE_REQUIRED");
  const next: SafetyCheck = { ...cur, status: input.approve ? "approved" : "open", approvedBy: input.approve ? uid : null, approvedAt: input.approve ? nowIso() : null, reference: input.reference.trim().slice(0, 300) };
  await store().put("safety", next);
  return next;
}

export async function reportIncident(uid: string, eventId: string, input: { type: IncidentType; severity: Severity; description: string; requirementId?: string | null; bookingId?: string | null }) {
  const { event } = await access(eventId, uid, "report_incident");
  // References must belong to this event (no pointing at other events' records).
  if (input.requirementId) {
    const r = await store().get<Requirement>("requirements", input.requirementId);
    if (!r || r.eventId !== eventId) throw new OpsError(400, "UNKNOWN_REFERENCE");
  }
  if (input.bookingId) {
    const b = await store().get<Booking>("bookings", input.bookingId);
    if (!b || b.eventId !== eventId) throw new OpsError(400, "UNKNOWN_REFERENCE");
  }
  const t = nowIso();
  const i: Incident = { id: id(), eventId, type: input.type, severity: input.severity, description: input.description.trim().slice(0, 1000), reportedBy: uid, assigneeId: null, status: "open", requirementId: input.requirementId ?? null, bookingId: input.bookingId ?? null, at: t, updatedAt: t };
  await store().insert("incidents", i);
  if (i.severity === "high" || i.severity === "critical") for (const m of await managersOf(eventId)) await notify(m.userId, eventId, "notif.incident", { event: event.name }, `incident:${i.id}:${m.userId}`);
  return i;
}

export async function updateIncident(uid: string, eventId: string, incidentId: string, input: { status?: Incident["status"]; assigneeId?: string | null }) {
  const { member } = await access(eventId, uid);
  const i = await store().get<Incident>("incidents", incidentId);
  if (!i || i.eventId !== eventId) throw notFound();
  if (!can(member, "manage_incidents") && i.assigneeId !== uid) throw deny();
  if (input.assigneeId !== undefined && !can(member, "manage_incidents")) throw deny();
  if (input.assigneeId && !(await memberOf(eventId, input.assigneeId))) throw new OpsError(400, "NOT_A_MEMBER");
  const next: Incident = { ...i, ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)), updatedAt: nowIso() } as Incident;
  await store().put("incidents", next);
  return next;
}

/** Replacement candidates for a cancelled booking or a staff shortage. Contacting them is a separate, explicit step. */
export async function replacements(uid: string, eventId: string, incidentId: string) {
  await access(eventId, uid, "manage_incidents");
  const i = await store().get<Incident>("incidents", incidentId);
  if (!i || i.eventId !== eventId) throw notFound();
  if (!incidentNeedsReplacement(i)) return { incident: i, eligible: [], excluded: [] };
  const b = i.bookingId ? await store().get<Booking>("bookings", i.bookingId) : null;
  const c = await candidates(uid, eventId, i.requirementId!, b ? [b.providerId] : []);
  return { incident: i, eligible: c.eligible, excluded: c.excluded };
}

export async function recordHandover(uid: string, eventId: string, input: { bookingId: string; direction: "out" | "return"; quantity: number; condition: Handover["condition"]; note?: string; photoIds?: string[] }) {
  const { member } = await access(eventId, uid, "record_handover");
  const b = await store().get<Booking>("bookings", input.bookingId);
  if (!b || b.eventId !== eventId) throw notFound();
  if (member.role === "vendor" && b.providerId !== uid) throw deny();
  if (b.status !== "confirmed" && b.status !== "completed") throw new OpsError(400, "BOOKING_NOT_CONFIRMED");
  const h: Handover = { id: id(), eventId, bookingId: b.id, direction: input.direction, quantity: Math.max(0, Math.floor(input.quantity)), condition: input.condition, photoIds: input.photoIds ?? [], handledBy: uid, note: (input.note ?? "").slice(0, 500), at: nowIso() };
  await store().insert("handovers", h);
  if (input.direction === "return" && (h.condition === "damaged" || h.condition === "missing" || h.quantity < b.quantity)) {
    await store().insert<Incident>("incidents", { id: id(), eventId, type: "equipment_failure", severity: "medium", description: h.note, reportedBy: uid, assigneeId: null, status: "open", requirementId: null, bookingId: b.id, at: h.at, updatedAt: h.at });
  }
  return h;
}

// ------------------------------------------------------------------ team reuse

/** Sends quote requests for the new event to the providers who worked on a previous event (organizer's explicit action). */
export async function reuseTeam(uid: string, fromEventId: string, toEventId: string) {
  await access(fromEventId, uid, "recruit");
  await access(toEventId, uid, "recruit");
  const old = (await store().list<Agreement>("agreements", { eventId: fromEventId })).filter((a) => a.status === "agreed" || a.status === "completed");
  const reqs = (await store().list<Requirement>("requirements", { eventId: toEventId })).filter((r) => ["needed", "recruiting"].includes(r.status));
  const created: Opening[] = [];
  for (const ag of old) {
    const b = await store().get<Booking>("bookings", ag.bookingId);
    const l = b ? await store().get<Listing>("listings", b.listingId) : null;
    if (!l || !l.active) continue;
    const ids = reqs.filter((r) => l.items.some((i) => i.key === r.key)).map((r) => r.id);
    if (!ids.length) continue;
    created.push(await createOpening(uid, toEventId, { kind: "quote", requirementIds: ids, targetListingId: l.id, message: "" }));
  }
  return created;
}

// ------------------------------------------------------------------ reviews

export async function review(uid: string, agreementId: string, input: { scores: Review["scores"]; comment?: string }) {
  await ready();
  const ag = await store().get<Agreement>("agreements", agreementId);
  if (!ag || (ag.organizerId !== uid && ag.providerId !== uid)) throw notFound();
  const e = await store().get<OpsEvent>("events", ag.eventId);
  // Only real, finished work can be reviewed: a completed agreement, or an agreed one after the event ended.
  const finished = ag.status === "completed" || (ag.status === "agreed" && !!e && Date.parse(e.endAt) < Date.now());
  if (!finished) throw new OpsError(400, "NOT_FINISHED");
  const mine = await store().list<Review>("reviews", { agreementId, raterId: uid });
  if (mine.length) throw new OpsError(409, "ALREADY_REVIEWED");
  const s = input.scores;
  const vals = [s.punctuality, s.communication, s.delivery, s.quality, s.overall];
  if (!vals.every((v) => Number.isInteger(v) && v >= 1 && v <= 5)) throw new OpsError(400, "INVALID_SCORES");
  const r: Review = { id: id(), eventId: ag.eventId, agreementId, raterId: uid, rateeId: ag.organizerId === uid ? ag.providerId : ag.organizerId, scores: s, comment: (input.comment ?? "").slice(0, 1000), at: nowIso() };
  await store().insert("reviews", r);
  return r;
}

// ------------------------------------------------------------------ notifications

export async function notifications(uid: string) {
  await ready();
  return (await store().list<Notification>("notifications", { userId: uid })).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 50);
}

export async function markNotificationsRead(uid: string) {
  for (const n of await store().list<Notification>("notifications", { userId: uid, read: false })) await store().put("notifications", { ...n, read: true });
}

export { type ScaleLevel };
export const SAFETY_ALL = SAFETY_KEYS;
export type { SafetyKey as OpsSafetyKey };
export const isAutoSafety = (k: SafetyKey) => AUTO_SAFETY.includes(k);
