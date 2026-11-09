import { NextResponse } from "next/server";
import { getRankingHistory } from "@/lib/ranking/service";
import { PUBLIC_CACHE, apiError, limited } from "@/lib/ranking/guard";
import { handleError } from "@/app/api/rankings/handler";

export const dynamic = "force-dynamic";

/** GET /api/events/:id/ranking-history?days=14 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = limited(req, "history", 60);
  if (blocked) return blocked;
  const { id } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(id)) return apiError(400, "INVALID_ID", "Invalid event id.");
  const days = Number(new URL(req.url).searchParams.get("days") ?? 14);
  if (!Number.isInteger(days) || days < 1 || days > 30) return apiError(400, "INVALID_QUERY", "days must be 1–30.");
  try {
    const res = await getRankingHistory(id, days);
    if (!res) return apiError(404, "EVENT_NOT_FOUND", "Event not found.");
    return NextResponse.json(res, { headers: { "Cache-Control": PUBLIC_CACHE } });
  } catch (e) {
    return handleError(e);
  }
}
