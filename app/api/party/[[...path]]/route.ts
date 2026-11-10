/**
 * PERSONAL PARTY UNIVERSE API (9.0). Same session, CSRF check, rate limits and zod validation as /api/ops.
 * Public reads (worlds, public profiles, published parties, visible media) need no sign-in and only ever
 * return what lib/party/service.ts allows for the viewer.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import { currentUser, fail, limit, ok, readJson, sameOrigin } from "@/lib/auth/http";
import { clientKey } from "@/lib/ranking/guard";
import * as party from "@/lib/party/service";
import { OpsError } from "@/lib/ops/types";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ path?: string[] }> };

const zId = z.string().regex(/^[0-9a-f-]{36}$/i);
const zHandle = z.string().regex(/^(FREAK-\d{8}|demo)$/i);
const zText = (max: number) => z.string().trim().max(max).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f]*$/u);
const zVis = z.enum(["public", "attendees", "hidden"]);

function fromError(e: unknown) {
  if (e instanceof OpsError) return fail(e.status, e.code, e.extra);
  console.error("[party]", e);
  return fail(500, "SERVER_ERROR");
}
function parse<T extends z.ZodType>(schema: T, body: unknown): { data: z.infer<T> } | { error: Response } {
  const r = schema.safeParse(body);
  return r.success ? { data: r.data } : { error: fail(400, "INVALID_INPUT", { field: r.error.issues[0]?.path.join(".") }) };
}

export async function GET(req: Request, { params }: Params) {
  const p = (await params).path ?? [];
  const user = await currentUser();
  const viewer = user?.id ?? null;
  const lim = limit("party-read", viewer ?? clientKey(req), 300, 60_000);
  if (lim) return lim;
  try {
    if (p[0] === "worlds" && p.length === 2) {
      if (!zHandle.safeParse(p[1]).success) return fail(404, "NOT_FOUND");
      return ok({ world: await party.world(viewer, p[1]) });
    }
    if (p[0] === "profiles" && p.length === 2) {
      if (!zHandle.safeParse(p[1]).success) return fail(404, "NOT_FOUND");
      return ok({ profile: await party.publicProfile(viewer, p[1]) });
    }
    if (p[0] === "events" && p.length === 2) {
      if (!zId.safeParse(p[1]).success) return fail(404, "NOT_FOUND");
      return ok(await party.partyEvent(viewer, p[1]));
    }
    if (p[0] === "directory" && p.length === 1) return ok({ worlds: await party.directory() });
    if (p[0] === "upcoming" && p.length === 1) return ok({ parties: await party.upcomingParties() });
    if (p[0] === "media" && p.length === 2) {
      if (!zId.safeParse(p[1]).success) return fail(404, "NOT_FOUND");
      const b = await party.mediaBlob(viewer, p[1]);
      return new Response(new Uint8Array(b.data), {
        headers: { "Content-Type": b.mime, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox", "Cache-Control": "private, max-age=300" },
      });
    }

    if (!user) return fail(401, "SIGN_IN_REQUIRED");
    const uid = user.id;
    if (p[0] === "me" && p.length === 1) return ok(await party.myParties(uid));
    if (p[0] === "pass" && p.length === 2) return ok({ pass: await party.myPass(uid, p[1]) });
    if (p[0] === "door" && p.length === 2) return ok({ door: await party.doorView(uid, p[1]) });
    if (p[0] === "admin" && p.length === 1) return ok(await party.adminReview(uid));
    return fail(404, "NOT_FOUND");
  } catch (e) {
    return fromError(e);
  }
}

export async function POST(req: Request, { params }: Params) {
  const p = (await params).path ?? [];
  const path = p.join("/");
  if (!sameOrigin(req)) return fail(403, "CSRF");
  const user = await currentUser();
  if (!user) return fail(401, "SIGN_IN_REQUIRED");
  const lim = limit("party-write", user.id, 120, 60_000);
  if (lim) return lim;
  const upload = /^events\/[^/]+\/media$/.test(path);
  const body = await readJson(req, upload ? 11_500_000 : 16_000);
  if (!body) return fail(400, "INVALID_BODY");
  const uid = user.id;
  try {
    if (path === "privacy") {
      const r = parse(z.object({ showInWorlds: z.boolean(), showHistory: z.boolean() }).partial().strict(), body);
      if ("error" in r) return r.error;
      return ok({ privacy: await party.setWorldPrivacy(uid, r.data) });
    }
    if (path === "tagline") {
      const r = parse(z.object({ tagline: zText(140) }).strict(), body);
      if ("error" in r) return r.error;
      return ok({ settings: await party.setTagline(uid, r.data.tagline) });
    }
    if (path === "me/delete") {
      const r = parse(z.object({ confirm: z.literal(true) }).strict(), body);
      if ("error" in r) return r.error;
      await party.deleteMyPartyData(uid, true);
      return ok({ deleted: true });
    }
    if (p[0] === "organizers" && p.length === 3 && (zId.safeParse(p[1]).success || zHandle.safeParse(p[1]).success)) {
      // Visitors use the public handle (FREAK-…); "My parties" uses the id it was given for its own follows.
      const oid = zId.safeParse(p[1]).success ? p[1] : (await party.resolveHandle(p[1])).userId;
      if (p[2] === "follow") {
        const r = parse(z.object({ notify: z.boolean() }).strict(), body);
        if ("error" in r) return r.error;
        return ok({ follow: await party.follow(uid, oid, r.data.notify) });
      }
      if (p[2] === "unfollow") return ok({ done: (await party.unfollow(uid, oid), true) });
      if (p[2] === "block") return ok({ done: (await party.block(uid, oid), true) });
      if (p[2] === "unblock") return ok({ done: (await party.unblock(uid, oid), true) });
    }
    if (p[0] === "media" && p.length === 3 && zId.safeParse(p[1]).success) {
      if (p[2] === "delete") return ok({ done: (await party.deleteMedia(uid, p[1]), true) });
      if (p[2] === "update") {
        const r = parse(z.object({ visibility: zVis, hiddenByOrganizer: z.boolean() }).partial().strict(), body);
        if ("error" in r) return r.error;
        return ok({ media: await party.updateMedia(uid, p[1], r.data) });
      }
    }
    if (p[0] === "events" && p.length >= 3 && zId.safeParse(p[1]).success) {
      const eid = p[1];
      const rest = p.slice(2).join("/");
      if (rest === "publish") {
        const r = parse(z.object({ published: z.boolean() }).strict(), body);
        if ("error" in r) return r.error;
        return ok(await party.publishEvent(uid, eid, r.data.published));
      }
      if (rest === "rsvp") return ok({ attendance: await party.rsvp(uid, eid) });
      if (rest === "cancel") return ok({ attendance: await party.cancelRsvp(uid, eid) });
      if (rest === "checkin") {
        const l2 = limit("party-checkin", uid, 240, 60_000);
        if (l2) return l2;
        const r = parse(z.object({ code: zText(120).min(4) }).strict(), body);
        if ("error" in r) return r.error;
        const ipHash = createHash("sha256").update(`fk-door:${clientKey(req)}`).digest("hex").slice(0, 16);
        return ok(await party.checkIn(uid, eid, r.data.code, ipHash));
      }
      if (rest === "confirm" || rest === "revoke") {
        const r = parse(z.object({ userId: zId, reason: zText(300), confirm: z.literal(true) }).strict(), body);
        if ("error" in r) return r.error;
        const fn = rest === "confirm" ? party.confirmManually : party.revokeAttendance;
        return ok({ attendance: await fn(uid, eid, r.data.userId, r.data.reason, true) });
      }
      if (rest === "guests") {
        const r = parse(z.object({ count: z.number().int().min(0).max(1_000_000), reason: zText(300) }).strict(), body);
        if ("error" in r) return r.error;
        return ok({ guests: await party.setGuests(uid, eid, r.data.count, r.data.reason) });
      }
      if (rest === "review") {
        const r = parse(z.object({ rating: z.number().int().min(1).max(5), text: zText(1000).default("") }).strict(), body);
        if ("error" in r) return r.error;
        return ok({ review: await party.review(uid, eid, r.data) });
      }
      if (rest === "review/delete") return ok({ done: (await party.deleteReview(uid, eid), true) });
      if (rest === "media") {
        const r = parse(z.object({ mime: z.string().max(40), data: z.string().max(11_200_000), caption: zText(200).optional(), visibility: zVis.optional() }).strict(), body);
        if ("error" in r) return r.error;
        return ok({ media: await party.uploadMedia(uid, eid, r.data) });
      }
    }
    return fail(404, "NOT_FOUND");
  } catch (e) {
    return fromError(e);
  }
}
