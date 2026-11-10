"use client";

import { Tx } from "@/components/i18n/Tx";
import { type Tu } from "@/lib/i18n/tu";
import { useTranslations } from "next-intl";
import { useMyAvatar } from "@/lib/auth/client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DoorOpen, Flame, MapPinCheck, Music2, ShieldCheck, Users, Zap } from "lucide-react";
import { AlienG } from "@/components/art/Alien";
import { AfterPartyCard } from "@/components/cards/Cards";
import { ToggleRow } from "@/components/forms/Fields";
import { Button, Card, DemoBadge, DemoNotice, Progress, Stat, Tag } from "@/components/ui/primitives";
import { DJS, EVENTS, getAfterParty, getDJ } from "@/lib/data";
import { grantXp, toast, useDemo, useHydrated } from "@/lib/store";
import { cn, rng } from "@/lib/utils";
import type { AlienLook } from "@/lib/types";

type Zone = { id: string; name: string; x: number; y: number; w: number; h: number; color: string; round?: boolean };
const ZONES = (tu: Tu): Zone[] => ([
  { id: "main", name: tu("mainStage"), x: 16, y: 16, w: 368, h: 160, color: "#FF625C" },
  { id: "second", name: tu("secondStage"), x: 16, y: 196, w: 170, h: 140, color: "#A276E9" },
  { id: "lounge", name: tu("lounge"), x: 206, y: 196, w: 178, h: 100, color: "#55BCEB" },
  { id: "bar", name: tu("bar"), x: 206, y: 312, w: 178, h: 86, color: "#FFAD5B" },
  { id: "food", name: tu("foodArea"), x: 16, y: 352, w: 170, h: 110, color: "#B6F05C" },
  { id: "portal", name: tu("afterPartyPortal2"), x: 216, y: 414, w: 160, h: 100, color: "#A276E9", round: true },
  { id: "entrance", name: tu("entrance"), x: 96, y: 482, w: 110, h: 62, color: "#F5F2EA" },
]);

export function LiveFestival() {
  const tu = useTranslations("live");
  const ok = useHydrated();
  const event = EVENTS.find((e) => e.status === "live")!;
  const after = event.afterPartyId ? getAfterParty(event.afterPartyId) : undefined;
  const { liveShowAvatar, liveZone, liveCheckedIn, setLive } = useDemo();
  const { look, name: avatarName } = useMyAvatar();
  const hasTicket = useDemo((s) => s.orders.some((o) => o.eventId === event.id));
  const [checkins, setCheckins] = useState(512);
  const [energy, setEnergy] = useState(0.62);
  const [slot, setSlot] = useState(1);

  // Simulated live numbers
  useEffect(() => {
    const t = setInterval(() => {
      setCheckins((c) => Math.min(event.capacity, c + (Math.random() < 0.6 ? 1 : 0)));
      setEnergy((e) => Math.max(0.2, Math.min(1, e + (Math.random() - 0.55) * 0.04)));
    }, 2000);
    return () => clearInterval(t);
  }, [event.capacity]);

  const crowd = useMemo(() => {
    const r = rng("crowd-live");
    const looks: AlienLook[] = DJS.map((d) => ({ ...d.look }));
    return Array.from({ length: 22 }, (_, i) => {
      const z = ZONES(tu)[[0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 0, 1, 3, 0, 2][i]];
      return { id: i, zone: z.id, x: z.x + 18 + r() * (z.w - 50), y: z.y + 36 + r() * (z.h - 62), look: looks[i % looks.length], delay: -r() * 2.4 };
    });
  }, []);

  const now = event.timetable[slot % event.timetable.length];
  const nowDj = getDJ(now.djId)!;
  const zone = ZONES(tu).find((z) => z.id === liveZone) ?? ZONES(tu)[6];
  const publicCount = crowd.length + 140 + (liveShowAvatar ? 1 : 0);

  const move = (id: string) => {
    if (!liveShowAvatar) {
      toast({ title: tu("turnOnShowMyAvatar"), body: tu("yourAvatarOnlyAppearsWith") });
      return;
    }
    setLive({ liveZone: id });
    const z = ZONES(tu).find((x) => x.id === id)!;
    if (id === "portal") toast({ title: tu("afterPartyPortal"), body: tu("opensWhenTheMainEvent"), tone: "level" });
    else toast({ title: tu("movedToName", { name: z.name }) });
  };

  const checkIn = () => {
    setLive({ liveCheckedIn: true });
    setCheckins((c) => c + 1);
    grantXp(80, tu("xpCheckedInAtALive"));
  };

  return (
    <div className="mx-auto max-w-6xl md:px-6">
      <div className="px-4 pb-4 pt-4 md:px-0 md:pt-8">
        <div className="flex flex-wrap items-center gap-2">
          <Tag color="#FF625C" dark>{tu("live")}</Tag>
          <DemoBadge label={tu("demoLiveView")} />
        </div>
        <h1 className="mt-3 text-[40px] uppercase sm:text-6xl">{event.name}</h1>
        <p className="mt-1 text-mute">{tu("cityKaijuBasementLiveFestival", { city: event.city })}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px] [&>*]:min-w-0">
        {/* MAP */}
        <section aria-labelledby="map-h" className="px-4 md:px-0">
          <h2 id="map-h" className="sr-only">{tu("venueMap")}</h2>
          <div className="overflow-hidden rounded-[28px] border-[3px] border-ink bg-[#15131d]">
            <svg viewBox="0 0 400 560" className="block h-auto w-full" role="group" aria-label={tu("illustratedVenueMapWithDemo")}>
              <defs>
                <pattern id="floor" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#15131d" /><circle cx="2" cy="2" r="1.2" fill="#2b2838" /></pattern>
              </defs>
              <rect width="400" height="560" fill="url(#floor)" />
              {/* paths between zones */}
              <path d="M150 512 C150 430 110 400 100 336 M150 512 C200 470 260 430 290 398 M100 196 L100 176 M295 196 L295 176" stroke="#F5F2EA" strokeOpacity="0.18" strokeWidth="10" strokeDasharray="2 14" strokeLinecap="round" fill="none" />
              {ZONES(tu).map((z) => (
                <g key={z.id} onClick={() => move(z.id)} className="cursor-pointer" role="button" tabIndex={0} aria-label={tu("moveMyAvatarToName", { name: z.name })} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); move(z.id); } }}>
                  {z.round ? (
                    <ellipse cx={z.x + z.w / 2} cy={z.y + z.h / 2} rx={z.w / 2} ry={z.h / 2} fill={z.color} fillOpacity="0.22" stroke={z.color} strokeWidth={liveZone === z.id ? 5 : 3} strokeDasharray="10 6">
                      <animateTransform attributeName="transform" type="rotate" from={`0 ${z.x + z.w / 2} ${z.y + z.h / 2}`} to={`360 ${z.x + z.w / 2} ${z.y + z.h / 2}`} dur="18s" repeatCount="indefinite" />
                    </ellipse>
                  ) : (
                    <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="20" fill={z.color} fillOpacity="0.16" stroke={z.color} strokeWidth={liveZone === z.id ? 5 : 3} />
                  )}
                  <text x={z.x + 14} y={z.y + 24} fontFamily="var(--font-display), sans-serif" fontSize="13" fill={z.color}>{z.name.toUpperCase()}</text>
                </g>
              ))}
              {/* main stage art */}
              <g pointerEvents="none">
                <path d="M120 70 L280 70 L292 120 L108 120 Z" fill="#FFAD5B" stroke="#080808" strokeWidth="4" />
                <rect x="150" y="56" width="100" height="16" rx="4" fill="#262626" stroke="#080808" strokeWidth="4" />
                <rect x="40" y="50" width="34" height="56" rx="6" fill="#FF625C" stroke="#080808" strokeWidth="4" />
                <rect x="326" y="50" width="34" height="56" rx="6" fill="#FF625C" stroke="#080808" strokeWidth="4" />
                <circle cx="57" cy="70" r="9" fill="#080808" /><circle cx="343" cy="70" r="9" fill="#080808" />
                <line x1="200" y1="20" x2="90" y2="170" stroke="#B6F05C" strokeWidth="2" opacity="0.6" />
                <line x1="200" y1="20" x2="310" y2="170" stroke="#55BCEB" strokeWidth="2" opacity="0.6" />
                <rect x="232" y="336" width="130" height="20" rx="6" fill="#FFAD5B" stroke="#080808" strokeWidth="3" />
                <circle cx="60" cy="410" r="14" fill="#B6F05C" stroke="#080808" strokeWidth="3" /><circle cx="120" cy="420" r="12" fill="#FF625C" stroke="#080808" strokeWidth="3" />
                <circle cx="296" cy="464" r="18" fill="#080808" stroke="#A276E9" strokeWidth="4" />
              </g>
              {/* demo crowd */}
              <g pointerEvents="none">
                {crowd.map((c) => (
                  <g key={c.id} transform={`translate(${c.x} ${c.y}) scale(0.15)`}>
                    <g className={c.id % 3 === 0 ? "animate-bob" : undefined} style={{ animationDelay: `${c.delay}s` }}><AlienG look={c.look} /></g>
                  </g>
                ))}
              </g>
              {/* you */}
              {ok && liveShowAvatar && (
                <g transform={`translate(${zone.x + zone.w / 2 - 22} ${zone.y + zone.h / 2 - 22})`} pointerEvents="none" style={{ transition: "transform 600ms ease" }}>
                  <circle cx="22" cy="26" r="28" fill="#B6F05C" fillOpacity="0.25" stroke="#B6F05C" strokeWidth="3" />
                  <g transform="scale(0.22)"><AlienG look={look} /></g>
                  <rect x="-6" y="-16" width="56" height="16" rx="8" fill="#B6F05C" stroke="#080808" strokeWidth="2" />
                  <text x="22" y="-4.5" textAnchor="middle" fontSize="10" fontWeight="900" fill="#080808">{tu("you")}</text>
                </g>
              )}
            </svg>
          </div>
          <div className="rail mt-3 !gap-2 !px-0" role="group" aria-label={tu("moveMyAvatar")}>
            {ZONES(tu).map((z) => (
              <button key={z.id} type="button" onClick={() => move(z.id)} aria-pressed={liveZone === z.id && liveShowAvatar} className={cn("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border-2 px-4 text-sm font-bold", liveZone === z.id && liveShowAvatar ? "border-acid bg-acid text-ink" : "border-line bg-surface")}>
                <span className="size-2.5 rounded-full" style={{ background: z.color }} aria-hidden /><Tx>{z.name}</Tx>
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            <ToggleRow checked={ok && liveShowAvatar} onChange={(v) => { setLive({ liveShowAvatar: v }); toast({ title: v ? tu("avatarnameJoinedTheMap", { avatarName }) : tu("avatarHidden"), body: v ? tu("onlyYourAvatarAndChosen") : undefined }); }} label={tu("showMyAvatarOnThe")} sub={tu("text")} />
            <div className="flex gap-2 rounded-2xl bg-surface p-3 text-xs text-mute"><ShieldCheck className="size-4 shrink-0 text-acid" aria-hidden /> {tu("zonesAreChosenByYou")}</div>
          </div>
        </section>

        {/* INFO */}
        <aside className="space-y-4 px-4 md:px-0" aria-label={tu("liveInformation")}>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-coral"><Music2 className="size-4" aria-hidden /> {tu("nowPlayingStage", { stage: now.stage })}</div>
            <div className="mt-1 font-display text-2xl uppercase">{nowDj.name}</div>
            <div className="text-sm text-mute">{tu("timeEndUtcJoin", { time: now.time, end: now.end, join: nowDj.genres.join(" / ") })}</div>
            <Button size="sm" variant="ghost" className="mt-3" onClick={() => setSlot((s) => s + 1)}>{tu("skipToNextSetDemo")}</Button>
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <Stat label={tu("checkedIn")} value={checkins.toLocaleString("en-US")} accent="#B6F05C" />
            <Stat label={tu("avatars")} value={publicCount} accent="#A276E9" />
          </div>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold"><Flame className="size-5 text-orange" aria-hidden /> {tu("liveEnergy")}</div>
              <span className="font-display">{Math.round(energy * 100)}%</span>
            </div>
            <Progress value={energy} color="#FFAD5B" className="mt-2" label={tu("liveEnergy")} />
            <Button className="mt-3 w-full" variant="coral" onClick={() => setEnergy((e) => Math.min(1, e + 0.06))}><Zap className="size-4" aria-hidden /> {tu("sendHype")}</Button>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-1.5 font-bold"><MapPinCheck className="size-5 text-acid" aria-hidden /> {tu("checkIn")}</div>
            {ok && liveCheckedIn ? (
              <p className="mt-1 text-sm text-acid">{tu("youreCheckedInDemo80")}</p>
            ) : (
              <>
                <p className="mt-1 text-sm text-mute">{hasTicket ? tu("yourDemoTicketIsReady") : tu("noDemoTicketYetYou")}</p>
                <Button className="mt-3 w-full" onClick={checkIn}><DoorOpen className="size-4" aria-hidden /> {tu("checkInDemo")}</Button>
              </>
            )}
          </Card>
          <div>
            <h2 className="text-2xl uppercase">{tu("timetable")}</h2>
            <ol className="mt-2 overflow-hidden rounded-3xl border border-line">
              {event.timetable.map((s, i) => {
                const d = getDJ(s.djId)!;
                const on = i === slot % event.timetable.length;
                return (
                  <li key={s.djId} className={cn("flex items-center gap-3 border-b border-line p-3 last:border-0", on ? "bg-coral/15" : "bg-surface")}>
                    <span className="w-[104px] shrink-0 whitespace-nowrap font-display text-sm">{s.time}–{s.end}</span>
                    <span className="min-w-0 flex-1 truncate font-bold">{d.name}</span>
                    {on && <Tag color="#FF625C" dark>{tu("now")}</Tag>}
                  </li>
                );
              })}
            </ol>
          </div>
          {after && (
            <div>
              <h2 className="text-2xl uppercase">{tu("afterParty")}</h2>
              <AfterPartyCard party={after} className="mt-2" />
            </div>
          )}
          <Link href={`/events/${event.id}`} className="inline-flex min-h-11 items-center font-bold text-acid">{tu("eventDetails")}</Link>
          <DemoNotice><Users className="mr-1 inline size-4" aria-hidden />{tu("countsEnergyAndAvatarsAre")}</DemoNotice>
        </aside>
      </div>
    </div>
  );
}
