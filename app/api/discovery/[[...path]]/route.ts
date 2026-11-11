/**
 * GLOBAL DISCOVERY API (11.0). External event data is served only from sources that are connected AND approved.
 *  GET  /api/discovery/events?q=&city=&artist=&when=&category=&genre=&limit=   public
 *  GET  /api/discovery/artists?q=                                                public: artists by name, kept apart by source id
 *  GET  /api/discovery/sources                                                   public: which sources are connected (no secrets)
 *  GET  /api/discovery/cron                                                      Vercel Cron (Authorization: Bearer CRON_SECRET)
 *  GET  /api/discovery/admin                                                     admins (OPS_ADMIN_EMAILS): sources + data quality
 *  POST /api/discovery/admin/{sync|pause|intervals|hide|purge}                   admins
 */
import { z } from "zod";
import { currentUser, fail, limit, ok, readJson, sameOrigin } from "@/lib/auth/http";
import { clientKey } from "@/lib/ranking/guard";
import { assertAdmin } from "@/lib/loyalty/service";
import { OpsError } from "@/lib/ops/types";
import * as d from "@/lib/discovery/service";
import { WHEN_FILTERS } from "@/lib/discovery/time";
import { EVENT_CATEGORIES } from "@/lib/discovery/types";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ path?: string[] }> };

const zQuery = z.object({
  q: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  artist: z.string().trim().max(120).optional(),
  when: z.enum(WHEN_FILTERS as [string, ...string[]]).optional(),
  category: z.enum(EVENT_CATEGORIES as [string, ...string[]]).optional(),
  genre: z.string().trim().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});
const zSource = z.enum(d.ADAPTERS.map((a) => a.id) as [string, ...string[]]);

function fromError(e: unknown) {
  if (e instanceof OpsError) return fail(e.status, e.code, e.extra);
  const m = (e as Error)?.message;
  if (m === "UNKNOWN_SOURCE" || m === "NOT_FOUND") return fail(404, m);
  console.error("[discovery]", m);
  return fail(500, "SERVER_ERROR");
}

export async function GET(req: Request, { params }: Params) {
  const p = (await params).path?.join("/") ?? "";
  const url = new URL(req.url);
  if (p === "cron") {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return fail(401, "UNAUTHORIZED");
    const results = [];
    for (const a of d.ADAPTERS) results.push(await d.syncSource(a.id));
    return ok({ results });
  }
  const lim = limit("discovery-read", clientKey(req), 120, 60_000);
  if (lim) return lim;
  try {
    if (p === "events") {
      const r = zQuery.safeParse(Object.fromEntries(url.searchParams));
      if (!r.success) return fail(400, "INVALID_QUERY", { field: r.error.issues[0]?.path.join(".") });
      const res = await d.publicEvents(r.data as d.DiscoveryQuery);
      return ok({ ...res, connected: res.sources.some((s) => s.state === "connected" || s.state === "error") });
    }
    if (p === "artists") {
      const q = (url.searchParams.get("q") ?? "").slice(0, 80);
      return ok({ artists: await d.findArtists(q) });
    }
    if (p === "sources") {
      const s = await d.sourceStatuses();
      return ok({ sources: s.map(({ id, name, state, lastSuccessAt, eventCount }) => ({ id, name, state, lastSuccessAt, eventCount })) });
    }
    if (p === "admin") {
      const user = await currentUser();
      if (!user) return fail(401, "SIGN_IN_REQUIRED");
      await assertAdmin(user.id);
      return ok({ sources: await d.sourceStatuses(), quality: await d.quality() });
    }
    return fail(404, "NOT_FOUND");
  } catch (e) {
    return fromError(e);
  }
}

export async function POST(req: Request, { params }: Params) {
  const p = (await params).path?.join("/") ?? "";
  if (!sameOrigin(req)) return fail(403, "CSRF");
  const user = await currentUser();
  if (!user) return fail(401, "SIGN_IN_REQUIRED");
  const lim = limit("discovery-admin", user.id, 30, 60_000);
  if (lim) return lim;
  const body = await readJson(req);
  if (!body) return fail(400, "INVALID_BODY");
  try {
    await assertAdmin(user.id);
    if (p === "admin/sync") {
      const r = z.object({ source: zSource }).strict().safeParse(body);
      if (!r.success) return fail(400, "INVALID_INPUT");
      return ok({ result: await d.syncSource(r.data.source) });
    }
    if (p === "admin/pause") {
      const r = z.object({ source: zSource, paused: z.boolean() }).strict().safeParse(body);
      if (!r.success) return fail(400, "INVALID_INPUT");
      await d.setPaused(r.data.source, r.data.paused);
      return ok();
    }
    if (p === "admin/intervals") {
      const h = z.number().min(1).max(168);
      const r = z.object({ source: zSource, intervals: z.object({ within48h: h, within30d: h, later: h }).strict() }).strict().safeParse(body);
      if (!r.success) return fail(400, "INVALID_INPUT");
      await d.setIntervals(r.data.source, r.data.intervals);
      return ok();
    }
    if (p === "admin/hide") {
      const r = z.object({ eventId: z.string().min(3).max(200), hidden: z.boolean() }).strict().safeParse(body);
      if (!r.success) return fail(400, "INVALID_INPUT");
      await d.setHidden(r.data.eventId, r.data.hidden);
      return ok();
    }
    if (p === "admin/purge") {
      const r = z.object({ source: zSource, confirm: z.literal("DELETE") }).strict().safeParse(body);
      if (!r.success) return fail(400, "INVALID_INPUT");
      return ok({ removed: await d.purgeSource(r.data.source) });
    }
    return fail(404, "NOT_FOUND");
  } catch (e) {
    return fromError(e);
  }
}
