"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Plus, X, Mail } from "lucide-react";
import { AFTER_PARTIES, DJS, EVENTS, VENUES, getDJ, getEvent } from "@/lib/data";
import { toast, useDemo, useHydrated } from "@/lib/store";
import { userLevel } from "@/lib/levels";
import { AlienAvatar } from "@/components/cards/Cards";
import { ButtonLink, Card, DemoBadge, PageTitle, Progress, Stat, Tag } from "@/components/ui/primitives";
import { EmptyState, LoadingSkeleton } from "@/components/ui/States";
import { cn, money, fmtDate } from "@/lib/utils";
import type { DJApplication } from "@/lib/types";

const ROLES = [
  { id: "organizer", label: "Organizer" },
  { id: "dj", label: "DJ" },
  { id: "venue", label: "Venue owner" },
  { id: "fan", label: "Fan" },
] as const;
type Role = (typeof ROLES)[number]["id"];

/** Sample applications so the organizer view isn’t empty on first visit. */
const SAMPLE_APPS: DJApplication[] = [
  { id: "s-app-1", eventId: "void-jelly-rave", djName: "WOBBLE WITCH", genres: ["Drum & Bass"], bpm: 174, city: "Bristol", mixUrl: "https://example.com/mix", message: "Liquid to jungle, 30-min audition ready.", createdAt: "2026-11-05T10:00:00Z", status: "pending" },
  { id: "s-app-2", eventId: "void-jelly-rave", djName: "DJ PUDDLE", genres: ["Garage"], bpm: 132, city: "London", mixUrl: "https://example.com/mix2", message: "UKG all night.", createdAt: "2026-11-06T10:00:00Z", status: "shortlisted" },
];

export function Dashboard() {
  const params = useSearchParams();
  const router = useRouter();
  const ok = useHydrated();
  const role = (ROLES.some((r) => r.id === params.get("role")) ? params.get("role") : "organizer") as Role;

  return (
    <div className="mx-auto max-w-6xl md:px-6">
      <PageTitle kicker="Dashboard" title="Control room" sub="役割ごとのダッシュボード。データはデモ用サンプルとあなたのブラウザ内の操作内容です。">
        <div className="mt-3"><DemoBadge label="Demo data" /></div>
      </PageTitle>
      <div role="tablist" aria-label="Dashboard role" className="rail !gap-2 md:!px-0">
        {ROLES.map((r) => (
          <button key={r.id} role="tab" type="button" aria-selected={role === r.id} aria-controls={`panel-${r.id}`} id={`tab-${r.id}`} onClick={() => router.replace(`/dashboard?role=${r.id}`, { scroll: false })} className={cn("inline-flex min-h-12 shrink-0 items-center rounded-full border-2 px-5 font-extrabold uppercase", role === r.id ? "border-acid bg-acid text-ink" : "border-line bg-surface")}>
            {r.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${role}`} aria-labelledby={`tab-${role}`} className="mt-6 px-4 md:px-0">
        {!ok ? <LoadingSkeleton variant="list" /> : role === "organizer" ? <Organizer /> : role === "dj" ? <DJView /> : role === "venue" ? <VenueOwner /> : <Fan />}
      </div>
    </div>
  );
}

function Organizer() {
  const created = useDemo((s) => s.createdEvents);
  const apps = useDemo((s) => s.applications);
  const setStatus = useDemo((s) => s.setApplicationStatus);
  const add = useDemo((s) => s.addApplication);
  const myAps = useDemo((s) => s.afterParties);
  const sample = EVENTS.find((e) => e.id === "void-jelly-rave")!;
  const allApps = [...apps, ...SAMPLE_APPS.filter((s) => !apps.some((a) => a.id === s.id))];
  const sold = 512;
  const totalTickets = sample.tickets.reduce((s, t) => s + t.remaining, 0) + sold;

  const decide = (a: DJApplication, status: DJApplication["status"]) => {
    if (a.id.startsWith("s-app")) add({ ...a, status });
    else setStatus(a.id, status);
    toast({ title: `${a.djName}: ${status}`, tone: status === "declined" ? "default" : "success" });
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Events" value={created.length + 1} accent="#B6F05C" />
        <Stat label="DJ applicants" value={allApps.length} accent="#A276E9" />
        <Stat label="Tickets sold" value={sold} accent="#FFAD5B" />
        <Stat label="Raised" value={money(sample.raised)} accent="#55BCEB" />
      </div>

      <section>
        <div className="flex items-center justify-between gap-2"><h2 className="text-2xl uppercase">My events</h2><ButtonLink href="/events/create" size="sm"><Plus className="size-4" aria-hidden /> New</ButtonLink></div>
        <ul className="mt-3 space-y-2">
          <li><Link href={`/events/${sample.id}`} className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4"><span className="min-w-0"><span className="block truncate font-bold">{sample.name}</span><span className="text-xs text-mute">{sample.city} · {fmtDate(sample.startsAt)} · sample</span></span><Tag color="#FFAD5B" dark>Confirmed</Tag></Link></li>
          {created.map((c) => (
            <li key={c.id} className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-acid/40 bg-surface px-4"><span className="min-w-0"><span className="block truncate font-bold">{c.name}</span><span className="text-xs text-mute">{c.city} · {c.date} · {c.genres?.join(", ")}</span></span><Tag color="#B6F05C" dark>Published (demo)</Tag></li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-2xl uppercase">DJ applicants</h2>
        <ul className="mt-3 space-y-2">
          {allApps.map((a) => {
            const ev = getEvent(a.eventId);
            return (
              <li key={a.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0"><div className="font-extrabold">{a.djName}</div><div className="text-xs text-mute">{a.city} · {a.genres.join(", ")} · {a.bpm} BPM · for {ev?.name}</div></div>
                    <Tag color={a.status === "accepted" ? "#B6F05C" : a.status === "declined" ? "#FF625C" : a.status === "shortlisted" ? "#A276E9" : "#2a2a2a"} dark={a.status !== "pending"}>{a.status}</Tag>
                  </div>
                  <p className="mt-2 text-sm text-cream/85">{a.message}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => decide(a, "accepted")} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-acid px-4 text-sm font-extrabold text-ink"><Check className="size-4" aria-hidden /> Accept</button>
                    <button type="button" onClick={() => decide(a, "shortlisted")} className="inline-flex min-h-11 items-center rounded-full border-2 border-line px-4 text-sm font-bold">Shortlist</button>
                    <button type="button" onClick={() => decide(a, "declined")} className="inline-flex min-h-11 items-center gap-1 rounded-full border-2 border-line px-4 text-sm font-bold text-coral"><X className="size-4" aria-hidden /> Decline</button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="text-2xl uppercase">Tickets</h2>
          <Card className="mt-3 space-y-3 p-4">
            {sample.tickets.map((t, i) => {
              const s = [312, 64, 98, 38][i];
              return <div key={t.kind}><div className="mb-1 flex justify-between text-sm font-semibold"><span>{t.name}</span><span>{s} sold</span></div><Progress value={s / (s + t.remaining)} color={["#B6F05C", "#55BCEB", "#FFAD5B", "#A276E9"][i]} label={`${t.name} sold`} /></div>;
            })}
            <p className="text-xs text-mute">{sold} of {totalTickets} sold (sample)</p>
          </Card>
        </section>
        <section>
          <h2 className="text-2xl uppercase">Budget</h2>
          <Card className="mt-3 space-y-2 p-4 text-sm">
            {[["Venue", 8400], ["DJs", 6200], ["Sound & lights", 4300], ["Staff & security", 3100]].map(([k, v]) => (
              <div key={k as string} className="flex justify-between"><span>{k as string}</span><span className="font-bold">{money(v as number)}</span></div>
            ))}
            <div className="flex justify-between border-t border-line pt-2 font-display text-lg"><span>Total</span><span>{money(22000)}</span></div>
            <Progress value={sample.raised / 22000} color="#B6F05C" label="Budget covered" />
            <p className="text-xs text-mute">{Math.round((sample.raised / 22000) * 100)}% covered by funding so far</p>
          </Card>
        </section>
        <section>
          <h2 className="text-2xl uppercase">Venue</h2>
          <Link href="/venues/v-swamp" className="mt-3 flex min-h-16 items-center justify-between rounded-2xl border border-line bg-surface px-4 font-bold">THE SWAMP ROOM <ArrowRight className="size-4" aria-hidden /></Link>
          <Link href="/venues" className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-acid">Find another venue →</Link>
        </section>
        <section>
          <div className="flex items-center justify-between"><h2 className="text-2xl uppercase">After parties</h2><ButtonLink href="/after-party/new" size="sm"><Plus className="size-4" aria-hidden /> New</ButtonLink></div>
          <ul className="mt-3 space-y-2">
            {[...myAps, AFTER_PARTIES[2]].map((a) => <li key={a.id}><Link href={`/after-party/${a.id}`} className="flex min-h-14 items-center justify-between rounded-2xl border border-line bg-surface px-4"><span className="truncate font-bold">{a.name}</span><span className="shrink-0 text-xs text-mute">{a.seatsLeft} left</span></Link></li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}

function DJView() {
  const apps = useDemo((s) => s.applications);
  const me = DJS[3];
  return (
    <div className="space-y-8">
      <Card className="flex items-center gap-4 p-4">
        <AlienAvatar look={me.look} size={64} ring={me.look.accent} />
        <div className="min-w-0 flex-1"><div className="font-display text-xl">{me.name}</div><div className="text-sm text-mute">Sample DJ profile · rank #{me.rank}</div></div>
        <ButtonLink href={`/djs/${me.id}`} size="sm" variant="ghost">Profile</ButtonLink>
      </Card>
      <div className="grid grid-cols-3 gap-2"><Stat label="Rank" value={`#${me.rank}`} accent="#FFAD5B" /><Stat label="Votes" value={me.votes} accent="#A276E9" /><Stat label="Followers" value={(me.followers / 1000).toFixed(1) + "k"} /></div>
      <section>
        <div className="flex items-center justify-between"><h2 className="text-2xl uppercase">Applications</h2><ButtonLink href="/djs/apply" size="sm"><Plus className="size-4" aria-hidden /> Apply</ButtonLink></div>
        {apps.length ? (
          <ul className="mt-3 space-y-2">{apps.map((a) => <li key={a.id} className="flex min-h-14 items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-4"><span className="min-w-0 truncate font-bold">{getEvent(a.eventId)?.name}</span><Tag color={a.status === "accepted" ? "#B6F05C" : a.status === "declined" ? "#FF625C" : "#2a2a2a"} dark={a.status === "accepted" || a.status === "declined"}>{a.status}</Tag></li>)}</ul>
        ) : <EmptyState className="mt-3" title="No applications yet" body="DJ募集中のイベントに応募しよう。" action={<ButtonLink href="/djs/apply" size="sm">Apply now</ButtonLink>} />}
      </section>
      <section>
        <h2 className="text-2xl uppercase">Auditions</h2>
        <Link href={`/djs/${me.id}/audition`} className="mt-3 flex min-h-16 items-center justify-between rounded-2xl border-2 border-coral bg-coral/10 px-4 font-bold">Your 30-min audition slot · open room (demo) <ArrowRight className="size-4 shrink-0" aria-hidden /></Link>
      </section>
      <section>
        <h2 className="text-2xl uppercase">Upcoming gigs</h2>
        <ul className="mt-3 space-y-2">{EVENTS.filter((e) => e.lineup.includes(me.id)).map((e) => <li key={e.id}><Link href={`/events/${e.id}`} className="flex min-h-14 items-center justify-between rounded-2xl border border-line bg-surface px-4 font-bold">{e.name}<span className="text-xs text-mute">{fmtDate(e.startsAt)}</span></Link></li>)}</ul>
      </section>
    </div>
  );
}

function VenueOwner() {
  const mine = useDemo((s) => s.venues);
  const answered = useDemo((s) => s.inquiriesAnswered);
  const answer = useDemo((s) => s.answerInquiry);
  const listed = [...mine, VENUES[2]];
  const inquiries = [
    { id: "iq1", from: "Ooze Collective", text: "Is Dec 13 free for 400 people?", date: "Nov 8" },
    { id: "iq2", from: "Palm Aliens", text: "Can we bring our own lasers?", date: "Nov 7" },
  ];
  const months = [["Jul", 6200], ["Aug", 8100], ["Sep", 7400], ["Oct", 9900], ["Nov", 11200]] as const;
  const max = Math.max(...months.map((m) => m[1]));
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 gap-2"><Stat label="Listed" value={listed.length} accent="#55BCEB" /><Stat label="Bookings" value={7} accent="#B6F05C" /><Stat label="Revenue (Nov)" value={money(11200)} accent="#FFAD5B" /></div>
      <section>
        <div className="flex items-center justify-between"><h2 className="text-2xl uppercase">My venues</h2><ButtonLink href="/venues/new" size="sm"><Plus className="size-4" aria-hidden /> List</ButtonLink></div>
        <ul className="mt-3 space-y-2">{listed.map((v) => <li key={v.id}><Link href={`/venues/${v.id}`} className="flex min-h-14 items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-4"><span className="truncate font-bold">{v.name}</span>{v.isDemo ? <DemoBadge /> : <Tag color="#B6F05C" dark>Yours</Tag>}</Link></li>)}</ul>
      </section>
      <section>
        <h2 className="text-2xl uppercase">Bookings</h2>
        <ul className="mt-3 space-y-2">{EVENTS.filter((e) => e.venueId === "v-swamp" || e.venueId === "v-glass").map((e) => <li key={e.id} className="flex min-h-14 items-center justify-between rounded-2xl bg-surface px-4 text-sm"><span className="font-bold">{e.name}</span><span className="text-mute">{fmtDate(e.startsAt)}</span></li>)}</ul>
      </section>
      <section>
        <h2 className="text-2xl uppercase">Inquiries</h2>
        <ul className="mt-3 space-y-2">{inquiries.map((q) => (
          <li key={q.id}><Card className="p-4"><div className="flex justify-between text-sm"><span className="font-bold">{q.from}</span><span className="text-mute">{q.date}</span></div><p className="mt-1 text-sm">{q.text}</p>
            {answered.includes(q.id) ? <p className="mt-2 text-sm font-bold text-acid">Replied (demo)</p> : <button type="button" onClick={() => { answer(q.id); toast({ title: "Reply saved (demo)", tone: "success" }); }} className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-cream px-4 text-sm font-extrabold text-ink"><Mail className="size-4" aria-hidden /> Quick reply</button>}
          </Card></li>
        ))}</ul>
      </section>
      <section>
        <h2 className="text-2xl uppercase">Revenue</h2>
        <Card className="mt-3 p-4">
          <div className="flex h-40 items-end gap-3" role="img" aria-label={`Monthly revenue: ${months.map(([m, v]) => `${m} ${money(v)}`).join(", ")}`}>
            {months.map(([m, v]) => (
              <div key={m} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[11px] font-bold text-mute">{(v / 1000).toFixed(1)}k</span>
                <div className="w-full rounded-t-lg bg-blue" style={{ height: `${(v / max) * 100}%` }} />
                <span className="text-xs font-bold">{m}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-mute">Sample figures.</p>
        </Card>
      </section>
    </div>
  );
}

function Fan() {
  const s = useDemo();
  const lv = userLevel(s.profile.xp);
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Stat label="Level" value={`LV.${lv.level}`} accent="#A276E9" /><Stat label="XP" value={s.profile.xp} /><Stat label="Tickets" value={s.orders.length} accent="#B6F05C" /><Stat label="Following" value={s.favorites.length} accent="#FF625C" /></div>
      <Card className="p-4"><div className="mb-1 flex justify-between text-sm font-bold"><span>Game progress</span><span className="text-mute">{lv.intoLevel}/{lv.need} XP</span></div><Progress value={lv.pct} color="#A276E9" label="Level progress" /><Link href="/quests" className="mt-3 inline-flex min-h-11 items-center font-bold text-acid">See quests & badges →</Link></Card>
      <section><h2 className="text-2xl uppercase">Tickets</h2>
        {s.orders.length ? <ul className="mt-3 space-y-2">{s.orders.map((o) => <li key={o.id}><Link href={`/tickets/${o.id}`} className="flex min-h-14 items-center justify-between rounded-2xl border border-line bg-surface px-4 font-bold">{getEvent(o.eventId)?.name}<DemoBadge /></Link></li>)}</ul> : <p className="mt-2 text-sm text-mute">No tickets yet.</p>}
      </section>
      <section><h2 className="text-2xl uppercase">Favorites</h2>
        <ul className="mt-3 flex flex-wrap gap-3">{s.favorites.map((id) => { const d = getDJ(id); return d ? <li key={id}><Link href={`/djs/${id}`} className="flex flex-col items-center gap-1"><AlienAvatar look={d.look} size={56} /><span className="text-xs font-bold">{d.name}</span></Link></li> : null; })}</ul>
      </section>
      <section><h2 className="text-2xl uppercase">History</h2><Link href="/profile" className="mt-2 inline-flex min-h-11 items-center font-bold text-acid">Open profile →</Link></section>
    </div>
  );
}
