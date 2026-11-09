import { NextResponse } from "next/server";
import { parseRankingQuery } from "@/lib/ranking/query";
import { getRankings } from "@/lib/ranking/service";
import { DataSourceNotConfigured } from "@/lib/ranking/source";
import type { RankingQuery } from "@/lib/ranking/types";
import { PUBLIC_CACHE, apiError, limited } from "@/lib/ranking/guard";

/** Shared GET handler: parse + validate the query, apply overrides, rank. */
export async function rankingsGet(req: Request, override?: Partial<RankingQuery>) {
  const blocked = limited(req, "rankings");
  if (blocked) return blocked;
  const parsed = parseRankingQuery(new URL(req.url).searchParams);
  if (!parsed.ok) return apiError(400, "INVALID_QUERY", "Invalid ranking query.", { issues: parsed.issues });
  const q = { ...parsed.query, ...override };
  try {
    const res = await getRankings(q);
    return NextResponse.json(res, { headers: { "Cache-Control": q.personalization ? "private, no-store" : PUBLIC_CACHE } });
  } catch (e) {
    return handleError(e);
  }
}

export function handleError(e: unknown) {
  if (e instanceof DataSourceNotConfigured) return apiError(503, e.code, e.message);
  console.error(e);
  return apiError(500, "INTERNAL", "Ranking calculation failed.");
}
