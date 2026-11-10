"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Music2, Users } from "lucide-react";
import type { FreakEvent } from "@/lib/types";
import { EventCover } from "@/components/cards/Cards";
import { DemoBadge, Progress } from "@/components/ui/primitives";
import { useEventStats } from "@/lib/store";
import { fmtDate, money } from "@/lib/utils";

/** Big "EVENT OPEN" spotlight card, after the FREAKTOPIA mobile mockups. */
export function HomeFeatured({ event }: { event: FreakEvent }) {
  const tu = useTranslations("home");
  const s = useEventStats(event);
  const pct = Math.round((s.raised / event.goal) * 100);
  return (
    <article className="neon-acid relative grid overflow-hidden rounded-[28px] border-2 bg-surface md:grid-cols-[1.1fr_1fr]">
      <Link href={`/events/${event.id}`} className="relative block aspect-[16/10] md:aspect-auto md:min-h-[320px]" tabIndex={-1} aria-hidden="true">
        <EventCover id={event.id} sizes="(min-width:768px) 560px, 100vw" />
        <span className="absolute left-3 top-3 -rotate-6 rounded-2xl border-[3px] border-ink bg-coral px-3 py-1.5 font-display text-lg uppercase text-ink shadow-[0_4px_0_#080808]">
          {tu("eventOpen")}
        </span>
        <DemoBadge className="absolute right-3 top-3 bg-ink" />
      </Link>
      <div className="flex flex-col gap-3 p-4 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[28px] uppercase italic leading-[0.92] sm:text-4xl">
            <Link href={`/events/${event.id}`} className="hover:text-acid">{event.name}</Link>
          </h3>
          <span className="shrink-0 -rotate-6 rounded-2xl border-[3px] border-ink bg-acid px-2.5 py-1 font-display text-2xl italic leading-none text-ink shadow-[0_0_18px_-2px_rgba(182,240,92,0.7)]">LV.{s.level}</span>
        </div>
        <ul className="space-y-1.5 text-sm text-cream/90">
          <li className="flex items-center gap-2"><MapPin className="size-4 text-acid" aria-hidden />{event.city}, {event.country}</li>
          <li className="flex items-center gap-2"><CalendarDays className="size-4 text-acid" aria-hidden /><time dateTime={event.startsAt}>{fmtDate(event.startsAt, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</time></li>
          <li className="flex items-center gap-2"><Music2 className="size-4 text-acid" aria-hidden />{event.genres.join(" / ")}</li>
        </ul>
        <div className="mt-1 flex items-center justify-between text-sm font-bold">
          <span className="inline-flex items-center gap-1.5"><Users className="size-4" aria-hidden />{tu("tolocalestringSupporters", { toLocaleString: s.supporters.toLocaleString("en-US") })}</span>
          <span>{money(s.raised)} / {money(event.goal)}</span>
        </div>
        <div className="flex items-center gap-3">
          <Progress value={s.raised / event.goal} label={tu("pctOfFundingGoal", { pct })} />
          <span className="shrink-0 whitespace-nowrap text-sm font-bold">{pct}%</span>
        </div>
        <Link href={`/events/${event.id}`} className="mt-auto inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-coral px-6 font-extrabold uppercase text-ink shadow-[0_4px_0_0_#9b2f2b] hover:bg-[#ff7a75]">
          {tu("supportJoin")} <ArrowRight className="size-5" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
