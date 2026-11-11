"use client";

import { useTranslations } from "next-intl";
import type { DisplayStatus } from "@/lib/event-status";
import { cn } from "@/lib/utils";

/**
 * Event status as a badge. Status colours (danger for live, success for confirmed) are never used for actions.
 * "demo_live" always says DEMO so a simulation is never mistaken for a broadcast.
 */
const STYLE: Record<DisplayStatus, string> = {
  live: "border-danger bg-danger/15 text-danger",
  demo_live: "border-danger/70 bg-danger/10 text-danger",
  confirmed: "border-success/70 bg-success/10 text-success",
  funding: "border-blue/70 bg-blue/10 text-blue",
  completed: "border-line bg-surface-2 text-mute",
  cancelled: "border-line bg-surface-2 text-mute line-through",
};

export function StatusBadge({ status, className }: { status: DisplayStatus; className?: string }) {
  const t = useTranslations("status");
  const label = status === "demo_live" ? t("demoLive") : status === "completed" ? t("completed") : t(status);
  return (
    <span data-status={status} className={cn("inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-extrabold uppercase tracking-wide", STYLE[status], className)}>
      {(status === "live" || status === "demo_live") && <span className="size-2 rounded-full bg-danger" aria-hidden />}
      {label}
    </span>
  );
}
