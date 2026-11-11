/**
 * FREAK ID & LOYALTY API (Phase 1). Same session, CSRF check, rate limits and zod validation as /api/party.
 *  GET  /api/loyalty/rules            public: the rules in force and an announced future change
 *  GET  /api/loyalty/me               signed in: FREAK ID (rank, verified events, discount, cities, history)
 *  POST /api/loyalty/quote            price breakdown for a checkout, computed on the server from the signed-in rank
 *  GET  /api/loyalty/admin            admins (OPS_ADMIN_EMAILS): rules, rank distribution, exclusions, audit log
 *  POST /api/loyalty/admin/rules      admins: change the rules (benefit cuts need notice + a start ≥ 30 days ahead)
 *  POST /api/loyalty/admin/cancel     admins: cancel an announced change
 *  POST /api/loyalty/admin/exclusions admins: exclude or restore an event in rank counts, with a reason
 */
import { z } from "zod";
import { currentUser, fail, limit, ok, readJson, sameOrigin } from "@/lib/auth/http";
import { clientKey } from "@/lib/ranking/guard";
import * as loyalty from "@/lib/loyalty/service";
import { RANKS } from "@/lib/loyalty/rules";
import { OpsError } from "@/lib/ops/types";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ path?: string[] }> };

const zReason = z.string().trim().min(5).max(500);
const zRules = z
  .object({
    version: z.number().int().nonnegative(),
    feeRatePct: z.number().min(0).max(30),
    maxDiscountPct: z.number().min(0).max(100),
    minFeeUsd: z.number().min(0).max(100),
    fullDiscountEnabled: z.boolean(),
    ranks: z.array(z.object({ rank: z.enum(RANKS), min: z.number().int().min(0).max(10_000), discountPct: z.number().min(0).max(100) }).strict()).length(5),
  })
  .strict();

function fromError(e: unknown) {
  if (e instanceof OpsError) return fail(e.status, e.code, e.extra);
  console.error("[loyalty]", e);
  return fail(500, "SERVER_ERROR");
}

export async function GET(req: Request, { params }: Params) {
  const p = (await params).path?.join("/") ?? "";
  const user = await currentUser();
  const lim = limit("loyalty-read", user?.id ?? clientKey(req), 120, 60_000);
  if (lim) return lim;
  try {
    if (p === "rules") return ok(await loyalty.currentRules());
    if (p === "me") {
      if (!user) return fail(401, "SIGN_IN_REQUIRED");
      return ok({ freakId: await loyalty.freakId(user.id) });
    }
    if (p === "admin") {
      if (!user) return fail(401, "SIGN_IN_REQUIRED");
      return ok(await loyalty.adminOverview(user.id));
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
  const lim = limit("loyalty-write", user?.id ?? clientKey(req), 60, 60_000);
  if (lim) return lim;
  const body = await readJson(req);
  if (!body) return fail(400, "INVALID_BODY");
  try {
    if (p === "quote") {
      const r = z.object({ ticketsUsd: z.number().min(0).max(1_000_000) }).strict().safeParse(body);
      if (!r.success) return fail(400, "INVALID_INPUT");
      return ok({ quote: await loyalty.quote(user?.id ?? null, r.data.ticketsUsd) });
    }
    if (!user) return fail(401, "SIGN_IN_REQUIRED");
    if (p === "admin/rules") {
      const r = z.object({ rules: zRules, reason: zReason, notice: z.string().trim().max(1000).optional(), effectiveAt: z.string().datetime().nullable().optional() }).strict().safeParse(body);
      if (!r.success) return fail(400, "INVALID_INPUT", { field: r.error.issues[0]?.path.join(".") });
      return ok(await loyalty.setRules(user.id, r.data.rules, { reason: r.data.reason, notice: r.data.notice, effectiveAt: r.data.effectiveAt ?? null }));
    }
    if (p === "admin/cancel") {
      const r = z.object({ reason: zReason }).strict().safeParse(body);
      if (!r.success) return fail(400, "REASON_REQUIRED");
      return ok(await loyalty.cancelScheduled(user.id, r.data.reason));
    }
    if (p === "admin/exclusions") {
      const r = z.object({ eventId: z.string().min(1).max(80), exclude: z.boolean(), reason: zReason }).strict().safeParse(body);
      if (!r.success) return fail(400, "INVALID_INPUT", { field: r.error.issues[0]?.path.join(".") });
      return ok(await loyalty.setExclusion(user.id, r.data.eventId, r.data.exclude, r.data.reason));
    }
    return fail(404, "NOT_FOUND");
  } catch (e) {
    return fromError(e);
  }
}
