"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, BellRing, Globe2, MapPin, UserCheck, UserPlus } from "lucide-react";
import { AlienAvatar } from "@/components/cards/Cards";
import { Tag } from "@/components/ui/primitives";
import type { LiveDetail } from "@/lib/live/client";
import { durationMin, fmtInTz, tzLabel } from "@/lib/live/time";
import { toast, useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";

export function Schedule({ detail, clockNow, tz, userTz }: { detail: LiveDetail; clockNow: number; tz: string; userTz: string }) {
  const [stage, setStage] = useState(detail.stages[0]?.id ?? "main");
  const liveTz = useDemo((s) => s.liveTz);
  const setLive = useDemo((s) => s.setLive);
  const reminders = useDemo((s) => s.liveReminders);
  const toggleReminder = useDemo((s) => s.toggleReminder);
  const favorites = useDemo((s) => s.favorites);
  const toggleFavorite = useDemo((s) => s.toggleFavorite);
  const sets = detail.sets.filter((s) => s.stageId === stage).sort((a, b) => a.startAt - b.startAt);
  const showTz = liveTz === "local" ? userTz : tz;
  const running = detail.status === "demo_live" || detail.status === "live";
  const nextId = running ? sets.find((s) => s.startAt > clockNow)?.id : sets[0]?.id;

  return (
    <section aria-labelledby="tt-h" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="tt-h" className="text-[28px] uppercase">Timetable</h2>
        <div className="flex rounded-full border-2 border-line p-0.5 text-[13px] font-bold" role="group" aria-label="Time zone">
          <button type="button" aria-pressed={liveTz === "venue"} onClick={() => setLive({ liveTz: "venue" })} className={cn("inline-flex min-h-10 items-center gap-1 rounded-full px-3", liveTz === "venue" && "bg-acid text-ink")}>
            <MapPin className="size-3.5" aria-hidden /> Venue time
          </button>
          <button type="button" aria-pressed={liveTz === "local"} onClick={() => setLive({ liveTz: "local" })} className={cn("inline-flex min-h-10 items-center gap-1 rounded-full px-3", liveTz === "local" && "bg-acid text-ink")}>
            <Globe2 className="size-3.5" aria-hidden /> My time
          </button>
        </div>
      </div>
      <p className="text-[12px] text-mute">
        Times in {liveTz === "venue" ? `venue time (${tz}, ${tzLabel(clockNow, tz)})` : `your time (${userTz}, ${tzLabel(clockNow, userTz)})`}. Sets after midnight belong to the next calendar day. {detail.clock.demo && "Now / next follow the DEMO CLOCK."}
      </p>
      <div className="flex gap-2" role="tablist" aria-label="Stage">
        {detail.stages.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={stage === s.id} onClick={() => setStage(s.id)} className={cn("min-h-11 flex-1 rounded-full border-2 px-3 text-sm font-bold", stage === s.id ? "border-acid bg-acid text-ink" : "border-line")}>
            {s.name}
          </button>
        ))}
      </div>
      <ol className="overflow-hidden rounded-3xl border border-line" data-testid="timetable">
        {sets.map((s) => {
          const now = running && s.startAt <= clockNow && clockNow < s.endAt;
          const done = running && s.endAt <= clockNow;
          const reminded = reminders.includes(s.id);
          const following = favorites.includes(s.dj.id);
          return (
            <li key={s.id} className={cn("border-b border-line p-3 last:border-0", now ? "bg-coral/15" : "bg-surface", done && "opacity-60")} data-testid={now ? "set-now" : undefined}>
              <div className="flex items-center gap-3">
                <AlienAvatar look={s.dj.look} size={48} ring={now ? "#FF625C" : "#2a2a2a"} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="whitespace-nowrap font-display text-sm">
                      {fmtInTz(s.startAt, showTz)}–{fmtInTz(s.endAt, showTz)}
                    </span>
                    <span className="text-[12px] text-mute">{durationMin(s)} min</span>
                    {liveTz === "local" && fmtInTz(s.startAt, showTz, { day: "numeric" }) !== fmtInTz(s.startAt, tz, { day: "numeric" }) && <span className="text-[11px] text-orange">({fmtInTz(s.startAt, showTz, { month: "short", day: "numeric" })})</span>}
                    {now && <Tag color="#FF625C" dark>Now</Tag>}
                    {s.id === nextId && !now && <Tag color="#A276E9" dark>Next</Tag>}
                  </div>
                  <Link href={`/djs/${s.dj.id}`} className="block truncate font-bold hover:text-acid" data-inline>{s.dj.name}</Link>
                  <div className="truncate text-[12px] text-mute">{s.dj.genres.join(" / ")} · from {s.dj.city}</div>
                </div>
              </div>
              <div className="mt-2 flex gap-2 pl-[60px]">
                <button
                  type="button"
                  aria-pressed={following}
                  onClick={() => {
                    const on = toggleFavorite(s.dj.id);
                    toast({ title: on ? `Following ${s.dj.name}` : `Unfollowed ${s.dj.name}` });
                  }}
                  className={cn("inline-flex min-h-11 items-center gap-1 rounded-full border-2 px-3 text-[13px] font-bold", following ? "border-acid bg-acid text-ink" : "border-line")}
                >
                  {following ? <UserCheck className="size-4" aria-hidden /> : <UserPlus className="size-4" aria-hidden />} {following ? "Following" : "Follow"}
                </button>
                {!done && !now && (
                  <button
                    type="button"
                    aria-pressed={reminded}
                    aria-label={`${reminded ? "Remove reminder for" : "Remind me about"} ${s.dj.name}`}
                    onClick={() => {
                      const on = toggleReminder(s.id);
                      toast({ title: on ? "Reminder set (demo)" : "Reminder removed", body: on ? "Shown in this browser only. No push or email is sent in the demo." : undefined });
                    }}
                    className={cn("inline-flex min-h-11 items-center gap-1 rounded-full border-2 px-3 text-[13px] font-bold", reminded ? "border-purple bg-purple text-ink" : "border-line")}
                  >
                    {reminded ? <BellRing className="size-4" aria-hidden /> : <Bell className="size-4" aria-hidden />} {reminded ? "Reminder on" : "Remind me"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
