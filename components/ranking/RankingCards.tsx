"use client";

import { Tx } from "@/components/i18n/Tx";
import { type Tu } from "@/lib/i18n/tu";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { ArrowDown, ArrowUp, CalendarDays, Check, ChevronDown, GitCompareArrows, HandHeart, Landmark, MapPin, Mic2, Minus, Ticket, Trophy } from "lucide-react";
import { EventCover } from "@/components/cards/Cards";
import { EventLevelBadge } from "@/components/event/EventLevelBadge";
import { FollowButton } from "./FollowButton";
import { DemoBadge, Progress, Tag } from "@/components/ui/primitives";
import { toast, useDemo } from "@/lib/store";
import { CATEGORY_META, primaryLabel, secondaryMetrics } from "@/lib/ranking/meta";
import type { RankedEntry, RankingCategory } from "@/lib/ranking/types";
import { cn, fmtDate } from "@/lib/utils";

const STATUS = (tu: Tu): Record<string, { label: string; color: string }> => ({
  funding: { label: tu("funding"), color: "#FFAD5B" },
  confirmed: { label: tu("confirmed"), color: "#55BCEB" },
  live: { label: tu("live"), color: "#FF625C" },
  ended: { label: tu("completed"), color: "#b9b5ab" },
});

export function RankMove({ e }: { e: RankedEntry }) {
  const tu = useTranslations("ranking");
  if (e.previousRank === null) return <span className="text-[11px] font-extrabold uppercase text-blue">{tu("new")}</span>;
  const d = e.previousRank - e.rank;
  if (d === 0) return <span className="inline-flex items-center text-mute"><Minus className="size-3.5" aria-hidden /><span className="sr-only">{tu("noChange")}</span></span>;
  return d > 0 ? (
    <span className="inline-flex items-center text-[12px] font-extrabold text-acid"><ArrowUp className="size-3.5" aria-hidden /><span className="sr-only">{tu("up")}</span>{d}</span>
  ) : (
    <span className="inline-flex items-center text-[12px] font-extrabold text-coral"><ArrowDown className="size-3.5" aria-hidden /><span className="sr-only">{tu("down")}</span>{-d}</span>
  );
}

function CompareToggle({ id, name }: { id: string; name: string }) {
  const tu = useTranslations("ranking");
  const on = useDemo((s) => s.compareIds.includes(id));
  const toggle = useDemo((s) => s.toggleCompare);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? tu("compareRemove", { name }) : tu("compareAdd", { name })}
      onClick={() => {
        const r = toggle(id);
        if (r === "full") toast({ title: tu("compareIsFull"), body: "最大3イベントまで比較できます。", tone: "error" });
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
  const tu = useTranslations("ranking");
  const ev = e.event;
  const open = ev.status !== "ended";
  const pill = "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-extrabold uppercase";
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      <Link href={`/events/${ev.id}`} className={cn(pill, "bg-cream text-ink hover:bg-white")}>
        {tu("viewEvent")}
      </Link>
      {open && (
        <Link href={`/events/${ev.id}?action=support`} className={cn(pill, "bg-acid text-ink")}>
          <HandHeart className="size-4" aria-hidden /> {tu("support")}
        </Link>
      )}
      {open && ev.minPrice >= 0 && (
        <Link href={`/events/${ev.id}/tickets`} className={cn(pill, "bg-coral text-ink")}>
          <Ticket className="size-4" aria-hidden /> {tu("buyTicket")}
        </Link>
      )}
      {open && ev.djRecruiting && (
        <Link href={`/djs/apply?event=${ev.id}`} className={cn(pill, "bg-purple text-ink")}>
          <Mic2 className="size-4" aria-hidden /> {tu("applyAsDj")}
        </Link>
      )}
      <FollowButton eventId={ev.id} eventName={ev.name} compact />
      <CompareToggle id={ev.id} name={ev.name} />
    </div>
  );
}

function Meta({ e }: { e: RankedEntry }) {
  const tu = useTranslations("ranking");
  const ev = e.event;
  const st = STATUS(tu)[ev.status];
  return (
    <>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-mute">
        <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{ev.city}</span>
        <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" aria-hidden /><time dateTime={ev.startsAt}>{fmtDate(ev.startsAt, { month: "short", day: "numeric", year: "numeric" })}</time></span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <EventLevelBadge level={ev.level} />
        <Tag color={st.color} dark><Tx>{st.label}</Tx></Tag>
        <Tag>{ev.genres[0]}</Tag>
        {ev.isDemo && <DemoBadge />}
      </div>
      {ev.dao && (
        <Link href={`/dao/${ev.id}`} className="relative z-[1] mt-2 inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border border-acid/50 px-3 text-[11px] font-extrabold uppercase text-acid hover:bg-acid/10" data-testid="rank-dao">
          <Landmark className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{tu("daoMembersMembersActiveproposalsProp", { members: ev.dao.members, activeProposals: ev.dao.activeProposals, round: Math.round(ev.dao.participationRate * 100) })}</span>
        </Link>
      )}
    </>
  );
}

function Metrics({ e, category }: { e: RankedEntry; category: RankingCategory }) {
  const tu = useTranslations("ranking");
  const p = primaryLabel(e, category);
  const sec = secondaryMetrics(category, e.metrics);
  const pct = Math.min(1, e.metrics.funding_usd / Math.max(1, e.event.goal));
  return (
    <div className="mt-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-[26px] leading-none" style={{ color: CATEGORY_META[category].color }}>{p.value}</div>
          <div className="mt-1 text-[12px] font-bold uppercase tracking-wider text-mute"><Tx>{p.label}</Tx></div>
        </div>
        <dl className="flex min-w-0 shrink-0 gap-3 text-right">
          {sec.map((s) => (
            <div key={s.key}>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-mute"><Tx>{s.label}</Tx></dt>
              <dd className="text-sm font-extrabold">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <Progress value={pct} className="h-2.5 border" label={tu("roundOfFundingGoal", { round: Math.round(pct * 100) })} />
        <span className="shrink-0 text-[11px] font-bold text-mute">{tu("roundFunded", { round: Math.round(pct * 100) })}</span>
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
          <span className="text-[12px] font-bold uppercase text-mute"><Tx>{p.label}</Tx></span>
        </div>
        <div className="mt-2">
          <RankActions e={e} />
        </div>
      </div>
    </article>
  );
}

/**
 * Rank 4+ as a row: rank, cover, name, the category's main number. Tapping the row opens the details
 * (secondary metrics and actions) in place; the name links to the event.
 */
export function RankingRow({ e, category }: { e: RankedEntry; category: RankingCategory }) {
  const tu = useTranslations("ranking");
  const [open, setOpen] = useState(false);
  const p = primaryLabel(e, category);
  const id = `rk-${e.event.id}`;
  return (
    <article className="min-w-0 rounded-[16px] border border-line bg-surface-2 focus-within:border-acid" aria-labelledby={id} data-testid="ranking-row">
      <div className="relative flex min-h-16 items-center gap-3 p-2.5">
        <div className="flex w-9 shrink-0 flex-col items-center">
          <span className="font-display text-[20px] leading-none">{e.rank}</span>
          <RankMove e={e} />
        </div>
        <span className="relative size-12 shrink-0 overflow-hidden rounded-xl" aria-hidden="true">
          <EventCover id={e.event.id} sizes="48px" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={id} className="truncate text-[16px] uppercase leading-tight">
            <Link href={`/events/${e.event.id}`} className="outline-none after:absolute after:inset-0 after:content-[''] hover:text-acid focus-visible:underline">{e.event.name}</Link>
          </h3>
          <p className="truncate text-[13px] text-mute">{e.event.city} · {fmtDate(e.event.startsAt, { month: "short", day: "numeric" })}{e.event.isDemo ? " · DEMO" : ""}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-[18px] leading-none" style={{ color: CATEGORY_META[category].color }}>{p.value}</div>
          <div className="mt-0.5 max-w-24 truncate text-[11px] font-bold uppercase text-mute"><Tx>{p.label}</Tx></div>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls={`${id}-more`} aria-label={tu("rowDetails", { name: e.event.name })} className="relative z-10 inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-surface">
          <ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      </div>
      {open && (
        <div id={`${id}-more`} className="border-t border-line px-3 pb-3">
          <Metrics e={e} category={category} />
          <div className="mt-3"><RankActions e={e} /></div>
        </div>
      )}
    </article>
  );
}
