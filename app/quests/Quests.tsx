"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Award, Building, Check, Crown, Flame, Heart, Lock, MapPinned, Mic2, Ticket, Trophy, Sparkles } from "lucide-react";
import { DJS, EVENTS } from "@/lib/data";
import { userLevel, levelFor } from "@/lib/levels";
import { toast, useDemo, useHydrated } from "@/lib/store";
import { AlienAvatar } from "@/components/cards/Cards";
import { Button, Card, DemoBadge, PageTitle, Progress } from "@/components/ui/primitives";
import { Input } from "@/components/forms/Fields";
import { LoadingSkeleton } from "@/components/ui/States";
import { cn, compact } from "@/lib/utils";

export function Quests() {
  const ok = useHydrated();
  if (!ok) return <LoadingSkeleton variant="page" />;
  return <Inner />;
}

function Inner() {
  const tu = useTranslations("quests");
  const s = useDemo();
  const lv = userLevel(s.profile.xp);
  const supported = Object.keys(s.support).length;
  const quests = [
    { id: "q1", icon: Heart, title: tu("support3Events"), cur: supported, goal: 3, href: "/events", xp: 100 },
    { id: "q2", icon: Ticket, title: tu("getATicket"), cur: s.orders.length, goal: 1, href: `/events/${EVENTS[0].id}/tickets`, xp: 60 },
    { id: "q3", icon: Sparkles, title: tu("createYourAlien"), cur: s.profile.avatarSaved ? 1 : 0, goal: 1, href: "/avatar", xp: 50 },
    { id: "q4", icon: Mic2, title: tu("follow3Djs"), cur: s.favorites.length, goal: 3, href: "/djs", xp: 30 },
    { id: "q5", icon: MapPinned, title: tu("checkInLive"), cur: s.liveCheckedIn ? 1 : 0, goal: 1, href: "/live", xp: 80 },
    { id: "q6", icon: Flame, title: tu("voteInAnAudition"), cur: Object.keys(s.votes).length, goal: 1, href: `/djs/${DJS[2].id}/audition`, xp: 20 },
  ];
  const badges = [
    { id: "b1", name: tu("firstSupporter"), got: supported > 0, color: "#B6F05C" },
    { id: "b2", name: tu("ticketHolder"), got: s.orders.length > 0, color: "#FFAD5B" },
    { id: "b3", name: tu("alienBorn"), got: s.profile.avatarSaved, color: "#A276E9" },
    { id: "b4", name: tu("eventCreator"), got: s.createdEvents.length > 0, color: "#55BCEB" },
    { id: "b5", name: tu("venueLandlord"), got: s.venues.length > 0, color: "#FF625C" },
    { id: "b6", name: tu("nightOwl"), got: s.afterParties.length > 0, color: "#A276E9" },
    { id: "b7", name: tu("crateDigger"), got: s.favorites.length >= 3, color: "#FFAD5B" },
    { id: "b8", name: tu("lv5Legend"), got: lv.level >= 5, color: "#B6F05C" },
  ];
  const cities = Object.values(
    EVENTS.reduce<Record<string, { city: string; supporters: number; events: number; top: number }>>((acc, e) => {
      const sup = e.supporters + (s.support[e.id]?.supporters ?? 0);
      const r = e.raised + (s.support[e.id]?.raised ?? 0);
      const c = (acc[e.city] ??= { city: e.city, supporters: 0, events: 0, top: 1 });
      c.supporters += sup;
      c.events += 1;
      c.top = Math.max(c.top, levelFor(sup, r));
      return acc;
    }, {}),
  ).sort((a, b) => b.supporters - a.supporters).slice(0, 8);

  return (
    <div className="mx-auto max-w-5xl md:px-6">
      <PageTitle kicker={tu("game")} title={tu("questsRankings")} sub={tu("xp")} />

      <section aria-labelledby="fq" className="px-4 md:px-0">
        <div className="flex items-center justify-between gap-2"><h2 id="fq" className="text-3xl uppercase">{tu("festivalQuest")}</h2><span className="font-display text-purple">LV.{lv.level}</span></div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {quests.map((q) => {
            const done = q.cur >= q.goal;
            return (
              <li key={q.id}>
                <Link href={q.href} className={cn("flex items-center gap-3 rounded-2xl border-2 bg-surface p-3", done ? "border-acid" : "border-line hover:border-cream/30")}>
                  <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl border-2 border-ink", done ? "bg-acid text-ink" : "bg-surface-2")}>{done ? <Check className="size-5" aria-hidden /> : <q.icon className="size-5" aria-hidden />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{q.title}</span>
                    <Progress value={Math.min(1, q.cur / q.goal)} className="mt-1.5 !h-2" label={tu("progressOf", { name: q.title })} />
                  </span>
                  <span className="shrink-0 text-xs font-extrabold text-acid">+{q.xp} XP</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="bd" className="mt-10 px-4 md:px-0">
        <h2 id="bd" className="text-3xl uppercase">{tu("achievementBadges")}</h2>
        <ul className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-8">
          {badges.map((b) => (
            <li key={b.id} className="flex flex-col items-center text-center">
              <span className={cn("flex size-16 items-center justify-center rounded-full border-[3px]", b.got ? "border-ink text-ink" : "border-line text-mute")} style={b.got ? { background: b.color } : undefined} aria-label={b.got ? tu("badgeUnlocked", { name: b.name }) : tu("badgeLocked", { name: b.name })}>
                {b.got ? <Award className="size-7" aria-hidden /> : <Lock className="size-6" aria-hidden />}
              </span>
              <span className={cn("mt-1.5 text-[11px] font-bold leading-tight", !b.got && "text-mute")}>{b.name}</span>
            </li>
          ))}
        </ul>
      </section>

      <div id="rankings" className="mt-10 grid gap-8 px-4 md:grid-cols-2 md:px-0">
        <section aria-labelledby="cr">
          <h2 id="cr" className="text-3xl uppercase">{tu("cityRanking")}</h2>
          <ol className="mt-3 overflow-hidden rounded-3xl border border-line">
            {cities.map((c, i) => (
              <li key={c.city} className="flex items-center gap-3 border-b border-line bg-surface p-3 last:border-0">
                <span className="w-7 text-center font-display text-xl" style={{ color: ["#FFAD5B", "#F5F2EA", "#FF625C"][i] ?? "#b9b5ab" }}>{i + 1}</span>
                <span className="min-w-0 flex-1"><span className="block font-bold">{c.city}</span><span className="text-xs text-mute">{tu("eventsEventValueTopLv", { events: c.events, top: c.top })}</span></span>
                <span className="text-sm font-bold">{compact(c.supporters)}</span>
              </li>
            ))}
          </ol>
        </section>
        <section aria-labelledby="dr">
          <h2 id="dr" className="text-3xl uppercase">{tu("djRanking")}</h2>
          <ol className="mt-3 overflow-hidden rounded-3xl border border-line">
            {[...DJS].sort((a, b) => a.rank - b.rank).slice(0, 8).map((d) => (
              <li key={d.id} className="border-b border-line bg-surface last:border-0">
                <Link href={`/djs/${d.id}`} className="flex items-center gap-3 p-3">
                  <span className="w-7 text-center font-display text-xl">{d.rank}</span>
                  <AlienAvatar look={d.look} size={40} />
                  <span className="min-w-0 flex-1 truncate font-bold">{d.name}</span>
                  <span className="inline-flex items-center gap-1 text-sm font-bold"><Trophy className="size-4 text-orange" aria-hidden />{compact(d.votes)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section aria-labelledby="club" className="mt-10 px-4 md:px-0">
        <div className="flex items-center gap-2"><h2 id="club" className="text-3xl uppercase">{tu("myClub")}</h2><DemoBadge label={tu("preview")} /></div>
        <Card className="mt-3 overflow-hidden">
          <div className="flex items-center gap-4 bg-orange p-4 text-ink">
            <Building className="size-10 shrink-0" aria-hidden />
            <div className="min-w-0"><div className="truncate font-display text-2xl">{s.club.name}</div><div className="text-sm font-bold">{tu("tierTierInGameClub", { tier: s.club.tier })}</div></div>
          </div>
          <div className="space-y-3 p-4">
            <label htmlFor="club-name" className="text-sm font-bold">{tu("clubName")}</label>
            <div className="flex gap-2">
              <Input id="club-name" maxLength={24} defaultValue={s.club.name} onBlur={(e) => s.setClub({ name: e.target.value.toUpperCase() || tu("myFirstClub") })} />
            </div>
            <Button variant="ghost" disabled={s.club.tier >= Math.min(5, lv.level)} onClick={() => { s.setClub({ tier: s.club.tier + 1 }); toast({ title: tu("clubUpgraded"), body: tu("cosmeticDemoOnly"), tone: "level" }); }}>
              <Crown className="size-4" aria-hidden /> {tu("upgradeNeedsLvValue", { value: s.club.tier + 1 })}
            </Button>
            <p className="text-xs text-mute">{tu("text")}</p>
          </div>
        </Card>
      </section>
    </div>
  );
}
