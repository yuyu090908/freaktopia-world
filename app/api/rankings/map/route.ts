import { NextResponse } from "next/server";
import { parseRankingQuery } from "@/lib/ranking/query";
import { getMapPins } from "@/lib/ranking/service";
import { PUBLIC_CACHE, apiError, limited } from "@/lib/ranking/guard";
import { handleError } from "../handler";

export const dynamic = "force-dynamic";

/** GET /api/rankings/map: top ranked events as map pins (same filters as /api/rankings). */
export async function GET(req: Request) {
  const blocked = limited(req, "rankings-map");
  if (blocked) return blocked;
  const parsed = parseRankingQuery(new URL(req.url).searchParams);
  if (!parsed.ok) return apiError(400, "INVALID_QUERY", "Invalid ranking query.", { issues: parsed.issues });
  try {
    return NextResponse.json(await getMapPins(parsed.query), { headers: { "Cache-Control": PUBLIC_CACHE } });
  } catch (e) {
    return handleError(e);
  }
}
