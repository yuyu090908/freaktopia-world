"use client";

/**
 * Selected festival: a right-hand panel on desktop (map stays visible) and a swipeable bottom
 * sheet on phones (peek → expanded; swipe down or Close to see the whole map again).
 * Actions depend on status, and nothing unconnected is presented as working.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarDays, ChevronDown, ChevronUp, Crown, Disc3, HandHeart, Landmark, MapPin, Mic2, PartyPopper, Radio, Ticket, TrendingUp, Users, Vote, X } from "lucide-react";
import { EventCover } from "@/components/cards/Cards";
import { LEVEL_COLORS } from "@/lib/map/growth";
import { LANDMARK_LABEL, STATUS_META, landmarkSvg } from "@/lib/map/landmarks";
import type { WorldEvent } from "@/lib/map/view";
import { cn, fmtDate } from "@/lib/utils";

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const num = (n: number) => n.toLocaleString("en-US");

export function StatusPill({ status, className }: { status: WorldEvent["status"]; className?: string }) {
  const s = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border-2 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide", className)} style={{ borderColor: s.color, color: s.color }} title={s.hint}>
      <span aria-hidden>{s.glyph}</span>
      {s.label}
    </span>
  );
}

export function LevelPill({ e }: { e: WorldEvent }) {
  const c = LEVEL_COLORS[e.level];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase text-ink" style={{ background: c }}>
      LV.{e.level} {e.growthResult.name}
    </span>
  );
}

type Action = { key: string; label: string; href: string; icon: React.ReactNode; tone: "primary" | "live" | "ghost"; testId?: string };

export function actionsFor(e: WorldEvent): Action[] {
  const a: Action[] = [];
  const ev = `/events/${e.id}`;
  if (e.live) a.push({ key: "live", label: e.live.demo ? "Enter festival (demo live)" : "Watch live", href: `/live/${e.id}`, icon: <Radio className="size-4" aria-hidden />, tone: "live", testId: "map-enter-live" });
  if (e.status === "funding" || e.status === "planning") a.push({ key: "support", label: "Support event", href: ev, icon: <HandHeart className="size-4" aria-hidden />, tone: "primary" });
  if ((e.status === "confirmed" || e.status === "live") && e.tickets.onSale) a.push({ key: "tickets", label: "Buy ticket", href: `${ev}/tickets`, icon: <Ticket className="size-4" aria-hidden />, tone: a.length ? "ghost" : "primary" });
  if (e.dao) a.push({ key: "dao", label: "View DAO", href: `/dao/${e.id}`, icon: <Vote className="size-4" aria-hidden />, tone: "ghost" });
  if (e.djRecruiting && e.status !== "cancelled") a.push({ key: "dj", label: "Apply as DJ", href: `/djs/apply?event=${e.id}`, icon: <Mic2 className="size-4" aria-hidden />, tone: "ghost" });
  a.push({ key: "view", label: "View event", href: ev, icon: <ArrowRight className="size-4" aria-hidden />, tone: a.length ? "ghost" : "primary" });
  return a;
}

function ActionButton({ a, compact }: { a: Action; compact?: boolean }) {
  return (
    <Link
      href={a.href}
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
      {a.label}
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

function Details({ e }: { e: WorldEvent }) {
  const g = e.growthResult;
  return (
    <div className="space-y-4">
      {e.live && (
        <section aria-label="Live now" className="rounded-2xl border-2 border-coral/60 bg-coral/10 p-3" data-testid="map-live-info">
          <div className="flex items-center gap-2 text-[12px] font-extrabold uppercase text-coral">
            <span className="size-2 rounded-full bg-coral" aria-hidden /> {e.live.demo ? "Demo live · simulation" : "Live now"}
          </div>
          <p className="mt-1 text-[14px]">
            Now playing: <b>{e.live.currentDj?.name ?? "Between sets"}</b>
          </p>
          <p className="text-[12px] text-mute">{e.live.demo ? "Stream: demo visualizer. No licensed stream is connected." : "Licensed stream"}</p>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-ink/60 p-2">
              <dt className="text-[10px] uppercase text-mute">Online viewers</dt>
              <dd className="font-display text-lg">{num(e.live.onlineViewers)}</dd>
            </div>
            <div className="rounded-xl bg-ink/60 p-2">
              <dt className="text-[10px] uppercase text-mute">Checked in on site</dt>
              <dd className="font-display text-lg">{num(e.live.checkedIn)}</dd>
            </div>
            <div className="rounded-xl bg-ink/60 p-2">
              <dt className="text-[10px] uppercase text-mute">Public avatars</dt>
              <dd className="font-display text-lg">{num(e.live.publicAvatars)}</dd>
            </div>
          </dl>
          <p className="mt-1.5 text-[11px] text-mute">Viewers watch online; checked-in guests are verified at the door. They are never added together.</p>
        </section>
      )}

      <section aria-label="Festival level">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-extrabold uppercase">Festival level</h3>
          <LevelPill e={e} />
        </div>
        <p className="mt-1 text-[12px] text-mute">
          {g.visual}. A map game level, not venue capacity.
        </p>
        {g.next ? (
          <ul className="mt-2 space-y-1.5" aria-label={`Requirements for level ${g.next.level} ${g.next.name}`}>
            {g.requirements.map((r) => (
              <li key={r.key} className="text-[12px]">
                <div className="flex justify-between gap-2">
                  <span>
                    <span aria-hidden>{r.met ? "✓ " : "○ "}</span>
                    {r.label}
                  </span>
                  <span className="text-mute">
                    {r.key === "venueContract" ? (r.met ? "signed" : "not yet") : r.key === "fundingUsd" ? `${usd(r.have)} / ${usd(r.need)}` : `${num(r.have)} / ${num(r.need)}`}
                  </span>
                </div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-surface-2" role="presentation">
                  <div className="h-full rounded-full" style={{ width: `${r.pct * 100}%`, background: r.met ? "#B6F05C" : LEVEL_COLORS[g.next!.level] }} />
                </div>
              </li>
            ))}
            <li className="pt-0.5 text-[11px] text-mute">Next: LV.{g.next.level} {g.next.name}</li>
          </ul>
        ) : (
          <p className="mt-2 text-[12px] text-acid">Top level reached.</p>
        )}
      </section>

      <section aria-label="Key facts">
        <Row icon={<Users className="size-4" />} label="Supporters">
          {num(e.growth.supporters)}
        </Row>
        <Row icon={<Landmark className="size-4" />} label="Confirmed funding">
          {usd(e.growth.fundingUsd)} of {usd(e.goalUsd)} goal
        </Row>
        <Row icon={<Vote className="size-4" />} label="Staking participants">
          {e.dao ? (
            <>
              {num(e.dao.stakers)} people · {num(e.dao.staked)} {e.dao.tokenSymbol} escrowed
              <span className="block text-[11px] text-mute">Staking is held separately and is not event budget.</span>
            </>
          ) : (
            "No DAO for this event"
          )}
        </Row>
        <Row icon={<Ticket className="size-4" />} label="Tickets">
          {e.status === "completed" ? "Event finished" : e.tickets.onSale ? `${num(e.tickets.remaining)} left · from ${usd(e.tickets.fromUsd ?? 0)} (demo checkout)` : e.status === "confirmed" || e.status === "live" ? "Sold out" : "Not on sale until confirmed"}
        </Row>
        <Row icon={<Mic2 className="size-4" />} label="DJ recruitment">
          {e.djRecruiting ? "Open: DJs can apply" : "Closed"}
        </Row>
        <Row icon={<PartyPopper className="size-4" />} label="After party">
          {e.afterParty ? (
            <Link href={`/after-party/${e.afterParty.id}`} className="font-bold text-acid underline-offset-2 hover:underline">
              {e.afterParty.name} · {e.afterParty.venue}
            </Link>
          ) : (
            "Not announced"
          )}
        </Row>
        <Row icon={<Disc3 className="size-4" />} label="Landmark">
          {LANDMARK_LABEL[e.landmark.type]}
          {e.landmark.approvedDesign ? <span className="block text-[11px] text-mute">Colours from the DAO-approved stage design “{e.landmark.approvedDesign.name}”.</span> : e.dao ? <span className="block text-[11px] text-mute">No approved DAO stage design yet: default look.</span> : null}
        </Row>
      </section>

      {e.dao && (
        <Link href={`/dao/${e.id}`} className="block rounded-2xl border-2 border-purple/50 bg-purple/10 p-3" data-testid="map-dao">
          <div className="flex items-center justify-between text-[12px] font-extrabold uppercase text-purple">
            <span>Community DAO · {e.dao.status}</span>
            <ArrowRight className="size-4" aria-hidden />
          </div>
          <p className="mt-1 text-[13px]">
            {num(e.dao.members)} members · {e.dao.activeProposals} active proposals · {e.dao.openVotes} open votes
          </p>
          {e.dao.activeVote && <p className="truncate text-[12px] text-mute">Voting now: {e.dao.activeVote}</p>}
          <p className="text-[11px] text-mute">Banners on the landmark grow with members. They are decoration, not funding progress.</p>
        </Link>
      )}

      {(e.ranking.rank || e.ranking.trendingRank) && (
        <Link href={`/rankings?category=${e.ranking.trendingRank && !e.ranking.badge ? "trending&period=7d" : "popular&period=all"}`} className="flex items-center gap-2 rounded-2xl bg-surface-2 p-3 text-[13px]" data-testid="map-rank">
          {e.ranking.badge ? <Crown className="size-4 text-[#E8C66A]" aria-hidden /> : <TrendingUp className="size-4 text-acid" aria-hidden />}
          <span className="min-w-0 flex-1">
            {e.ranking.rank && <span className="block">#{e.ranking.rank} Most popular · all time</span>}
            {e.ranking.trendingRank && <span className="block">#{e.ranking.trendingRank} Trending · last 7 days</span>}
            <span className="block text-[11px] text-mute">Updated {fmtDate(e.ranking.asOf, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · demo data</span>
          </span>
          <ArrowRight className="size-4 text-acid" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function Header({ e, onClose, big }: { e: WorldEvent; onClose: () => void; big?: boolean }) {
  return (
    <div className="flex gap-3">
      <div className={cn("relative shrink-0 overflow-hidden rounded-2xl border-2 border-line", big ? "size-24" : "size-[72px]")}>
        <EventCover id={e.id} sizes="96px" />
        <span className="absolute -bottom-1 -right-1 size-11 drop-shadow" aria-hidden dangerouslySetInnerHTML={{ __html: landmarkSvg({ type: e.landmark.type, level: e.level, status: e.status, palette: e.palette, animate: false }) }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill status={e.status} />
          <LevelPill e={e} />
        </div>
        <h2 className="mt-1.5 text-[22px] uppercase leading-none">{e.name}</h2>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-mute">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden />
            {e.city}, {e.country}
            {e.location.precision === "city" && " (approx.)"}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden />
            {fmtDate(e.startsAt, { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>
        <div className="mt-1 truncate text-[12px] text-mute">{e.genres.join(" / ")}</div>
      </div>
      <button type="button" onClick={onClose} aria-label="Close festival details" className="-mr-1 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2">
        <X className="size-5" />
      </button>
    </div>
  );
}

function KeyNumbers({ e }: { e: WorldEvent }) {
  const items = e.live
    ? [
        ["Online viewers", num(e.live.onlineViewers)],
        ["Checked in", num(e.live.checkedIn)],
        ["Supporters", num(e.growth.supporters)],
      ]
    : [
        ["Supporters", num(e.growth.supporters)],
        ["Funding", e.goalUsd ? `${Math.round((e.growth.fundingUsd / e.goalUsd) * 100)}%` : "–"],
        [e.dao ? "Stakers" : "Tickets", e.dao ? num(e.dao.stakers) : e.tickets.onSale ? num(e.tickets.remaining) : "–"],
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
  const actions = actionsFor(e);
  return (
    <section aria-label={`${e.name} summary`} className="wm-panel absolute bottom-4 right-4 top-[124px] z-20 flex w-[400px] flex-col overflow-hidden rounded-[28px] border-2 border-line bg-[#0D121B]/95 shadow-[0_20px_60px_rgba(0,0,0,.55)] backdrop-blur" data-testid="event-panel">
      <div className="border-b border-line p-4">
        <Header e={e} onClose={onClose} big />
        <KeyNumbers e={e} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        <Details e={e} />
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-line p-3">
        {actions.map((a, i) => (
          <div key={a.key} className={cn(i === 0 && "col-span-2")}>
            <ActionButton a={a} compact={i > 0} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Phone: bottom sheet with a peek and an expanded state. */
export function EventBottomSheet({ e, onClose, expanded, setExpanded, onHeight }: { e: WorldEvent; onClose: () => void; expanded: boolean; setExpanded: (v: boolean) => void; onHeight: (h: number) => void }) {
  const ref = useRef<HTMLElement>(null);
  const start = useRef<{ y: number; t: number } | null>(null);
  const [dy, setDy] = useState(0);
  const actions = actionsFor(e);
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
      aria-label={`${e.name} summary`}
      data-testid="event-sheet"
      data-expanded={expanded}
      className={cn("wm-sheet absolute inset-x-0 bottom-0 flex flex-col rounded-t-[28px] border-2 border-b-0 border-line bg-[#0D121B]/97 shadow-[0_-12px_40px_rgba(0,0,0,.5)] backdrop-blur", expanded ? "z-40 max-h-[calc(100%-8px)]" : "z-20 max-h-[62%]")}
      style={{ transform: dy ? `translateY(${Math.max(-60, dy)}px)` : undefined, transition: dy ? "none" : "transform 200ms ease-out" }}
    >
      <div className="touch-none px-4 pb-1 pt-2" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <button type="button" onClick={() => setExpanded(!expanded)} className="-mt-2 mb-0 flex h-11 w-full items-center justify-center" aria-label={expanded ? "Show less" : "Show all details"} aria-expanded={expanded}>
          <span className="h-1.5 w-12 rounded-full bg-cream/30" aria-hidden />
        </button>
        <Header e={e} onClose={onClose} />
      </div>
      <div className={cn("min-h-0 flex-1 px-4", expanded ? "overflow-y-auto overscroll-contain" : "overflow-hidden")}>
        <KeyNumbers e={e} />
        <div className="mt-3">
          <ActionButton a={primary} />
        </div>
        {!expanded && (
          <button type="button" onClick={() => setExpanded(true)} className="mx-auto my-1 flex min-h-11 items-center gap-1 text-[13px] font-bold text-mute">
            <ChevronUp className="size-4" aria-hidden /> More: level, DAO, tickets, actions
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
              <ChevronDown className="size-4" aria-hidden /> Show less
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
