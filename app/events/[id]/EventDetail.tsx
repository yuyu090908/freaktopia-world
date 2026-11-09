"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  HandHeart,
  MapPin,
  Mic2,
  Play,
  RotateCcw,
  Share2,
  Ticket,
  Users,
  Sparkles,
} from "lucide-react";
import type { FreakEvent } from "@/lib/types";
import { EventCover } from "@/components/cards/Cards";
import { Stage } from "@/components/art/Stage";
import { EventLevelBadge } from "@/components/event/EventLevelBadge";
import { EventProgress } from "@/components/event/EventProgress";
import { AfterPartyCard, AlienAvatar } from "@/components/cards/Cards";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button, ButtonLink, Card, DemoBadge, DemoNotice, Progress, Tag } from "@/components/ui/primitives";
import { getAfterParty, getDJ, getVenue } from "@/lib/data";
import { LEVELS, levelInfo } from "@/lib/levels";
import { grantXp, toast, useDemo, useEventStats } from "@/lib/store";
import { cn, fmtDate, fmtDateLong, fmtTime, money } from "@/lib/utils";
import { FollowButton } from "@/components/ranking/FollowButton";
import { EventRankingPanel } from "@/components/ranking/EventRankingPanel";

export function EventDetail({ event }: { event: FreakEvent }) {
  const stats = useEventStats(event);
  const supportEvent = useDemo((s) => s.supportEvent);
  const setSim = useDemo((s) => s.setSim);
  const [sheet, setSheet] = useState(false);
  const [amount, setAmount] = useState(20);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const prevLevel = useRef(stats.level);
  const venue = getVenue(event.venueId);
  const after = event.afterPartyId ? getAfterParty(event.afterPartyId) : undefined;
  const info = levelInfo(stats.level);
  const ended = event.status === "ended";
  const toggleFollow = useDemo((s) => s.toggleFollow);

  // Deep links from WORLD RANKING cards: ?action=support | follow
  useEffect(() => {
    const action = new URLSearchParams(window.location.search).get("action");
    if (action === "support" && !ended) setSheet(true);
    if (action === "follow" && !useDemo.getState().followedEvents.includes(event.id)) {
      toggleFollow(event.id);
      toast({ title: "Following", body: `${event.name}: alerts appear in your inbox (demo).`, tone: "success" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Level-up celebration whenever the level increases
  useEffect(() => {
    if (stats.level > prevLevel.current) {
      setLevelUp(stats.level);
      toast({ title: `LEVEL UP! LV.${stats.level}`, body: `${event.name} evolved into a ${levelInfo(stats.level).name}.`, tone: "level" });
      const t = setTimeout(() => setLevelUp(null), 2400);
      prevLevel.current = stats.level;
      return () => clearTimeout(t);
    }
    prevLevel.current = stats.level;
  }, [stats.level, event.name]);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: event.name, text: event.tagline, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", body: "Share it with your crew.", tone: "success" });
    } catch {
      /* user cancelled */
    }
  };

  const confirmSupport = () => {
    supportEvent(event.id, amount);
    setSheet(false);
    toast({ title: "You’re a supporter!", body: amount ? `Demo pledge of ${money(amount)} added. No money was charged.` : "Cheer added. Thanks!", tone: "success" });
    grantXp(amount ? 40 : 15, `Supported ${event.name}`);
  };

  return (
    <div className="mx-auto max-w-6xl">
      {/* HERO */}
      <section aria-labelledby="ev-title" className="md:grid md:grid-cols-2 md:gap-8 md:px-6 md:pt-6">
        <div className="relative aspect-[5/3] overflow-hidden md:rounded-[32px] md:border-2 md:border-purple/50 md:shadow-[0_0_36px_-10px_rgba(162,118,233,0.7)]">
          <EventCover id={event.id} priority sizes="(min-width:768px) 560px, 100vw" />
          <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-ink to-transparent md:hidden" aria-hidden />
          <div className="absolute left-4 top-4 flex flex-wrap gap-1.5">
            <EventLevelBadge level={stats.level} long />
            {event.status === "live" && <Tag color="#FF625C" dark>● Live now</Tag>}
          </div>
          <DemoBadge label="Demo event" className="absolute right-4 top-4 bg-ink" />
        </div>
        <div className="px-4 pt-5 md:px-0 md:pt-2">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-acid">{event.tagline}</p>
          <h1 id="ev-title" className="mt-2 text-[44px] uppercase italic sm:text-6xl">{event.name}</h1>
          <ul className="mt-4 space-y-2 text-[15px]">
            <li className="flex items-center gap-2"><MapPin className="size-4 shrink-0 text-mute" aria-hidden />{event.city}, {event.country}{venue ? ` · ${venue.name}` : ""}</li>
            <li className="flex items-center gap-2"><CalendarDays className="size-4 shrink-0 text-mute" aria-hidden /><time dateTime={event.startsAt}>{fmtDateLong(event.startsAt)}</time></li>
            <li className="flex items-center gap-2"><Clock className="size-4 shrink-0 text-mute" aria-hidden />{fmtTime(event.startsAt)} – {fmtTime(event.endsAt)}</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {event.genres.map((g) => <Tag key={g}>{g}</Tag>)}
            {event.djRecruiting && <Tag color="#A276E9" dark>DJs wanted</Tag>}
            <Tag color="#2a2a2a">By {event.organizer}</Tag>
          </div>
          <p className="ja mt-4 leading-relaxed text-cream/85">{event.description}</p>

          {/* ACTIONS */}
          {ended && (
            <DemoNotice className="mt-5">This event has ended. Support and tickets are closed; it still appears in the WORLD RANKING (Most attended).</DemoNotice>
          )}
          <div className={cn("mt-5 grid grid-cols-2 gap-2.5", ended && "hidden")}>
            <Button onClick={() => setSheet(true)} className="col-span-2" size="lg">
              <HandHeart className="size-5" aria-hidden /> {stats.supported ? "Support again" : "Support event"}
            </Button>
            <ButtonLink href={`/events/${event.id}/tickets`} variant="secondary">
              <Ticket className="size-4" aria-hidden /> Buy ticket
            </ButtonLink>
            <ButtonLink href={`/djs/apply?event=${event.id}`} variant="purple">
              <Mic2 className="size-4" aria-hidden /> Apply as DJ
            </ButtonLink>
            <FollowButton eventId={event.id} eventName={event.name} />
            <Button variant="ghost" onClick={share}>
              <Share2 className="size-4" aria-hidden /> Share
            </Button>
          </div>
          {ended && (
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <FollowButton eventId={event.id} eventName={event.name} />
              <Button variant="ghost" onClick={share}>
                <Share2 className="size-4" aria-hidden /> Share
              </Button>
            </div>
          )}
          <div className="mt-5">
            <EventRankingPanel eventId={event.id} />
          </div>
        </div>
      </section>

      {/* Section jump rail */}
      <nav aria-label="Event sections" className="rail mt-8 !gap-2 md:!px-6">
        {[
          ["evolution", "Evolution"],
          ["lineup", "Lineup"],
          ["auditions", "Auditions"],
          ["venue", "Venue"],
          ["funding", "Funding"],
          ["timetable", "Timetable"],
          ["afterparty", "After Party"],
          ["updates", "Updates"],
          ["faq", "FAQ"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center rounded-full border-2 border-line px-4 text-sm font-bold hover:border-cream/40">
            {label}
          </a>
        ))}
      </nav>

      <div className="mt-6 grid gap-6 px-4 md:px-6 lg:grid-cols-[1.2fr_1fr] [&>*]:min-w-0">
        {/* EVOLUTION */}
        <section id="evolution" aria-labelledby="evo-h" className="lg:row-span-2">
          <Card className="overflow-hidden p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="evo-h" className="text-3xl uppercase">Event evolution</h2>
                <p className="ja mt-1 text-sm text-mute">応援者と資金が増えると、ステージが進化します。</p>
              </div>
              <EventLevelBadge level={stats.level} className="shrink-0 text-base" />
            </div>
            <div className="relative mt-4">
              <div key={stats.level} className={cn(levelUp && "animate-[stage-pop_600ms_ease-out]")}>
                <Stage level={stats.level} palette={event.palette} className="h-auto w-full" title={`Stage at level ${stats.level}: ${info.name}`} />
              </div>
              {levelUp && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center rounded-[18px] bg-ink/55" aria-hidden>
                  <Sparkles className="size-10 text-acid animate-bounce" />
                  <div className="font-display text-4xl text-acid drop-shadow-[0_4px_0_#000]">LEVEL UP!</div>
                  <div className="font-display text-xl">LV.{levelUp} {levelInfo(levelUp as 1).name}</div>
                </div>
              )}
            </div>
            <p className="mt-3 text-sm text-cream/85"><span className="font-bold" style={{ color: info.color }}>{info.name}:</span> {info.description}</p>
            <ol className="mt-4 grid grid-cols-5 gap-1.5" aria-label="Level ladder">
              {LEVELS.map((l) => (
                <li key={l.level} className={cn("rounded-xl border-2 p-1.5 text-center", l.level <= stats.level ? "border-ink text-ink" : "border-line text-mute")} style={l.level <= stats.level ? { background: l.color } : undefined} aria-current={l.level === stats.level ? "step" : undefined}>
                  <div className="font-display text-sm">{l.level}</div>
                  <div className="truncate text-[10px] font-bold uppercase">{l.short}</div>
                </li>
              ))}
            </ol>
            <div className="mt-5">
              <EventProgress supporters={stats.supporters} raised={stats.raised} goal={event.goal} />
            </div>
            <Simulator event={event} supporters={stats.supporters} raised={stats.raised} simulated={stats.simulated} onReset={() => setSim(event.id, undefined)} onChange={(v) => setSim(event.id, v)} />
          </Card>
        </section>

        {/* LINEUP */}
        <section id="lineup" aria-labelledby="lineup-h">
          <h2 id="lineup-h" className="text-3xl uppercase">Lineup</h2>
          <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2">
            {event.lineup.map((id) => {
              const dj = getDJ(id)!;
              return (
                <li key={id}>
                  <Link href={`/djs/${id}`} className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface p-2.5 hover:border-cream/30">
                    <AlienAvatar look={dj.look} size={48} ring={dj.look.accent} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-extrabold">{dj.name}</span>
                      <span className="block truncate text-xs text-mute">{dj.genres[0]}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
            {event.djRecruiting && (
              <li>
                <Link href={`/djs/apply?event=${event.id}`} className="flex h-full min-h-[68px] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-purple/60 p-2.5 text-sm font-bold text-purple">
                  + Open slot · Apply
                </Link>
              </li>
            )}
          </ul>
        </section>

        {/* AUDITIONS */}
        <section id="auditions" aria-labelledby="aud-h">
          <div className="flex items-center justify-between gap-2">
            <h2 id="aud-h" className="text-3xl uppercase">DJ auditions</h2>
            <DemoBadge label="Demo streams" />
          </div>
          <p className="ja mt-1 text-sm text-mute">30分のライブオーディションを視聴して投票しよう。</p>
          <ul className="mt-3 space-y-2">
            {event.auditionDjIds.map((id, i) => {
              const dj = getDJ(id)!;
              return (
                <li key={id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5">
                  <AlienAvatar look={dj.look} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-extrabold">{dj.name}</div>
                    <div className="text-xs text-mute">{i === 0 ? "Auditioning now (demo)" : `Slot ${i + 1} · ${dj.genres[0]}`}</div>
                  </div>
                  <Link href={`/djs/${id}/audition?event=${event.id}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-cream px-4 text-sm font-extrabold uppercase text-ink">
                    <Play className="size-4" aria-hidden /> Watch
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* VENUE */}
        {venue && (
          <section id="venue" aria-labelledby="venue-h">
            <h2 id="venue-h" className="text-3xl uppercase">Venue</h2>
            <Card className="mt-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xl font-extrabold">{venue.name}</div>
                  <div className="text-sm text-mute">{venue.address}</div>
                </div>
                <DemoBadge />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Tag>Capacity {venue.capacity.toLocaleString("en-US")}</Tag>
                {venue.amenities.slice(0, 4).map((a) => <Tag key={a}>{a}</Tag>)}
              </div>
              <Link href={`/venues/${venue.id}`} className="mt-3 inline-flex min-h-11 items-center gap-1 font-bold text-acid">
                View venue <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Card>
          </section>
        )}

        {/* FUNDING */}
        <section id="funding" aria-labelledby="fund-h">
          <h2 id="fund-h" className="text-3xl uppercase">Funding progress</h2>
          <Card className="mt-3 space-y-3 p-4">
            {[
              ["Ticket pre-sales", 0.52, "#B6F05C"],
              ["Supporter pledges", 0.31, "#A276E9"],
              ["Venue & sponsors", 0.17, "#55BCEB"],
            ].map(([label, share, color]) => (
              <div key={label as string}>
                <div className="mb-1 flex justify-between text-sm font-semibold">
                  <span>{label as string}</span>
                  <span>{money(stats.raised * (share as number))}</span>
                </div>
                <Progress value={share as number} color={color as string} label={label as string} />
              </div>
            ))}
            <p className="text-xs text-mute">Breakdown is illustrative demo data. Real funding would be held by a payment provider and shown here after Phase 2.</p>
          </Card>
        </section>

        {/* TIMETABLE */}
        <section id="timetable" aria-labelledby="tt-h">
          <h2 id="tt-h" className="text-3xl uppercase">Timetable</h2>
          <ol className="mt-3 overflow-hidden rounded-3xl border border-line">
            {event.timetable.map((s) => {
              const dj = getDJ(s.djId)!;
              return (
                <li key={s.djId + s.time} className="flex items-center gap-3 border-b border-line bg-surface p-3 last:border-b-0">
                  <span className="w-[104px] shrink-0 whitespace-nowrap font-display text-sm">{s.time}–{s.end}</span>
                  <span className="min-w-0 flex-1 truncate font-bold">{dj.name}</span>
                  <span className="shrink-0 text-xs text-mute">{s.stage}</span>
                </li>
              );
            })}
          </ol>
          <p className="mt-2 text-xs text-mute">Times shown in UTC.</p>
        </section>

        {/* AFTER PARTY */}
        <section id="afterparty" aria-labelledby="ap-h">
          <h2 id="ap-h" className="text-3xl uppercase">After party</h2>
          {after ? (
            <AfterPartyCard party={after} className="mt-3" />
          ) : (
            <Card className="mt-3 p-4">
              <p className="text-sm text-mute">No official after party yet.</p>
              <Link href={`/after-party/new?event=${event.id}`} className="mt-2 inline-flex min-h-11 items-center gap-1 font-bold text-acid">
                Create one for this event <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Card>
          )}
        </section>

        {/* UPDATES */}
        <section id="updates" aria-labelledby="up-h">
          <h2 id="up-h" className="text-3xl uppercase">Event updates</h2>
          <ol className="mt-3 space-y-3 border-l-2 border-line pl-4">
            {event.updates.map((u) => (
              <li key={u.date} className="relative">
                <span className="absolute -left-[23px] top-1.5 size-3 rounded-full border-2 border-ink bg-acid" aria-hidden />
                <div className="text-xs font-bold text-mute">{fmtDate(u.date + "T00:00:00Z", { month: "short", day: "numeric", year: "numeric" })}</div>
                <div className="font-extrabold">{u.title}</div>
                <p className="text-sm text-cream/85">{u.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* FAQ */}
        <section id="faq" aria-labelledby="faq-h">
          <h2 id="faq-h" className="text-3xl uppercase">FAQ</h2>
          <div className="mt-3 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
            {event.faq.map((f) => (
              <details key={f.q} className="group">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 font-bold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="text-xl transition-transform group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="px-4 pb-4 text-sm text-cream/85">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>

      {/* STICKY CTA */}
      <div className="h-24" aria-hidden />
      <div className={cn(ended && "hidden")}>
      <div className="sticky-cta fixed inset-x-0 z-40 border-t border-purple/40 bg-ink px-4 py-3 shadow-[0_-10px_30px_-12px_rgba(162,118,233,0.5)]">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="hidden min-w-0 flex-1 sm:block">
            <div className="truncate font-display text-lg uppercase">{event.name}</div>
            <div className="text-sm text-mute">From {money(Math.min(...event.tickets.map((t) => t.price)))} · demo checkout</div>
          </div>
          <Button variant="ghost" onClick={() => setSheet(true)} className="flex-1 sm:flex-none" aria-label="Support event">
            <HandHeart className="size-5" aria-hidden /> Support
          </Button>
          <ButtonLink href={`/events/${event.id}/tickets`} className="flex-[1.4] sm:flex-none">
            <Ticket className="size-5" aria-hidden /> Tickets
          </ButtonLink>
        </div>
      </div>
      </div>

      {/* SUPPORT SHEET */}
      <BottomSheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Support event"
        footer={
          <Button className="mb-1 w-full" size="lg" onClick={confirmSupport}>
            <HandHeart className="size-5" aria-hidden /> {amount ? `Pledge ${money(amount)} (demo)` : "Send a cheer"}
          </Button>
        }
      >
        <p className="text-sm text-cream/85">Supporters push {event.name} toward the next level. Choose a demo pledge or just cheer.</p>
        <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Pledge amount">
          {[0, 5, 20, 50, 200, 1000].map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={amount === a}
              onClick={() => setAmount(a)}
              className={cn("min-h-14 rounded-2xl border-2 font-display text-lg", amount === a ? "border-acid bg-acid text-ink" : "border-line bg-surface-2")}
            >
              {a === 0 ? "Cheer" : money(a)}
            </button>
          ))}
        </div>
        <DemoNotice className="mt-4">
          <strong>Demo only.</strong> No payment is taken and nothing leaves your browser. デモのため、実際の決済は行われません。
        </DemoNotice>
      </BottomSheet>
      <style>{`@keyframes stage-pop{0%{transform:scale(.92)}60%{transform:scale(1.04)}100%{transform:scale(1)}}`}</style>
    </div>
  );
}

function Simulator({
  event,
  supporters,
  raised,
  simulated,
  onChange,
  onReset,
}: {
  event: FreakEvent;
  supporters: number;
  raised: number;
  simulated: boolean;
  onChange: (v: { supporters: number; raised: number }) => void;
  onReset: () => void;
}) {
  return (
    <div className="mt-6 rounded-2xl border-2 border-dashed border-orange/50 bg-orange/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <DemoBadge label="Simulator" />
          <span className="text-sm font-bold">Level-up preview</span>
        </div>
        {simulated && (
          <button type="button" onClick={onReset} className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-bold text-orange">
            <RotateCcw className="size-4" aria-hidden /> Reset
          </button>
        )}
      </div>
      <p className="ja mt-1 text-xs text-mute">スライダーで応援者数と資金を動かして、ステージの進化を確認できます（デモ）。</p>
      <label className="mt-3 block">
        <span className="flex justify-between text-sm font-semibold">
          <span className="inline-flex items-center gap-1"><Users className="size-4" aria-hidden /> Supporters</span>
          <span>{supporters.toLocaleString("en-US")}</span>
        </span>
        <input type="range" className="fk-range" min={0} max={12000} step={10} value={supporters} onChange={(e) => onChange({ supporters: +e.target.value, raised })} aria-label="Simulated supporters" />
      </label>
      <label className="block">
        <span className="flex justify-between text-sm font-semibold">
          <span>Funding secured</span>
          <span>{money(raised)}</span>
        </span>
        <input type="range" className="fk-range" min={0} max={260000} step={500} value={raised} onChange={(e) => onChange({ supporters, raised: +e.target.value })} aria-label="Simulated funding" />
      </label>
      <div className="mt-1 flex flex-wrap gap-2">
        {LEVELS.map((l) => (
          <button key={l.level} type="button" onClick={() => onChange({ supporters: Math.max(l.supporters, 10), raised: Math.max(l.funding, 500) })} className="min-h-11 rounded-full border-2 border-line px-3 text-xs font-extrabold uppercase hover:border-cream/40">
            Jump LV.{l.level}
          </button>
        ))}
      </div>
      <span className="sr-only" aria-live="polite">{`${event.name} simulated at ${supporters} supporters and ${money(raised)}`}</span>
    </div>
  );
}
