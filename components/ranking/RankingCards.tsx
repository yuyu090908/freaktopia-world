"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, CalendarDays, Check, GitCompareArrows, HandHeart, MapPin, Mic2, Minus, Ticket, Trophy } from "lucide-react";
import { EventCover } from "@/components/cards/Cards";
import { EventLevelBadge } from "@/components/event/EventLevelBadge";
import { FollowButton } from "./FollowButton";
import { DemoBadge, Progress, Tag } from "@/components/ui/primitives";
import { toast, useDemo } from "@/lib/store";
import { CATEGORY_META, primaryLabel, secondaryMetrics } from "@/lib/ranking/meta";
import type { RankedEntry, RankingCategory } from "@/lib/ranking/types";
import { cn, fmtDate } from "@/lib/utils";

const STATUS: Record<string, { label: string; color: string }> = {
  funding: { label: "Funding", color: "#FFAD5B" },
  confirmed: { label: "Confirmed", color: "#55BCEB" },
  live: { label: "● Live", color: "#FF625C" },
  ended: { label: "Completed", color: "#b9b5ab" },
};

export function RankMove({ e }: { e: RankedEntry }) {
  if (e.previousRank === null) return <span className="text-[11px] font-extrabold uppercase text-blue">New</span>;
  const d = e.previousRank - e.rank;
  if (d === 0) return <span className="inline-flex items-center text-mute"><Minus className="size-3.5" aria-hidden /><span className="sr-only">No change</span></span>;
  return d > 0 ? (
    <span className="inline-flex items-center text-[12px] font-extrabold text-acid"><ArrowUp className="size-3.5" aria-hidden /><span className="sr-only">Up</span>{d}</span>
  ) : (
    <span className="inline-flex items-center text-[12px] font-extrabold text-coral"><ArrowDown className="size-3.5" aria-hidden /><span className="sr-only">Down</span>{-d}</span>
  );
}

function CompareToggle({ id, name }: { id: string; name: string }) {
  const on = useDemo((s) => s.compareIds.includes(id));
  const toggle = useDemo((s) => s.toggleCompare);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`${on ? "Remove" : "Add"} ${name} ${on ? "from" : "to"} compare`}
      onClick={() => {
        const r = toggle(id);
        if (r === "full") toast({ title: "Compare is full", body: "最大3イベントまで比較できます。", tone: "error" });
      }}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        on ? "border-blue bg-blue text-ink" : "border-cream/25 bg-ink/60 text-cream hover:border-cream/60",
      )}
    >
      {on ? <Check className="size-4" aria-hidden /> : <GitCompareArrows className="size-4" aria-hidden />}
    </button>
  );
}

/** Action row shared by all ranking cards (wired to existing features). */
export function RankActions({ e }: { e: RankedEntry }) {
  const ev = e.event;
  const open = ev.status !== "ended";
  const pill = "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-extrabold uppercase";
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      <Link href={`/events/${ev.id}`} className={cn(pill, "bg-cream text-ink hover:bg-white")}>
        View event
      </Link>
      {open && (
        <Link href={`/events/${ev.id}?action=support`} className={cn(pill, "bg-acid text-ink")}>
          <HandHeart className="size-4" aria-hidden /> Support
        </Link>
      )}
      {open && ev.minPrice >= 0 && (
        <Link href={`/events/${ev.id}/tickets`} className={cn(pill, "bg-coral text-ink")}>
          <Ticket className="size-4" aria-hidden /> Buy ticket
        </Link>
      )}
      {open && ev.djRecruiting && (
        <Link href={`/djs/apply?event=${ev.id}`} className={cn(pill, "bg-purple text-ink")}>
          <Mic2 className="size-4" aria-hidden /> Apply as DJ
        </Link>
      )}
      <FollowButton eventId={ev.id} eventName={ev.name} compact />
      <CompareToggle id={ev.id} name={ev.name} />
    </div>
  );
}

function Meta({ e }: { e: RankedEntry }) {
  const ev = e.event;
  const st = STATUS[ev.status];
  return (
    <>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-mute">
        <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{ev.city}</span>
        <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" aria-hidden /><time dateTime={ev.startsAt}>{fmtDate(ev.startsAt, { month: "short", day: "numeric", year: "numeric" })}</time></span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <EventLevelBadge level={ev.level} />
        <Tag color={st.color} dark>{st.label}</Tag>
        <Tag>{ev.genres[0]}</Tag>
        {ev.isDemo && <DemoBadge />}
      </div>
    </>
  );
}

function Metrics({ e, category }: { e: RankedEntry; category: RankingCategory }) {
  const p = primaryLabel(e, category);
  const sec = secondaryMetrics(category, e.metrics);
  const pct = Math.min(1, e.metrics.funding_usd / Math.max(1, e.event.goal));
  return (
    <div className="mt-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-[26px] leading-none" style={{ color: CATEGORY_META[category].color }}>{p.value}</div>
          <div className="mt-1 text-[12px] font-bold uppercase tracking-wider text-mute">{p.label}</div>
        </div>
        <dl className="flex min-w-0 shrink-0 gap-3 text-right">
          {sec.map((s) => (
            <div key={s.key}>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-mute">{s.label}</dt>
              <dd className="text-sm font-extrabold">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <Progress value={pct} className="h-2.5 border" label={`${Math.round(pct * 100)}% of funding goal`} />
        <span className="shrink-0 text-[11px] font-bold text-mute">{Math.round(pct * 100)}% funded</span>
      </div>
    </div>
  );
}

/** Rank 4+ : one-column card. */
export function RankingCard({ e, category }: { e: RankedEntry; category: RankingCategory }) {
  return (
    <article className="neon cv-auto min-w-0 rounded-[24px] border bg-surface/95 p-3 [contain-intrinsic-size:auto_330px]" aria-labelledby={`rk-${e.event.id}`}>
      <div className="flex gap-3">
        <div className="flex w-9 shrink-0 flex-col items-center pt-1">
          <span className="font-display text-[26px] leading-none">{e.rank}</span>
          <RankMove e={e} />
        </div>
        <Link href={`/events/${e.event.id}`} tabIndex={-1} aria-hidden="true" className="relative size-20 shrink-0 overflow-hidden rounded-2xl sm:size-24">
          <EventCover id={e.event.id} sizes="96px" />
        </Link>
        <div className="min-w-0 flex-1">
          <h3 id={`rk-${e.event.id}`} className="-my-3 text-lg uppercase leading-none">
            <Link href={`/events/${e.event.id}`} className="block truncate py-3.5 hover:text-acid">{e.event.name}</Link>
          </h3>
          <Meta e={e} />
        </div>
      </div>
      <Metrics e={e} category={category} />
      <div className="mt-3">
        <RankActions e={e} />
      </div>
    </article>
  );
}

const MEDAL = ["#B6F05C", "#55BCEB", "#FFAD5B"];

/** #1: big hero card. */
export function TopOneCard({ e, category }: { e: RankedEntry; category: RankingCategory }) {
  return (
    <article className="neon-acid relative overflow-hidden rounded-[28px] border-2 bg-surface" aria-labelledby={`rk-${e.event.id}`}>
      <div className="relative aspect-[16/10] sm:aspect-[16/8]">
        <EventCover id={e.event.id} sizes="(min-width:768px) 720px, 100vw" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/10 to-transparent" aria-hidden />
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <span className="rk-pop inline-flex items-center gap-1.5 rounded-2xl border-[3px] border-ink bg-acid px-3 py-1 font-display text-2xl text-ink shadow-[0_4px_0_#080808]">
            <Trophy className="size-5" aria-hidden /> #1
          </span>
          <span className="rounded-full bg-ink/85 px-2 py-1"><RankMove e={e} /></span>
        </div>
      </div>
      <div className="relative -mt-10 p-4">
        <h3 id={`rk-${e.event.id}`} className="text-[30px] uppercase italic leading-[0.92] sm:text-4xl">
          <Link href={`/events/${e.event.id}`} className="inline-block min-h-11 py-1 hover:text-acid">{e.event.name}</Link>
        </h3>
        <Meta e={e} />
        <Metrics e={e} category={category} />
        <div className="mt-3">
          <RankActions e={e} />
        </div>
      </div>
    </article>
  );
}

/** #2 / #3: compact cards. */
export function TopSmallCard({ e, category }: { e: RankedEntry; category: RankingCategory }) {
  const p = primaryLabel(e, category);
  const color = MEDAL[e.rank - 1] ?? "#F5F2EA";
  return (
    <article className="neon flex w-[78vw] max-w-[340px] flex-col overflow-hidden rounded-[24px] border bg-surface sm:w-auto sm:max-w-none" aria-labelledby={`rk-${e.event.id}`}>
      <div className="relative aspect-[16/9]">
        <EventCover id={e.event.id} sizes="(min-width:640px) 340px, 78vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" aria-hidden />
        <span className="absolute left-3 top-3 rounded-2xl border-[3px] border-ink px-2.5 py-0.5 font-display text-xl text-ink shadow-[0_3px_0_#080808]" style={{ background: color }}>
          #{e.rank}
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-ink/85 px-2 py-1"><RankMove e={e} /></span>
      </div>
      <div className="flex flex-1 flex-col p-3 pt-0">
        <h3 id={`rk-${e.event.id}`} className="-my-3 text-xl uppercase leading-none">
          <Link href={`/events/${e.event.id}`} className="block truncate py-3 hover:text-acid">{e.event.name}</Link>
        </h3>
        <Meta e={e} />
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-display text-2xl" style={{ color: CATEGORY_META[category].color }}>{p.value}</span>
          <span className="text-[12px] font-bold uppercase text-mute">{p.label}</span>
        </div>
        <div className="mt-2">
          <RankActions e={e} />
        </div>
      </div>
    </article>
  );
}
