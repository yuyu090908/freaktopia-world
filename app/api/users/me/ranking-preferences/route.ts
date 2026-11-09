import { authRequired, getSessionUser, limited } from "@/lib/ranking/guard";

export const dynamic = "force-dynamic";

/** GET /api/users/me/ranking-preferences (auth required) */
export async function GET(req: Request) {
  const blocked = limited(req, "prefs", 60);
  if (blocked) return blocked;
  const user = await getSessionUser(req);
  if (!user) return authRequired("/rankings?category=for_you");
  // Production: read user_ranking_preferences.
  return Response.json({ personalize: true, genres: [], cities: [], djIds: [], alerts: {} });
}
