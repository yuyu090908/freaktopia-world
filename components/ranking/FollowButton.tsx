"use client";

import { useTranslations } from "next-intl";
import { Bell, BellRing } from "lucide-react";
import { toast, useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Follow toggle. Phase 1 stores follows in this browser (demo). With auth,
 * this calls POST/DELETE /api/events/:id/follow and sends signed-out users to
 * the login URL from the 401 response, returning them to ?action=follow.
 */
export function FollowButton({ eventId, eventName, compact = false, className }: { eventId: string; eventName: string; compact?: boolean; className?: string }) {
  const tu = useTranslations("ranking");
  const following = useDemo((s) => s.followedEvents.includes(eventId));
  const toggle = useDemo((s) => s.toggleFollow);
  const onClick = () => {
    const now = toggle(eventId);
    toast({
      title: now ? tu("following") : tu("unfollowed"),
      body: now ? tu("eventnameAlertsAppearInYour", { eventName }) : tu("eventnameRemovedFromYourFollows", { eventName }),
      tone: now ? "success" : "default",
    });
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={following}
      aria-label={compact ? `${following ? tu("unfollow") : tu("follow")} ${eventName}` : undefined}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border-2 px-4 text-sm font-extrabold uppercase transition-colors",
        following ? "border-acid bg-acid/15 text-acid" : "border-cream/25 bg-ink/60 text-cream hover:border-cream/60",
        compact && "size-11 px-0",
        className,
      )}
    >
      {following ? <BellRing className="size-4" aria-hidden /> : <Bell className="size-4" aria-hidden />}
      {!compact && (following ? tu("following") : tu("follow"))}
    </button>
  );
}
