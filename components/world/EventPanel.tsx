"use client";

import { Tx } from "@/components/i18n/Tx";
/**
 * Selected festival: a right-hand panel on desktop (map stays visible) and a swipeable bottom
 * sheet on phones (peek → expanded; swipe down or Close to see the whole map again).
 * Actions depend on status, and nothing unconnected is presented as working.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarDays, ExternalLink, ShieldCheck, Clock, ChevronDown, ChevronUp, Crown, Disc3, HandHeart, Landmark, MapPin, Mic2, PartyPopper, Radio, Ticket, TrendingUp, UserRound, Users, Vote, X } from "lucide-react";
import { EventCover } from "@/components/cards/Cards";
import { LEVEL_COLORS } from "@/lib/map/growth";
import { EXTERNAL_MARKER_LABEL, LANDMARK_LABEL, STATUS_META, externalMarkerKind, externalMarkerSvg, landmarkSvg } from "@/lib/map/landmarks";
import type { WorldEvent } from "@/lib/map/view";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/config";
import { formatEventDate, formatMoney, formatNumber } from "@/lib/i18n/format";
import { Alien } from "@/components/art/Alien";
import { useAuth } from "@/lib/auth/client";
import { useDemo } from "@/lib/store";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { labelKey } from "@/lib/i18n/labels";

/** Numbers and money in the visitor's locale (USD stays USD: it is the event's currency). */
function useFmt() {
  const locale = useLocale() as Locale;
  return { locale, usd: (n: number) => formatMoney(locale, Math.round(n)), num: (n: number) => formatNumber(locale, n) };
}

export function StatusPill({ status, className }: { status: WorldEvent["status"]; className?: string }) {
  const s = STATUS_META[status];
  const t = useTranslations("status");
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border-2 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide", className)} style={{ borderColor: s.color, color: s.color }} title={t(`hint.${status}`)}>
      <span aria-hidden>{s.glyph}</span>
      {status === "live" ? t("demoLive") : t(status)}
    </span>
  );
}

export function LevelPill({ e }: { e: WorldEvent }) {
  const c = LEVEL_COLORS[e.level];
  const t = useTranslations("levels");
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase text-ink" style={{ background: c }}>
      LV.{e.level} {t(String(e.level))}
    </span>
  );
}

type Action = { key: string; label: string; href: string; icon: React.ReactNode; tone: "primary" | "live" | "ghost"; testId?: string; external?: boolean };

const ACTION_EN: Record<string, string> = { officialEvent: "View official event", getTickets: "Get tickets", enterDemoLive: "Enter festival (demo live)", watchLive: "Watch live", support: "Support event", buyTicket: "Buy ticket", viewDao: "View DAO", applyDj: "Apply as DJ", viewEvent: "View event" };

/** Actions by status. `label` translates a key under world.actions (English by default). */
export function actionsFor(e: WorldEvent, label: (k: string) => string = (k) => ACTION_EN[k]): Action[] {
  const a: Action[] = [];
  // External events only link out: the official page and the seller's ticket page. Never a FREAKTOPIA ticket, support or DJ button.
  if (e.external) {
    const x = e.external;
    const official = x.officialUrl ?? x.sourceUrl;
    if (official) a.push({ key: "official", label: label("officialEvent"), href: official, icon: <ExternalLink className="size-4" aria-hidden />, tone: "primary", external: true, testId: "map-official" });
    if (x.ticketUrl && x.externalStatus !== "postponed") a.push({ key: "tickets", label: label("getTickets"), href: x.ticketUrl, icon: <Ticket className="size-4" aria-hidden />, tone: a.length ? "ghost" : "primary", external: true, testId: "map-external-tickets" });
    return a;
  }
  // A community party has no sample funding, tickets, DAO or DJ calls: only its page in the organizer's world.
  if (e.source === "community" && e.href) return [{ key: "view", label: label("viewEvent"), href: e.href, icon: <ArrowRight className="size-4" aria-hidden />, tone: "primary" }];
  const ev = `/events/${e.id}`;
  if (e.live) a.push({ key: "live", label: e.live.demo ? label("enterDemoLive") : label("watchLive"), href: `/live/${e.id}`, icon: <Radio className="size-4" aria-hidden />, tone: "live", testId: "map-enter-live" });
  if (e.status === "funding" || e.status === "planning") a.push({ key: "support", label: label("support"), href: ev, icon: <HandHeart className="size-4" aria-hidden />, tone: "primary" });
  if ((e.status === "confirmed" || e.status === "live") && e.tickets.onSale) a.push({ key: "tickets", label: label("buyTicket"), href: `${ev}/tickets`, icon: <Ticket className="size-4" aria-hidden />, tone: a.length ? "ghost" : "primary" });
  if (e.dao) a.push({ key: "dao", label: label("viewDao"), href: `/dao/${e.id}`, icon: <Vote className="size-4" aria-hidden />, tone: "ghost" });
  if (e.djRecruiting && e.status !== "cancelled") a.push({ key: "dj", label: label("applyDj"), href: `/djs/apply?event=${e.id}`, icon: <Mic2 className="size-4" aria-hidden />, tone: "ghost" });
  a.push({ key: "view", label: label("viewEvent"), href: ev, icon: <ArrowRight className="size-4" aria-hidden />, tone: a.length ? "ghost" : "primary" });
  return a;
}

function ActionButton({ a, compact }: { a: Action; compact?: boolean }) {
  const href = useLocalHref();
  const tw = useTranslations("world.external");
  const cls = cn(
    "flex min-h-12 items-center justify-center gap-2 rounded-full px-4 text-[13px] font-extrabold uppercase",
    a.tone === "primary" && "bg-acid text-ink shadow-[0_4px_0_0_#5f8a22]",
    a.tone === "ghost" && "border-2 border-line bg-surface-2 text-cream",
    compact && "min-h-11",
  );
  if (a.external)
    return (
      <a href={a.href} target="_blank" rel="noopener noreferrer" data-testid={a.testId} className={cls}>
        {a.icon}
        <span>{a.label}</span>
        <span className="sr-only"> ({tw("opensNewTab")})</span>
      </a>
    );
  return (
    <Link
      href={href(a.href)}
      data-testid={a.testId}
      className={cn(
        "flex min-h-12 items-center justify-center gap-2 rounded-full px-4 text-[13px] font-extrabold uppercase",
        a.tone === "primary" && "bg-acid text-ink shadow-[0_4px_0_0_#5f8a22]",
        a.tone === "live" && "bg-coral text-ink shadow-[0_4px_0_0_#9b2f2b]",
        a.tone === "ghost" && "border-2 border-line bg-surface-2 text-cream",
        compact && "min-h-11",
      )}
    >
      {a.icon}
      <Tx>{a.label}</Tx>
    </Link>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 border-b border-line/70 py-2 last:border-0">
      <span className="mt-0.5 text-mute" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold uppercase tracking-wide text-mute">{label}</div>
        <div className="text-[14px]">{children}</div>
      </div>
    </div>
  );
}

/** "Your alien is here": only for events the user joined, and only with World Map presence turned on. */
function MyAlienHere({ e }: { e: WorldEvent }) {
  const t = useTranslations("world");
  const me = useAuth((s) => s.me);
  const joined = useDemo((s) => s.orders.some((o) => o.eventId === e.id) || Boolean(s.support[e.id]));
  if (!me?.alien || !joined) return null;
  if (!me.privacy.mapPresence) return <p className="rounded-2xl border border-dashed border-line p-3 text-[12px] text-mute">{t("myAlienOff")}</p>;
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-acid/50 bg-acid/10 p-2.5" data-testid="panel-my-alien">
      <Alien look={me.alien.look} className="size-12 shrink-0" />
      <div className="min-w-0">
        <div className="text-[13px] font-extrabold uppercase text-acid">{t("myAlienHere")}</div>
        <div className="text-[11px] text-mute">{t("myAlienHint")}</div>
      </div>
    </div>
  );
}

/** An external event: provenance first (source, verification, last verified), then only what the source said. */
function ExternalDetails({ e }: { e: WorldEvent }) {
  const t = useTranslations("world.external");
  const { locale } = useFmt();
  const x = e.external!;
  const when = (iso: string) => formatEventDate(locale, iso, "UTC", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
  const stale = Date.now() - Date.parse(x.lastSyncedAt) > 24 * 36e5;
  return (
    <div className="space-y-4" data-testid="map-external">
      <p className="rounded-2xl border border-line bg-surface p-3 text-[13px] text-mute">{t("notFreaktopia")}</p>
      <section aria-label={t("source")}>
        <Row icon={<ExternalLink className="size-4" />} label={t("source")}>
          <span data-testid="map-source">{x.sourceName}</span>
          <span className="block text-[11px] text-mute">{t(`sourceType.${x.sourceType}`)} · ID {x.sourceEventId}</span>
        </Row>
        <Row icon={<ShieldCheck className="size-4" />} label={t("verification")}>
          {t(`verified.${x.verificationStatus}`)}
        </Row>
        <Row icon={<Clock className="size-4" />} label={t("lastVerified")}>
          <span data-testid="map-last-verified">{when(x.lastVerifiedAt)}</span>
          {stale && <span className="block text-[11px] text-mute">{t("staleNote", { time: when(x.lastSyncedAt) })}</span>}
        </Row>
        {x.externalStatus !== "scheduled" && (
          <Row icon={<CalendarDays className="size-4" />} label={t("statusLabel")}>
            {t(`status.${x.externalStatus}`)}
          </Row>
        )}
        <Row icon={<MapPin className="size-4" />} label={t("venue")}>
          {e.venue ?? t("venueUnknown")}
          {e.location.precision === "city" && <span className="block text-[11px] text-mute" data-testid="map-approx">{t("approxLocation")}</span>}
        </Row>
        <Row icon={<Mic2 className="size-4" />} label={t("lineup")}>
          {e.lineup.length ? e.lineup.map((d) => d.name).join(", ") : t("lineupEmpty")}
        </Row>
        {x.priceRange && (
          <Row icon={<Ticket className="size-4" />} label={t("price")}>
            {t("priceFromSource", { min: x.priceRange.min, max: x.priceRange.max, currency: x.priceRange.currency })}
          </Row>
        )}
      </section>
    </div>
  );
}

function Details({ e }: { e: WorldEvent }) {
  if (e.external) return <ExternalDetails e={e} />;
  return <FreakDetails e={e} />;
}

function FreakDetails({ e }: { e: WorldEvent }) {
  const tu = useTranslations("world");
  const g = e.growthResult;
  const t = useTranslations("world");
  const tl = useTranslations("levels");
  const tlive = useTranslations("live");
  const tr = useTranslations("ranking");
  const tc = useTranslations("common");
  const { usd, num, locale } = useFmt();
  return (
    <div className="space-y-4">
      <MyAlienHere e={e} />
      {e.live && (
        <section aria-label={tu("liveNow")} className="rounded-2xl border-2 border-coral/60 bg-coral/10 p-3" data-testid="map-live-info">
          <div className="flex items-center gap-2 text-[12px] font-extrabold uppercase text-coral">
            <span className="size-2 rounded-full bg-coral" aria-hidden /> {e.live.demo ? tlive("demoLive") : tlive("liveNow")}
          </div>
          <p className="mt-1 text-[14px]">
            {tlive("nowPlaying")}: <b>{e.live.currentDj?.name ?? tlive("betweenSets")}</b>
          </p>
          <p className="text-[12px] text-mute">{e.live.demo ? tlive("streamDemo") : tu("licensedStream")}</p>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-ink/60 p-2">
              <dt className="text-[10px] uppercase text-mute">{t("facts.onlineViewers")}</dt>
              <dd className="font-display text-lg">{num(e.live.onlineViewers)}</dd>
            </div>
            <div className="rounded-xl bg-ink/60 p-2">
              <dt className="text-[10px] uppercase text-mute">{t("facts.checkedIn")}</dt>
              <dd className="font-display text-lg">{num(e.live.checkedIn)}</dd>
            </div>
            <div className="rounded-xl bg-ink/60 p-2">
              <dt className="text-[10px] uppercase text-mute">{t("facts.publicAvatars")}</dt>
              <dd className="font-display text-lg">{num(e.live.publicAvatars)}</dd>
            </div>
          </dl>
          <p className="mt-1.5 text-[11px] text-mute">{tlive("notSummed")}</p>
        </section>
      )}

      {e.source === "community" && <p className="rounded-2xl border border-line bg-surface p-3 text-[13px] text-mute" data-testid="map-community-note">{t("communityNote")}</p>}
      {e.source !== "community" && (<>
      <section aria-label={tl("festivalLevel")}>
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-extrabold uppercase">{tl("festivalLevel")}</h3>
          <LevelPill e={e} />
        </div>
        <p className="mt-1 text-[12px] text-mute">
          {tl("notCapacity")}
        </p>
        {g.next ? (
          <ul className="mt-2 space-y-1.5" aria-label={`LV.${g.next.level} ${tl(String(g.next.level))}`}>
            {g.requirements.map((r) => (
              <li key={r.key} className="text-[12px]">
                <div className="flex justify-between gap-2">
                  <span>
                    <span aria-hidden>{r.met ? "✓ " : "○ "}</span>
                    <Tx>{r.label}</Tx>
                  </span>
                  <span className="text-mute">
                    {r.key === "venueContract" ? (r.met ? tu("signed") : tu("notYet")) : r.key === "fundingUsd" ? `${usd(r.have)} / ${usd(r.need)}` : `${num(r.have)} / ${num(r.need)}`}
                  </span>
                </div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-surface-2" role="presentation">
                  <div className="h-full rounded-full" style={{ width: `${r.pct * 100}%`, background: r.met ? "#B6F05C" : LEVEL_COLORS[g.next!.level] }} />
                </div>
              </li>
            ))}
            <li className="pt-0.5 text-[11px] text-mute">{tu("lvLevelTl", { level: g.next.level, tl: tl(String(g.next.level)) })}</li>
          </ul>
        ) : (
          <p className="mt-2 text-[12px] text-acid">{tl("topReached")}</p>
        )}
      </section>

      <section aria-label={t("facts.supporters")}>
        <Row icon={<Users className="size-4" />} label={t("facts.supporters")}>
          {num(e.growth.supporters)}
        </Row>
        <Row icon={<Landmark className="size-4" />} label={t("facts.funding")}>
          {usd(e.growth.fundingUsd)} / {usd(e.goalUsd)}
        </Row>
        <Row icon={<Vote className="size-4" />} label={t("facts.stakers")}>
          {e.dao ? (
            <>
              {tu("numPeopleNum2TokensymbolEscrowed", { num: num(e.dao.stakers), num2: num(e.dao.staked), tokenSymbol: e.dao.tokenSymbol })}
              <span className="block text-[11px] text-mute">{t("facts.stakingNote")}</span>
            </>
          ) : (
            t("facts.noDao")
          )}
        </Row>
        <Row icon={<Ticket className="size-4" />} label={t("facts.tickets")}>
          {e.status === "completed" ? t("facts.eventFinished") : e.tickets.onSale ? t("facts.ticketsLeft", { count: num(e.tickets.remaining), price: usd(e.tickets.fromUsd ?? 0) }) : e.status === "confirmed" || e.status === "live" ? t("facts.soldOut") : t("facts.notOnSale")}
        </Row>
        </section>
      </>)}
      <section aria-label={t("facts.organizer")}>
        {e.organizer && (
          <Row icon={<UserRound className="size-4" />} label={t("facts.organizer")}>
            {e.organizer.handle ? (
              <Link href={`/u/${e.organizer.handle}/world`} className="font-bold text-acid underline-offset-2 hover:underline" data-testid="map-organizer-world">
                {e.organizer.name}
              </Link>
            ) : (
              <>
                {e.organizer.name}
                {e.organizer.demo && <span className="block text-[11px] text-mute">{t("facts.organizerSample")}</span>}
              </>
            )}
          </Row>
        )}
        <Row icon={<Mic2 className="size-4" />} label={t("facts.djRecruitment")}>
          {e.djRecruiting ? t("facts.djOpen") : t("facts.closed")}
        </Row>
        <Row icon={<PartyPopper className="size-4" />} label={t("facts.afterParty")}>
          {e.afterParty ? (
            <Link href={`/after-party/${e.afterParty.id}`} className="font-bold text-acid underline-offset-2 hover:underline">
              {e.afterParty.name} · {e.afterParty.venue}
            </Link>
          ) : (
            t("facts.notAnnounced")
          )}
        </Row>
        <Row icon={<Disc3 className="size-4" />} label={t("facts.landmark")}>
          <Tx>{LANDMARK_LABEL[e.landmark.type]}</Tx>
          {e.landmark.approvedDesign ? <span className="block text-[11px] text-mute">{tu("coloursFromTheDaoApproved", { name: e.landmark.approvedDesign.name })}</span> : e.dao ? <span className="block text-[11px] text-mute">{tu("noApprovedDaoStageDesign")}</span> : null}
        </Row>
      </section>

      {e.dao && (
        <Link href={`/dao/${e.id}`} className="block rounded-2xl border-2 border-purple/50 bg-purple/10 p-3" data-testid="map-dao">
          <div className="flex items-center justify-between text-[12px] font-extrabold uppercase text-purple">
            <span>{tu("communityDaoStatus", { status: e.dao.status })}</span>
            <ArrowRight className="size-4" aria-hidden />
          </div>
          <p className="mt-1 text-[13px]">
            {tu("numMembersActiveproposalsActivePropo", { num: num(e.dao.members), activeProposals: e.dao.activeProposals, openVotes: e.dao.openVotes })}
          </p>
          {e.dao.activeVote && <p className="truncate text-[12px] text-mute">{tu("votingNowActivevote", { activeVote: e.dao.activeVote })}</p>}
          <p className="text-[11px] text-mute">{tu("bannersOnTheLandmarkGrow")}</p>
        </Link>
      )}

      {(e.ranking.rank || e.ranking.trendingRank) && (
        <Link href={`/rankings?category=${e.ranking.trendingRank && !e.ranking.badge ? "trending&period=7d" : "popular&period=all"}`} className="flex items-center gap-2 rounded-2xl bg-surface-2 p-3 text-[13px]" data-testid="map-rank">
          {e.ranking.badge ? <Crown className="size-4 text-[#E8C66A]" aria-hidden /> : <TrendingUp className="size-4 text-acid" aria-hidden />}
          <span className="min-w-0 flex-1">
            {e.ranking.rank && <span className="block">#{e.ranking.rank} {tr("popular")} · {tr("allTime")}</span>}
            {e.ranking.trendingRank && <span className="block">#{e.ranking.trendingRank} {tr("trending")} · {tr("days7")}</span>}
            <span className="block text-[11px] text-mute">{tr("updated", { time: formatEventDate(locale, e.ranking.asOf, "UTC", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) })} · {tc("demoData")}</span>
          </span>
          <ArrowRight className="size-4 text-acid" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function Header({ e, onClose, big }: { e: WorldEvent; onClose: () => void; big?: boolean }) {
  const t = useTranslations("world");
  const ts = useTranslations("status");
  const tx = useTranslations("world.external");
  const tl = useTranslations("labels");
  const { locale } = useFmt();
  const x = e.external;
  return (
    <div className="flex gap-3">
      <div className={cn("relative shrink-0 overflow-hidden rounded-2xl border-2 border-line", big ? "size-24" : "size-[72px]", x && "bg-surface-2 p-2")}>
        {x ? (
          <span className="block size-full" aria-hidden dangerouslySetInnerHTML={{ __html: externalMarkerSvg(externalMarkerKind(x.category), e.location.precision === "city") }} />
        ) : (
          <>
            <EventCover id={e.id} sizes="96px" />
            <span className="absolute -bottom-1 -right-1 size-11 drop-shadow" aria-hidden dangerouslySetInnerHTML={{ __html: landmarkSvg({ type: e.landmark.type, level: e.level, status: e.status, palette: e.palette, animate: false }) }} />
          </>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {x ? (
            <>
              <span className="inline-flex items-center gap-1 rounded-full border-2 border-[#66DFFF] px-2 py-0.5 text-[11px] font-extrabold uppercase text-[#66DFFF]" data-testid="map-source-badge">
                <ExternalLink className="size-3" aria-hidden /> {x.sourceName}
              </span>
              <span className="inline-flex rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-extrabold uppercase">{tl(labelKey(EXTERNAL_MARKER_LABEL[externalMarkerKind(x.category)]))}</span>
            </>
          ) : (
            <>
              <StatusPill status={e.status} />
              <LevelPill e={e} />
            </>
          )}
        </div>
        <h2 className="mt-1.5 text-[22px] uppercase leading-none">{e.name}</h2>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-mute">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden />
            {e.city}, {e.country}
            {e.location.precision === "city" && ` (${ts("approx")})`}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden />
            {x
              ? `${formatEventDate(locale, e.startsAt, x.venueTimezone ?? "UTC", x.timeTbd ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}${x.timeTbd ? ` · ${tx("timeTbd")}` : ` (${tx("localTime")})`}`
              : formatEventDate(locale, e.startsAt, "UTC", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>
        <div className="mt-1 truncate text-[12px] text-mute">{(x ? x.genres : e.genres).join(" / ")}</div>
      </div>
      <button type="button" onClick={onClose} aria-label={t("closeDetails")} className="-mr-1 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2">
        <X className="size-5" />
      </button>
    </div>
  );
}

function KeyNumbers({ e }: { e: WorldEvent }) {
  if (e.external) return null; // no FREAKTOPIA numbers exist for an outside event
  return <FreakNumbers e={e} />;
}

function FreakNumbers({ e }: { e: WorldEvent }) {
  const t = useTranslations("world.facts");
  const tk = useTranslations("world.keys");
  const { num } = useFmt();
  const items = e.live
    ? [
        [tk("viewers"), num(e.live.onlineViewers)],
        [tk("checkedIn"), num(e.live.checkedIn)],
        [t("supporters"), num(e.growth.supporters)],
      ]
    : [
        [t("supporters"), num(e.growth.supporters)],
        [tk("funding"), e.goalUsd ? `${Math.round((e.growth.fundingUsd / e.goalUsd) * 100)}%` : "–"],
        [e.dao ? tk("stakers") : t("tickets"), e.dao ? num(e.dao.stakers) : e.tickets.onSale ? num(e.tickets.remaining) : "–"],
      ];
  return (
    <dl className="mt-3 grid grid-cols-3 gap-2">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-xl bg-surface-2 px-2 py-1.5">
          <dt className="text-[10px] font-bold uppercase text-mute">{k}</dt>
          <dd className="font-display text-[17px] leading-tight">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Desktop: right panel. */
export function EventSidePanel({ e, onClose }: { e: WorldEvent; onClose: () => void }) {
  const ta = useTranslations("world.actions");
  const tw = useTranslations("world");
  const actions = actionsFor(e, (k) => ta(k));
  return (
    <section aria-label={tw("summaryOf", { name: e.name })} className="wm-panel absolute bottom-4 right-4 top-[124px] z-20 flex w-[400px] flex-col overflow-hidden rounded-[28px] border-2 border-line bg-[#0D121B]/95 shadow-[0_20px_60px_rgba(0,0,0,.55)] backdrop-blur" data-testid="event-panel">
      <div className="border-b border-line p-4">
        <Header e={e} onClose={onClose} big />
        <KeyNumbers e={e} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        <Details e={e} />
      </div>
      {actions.length > 0 && <div className="grid grid-cols-2 gap-2 border-t border-line p-3">
        {actions.map((a, i) => (
          <div key={a.key} className={cn(i === 0 && "col-span-2")}>
            <ActionButton a={a} compact={i > 0} />
          </div>
        ))}
      </div>}
    </section>
  );
}

/** Phone: bottom sheet with a peek and an expanded state. */
export function EventBottomSheet({ e, onClose, expanded, setExpanded, onHeight }: { e: WorldEvent; onClose: () => void; expanded: boolean; setExpanded: (v: boolean) => void; onHeight: (h: number) => void }) {
  const tu = useTranslations("world");
  const ref = useRef<HTMLElement>(null);
  const start = useRef<{ y: number; t: number } | null>(null);
  const [dy, setDy] = useState(0);
  const ta = useTranslations("world.actions");
  const tw = useTranslations("world");
  const actions = actionsFor(e, (k) => ta(k));
  const primary = actions[0];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => onHeight(el.getBoundingClientRect().height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeight]);

  const onDown = (ev: React.PointerEvent) => {
    start.current = { y: ev.clientY, t: Date.now() };
  };
  const onMove = (ev: React.PointerEvent) => {
    if (!start.current) return;
    const d = ev.clientY - start.current.y;
    // Capture only once it is clearly a drag, so taps on the handle and Close stay clicks.
    if (Math.abs(d) > 6) (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
    setDy(d);
  };
  const onUp = () => {
    if (!start.current) return;
    const d = Math.abs(dy) > 6 ? dy : 0;
    start.current = null;
    setDy(0);
    if (d < -40) setExpanded(true);
    else if (d > 60) {
      if (expanded) setExpanded(false);
      else onClose();
    }
  };

  return (
    <section
      ref={ref}
      aria-label={tw("summaryOf", { name: e.name })}
      data-testid="event-sheet"
      data-expanded={expanded}
      className={cn("wm-sheet absolute inset-x-0 bottom-0 flex flex-col rounded-t-[28px] border-2 border-b-0 border-line bg-[#0D121B]/97 shadow-[0_-12px_40px_rgba(0,0,0,.5)] backdrop-blur", expanded ? "z-40 max-h-[calc(100%-8px)]" : "z-20 max-h-[62%]")}
      style={{ transform: dy ? `translateY(${Math.max(-60, dy)}px)` : undefined, transition: dy ? "none" : "transform 200ms ease-out" }}
    >
      <div className="touch-none px-4 pb-1 pt-2" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <button type="button" onClick={() => setExpanded(!expanded)} className="-mt-2 mb-0 flex h-11 w-full items-center justify-center" aria-label={expanded ? tw("showLess") : tw("showAll")} aria-expanded={expanded}>
          <span className="h-1.5 w-12 rounded-full bg-cream/30" aria-hidden />
        </button>
        <Header e={e} onClose={onClose} />
      </div>
      <div className={cn("min-h-0 flex-1 px-4", expanded ? "overflow-y-auto overscroll-contain" : "overflow-hidden")}>
        <KeyNumbers e={e} />
        {primary && (
          <div className="mt-3">
            <ActionButton a={primary} />
          </div>
        )}
        {!expanded && (
          <button type="button" onClick={() => setExpanded(true)} className="mx-auto my-1 flex min-h-11 items-center gap-1 text-[13px] font-bold text-mute">
            <ChevronUp className="size-4" aria-hidden /> {e.external ? tw("showAll") : tw("moreDetails")}
          </button>
        )}
        {expanded && (
          <div className="pb-4 pt-3">
            <div className="grid grid-cols-2 gap-2">
              {actions.slice(1).map((a) => (
                <ActionButton key={a.key} a={a} compact />
              ))}
            </div>
            <div className="mt-4">
              <Details e={e} />
            </div>
            <button type="button" onClick={() => setExpanded(false)} className="mx-auto mt-2 flex min-h-11 items-center gap-1 text-[13px] font-bold text-mute">
              <ChevronDown className="size-4" aria-hidden /> {tu("showLess")}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
