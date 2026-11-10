"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Award, BadgeCheck, CheckCircle2, Clock, DoorOpen, Eye, Lock, MapPin, PartyPopper, QrCode, ScanLine, ShieldX, Ticket, Trophy, Users, Vote, XCircle } from "lucide-react";
import { AlienAvatar } from "@/components/cards/Cards";
import { BeforeAfter } from "@/components/dao/views/StageDesigner";
import type { ConceptDto } from "@/components/dao/DaoContext";
import { DemoBadge, DemoNotice, Progress, Tag } from "@/components/ui/primitives";
import { useDaoQuery } from "@/lib/dao/client";
import { STATUS_META } from "@/lib/dao/meta";
import type { DaoStatus } from "@/lib/dao/types";
import { fmtCount, liveApi, useLiveQuery, type LiveDetail } from "@/lib/live/client";
import { LIVE_QUESTS, type QuestProgress } from "@/lib/live/quests";
import { fmtInTz, tzLabel } from "@/lib/live/time";
import { grantXp, toast, useDemo } from "@/lib/store";
import { cn, money } from "@/lib/utils";

/* ---------------- quests ---------------- */

export function QuestsPanel({ progress }: { progress: QuestProgress }) {
  const badges = useDemo((s) => s.liveBadges);
  return (
    <section aria-labelledby="q-h" className="space-y-3">
      <div className="flex items-end justify-between gap-2">
        <h2 id="q-h" className="text-[28px] uppercase">Quests</h2>
        <span className="text-[12px] text-mute">{progress.completed.length}/{LIVE_QUESTS.length} done</span>
      </div>
      <p className="text-[12px] text-mute">Online quests are done from anywhere. On-site quests need a verified check-in at the venue; watching a stream never counts as attending.</p>
      <ul className="space-y-2" data-testid="quests">
        {LIVE_QUESTS.map((q) => {
          const done = progress.completed.includes(q.id);
          const cur = Math.min(q.target, progress.progress[q.id] ?? 0);
          const locked = q.kind === "onsite" && !done;
          return (
            <li key={q.id} className={cn("rounded-2xl border p-3", done ? "border-acid/60 bg-acid/10" : "border-line bg-surface")} data-quest={q.id} data-done={done || undefined}>
              <div className="flex items-start gap-2">
                {done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-acid" aria-hidden /> : locked ? <Lock className="mt-0.5 size-5 shrink-0 text-mute" aria-hidden /> : <Trophy className="mt-0.5 size-5 shrink-0 text-orange" aria-hidden />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <b>{q.title}</b>
                    <Tag color={q.kind === "online" ? "#2a2a2a" : "#FF625C"} dark={q.kind !== "online"}>{q.kind === "online" ? "Online" : "On-site"}</Tag>
                  </div>
                  <p className="text-[13px] text-mute">{q.desc}</p>
                  <p className="mt-1 text-[12px]">
                    <span className="text-acid">+{q.xp} XP</span>
                    {q.badge && <span> · badge “{q.badge}”</span>}
                    {q.reward && <span> · {q.reward}</span>}
                  </p>
                  {!done && q.kind === "online" && <Progress value={cur / q.target} className="mt-2 h-2" label={`${q.title} progress`} />}
                  {locked && <p className="mt-1 text-[12px] text-orange">Needs a verified on-site check-in. Demo check-ins don&apos;t count.</p>}
                </div>
                {!done && q.kind === "online" && <span className="shrink-0 font-display text-sm">{q.id === "watch-set" ? `${Math.floor(cur / 60)}/${q.target / 60}m` : `${cur}/${q.target}`}</span>}
              </div>
            </li>
          );
        })}
      </ul>
      {badges.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
          <Award className="size-4 text-purple" aria-hidden /> Badges:
          {badges.map((b) => <Tag key={b} color="#A276E9" dark>{b}</Tag>)}
        </div>
      )}
    </section>
  );
}

/* ---------------- attendance ---------------- */

export function AttendancePanel({ detail, onlineViewers, publicAvatars }: { detail: LiveDetail; onlineViewers: number; publicAvatars: number }) {
  const a = detail.attendance;
  const rows: { label: string; value: string; note: string; icon: typeof Users; color: string }[] = [
    { label: "Tickets sold", value: fmtCount(a.ticketsSold), note: "Paid/issued tickets (demo ranking data).", icon: Ticket, color: "#FFAD5B" },
    { label: "Unique checked-in", value: fmtCount(a.checkedIn), note: "Unique tickets scanned at the door (demo).", icon: DoorOpen, color: "#B6F05C" },
    { label: "Verified currently present", value: a.currentlyPresent === null ? "Not tracked" : fmtCount(a.currentlyPresent), note: "Checked-in minus verified exits. Never inferred from GPS.", icon: BadgeCheck, color: "#55BCEB" },
    { label: "Online viewers", value: fmtCount(onlineViewers), note: "People with the room open (demo base + real visitors).", icon: Eye, color: "#A276E9" },
    { label: "Public avatars", value: fmtCount(publicAvatars), note: "Avatars set to public on the map. Not attendance.", icon: Users, color: "#FF625C" },
  ];
  return (
    <section aria-labelledby="att-h" className="space-y-3">
      <h2 id="att-h" className="text-[28px] uppercase">Who&apos;s here</h2>
      <ul className="grid gap-2 sm:grid-cols-2" data-testid="attendance">
        {rows.map((r) => (
          <li key={r.label} className="flex items-start gap-3 rounded-2xl bg-surface-2 p-3">
            <r.icon className="mt-0.5 size-5 shrink-0" style={{ color: r.color }} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-mute">{r.label}</div>
              <div className="font-display text-xl">{r.value}</div>
              <div className="text-[12px] text-mute">{r.note}</div>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-[12px] text-mute">Door demo this session: {a.doorDemo.checkedIn} demo check-ins. Demo check-ins are never added to the figures above.</p>
    </section>
  );
}

/* ---------------- check-in ---------------- */

function FakeQr({ value }: { value: string }) {
  // Decorative pattern derived from the code. It is not a scannable QR code.
  let h = 2166136261;
  const cells: boolean[] = [];
  for (let i = 0; i < 21 * 21; i++) {
    h ^= value.charCodeAt(i % value.length) + i;
    h = Math.imul(h, 16777619) >>> 0;
    cells.push((h & 7) > 3);
  }
  const finder = (x: number, y: number) => (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
  return (
    <svg viewBox="0 0 21 21" className="size-32 rounded-lg bg-cream p-1.5" role="img" aria-label="Demo ticket code pattern (not scannable)">
      {cells.map((on, i) => {
        const x = i % 21;
        const y = Math.floor(i / 21);
        if (finder(x, y)) return null;
        return on ? <rect key={i} x={x} y={y} width={1} height={1} fill="#080808" /> : null;
      })}
      {[[0, 0], [14, 0], [0, 14]].map(([x, y]) => (
        <g key={`${x}${y}`}>
          <rect x={x} y={y} width={7} height={7} fill="#080808" />
          <rect x={x + 1} y={y + 1} width={5} height={5} fill="#F5F2EA" />
          <rect x={x + 2} y={y + 2} width={3} height={3} fill="#080808" />
        </g>
      ))}
    </svg>
  );
}

export function CheckinPanel({ eventId, isDemoLive, onVerified }: { eventId: string; isDemoLive: boolean; onVerified: () => void }) {
  const [ticket, setTicket] = useState<{ ticketId: string; qr: string; cancelled?: boolean } | null>(null);
  const [result, setResult] = useState<{ ok: boolean; title: string; body: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const checkedIn = useDemo((s) => s.liveCheckedIn);
  const setLive = useDemo((s) => s.setLive);

  const issue = async (sample?: "cancelled") => {
    setBusy(true);
    setResult(null);
    const r = await liveApi<{ ticketId: string; qr: string; cancelled?: boolean }>(`${eventId}/demo-ticket${sample ? "?sample=cancelled" : ""}`, { method: "POST" });
    setBusy(false);
    if (!r.ok) return setResult({ ok: false, title: "Couldn't issue a demo ticket", body: r.error.message });
    setTicket(r.data);
  };
  const scan = async (method: "ticket_qr" | "organizer_scan" | "manual") => {
    if (!ticket) return;
    setBusy(true);
    const r = await liveApi<{ ticketId: string; kind: string }>(`${eventId}/checkin`, { method: "POST", json: { qr: ticket.qr, method } });
    setBusy(false);
    if (!r.ok) return setResult({ ok: false, title: r.error.code.replaceAll("_", " "), body: r.error.message });
    setResult({ ok: true, title: "Checked in (demo)", body: `Ticket ${r.data.ticketId} accepted. This is a demo check-in: it is not recorded as real attendance and doesn't unlock on-site quests.` });
    if (!checkedIn) grantXp(20, "Door check-in practice (demo)");
    setLive({ liveCheckedIn: true });
    onVerified();
  };

  if (!isDemoLive) {
    return (
      <section aria-labelledby="ci-h" className="space-y-2">
        <h2 id="ci-h" className="text-[28px] uppercase">Check-in</h2>
        <p className="text-sm text-mute">Door check-in opens two hours before the festival starts. Bring your ticket QR from My Tickets.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="ci-h" className="space-y-3" data-testid="checkin">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="ci-h" className="text-[28px] uppercase">Check-in</h2>
        <DemoBadge label="Door demo" />
      </div>
      <p className="text-[13px] text-mute">Three ways in: your ticket QR, a scan by door staff, or manual lookup by staff. Each ticket works once, only for this event, only while doors are open, and cancelled tickets are refused.</p>
      {checkedIn && <p className="flex items-center gap-1.5 text-sm text-acid"><CheckCircle2 className="size-4" aria-hidden />You’re checked in (demo). Not counted as real attendance.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => issue()} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-acid px-4 font-bold text-ink disabled:opacity-50"><Ticket className="size-4" aria-hidden />Get a demo ticket</button>
        <button type="button" disabled={busy} onClick={() => issue("cancelled")} className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-line px-4 font-bold disabled:opacity-50"><XCircle className="size-4" aria-hidden />Try a cancelled ticket</button>
      </div>
      {ticket && (
        <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-line bg-surface p-3">
          <FakeQr value={ticket.qr} />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-[12px] font-extrabold uppercase text-orange">Demo ticket · not valid for real entry</p>
            <p className="break-all font-mono text-[11px] text-mute">{ticket.qr}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => scan("ticket_qr")} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-coral px-4 font-bold text-ink disabled:opacity-50"><QrCode className="size-4" aria-hidden />Scan my QR at the door</button>
              <button type="button" disabled={busy} onClick={() => scan("organizer_scan")} className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-line px-4 text-sm font-bold disabled:opacity-50"><ScanLine className="size-4" aria-hidden />Organizer scan</button>
              <button type="button" disabled={busy} onClick={() => scan("manual")} className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-line px-4 text-sm font-bold disabled:opacity-50">Manual</button>
            </div>
            <p className="text-[11px] text-mute">Organizer scan and manual check-in need a door-staff session, which the demo doesn&apos;t issue, so they are refused.</p>
          </div>
        </div>
      )}
      {result && (
        <div role="status" className={cn("flex gap-2 rounded-2xl p-3 text-sm", result.ok ? "bg-acid/15" : "bg-coral/15")} data-testid="checkin-result">
          {result.ok ? <CheckCircle2 className="size-5 shrink-0 text-acid" aria-hidden /> : <ShieldX className="size-5 shrink-0 text-coral" aria-hidden />}
          <div>
            <b className="uppercase">{result.title}</b>
            <p className="text-[13px] text-cream/85">{result.body}</p>
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------------- after party portal ---------------- */

export function AfterPartyPortal({ detail, tz, onOpenPortal }: { detail: LiveDetail; tz: string; onOpenPortal?: () => void }) {
  const ap = detail.afterParty;
  if (!ap) {
    return (
      <section aria-labelledby="ap-h" className="space-y-2 rounded-3xl border border-dashed border-line p-4" data-testid="after-party">
        <h2 id="ap-h" className="text-[24px] uppercase">After party portal</h2>
        <Tag color="#2a2a2a">Not confirmed</Tag>
        <p className="text-sm text-mute">No after party has been confirmed for this festival yet. Venue, time and tickets appear here once the organizer confirms them.</p>
        <Link href="/after-party/new" className="inline-flex min-h-11 items-center font-bold text-acid">Host an after party →</Link>
      </section>
    );
  }
  const start = Date.parse(ap.startsAt);
  const soldOut = ap.seatsLeft <= 0;
  return (
    <section aria-labelledby="ap-h" className="neon space-y-3 overflow-hidden rounded-3xl border-2 bg-surface p-4" data-testid="after-party">
      <div className="flex flex-wrap items-center gap-2">
        <PartyPopper className="size-5 text-purple" aria-hidden />
        <h2 id="ap-h" className="text-[24px] uppercase">After party portal</h2>
        <Tag color={ap.confirmed ? "#B6F05C" : "#2a2a2a"} dark={ap.confirmed}>{ap.confirmed ? "Confirmed" : "Not confirmed"}</Tag>
        <DemoBadge />
      </div>
      <h3 className="font-display text-2xl uppercase">{ap.name}</h3>
      <ul className="space-y-1.5 text-[14px]">
        <li className="flex items-center gap-2"><MapPin className="size-4 shrink-0 text-mute" aria-hidden />{ap.venueName}, {ap.city}</li>
        <li className="flex items-center gap-2"><Clock className="size-4 shrink-0 text-mute" aria-hidden />{fmtInTz(start, tz, { weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}–{fmtInTz(Date.parse(ap.endsAt), tz)} {tzLabel(start, tz)}</li>
        <li className="flex items-center gap-2"><Ticket className="size-4 shrink-0 text-mute" aria-hidden />{money(ap.price)} · {soldOut ? "Sold out" : `${ap.seatsLeft} of ${ap.capacity} left`}</li>
      </ul>
      <div className="flex flex-wrap gap-2">
        {ap.dj.map((d) => (
          <Link key={d.id} href={`/djs/${d.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface-2 py-1 pl-1 pr-3 text-sm font-bold">
            <AlienAvatar look={d.look} size={34} /> {d.name}
          </Link>
        ))}
      </div>
      <p className="text-[13px] text-mute">{ap.description}</p>
      <p className="rounded-2xl bg-surface-2 p-3 text-[12px] text-mute">Entry: after-party ticket or main-event wristband plus photo ID; local age rules apply (sample conditions for the demo). The online portal opens in the virtual venue for everyone.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Link href={`/after-party/${ap.id}`} className={cn("flex min-h-12 items-center justify-center gap-2 rounded-full font-extrabold uppercase", soldOut ? "border-2 border-line" : "bg-purple text-ink")}>
          {soldOut ? "Details" : "Join / buy (demo)"} <ArrowRight className="size-4" aria-hidden />
        </Link>
        {onOpenPortal && (
          <button type="button" onClick={onOpenPortal} className="flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-purple font-extrabold uppercase text-purple">
            Go to portal zone
          </button>
        )}
      </div>
      <p className="text-[11px] text-mute">Payments are not connected in this build. “Buy” creates a demo order in this browser only.</p>
    </section>
  );
}

/* ---------------- DAO ---------------- */

interface DaoHomeDto {
  dao: { status: DaoStatus; description: string };
  summary: { members: number; activeProposals: number; openVotes: number; participationRate: number; gameLevel: number; tokenSymbol: string };
  concepts: ConceptDto[];
  progress: { done: number; total: number; next: { title: string } | null };
  me: { member: boolean } | null;
}
interface RoadmapDto {
  level: number;
  stageConcept: ConceptDto | null;
  leadingConcept: ConceptDto | null;
}
interface ProposalsDto {
  proposals: { id: string; state: string; category: string; current: { title: string } }[];
}
interface ActivityDto {
  entries: { id: string; at: number; action: string }[];
}

const CLOSED = ["APPROVED", "REJECTED", "COMPLETED", "EXECUTION", "FEASIBILITY_CHECK", "ORGANIZER_CONFIRMATION", "CANCELLED"];

export function DaoPanel({ eventId }: { eventId: string }) {
  const home = useDaoQuery<DaoHomeDto>(eventId);
  const road = useDaoQuery<RoadmapDto>(`${eventId}/roadmap`);
  const props = useDaoQuery<ProposalsDto>(`${eventId}/proposals`);
  const act = useDaoQuery<ActivityDto>(`${eventId}/activity`);
  if (home.state.status === "loading") return <div className="h-48 animate-pulse rounded-3xl bg-surface" aria-hidden />;
  if (home.state.status === "error") {
    return (
      <section aria-labelledby="dao-h" className="space-y-2 rounded-3xl border border-dashed border-line p-4" data-testid="live-dao">
        <h2 id="dao-h" className="text-[24px] uppercase">Festival DAO</h2>
        <p className="text-sm text-mute">{home.state.httpStatus === 404 ? "This festival has no community DAO yet." : home.state.error.message}</p>
        <Link href={`/dao/${eventId}`} className="inline-flex min-h-11 items-center font-bold text-acid">Open DAO page →</Link>
      </section>
    );
  }
  const h = home.state.data;
  const r = road.state.status === "ok" ? road.state.data : null;
  const approved = r?.stageConcept ?? null;
  const candidate = approved ?? r?.leadingConcept ?? h.concepts[0] ?? null;
  const ps = props.state.status === "ok" ? props.state.data.proposals : [];
  const decisions = ps.filter((p) => CLOSED.includes(p.state));
  const current = ps.filter((p) => !CLOSED.includes(p.state));
  const updates = act.state.status === "ok" ? act.state.data.entries.slice(0, 4) : [];
  const st = STATUS_META[h.dao.status];
  return (
    <section aria-labelledby="dao-h" className="space-y-3 rounded-3xl border border-line bg-surface p-4" data-testid="live-dao">
      <div className="flex flex-wrap items-center gap-2">
        <Vote className="size-5 text-acid" aria-hidden />
        <h2 id="dao-h" className="text-[24px] uppercase">Festival DAO</h2>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase text-ink" style={{ background: st.color }}>{st.label}</span>
        <DemoBadge />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-surface-2 p-2"><div className="text-[10px] font-bold uppercase text-mute">Members</div><div className="font-display text-lg">{fmtCount(h.summary.members)}</div></div>
        <div className="rounded-2xl bg-surface-2 p-2"><div className="text-[10px] font-bold uppercase text-mute">Dev level</div><div className="font-display text-lg">LV.{r?.level ?? h.summary.gameLevel}</div></div>
        <div className="rounded-2xl bg-surface-2 p-2"><div className="text-[10px] font-bold uppercase text-mute">Roadmap</div><div className="font-display text-lg">{h.progress.done}/{h.progress.total}</div></div>
      </div>
      <p className="text-[13px]">{h.me?.member ? <span className="text-acid">You&apos;re a member of this DAO.</span> : <span className="text-mute">You&apos;re not a member. Anyone can read; joining, proposing and voting are checked on the server on the DAO page.</span>}</p>

      <div>
        <h3 className="text-sm font-extrabold uppercase text-mute">Stage design</h3>
        {approved ? (
          <p className="text-[13px]"><BadgeCheck className="mr-1 inline size-4 text-acid" aria-hidden />Approved by vote: <b>{approved.name}</b></p>
        ) : (
          <p className="text-[13px] text-mute">No stage design has been approved by vote yet{candidate ? `. Showing the community concept “${candidate.name}” (not approved).` : "."}</p>
        )}
        {candidate?.photo && (
          <div className="mt-2">
            <BeforeAfter c={candidate} />
            <p className="mt-1 text-[11px] text-mute">Left: the registered venue photo before the build. Right: the concept render. No photo of the finished stage has been uploaded, so this is design vs. venue, not design vs. result.</p>
          </div>
        )}
      </div>

      {current.length > 0 && (
        <div>
          <h3 className="text-sm font-extrabold uppercase text-mute">Current proposals</h3>
          <ul className="mt-1 space-y-1">
            {current.slice(0, 3).map((p) => (
              <li key={p.id}><Link href={`/dao/${eventId}/proposals/${p.id}`} className="flex min-h-11 items-center gap-2 rounded-xl bg-surface-2 px-3 text-[13px]"><Tag color="#2a2a2a">{p.state.replaceAll("_", " ")}</Tag><span className="min-w-0 flex-1 truncate">{p.current.title}</span></Link></li>
            ))}
          </ul>
        </div>
      )}
      {decisions.length > 0 && (
        <div>
          <h3 className="text-sm font-extrabold uppercase text-mute">Decisions</h3>
          <ul className="mt-1 space-y-1 text-[13px]">
            {decisions.slice(0, 3).map((p) => <li key={p.id} className="flex items-center gap-2"><Tag color={p.state === "REJECTED" ? "#FF625C" : "#B6F05C"} dark>{p.state.replaceAll("_", " ")}</Tag><span className="truncate">{p.current.title}</span></li>)}
          </ul>
        </div>
      )}
      {updates.length > 0 && (
        <div>
          <h3 className="text-sm font-extrabold uppercase text-mute">DAO updates</h3>
          <ul className="mt-1 space-y-0.5 text-[12px] text-mute">
            {updates.map((u) => <li key={u.id}>{new Date(u.at).toISOString().slice(0, 10)} · {u.action.replace(".", " · ").replaceAll("_", " ")}</li>)}
          </ul>
        </div>
      )}
      <Link href={`/dao/${eventId}`} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-acid font-extrabold uppercase text-ink">Open festival DAO <ArrowRight className="size-4" aria-hidden /></Link>
    </section>
  );
}

/* ---------------- rankings ---------------- */

interface RankRow { rank: number | null; of: number; period: string; asOf: string; label: string; calculationVersion?: string }

export function RankingsPanel({ eventId }: { eventId: string }) {
  const q = useLiveQuery<Record<"event" | "checkedIn" | "community" | "trending" | "liveViewers", RankRow> & { demo: boolean }>(`${eventId}/rankings`);
  if (q.state.status !== "ok") return <div className="h-40 animate-pulse rounded-3xl bg-surface" aria-hidden />;
  const d = q.state.data;
  const rows: [keyof typeof d, string][] = [["event", "Event"], ["checkedIn", "Checked-in"], ["community", "Community"], ["trending", "Trending"], ["liveViewers", "Live viewer"]];
  return (
    <section aria-labelledby="rk-h" className="space-y-3" data-testid="live-rankings">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="rk-h" className="text-[24px] uppercase">World ranking</h2>
        <DemoBadge />
      </div>
      <ul className="space-y-2">
        {rows.map(([k, name]) => {
          const r = d[k] as RankRow;
          return (
            <li key={k} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
              <span className="w-14 shrink-0 text-center font-display text-2xl">{r.rank ? `#${r.rank}` : "—"}</span>
              <div className="min-w-0 flex-1">
                <div className="font-bold">{name} rank <span className="text-[12px] font-normal text-mute">of {r.of}</span></div>
                <div className="text-[12px] text-mute">{r.label}</div>
                <div className="text-[11px] text-mute">Period: {r.period} · updated {r.asOf.slice(0, 16).replace("T", " ")} UTC{r.calculationVersion ? ` · ${r.calculationVersion}` : ""}</div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[12px] text-mute">Online viewers and on-site attendance are ranked separately and never added together.</p>
      <Link href="/rankings" className="inline-flex min-h-11 items-center font-bold text-acid">Full WORLD RANKING →</Link>
    </section>
  );
}

export { DemoNotice };
