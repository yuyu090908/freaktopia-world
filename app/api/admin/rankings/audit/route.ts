import { getSource } from "@/lib/ranking/source";
import { computeMetrics } from "@/lib/ranking/engine";
import { apiError, isAdmin, readAudit } from "@/lib/ranking/guard";
import { handleError } from "@/app/api/rankings/handler";

export const dynamic = "force-dynamic";

/** GET /api/admin/rankings/audit: per-event exclusion counts + audit log (Bearer RANKING_ADMIN_TOKEN). */
export async function GET(req: Request) {
  if (!isAdmin(req)) return apiError(403, "FORBIDDEN", "Admin token required.");
  try {
    const src = await getSource();
    const events = await src.events();
    const rows = [];
    for (const ev of events) {
      const act = await src.activity(ev.id);
      if (!act) continue;
      const m = computeMetrics(act, "all", src.asOf(), src.fx());
      rows.push({ eventId: ev.id, supporters: m.supporters_count, excluded: m.excluded });
    }
    return Response.json({ mode: src.mode, rows, log: readAudit() });
  } catch (e) {
    return handleError(e);
  }
}
