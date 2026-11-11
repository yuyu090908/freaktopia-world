/**
 * Event operations API. Uses the existing account session (no second auth system), the same CSRF check,
 * rate limits and zod validation as /api/me. Every write goes through lib/ops/service.ts, which checks the
 * caller's event membership and role; events the caller isn't a member of answer 404.
 */
import { z } from "zod";
import { currentUser, fail, limit, ok, readJson, sameOrigin } from "@/lib/auth/http";
import { REQ_KEYS } from "@/lib/ops/planner";
import * as ops from "@/lib/ops/service";
import { OpsError } from "@/lib/ops/types";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ path?: string[] }> };

// ------------------------------------------------------------------ schemas

const zId = z.string().regex(/^[0-9a-f-]{36}$/i);
const zText = (max: number) => z.string().trim().max(max).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f]*$/u);
const zName = (max: number) => zText(max).min(1);
const zIso = z.string().max(40).refine((v) => Number.isFinite(Date.parse(v)), "date");
const zKey = z.enum(REQ_KEYS as [string, ...string[]]);
const zArea = z.enum(["general", "sound", "lighting", "operations", "dj", "safety"]);
const zRole = z.enum(["owner", "manager", "lead", "staff", "vendor"]);
const zItem = z.object({ key: zKey, quantity: z.number().int().min(1).max(10_000), model: zText(80).default("") }).strict();
const zMoney = z.number().min(0).max(100_000_000);
const zTemplate = z.enum(["private_party", "club_night", "rooftop_party", "beach_party", "warehouse_rave", "outdoor_festival", "mega_festival"]);
const zCategory = z.enum(["venue", "sound", "lighting_video", "artists", "staff_security", "decor_facilities", "marketing", "safety_permits", "contingency"]);
const zSafety = z.enum(["contracts_complete", "equipment_secured", "staffing_confirmed", "venue_conditions", "permits_insurance", "safety_evacuation_plan", "emergency_contacts"]);
const zTerms = z.object({ scope: zText(2000), amountUsd: zMoney, dueAt: zIso.nullable(), cancellation: zText(1000), liability: zText(1000) }).partial().strict();

const zEvent = z
  .object({
    name: zName(80), city: zName(60), venueName: zText(80), setting: z.enum(["indoor", "outdoor", "mixed"]), startAt: zIso, endAt: zIso,
    genres: z.array(zName(32)).max(8), attendance: z.number().int().min(1).max(500_000), budgetUsd: zMoney,
    ticketing: z.boolean(), djs: z.boolean(), streaming: z.boolean(), templateId: zTemplate,
    ownedEquipment: z.array(zKey).max(60), venueFacilities: z.array(zKey).max(60), services: z.array(zKey).max(60),
    levelOverride: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]).nullable().optional(),
  })
  .strict();
const zListing = z
  .object({
    type: z.enum(["person", "company", "equipment", "package"]), title: zName(80), items: z.array(zItem).min(1).max(20), city: zName(60), priceUsd: zMoney,
    deposit: zMoney.optional(), insurance: zText(300).optional(), damageTerms: zText(300).optional(), delivery: z.boolean().optional(), setup: z.boolean().optional(),
    operatorIncluded: z.boolean().optional(), maxAudience: z.number().int().min(1).max(500_000).optional(),
    availability: z.array(z.object({ from: zIso, to: zIso }).strict()).max(20).optional(), active: z.boolean().optional(),
  })
  .strict();
const zProfile = z
  .object({
    roles: z.array(z.enum(["attendee", "dj", "organizer", "staff", "equipment_owner", "company"])).max(6), displayName: zName(40), regions: z.array(zName(60)).max(10),
    services: z.array(zKey).max(60), bio: zText(600), maxEventSize: z.number().int().min(0).max(500_000), pastWork: z.array(zName(120)).max(20),
    credentials: z.array(z.enum(["security_license", "electrician_license", "rigging_cert", "first_aid"])).max(4),
  })
  .partial()
  .strict();
const zFile = z.object({ name: zName(160), mime: z.string().max(100), data: z.string().max(7_000_000) });

const DOC_PATHS = /^(events\/[^/]+\/documents|openings\/[^/]+\/quote)$/;

// ------------------------------------------------------------------ helpers

function fromError(e: unknown) {
  if (e instanceof OpsError) return fail(e.status, e.code, e.extra);
  console.error("[ops]", e);
  return fail(500, "SERVER_ERROR");
}
const bad = (issues: z.core.$ZodIssue[]) => fail(400, "INVALID_INPUT", { field: issues[0]?.path.join(".") });
function parse<T extends z.ZodType>(schema: T, body: unknown): { data: z.infer<T> } | { error: Response } {
  const r = schema.safeParse(body);
  return r.success ? { data: r.data } : { error: bad(r.error.issues) };
}
function decodeFile(f: z.infer<typeof zFile>) {
  const data = Buffer.from(f.data, "base64");
  return { name: f.name, mime: f.mime, data };
}

// ------------------------------------------------------------------ GET

export async function GET(req: Request, { params }: Params) {
  const p = (await params).path ?? [];
  const url = new URL(req.url);
  try {
    // Public, sign-in not needed: provider trust card and a single active listing.
    if (p[0] === "providers" && p.length === 2) return ok({ trust: await ops.providerTrust(p[1]) });
    if (p[0] === "listings" && p.length === 2) {
      if (!zId.safeParse(p[1]).success) return fail(404, "NOT_FOUND");
      return ok({ listing: await ops.publicListing(p[1]) });
    }

    const user = await currentUser();
    if (!user) return fail(401, "SIGN_IN_REQUIRED");
    const lim = limit("ops-read", user.id, 240, 60_000);
    if (lim) return lim;
    const uid = user.id;

    if (p[0] === "profile" && p.length === 1) {
      const [profile, listings, trust, work] = await Promise.all([ops.getWorkProfile(uid), ops.myListings(uid), ops.providerTrust(uid), ops.myWork(uid)]);
      return ok({ profile, listings, trust, work, emailVerified: user.emailVerified });
    }
    if (p[0] === "opportunities" && p.length === 1) return ok({ opportunities: await ops.opportunities(uid) });
    if (p[0] === "notifications" && p.length === 1) return ok({ notifications: await ops.notifications(uid) });
    if (p[0] === "documents" && p.length === 2) {
      const { meta, blob } = await ops.readDocument(uid, p[1]);
      return new Response(new Uint8Array(blob.data), {
        headers: {
          "Content-Type": blob.mime,
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "sandbox",
          "Cache-Control": "private, no-store",
        },
      });
    }
    if (p[0] === "events") {
      if (p.length === 1) return ok({ events: await ops.myEvents(uid) });
      const eid = p[1];
      if (p.length === 2) return ok({ view: await ops.eventView(uid, eid) });
      if (p[2] === "candidates" && p.length === 4) {
        const exclude = (url.searchParams.get("exclude") ?? "").split(",").filter(Boolean).slice(0, 20);
        return ok(await ops.candidates(uid, eid, p[3], exclude));
      }
      if (p[2] === "messages" && p.length === 4) {
        const t = zArea.safeParse(p[3]);
        if (!t.success) return fail(404, "NOT_FOUND");
        return ok({ messages: await ops.messages(uid, eid, t.data) });
      }
      if (p[2] === "budget" && p[4] === "alternatives" && p.length === 5) {
        const c = zCategory.safeParse(p[3]);
        if (!c.success) return fail(404, "NOT_FOUND");
        return ok({ alternatives: await ops.budgetAlternatives(uid, eid, c.data) });
      }
      if (p[2] === "incidents" && p[4] === "replacements" && p.length === 5) return ok(await ops.replacements(uid, eid, p[3]));
    }
    return fail(404, "NOT_FOUND");
  } catch (e) {
    return fromError(e);
  }
}

// ------------------------------------------------------------------ POST (every change)

export async function POST(req: Request, { params }: Params) {
  const p = (await params).path ?? [];
  const path = p.join("/");
  if (!sameOrigin(req)) return fail(403, "CSRF");
  const user = await currentUser();
  if (!user) return fail(401, "SIGN_IN_REQUIRED");
  const lim = limit("ops-write", user.id, 120, 60_000);
  if (lim) return lim;
  const isUpload = DOC_PATHS.test(path);
  const body = await readJson(req, isUpload ? 7_200_000 : 64_000);
  if (!body) return fail(400, "INVALID_BODY");
  const uid = user.id;

  try {
    // ---- account side
    if (path === "profile") {
      const r = parse(zProfile, body);
      if ("error" in r) return r.error;
      return ok({ profile: await ops.saveWorkProfile(uid, r.data) });
    }
    if (path === "organizations") {
      const r = parse(z.object({ name: zName(80), kind: zName(40) }).strict(), body);
      if ("error" in r) return r.error;
      return ok({ organization: await ops.createOrganization(uid, r.data) });
    }
    if (path === "listings") {
      const r = parse(zListing, body);
      if ("error" in r) return r.error;
      return ok({ listing: await ops.createListing(uid, r.data) }, 201);
    }
    if (p[0] === "listings" && p.length === 2) {
      const r = parse(zListing, body);
      if ("error" in r) return r.error;
      return ok({ listing: await ops.updateListing(uid, p[1], r.data) });
    }
    if (path === "notifications/read") {
      await ops.markNotificationsRead(uid);
      return ok();
    }
    if (path === "admin/credentials") {
      const r = parse(z.object({ userId: zId, key: z.enum(["security_license", "electrician_license", "rigging_cert", "first_aid"]), status: z.enum(["verified", "unverified"]) }).strict(), body);
      if ("error" in r) return r.error;
      return ok({ profile: await ops.verifyCredential(uid, r.data.userId, r.data.key, r.data.status) });
    }

    // ---- provider side: openings, applications, agreements
    if (p[0] === "openings" && p.length === 3) {
      if (p[2] === "apply") {
        const r = parse(
          z.object({ listingId: zId, requirementIds: z.array(zId).max(20).optional(), priceUsd: zMoney, items: z.array(zItem).max(20).optional(), portfolio: zText(2000).optional(), availableFrom: zIso.nullable().optional(), availableTo: zIso.nullable().optional(), message: zText(2000).optional(), quoteDocumentId: zId.nullable().optional(), trackIds: z.array(zId).max(3).optional() }).strict(),
          body,
        );
        if ("error" in r) return r.error;
        return ok({ application: await ops.apply(uid, p[1], r.data) }, 201);
      }
      if (p[2] === "quote") {
        const r = parse(zFile.strict(), body);
        if ("error" in r) return r.error;
        return ok({ document: await ops.uploadQuote(uid, p[1], decodeFile(r.data)) }, 201);
      }
    }
    if (p[0] === "applications" && p[2] === "withdraw" && p.length === 3) return ok({ application: await ops.withdraw(uid, p[1]) });
    if (p[0] === "agreements" && p.length === 3) {
      const aid = p[1];
      const zv = z.number().int().min(0);
      if (p[2] === "accept") {
        const r = parse(z.object({ confirm: z.boolean(), version: zv }).strict(), body);
        if ("error" in r) return r.error;
        return ok({ agreement: await ops.acceptAgreement(uid, aid, r.data) });
      }
      if (p[2] === "change") {
        const r = parse(z.object({ terms: zTerms, version: zv }).strict(), body);
        if ("error" in r) return r.error;
        return ok({ agreement: await ops.changeAgreement(uid, aid, r.data) });
      }
      if (p[2] === "cancel") {
        const r = parse(z.object({ confirm: z.boolean(), version: zv, reason: zText(500).optional() }).strict(), body);
        if ("error" in r) return r.error;
        return ok({ agreement: await ops.cancelAgreement(uid, aid, r.data) });
      }
      if (p[2] === "complete") {
        const r = parse(z.object({ version: zv }).strict(), body);
        if ("error" in r) return r.error;
        return ok({ agreement: await ops.completeAgreement(uid, aid, r.data) });
      }
      if (p[2] === "review") {
        const s = z.number().int().min(1).max(5);
        const r = parse(z.object({ scores: z.object({ punctuality: s, communication: s, delivery: s, quality: s, overall: s }).strict(), comment: zText(1000).optional() }).strict(), body);
        if ("error" in r) return r.error;
        return ok({ review: await ops.review(uid, aid, r.data) }, 201);
      }
    }

    // ---- organizer side: one event
    if (path === "events") {
      const r = parse(zEvent, body);
      if ("error" in r) return r.error;
      return ok({ event: await ops.createEvent(uid, r.data) }, 201);
    }
    if (p[0] !== "events" || p.length < 2) return fail(404, "NOT_FOUND");
    const eid = p[1];
    const sub = p.slice(2).join("/");

    if (sub === "") {
      const r = parse(z.object({ patch: zEvent.partial().strict(), version: z.number().int().min(0) }).strict(), body);
      if ("error" in r) return r.error;
      return ok({ event: await ops.updateEvent(uid, eid, r.data.patch, r.data.version) });
    }
    if (sub === "requirements") {
      const r = parse(z.object({ key: zKey, quantity: z.number().int().min(1).max(100_000) }).strict(), body);
      if ("error" in r) return r.error;
      return ok({ requirement: await ops.addRequirement(uid, eid, r.data.key, r.data.quantity) }, 201);
    }
    if (p[2] === "requirements" && p.length === 4) {
      const r = parse(z.object({ quantity: z.number().int().min(0).max(100_000), note: zText(500), notNeeded: z.boolean(), expertName: zText(120) }).partial().strict(), body);
      if ("error" in r) return r.error;
      return ok({ requirement: await ops.updateRequirement(uid, eid, p[3], r.data) });
    }
    if (sub === "openings") {
      const r = parse(z.object({ kind: z.enum(["open", "direct", "quote"]), requirementIds: z.array(zId).min(1).max(20), targetListingId: zId.nullable().optional(), slots: z.number().int().min(1).max(50).optional(), budgetUsd: zMoney.nullable().optional(), message: zText(2000).optional() }).strict(), body);
      if ("error" in r) return r.error;
      return ok({ opening: await ops.createOpening(uid, eid, r.data) }, 201);
    }
    if (p[2] === "applications" && p.length === 5) {
      if (p[4] === "status") {
        const r = parse(z.object({ status: z.enum(["under_review", "shortlisted", "interview", "rejected"]) }).strict(), body);
        if ("error" in r) return r.error;
        return ok({ application: await ops.setApplicationStatus(uid, eid, p[3], r.data.status) });
      }
      if (p[4] === "accept") {
        const r = parse(z.object({ confirm: z.boolean(), terms: zTerms.optional() }).strict(), body);
        if ("error" in r) return r.error;
        return ok(await ops.accept(uid, eid, p[3], r.data));
      }
    }
    if (sub === "members") {
      const r = parse(z.object({ email: z.string().trim().email().max(254), role: zRole, area: zArea }).strict(), body);
      if ("error" in r) return r.error;
      const lim2 = limit("ops-invite", uid, 20, 60 * 60_000);
      if (lim2) return lim2;
      return ok(await ops.inviteMember(uid, eid, r.data));
    }
    if (p[2] === "members" && p[4] === "remove" && p.length === 5) {
      await ops.removeMember(uid, eid, p[3]);
      return ok();
    }
    if (p[2] === "messages" && p.length === 4) {
      const t = zArea.safeParse(p[3]);
      if (!t.success) return fail(404, "NOT_FOUND");
      const r = parse(z.object({ body: zName(2000) }).strict(), body);
      if ("error" in r) return r.error;
      const lim3 = limit("ops-chat", uid, 30, 60_000);
      if (lim3) return lim3;
      return ok({ message: await ops.postMessage(uid, eid, t.data, r.data.body) }, 201);
    }
    if (sub === "tasks") {
      const r = parse(z.object({ id: zId.optional(), title: zName(160).optional(), area: zArea.optional(), assigneeId: zId.nullable().optional(), dueAt: zIso.nullable().optional(), status: z.enum(["todo", "doing", "done"]).optional() }).strict(), body);
      if ("error" in r) return r.error;
      return ok({ task: await ops.saveTask(uid, eid, r.data) });
    }
    if (sub === "documents") {
      const r = parse(zFile.extend({ kind: z.enum(["floor_plan", "stage_design", "equipment_list", "timetable", "contract", "emergency_manual", "quote", "photo", "other"]), audience: z.enum(["team", "leads", "managers"]) }).strict(), body);
      if ("error" in r) return r.error;
      return ok({ document: await ops.uploadDocument(uid, eid, { ...decodeFile(r.data), kind: r.data.kind, audience: r.data.audience }) }, 201);
    }
    if (sub === "schedule") {
      const r = parse(z.object({ id: zId.optional(), kind: z.enum(["load_in", "setup", "soundcheck", "rehearsal", "doors", "show_start", "set", "show_end", "load_out"]), startAt: zIso, endAt: zIso, listingId: zId.nullable().optional(), note: zText(200).optional() }).strict(), body);
      if ("error" in r) return r.error;
      return ok({ item: await ops.saveScheduleItem(uid, eid, r.data) });
    }
    if (p[2] === "schedule" && p[4] === "delete" && p.length === 5) {
      await ops.deleteScheduleItem(uid, eid, p[3]);
      return ok();
    }
    if (p[2] === "budget" && p.length === 4) {
      const c = zCategory.safeParse(p[3]);
      const r = parse(z.object({ estimateUsd: zMoney }).strict(), body);
      if (!c.success) return fail(404, "NOT_FOUND");
      if ("error" in r) return r.error;
      return ok({ line: await ops.setBudgetEstimate(uid, eid, c.data, r.data.estimateUsd) });
    }
    if (sub === "payments") {
      const r = parse(z.object({ agreementId: zId, amountUsd: zMoney.positive(), note: zText(300).optional(), confirm: z.boolean() }).strict(), body);
      if ("error" in r) return r.error;
      return ok({ payment: await ops.recordPayment(uid, eid, r.data) }, 201);
    }
    if (p[2] === "safety" && p.length === 4) {
      const k = zSafety.safeParse(p[3]);
      if (!k.success) return fail(404, "NOT_FOUND");
      const r = parse(z.object({ approve: z.boolean(), reference: zText(300), confirm: z.boolean() }).strict(), body);
      if ("error" in r) return r.error;
      return ok({ check: await ops.approveSafety(uid, eid, k.data, r.data) });
    }
    if (sub === "incidents") {
      const r = parse(z.object({ type: z.enum(["equipment_failure", "staff_shortage", "load_in_delay", "power", "weather", "venue_facility", "cancellation", "other"]), severity: z.enum(["low", "medium", "high", "critical"]), description: zName(2000), requirementId: zId.nullable().optional(), bookingId: zId.nullable().optional() }).strict(), body);
      if ("error" in r) return r.error;
      return ok({ incident: await ops.reportIncident(uid, eid, r.data) }, 201);
    }
    if (p[2] === "incidents" && p.length === 4) {
      const r = parse(z.object({ status: z.enum(["open", "in_progress", "resolved"]).optional(), assigneeId: zId.nullable().optional() }).strict(), body);
      if ("error" in r) return r.error;
      return ok({ incident: await ops.updateIncident(uid, eid, p[3], r.data) });
    }
    if (sub === "handovers") {
      const r = parse(z.object({ bookingId: zId, direction: z.enum(["out", "return"]), quantity: z.number().int().min(0).max(100_000), condition: z.enum(["ok", "minor_damage", "damaged", "missing"]), note: zText(500).optional() }).strict(), body);
      if ("error" in r) return r.error;
      return ok({ handover: await ops.recordHandover(uid, eid, r.data) }, 201);
    }
    if (sub === "reuse") {
      const r = parse(z.object({ fromEventId: zId }).strict(), body);
      if ("error" in r) return r.error;
      return ok({ openings: await ops.reuseTeam(uid, r.data.fromEventId, eid) });
    }
    return fail(404, "NOT_FOUND");
  } catch (e) {
    return fromError(e);
  }
}
