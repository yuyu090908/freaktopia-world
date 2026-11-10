"use client";

import { Tx } from "@/components/i18n/Tx";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CalendarDays, MapPin, ShieldCheck, Users } from "lucide-react";
import { EventCover } from "@/components/cards/Cards";
import { Button, ButtonLink, DemoBadge } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/States";
import { getEvent } from "@/lib/data";
import { STATUS_META } from "@/lib/dao/meta";
import { cn, compact as compactNum, fmtDate } from "@/lib/utils";
import { useDao } from "./DaoContext";
import { JoinDao } from "./JoinDao";
import { LaunchDao } from "./LaunchDao";

const TABS = [
  ["", "tabHome"],
  ["votes", "tabVotes"],
  ["discussion", "tabDiscussion"],
  ["proposals", "tabProposals"],
  ["stage-designer", "tabStageDesigner"],
  ["gallery", "tabGallery"],
  ["treasury", "tabTreasury"],
  ["roadmap", "tabRoadmap"],
  ["members", "tabMembers"],
  ["settings", "tabSettings"],
] as const;

export function DaoShell({ children }: { children: ReactNode }) {
  const tu = useTranslations("dao");
  const { eventId, home, state, error, reload, joinOpen, setJoinOpen } = useDao();
  const path = usePathname();
  const ev = getEvent(eventId);

  if (state.status === "loading") return <LoadingSkeleton variant="page" />;
  if (error?.code === "DAO_NOT_FOUND" && ev) return <LaunchDao eventId={eventId} onDone={() => reload()} />;
  if (error || !home) return <ErrorState title={tu("daoUnavailable")} body={error?.code === "DATA_SOURCE_NOT_CONFIGURED" ? tu("theProductionDaoDatabaseIs") : (error?.message ?? tu("tryAgain"))} retry={<Button onClick={() => reload()}>{tu("retry")}</Button>} />;
  if (!ev) return <EmptyState title={tu("unknownEvent")} />;

  const st = STATUS_META[home.dao.status];
  const me = home.me;
  const base = `/dao/${eventId}`;

  return (
    <div className="pb-10">
      <header className="relative overflow-hidden md:mx-6 md:mt-4 md:rounded-[28px] md:border-2 md:border-purple/40">
        <div className="absolute inset-0" aria-hidden>
          <EventCover id={eventId} sizes="(min-width:1152px) 1100px, 100vw" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/80 to-ink/30" />
        </div>
        <div className="relative px-4 pb-4 pt-16 md:px-6 md:pt-24">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-ink" style={{ background: st.color }}>
              <Tx>{st.label}</Tx>
            </span>
            <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-acid">{tu("communityDao")}</span>
            {home.dao.isDemo && <DemoBadge />}
          </div>
          <p className="mt-2 font-display text-[28px] uppercase leading-none drop-shadow-[0_3px_0_#080808] sm:text-5xl">
            <Link href={`/events/${eventId}`} className="hover:text-acid">
              {ev.name}
            </Link>
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-mute">
            <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{ev.city}, {ev.country}</span>
            <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" aria-hidden /><time dateTime={ev.startsAt}>{fmtDate(ev.startsAt, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</time></span>
            <span className="inline-flex items-center gap-1"><Users className="size-3.5" aria-hidden />{tu("compactnumMembers", { compactNum: compactNum(home.summary.members) })}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {me?.staked ? (
              <span className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-acid/60 bg-acid/10 px-4 text-sm font-extrabold uppercase text-acid">
                <ShieldCheck className="size-4" aria-hidden /> {tu("memberXpXp", { xp: me.xp })}
              </span>
            ) : (
              <Button size="sm" onClick={() => setJoinOpen(true)} id="join">
                {tu("joinDao")}
              </Button>
            )}
            {me && me.roles.some((r) => r !== "member") && <span className="rounded-full bg-purple px-3 py-1 text-[11px] font-extrabold uppercase text-ink">{tu("viewAsJoin", { join: me.roles.filter((r) => r !== "member").join(", ") })}</span>}
            <ButtonLink href={`/events/${eventId}`} variant="ghost" size="sm">
              {tu("eventPage")}
            </ButtonLink>
          </div>
        </div>
      </header>

      <nav aria-label={tu("daoSections")} className="sticky top-[var(--header-h)] z-20 border-b border-line bg-ink/90 backdrop-blur md:mx-6 md:mt-3 md:rounded-full md:border">
        <ul className="flex gap-1 overflow-x-auto px-3 py-1.5 [scrollbar-width:none]">
          {TABS.map(([slug, label]) => {
            const href = slug ? `${base}/${slug}` : base;
            const active = slug ? path.startsWith(href) : path === base;
            return (
              <li key={slug} className="shrink-0">
                <Link href={href} aria-current={active ? "page" : undefined} className={cn("inline-flex min-h-11 items-center rounded-full px-3.5 text-[13px] font-extrabold uppercase tracking-wide", active ? "bg-acid text-ink" : "text-cream/85 hover:bg-surface-2")}>
                  {tu(label)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mx-auto max-w-6xl px-4 pt-5 md:px-6">{children}</div>
      <JoinDao open={joinOpen} onClose={() => setJoinOpen(false)} />
    </div>
  );
}
