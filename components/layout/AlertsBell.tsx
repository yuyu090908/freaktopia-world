"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useDemo, useIsHydrated } from "@/lib/store";

/** Header bell: dot when the user follows events with in-app alerts enabled. */
export function AlertsBell() {
  const hydrated = useIsHydrated();
  const follows = useDemo((s) => s.followedEvents.length);
  const consent = useDemo((s) => s.alertsConsent);
  const dot = hydrated && consent && follows > 0;
  return (
    <Link href="/alerts" aria-label={dot ? "Alerts (you follow events)" : "Alerts"} className="relative inline-flex size-11 items-center justify-center rounded-full hover:bg-surface">
      <Bell className="size-5" aria-hidden />
      {dot && <span className="absolute right-2.5 top-2.5 size-2.5 rounded-full border-2 border-ink bg-coral" aria-hidden />}
    </Link>
  );
}
