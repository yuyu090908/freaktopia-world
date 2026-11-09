import { rankingsGet } from "../handler";

export const dynamic = "force-dynamic";

/** GET /api/rankings/trending: shortcut for category=trending (defaults to 7 days). */
export function GET(req: Request) {
  const url = new URL(req.url);
  if (!url.searchParams.get("period")) url.searchParams.set("period", "7d");
  url.searchParams.set("category", "trending");
  return rankingsGet(new Request(url, req));
}
