import { rankingsGet } from "../handler";

export const dynamic = "force-dynamic";

/** GET /api/rankings/top: the first 3 entries of any ranking query. */
export function GET(req: Request) {
  return rankingsGet(req, { page: 1, pageSize: 3 });
}
