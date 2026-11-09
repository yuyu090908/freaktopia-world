import { _clearRankingCache } from "@/lib/ranking/service";
import { apiError, isAdmin, writeAudit } from "@/lib/ranking/guard";

export const dynamic = "force-dynamic";

/** POST /api/admin/rankings/recalculate: drop cached snapshots (Bearer RANKING_ADMIN_TOKEN). */
export async function POST(req: Request) {
  if (!isAdmin(req)) return apiError(403, "FORBIDDEN", "Admin token required.");
  _clearRankingCache();
  writeAudit({ actor: "admin", action: "ranking.recalculate", detail: {} });
  return Response.json({ ok: true, at: new Date().toISOString() });
}
