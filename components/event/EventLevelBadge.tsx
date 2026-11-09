import type { EventLevel } from "@/lib/types";
import { levelInfo } from "@/lib/levels";
import { cn } from "@/lib/utils";

export function EventLevelBadge({ level, className, long = false }: { level: EventLevel; className?: string; long?: boolean }) {
  const info = levelInfo(level);
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border-2 border-ink px-2.5 py-1 font-display text-[12px] leading-none text-ink", className)}
      style={{ background: info.color }}
      title={`Level ${level}: ${info.name}`}
    >
      LV.{level}
      {long && <span className="font-sans text-[11px] font-extrabold tracking-wide">{info.name}</span>}
    </span>
  );
}
