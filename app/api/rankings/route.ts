import { rankingsGet } from "./handler";

export const dynamic = "force-dynamic";

/** GET /api/rankings?category=&period=&q=&country=&city=&genre=&status=&price=&level=&dj=&ap=&page=&pageSize= */
export function GET(req: Request) {
  return rankingsGet(req);
}
