import { authRequired, apiError, getSessionUser, limited, writeAudit } from "@/lib/ranking/guard";
import { getEvent } from "@/lib/data";

export const dynamic = "force-dynamic";

async function handle(req: Request, params: Promise<{ id: string }>, follow: boolean) {
  const blocked = limited(req, "follow", 30);
  if (blocked) return blocked;
  const { id } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(id) || !getEvent(id)) return apiError(404, "EVENT_NOT_FOUND", "Event not found.");
  const user = await getSessionUser(req);
  if (!user) return authRequired(`/events/${id}?action=follow`);
  // Production: upsert / delete user_event_follows (unique (user_id, event_id)).
  writeAudit({ actor: user.id, action: follow ? "event.follow" : "event.unfollow", detail: { eventId: id } });
  return new Response(null, { status: 204 });
}

/** POST /api/events/:id/follow (auth required) */
export function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, ctx.params, true);
}

/** DELETE /api/events/:id/follow (auth required) */
export function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, ctx.params, false);
}
