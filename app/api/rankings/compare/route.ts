import { NextResponse } from "next/server";
import { z } from "zod";
import { compareEvents } from "@/lib/ranking/service";
import { apiError, limited } from "@/lib/ranking/guard";
import { handleError } from "../handler";

export const dynamic = "force-dynamic";

const body = z.object({ eventIds: z.array(z.string().regex(/^[a-z0-9-]{1,80}$/)).min(2).max(3) });

/**
 * POST /api/rankings/compare { eventIds: [2..3] }
 * Returns side-by-side data plus a shareable URL (stateless: ids in the query).
 */
export async function POST(req: Request) {
  const blocked = limited(req, "compare", 30);
  if (blocked) return blocked;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError(400, "INVALID_JSON", "Body must be JSON.");
  }
  const parsed = body.safeParse(json);
  if (!parsed.success) return apiError(400, "INVALID_BODY", "Send 2 or 3 distinct event ids.", { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
  const ids = [...new Set(parsed.data.eventIds)];
  if (ids.length < 2) return apiError(400, "INVALID_BODY", "Send 2 or 3 distinct event ids.");
  try {
    const res = await compareEvents(ids);
    if (res.missing.length) return apiError(404, "EVENT_NOT_FOUND", "Some events were not found.", { missing: res.missing });
    return NextResponse.json({ ...res, shareUrl: `/rankings/compare?ids=${ids.join(",")}` });
  } catch (e) {
    return handleError(e);
  }
}
