"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarClock, LayoutGrid, Map as MapIcon, MessageCircle, MoreHorizontal, Pencil, Radio, Tv, Wifi, WifiOff } from "lucide-react";
import { Alien } from "@/components/art/Alien";
import { ToggleRow } from "@/components/forms/Fields";
import { AvatarSheet, VisibilityPicker } from "@/components/live/AvatarSheet";
import { Chat } from "@/components/live/Chat";
import { EnergyMeter, ReactionBar } from "@/components/live/Energy";
import { FestivalMap, type MapFloat, type MeOnMap } from "@/components/live/FestivalMap";
import { AfterPartyPortal, AttendancePanel, CheckinPanel, DaoPanel, QuestsPanel, RankingsPanel } from "@/components/live/Panels";
import { MiniPlayer, Player, type Quality } from "@/components/live/Player";
import { Schedule } from "@/components/live/Schedule";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { DemoBadge, DemoNotice, Tag } from "@/components/ui/primitives";
import { ErrorState, LoadingSkeleton } from "@/components/ui/States";
import { STATUS_LABEL } from "@/app/live/LiveDiscovery";
import { fmtCount, liveApi, useLiveQuery, useLiveRoom, type LiveDetail, type RoomView } from "@/lib/live/client";
import { REACTION_META, levelFor } from "@/lib/live/energy";
import { applySignal, emptyProgress, type QuestSignal } from "@/lib/live/quests";
import { currentAndNext, fmtInTz } from "@/lib/live/time";
import type { ReactionKind, ZoneId } from "@/lib/live/types";
import { ZONES, zoneById } from "@/lib/live/zones";
import { grantXp, toast, useDemo, useHydrated } from "@/lib/store";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "watch", label: "Watch", icon: Tv },
  { id: "map", label: "Map", icon: MapIcon },
  { id: "schedule", label: "Schedule", icon: CalendarClock },
  { id: "community", label: "Community", icon: MessageCircle },
  { id: "more", label: "More", icon: MoreHorizontal },
] as const;
type TabId = (typeof TABS)[number]["id"];

const MAX_FLOATS = 12;
const isZone = (z: string): z is ZoneId => ZONES.some((x) => x.id === z);

export function LiveEvent({ eventId }: { eventId: string }) {
  const q = useLiveQuery<LiveDetail>(eventId);
  if (q.state.status === "loading") return <div className="mx-auto max-w-6xl p-4"><LoadingSkeleton variant="page" /></div>;
  if (q.state.status === "error") return <ErrorState title={q.state.httpStatus === 404 ? "Festival not found" : "Live data unavailable"} body={q.state.error.message} retry={<button type="button" onClick={() => q.reload()} className="min-h-11 rounded-full bg-acid px-5 font-bold text-ink">Retry</button>} />;
  return <Festival detail={q.state.data} />;
}

function Festival({ detail }: { detail: LiveDetail }) {
  const hydrated = useHydrated();
  const eventId = detail.event.id;
  const running = detail.status === "demo_live" || detail.status === "live";
  const tzVenue = detail.tz;
  const [userTz, setUserTz] = useState("UTC");
  useEffect(() => setUserTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"), []);

  /* ---------- tabs (deep-linkable via #tab) ---------- */
  const [tab, setTabState] = useState<TabId>("watch");
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1);
      if (TABS.some((t) => t.id === h)) setTabState(h as TabId);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const setTab = (t: TabId) => {
    setTabState(t);
    history.replaceState(null, "", `#${t}`);
  };

  /* ---------- demo clock ---------- */
  const fetchedAt = useRef(Date.now());
  const [offset, setOffset] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const clockNow = useMemo(() => detail.clock.now + (Date.now() - fetchedAt.current) + offset, [detail.clock.now, offset, tick]);
  const [stageId, setStageId] = useState(detail.stages[0]?.id ?? "main");
  const { current, next } = useMemo(() => (running ? currentAndNext(detail.sets, stageId, clockNow) : { current: null, next: detail.sets.find((s) => s.stageId === stageId) ?? null }), [detail.sets, stageId, clockNow, running]);
  const lastSet = useRef<string | null>(null);
  useEffect(() => {
    if (!running || !current) return;
    if (lastSet.current && lastSet.current !== current.id) toast({ title: `Now playing: ${current.dj.name}`, body: `${detail.stages.find((s) => s.id === stageId)?.name} · demo clock`, tone: "level" });
    lastSet.current = current.id;
  }, [current, running, stageId, detail.stages]);
  const skip = () => {
    const n = currentAndNext(detail.sets, stageId, clockNow).next ?? detail.sets.filter((s) => s.stageId === stageId).sort((a, b) => a.startAt - b.startAt)[0];
    if (!n) return;
    setOffset((o) => o + (n.startAt - clockNow) + 60_000);
  };

  /* ---------- player ---------- */
  const [playing, setPlaying] = useState(true);
  const [quality, setQuality] = useState<Quality>("auto");
  const [saveData, setSaveData] = useState(false);
  useEffect(() => {
    const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (c?.saveData || c?.effectiveType === "2g" || c?.effectiveType === "slow-2g") {
      setSaveData(true);
      setQuality("audio");
    }
  }, []);

  /* ---------- avatar & zone ---------- */
  const showAvatar = useDemo((s) => s.liveShowAvatar);
  const storedZone = useDemo((s) => s.liveZone);
  const zone: ZoneId = isZone(storedZone) ? storedZone : "entrance";
  const visibility = useDemo((s) => s.liveVisibility);
  const dance = useDemo((s) => s.liveDance);
  const emote = useDemo((s) => s.liveEmote);
  const look = useDemo((s) => s.profile.look);
  const avatarName = useDemo((s) => s.profile.avatarName);
  const setLive = useDemo((s) => s.setLive);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [sheetZone, setSheetZone] = useState<ZoneId | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  /* ---------- quests ---------- */
  const progress = useDemo((s) => s.liveQuests[eventId]) ?? emptyProgress();
  const setLiveQuests = useDemo((s) => s.setLiveQuests);
  const signal = useCallback(
    (s: QuestSignal) => {
      if (!running) return;
      const cur = useDemo.getState().liveQuests[eventId] ?? emptyProgress();
      const r = applySignal(cur, s);
      setLiveQuests(eventId, r.next, r.completed.map((q) => q.badge).filter((b): b is string => !!b));
      for (const qd of r.completed) {
        grantXp(qd.xp, `Quest complete: ${qd.title}`);
        void liveApi(`${eventId}/quests`, { method: "POST", json: { questId: qd.id } });
      }
    },
    [eventId, running, setLiveQuests],
  );

  /* ---------- room sync ---------- */
  const [floats, setFloats] = useState<MapFloat[]>([]);
  const mine = useRef<Partial<Record<ReactionKind, number>>>({});
  const addFloat = useCallback((kind: ReactionKind, z: ZoneId) => {
    const id = `${kind}-${Math.random().toString(36).slice(2, 7)}`;
    setFloats((f) => [...f, { id, kind, zone: z }].slice(-MAX_FLOATS));
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 2000);
  }, []);
  const onEvents = useCallback(
    (evs: RoomView["events"]) => {
      let shown = 0;
      for (const ev of evs) {
        if (ev.type !== "reaction_added") continue;
        if ((mine.current[ev.kind] ?? 0) > 0) {
          mine.current[ev.kind]! -= 1;
          continue;
        }
        if (shown++ < 6) addFloat(ev.kind, ev.zone);
      }
    },
    [addFloat],
  );
  const { room, conn, refresh } = useLiveRoom(running ? eventId : null, zone, onEvents);

  // Presence: only with consent. Heartbeat every 45s; leave when the toggle is turned off.
  useEffect(() => {
    if (!hydrated || !running) return;
    if (!showAvatar) {
      void liveApi(`${eventId}/leave`, { method: "POST" });
      return;
    }
    const send = () => liveApi(`${eventId}/presence`, { method: "POST", json: { name: avatarName.slice(0, 24).padEnd(2, "_"), look: { ...look, accessory: look.accessory }, zone, visibility, dance, emote, friends: [] } });
    void send().then(() => refresh());
    const t = setInterval(send, 45_000);
    return () => clearInterval(t);
  }, [hydrated, running, showAvatar, eventId, zone, visibility, dance, emote, look, avatarName, refresh]);

  // Watch time quest: counts while the Watch tab is open, the player is playing and the page is visible.
  useEffect(() => {
    if (!running || tab !== "watch" || !playing) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") signal({ kind: "watch_seconds", seconds: 10 });
    }, 10_000);
    return () => clearInterval(t);
  }, [running, tab, playing, signal]);

  /* ---------- actions ---------- */
  const [reactNote, setReactNote] = useState<string | null>(null);
  const react = async (kind: ReactionKind) => {
    if (!running) return toast({ title: "Reactions open when the festival is live" });
    const z = showAvatar ? zone : "dancefloor";
    addFloat(kind, z);
    mine.current[kind] = (mine.current[kind] ?? 0) + 1;
    signal({ kind: "reaction" });
    const r = await liveApi<{ counted: boolean; energy: number }>(`${eventId}/reactions`, { method: "POST", json: { kind, zone: z } });
    if (!r.ok) setReactNote(r.error.code === "RATE_LIMITED" ? "Slow down a little: reactions are rate limited." : r.error.message);
    else setReactNote(r.data.counted ? `${REACTION_META[kind].emoji} counted toward energy` : "Shown to the crowd, but only 6 reactions a minute count toward energy.");
  };

  const move = (to: ZoneId) => {
    if (!showAvatar) {
      toast({ title: "Turn on ‘Show my avatar’ first", body: "Your avatar only appears with your consent." });
      return false;
    }
    if (to === "vip") {
      toast({ title: "VIP balcony is for VIP ticket holders", body: "VIP is verified at the door. You can still look at the zone info." });
      return false;
    }
    if (to === zone) return true;
    setLive({ liveZone: to });
    toast({ title: `Moved to ${zoneById(to).name}` });
    signal({ kind: "zone", zone: to });
    if (to === "portal") signal({ kind: "portal_opened" });
    return true;
  };

  const energy = room?.energy ?? 0;
  const lv = levelFor(energy);
  const me: MeOnMap | null = hydrated && showAvatar ? { look, name: avatarName, zone, visibility, dance, emote } : null;
  const viewers = room?.onlineViewers ?? (running ? detail.attendance.onlineViewers : null);
  const st = STATUS_LABEL[detail.status];

  return (
    <div className="mx-auto max-w-6xl pb-6 md:px-6">
      {/* HEADER */}
      <header className="px-4 pb-3 pt-3 md:px-0 md:pt-6">
        <Link href="/live" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-mute hover:text-cream"><ArrowLeft className="size-4" aria-hidden />All live festivals</Link>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Tag color={st.color} dark={st.dark}>{st.label}</Tag>
          {detail.event.isDemo && <DemoBadge label="Demo event" />}
          {running && (
            <span className={cn("inline-flex items-center gap-1 text-[11px] font-bold", conn === "live" ? "text-acid" : "text-orange")} role="status" data-testid="conn">
              {conn === "offline" ? <WifiOff className="size-3.5" aria-hidden /> : <Wifi className="size-3.5" aria-hidden />}
              {conn === "live" ? "Room synced" : conn === "connecting" ? "Connecting…" : conn === "offline" ? "Offline, will reconnect" : "Reconnecting…"}
            </span>
          )}
        </div>
        <h1 className="mt-2 text-[36px] uppercase leading-none sm:text-6xl">{detail.event.name}</h1>
        <p className="mt-1 text-[13px] text-mute">
          {detail.event.city} · {detail.event.venue ?? "Venue TBA"} · venue time {fmtInTz(clockNow, tzVenue)} {detail.clock.demo && <span className="text-orange">(demo clock)</span>}
        </p>
      </header>

      {/* STICKY: mini player + in-event tabs */}
      <div className="sticky top-[calc(64px+env(safe-area-inset-top))] z-30 -mx-0 bg-ink/95 backdrop-blur md:mx-0">
        {running && tab !== "watch" && <MiniPlayer dj={current?.dj.name ?? null} playing={playing} setPlaying={setPlaying} onOpen={() => setTab("watch")} demo={detail.status === "demo_live"} />}
        <nav aria-label="Festival sections">
          <div role="tablist" className="grid grid-cols-5 border-b border-line">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} onClick={() => setTab(t.id)} className={cn("flex min-h-[52px] flex-col items-center justify-center gap-0.5 border-b-[3px] text-[11px] font-bold sm:flex-row sm:gap-1.5 sm:text-sm", tab === t.id ? "border-acid text-acid" : "border-transparent text-mute hover:text-cream")}>
                <t.icon className="size-5" aria-hidden />
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-4">
        {/* WATCH */}
        {tab === "watch" && (
          <div className="grid gap-4 lg:grid-cols-[1fr_380px] [&>*]:min-w-0">
            <div className="space-y-4">
              <Player detail={detail} stageId={stageId} setStageId={setStageId} current={current} next={next} viewers={viewers} playing={playing} setPlaying={setPlaying} quality={quality} setQuality={setQuality} tz={tzVenue} onSkip={detail.clock.demo ? skip : null} energyColor={lv.color} saveData={saveData} />
              {running && (
                <div className="space-y-3 px-4 md:px-0">
                  <EnergyMeter energy={energy} />
                  <ReactionBar onReact={react} counts={room?.reactions} note={reactNote} />
                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <div className="rounded-2xl bg-surface-2 p-3"><div className="font-bold uppercase text-mute">Online viewers</div><div className="font-display text-lg">{fmtCount(viewers ?? 0)}</div></div>
                    <div className="rounded-2xl bg-surface-2 p-3"><div className="font-bold uppercase text-mute">Checked in at venue</div><div className="font-display text-lg">{fmtCount(detail.attendance.checkedIn)}</div></div>
                  </div>
                  <p className="text-[11px] text-mute">Viewers and on-site guests are separate counts. Watching never counts as attending.</p>
                </div>
              )}
              {/* mobile chat entry */}
              {running && (
                <div className="px-4 lg:hidden">
                  <button type="button" onClick={() => setChatOpen(true)} className="flex min-h-14 w-full items-center gap-3 rounded-3xl border border-line bg-surface px-4 py-2 text-left" data-testid="open-chat">
                    <MessageCircle className="size-5 shrink-0 text-acid" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <b className="block text-sm">Live chat</b>
                      <span className="block truncate text-[12px] text-mute">{room?.chat.at(-1) ? `${room.chat.at(-1)!.name}: ${room.chat.at(-1)!.body}` : "Say hi to the crowd"}</span>
                    </span>
                  </button>
                </div>
              )}
            </div>
            {running && (
              <aside className="hidden h-[640px] flex-col rounded-[26px] border border-line bg-surface p-3 lg:flex" aria-label="Live chat">
                <h2 className="px-1 text-lg uppercase">Live chat</h2>
                <Chat eventId={eventId} messages={room?.chat ?? []} onSent={refresh} className="flex-1" />
              </aside>
            )}
          </div>
        )}

        {/* MAP */}
        {tab === "map" && (
          <div className="space-y-4">
            <div className="relative h-[min(62vh,560px)] min-h-[340px] overflow-hidden border-y-2 border-line md:rounded-[28px] md:border-2 lg:h-[620px]">
              <FestivalMap me={me} avatars={running ? room?.avatars ?? [] : []} zoneCounts={room?.zoneCounts ?? {}} floats={floats} selectedZone={sheetZone} onZoneTap={setSheetZone} beam={lv.color} invasion={lv.key === "ALIEN_INVASION"} paused={!playing} />
              {running && (
                <div className="pointer-events-none absolute left-2 top-2 flex flex-col gap-1">
                  <span className="pointer-events-auto rounded-full bg-ink/85 px-2.5 py-1 text-[11px] font-bold" style={{ color: lv.color }} data-testid="map-energy">⚡ {lv.label} · {energy}</span>
                  <span className="rounded-full bg-ink/85 px-2.5 py-1 text-[11px] font-bold text-cream">{fmtCount(room?.publicAvatars ?? 0)} public avatars</span>
                </div>
              )}
              {!running && <p className="absolute inset-x-2 bottom-2 rounded-2xl bg-ink/90 p-2 text-center text-[12px] text-mute">Preview map. Other avatars appear when the festival room opens.</p>}
            </div>
            <div className="space-y-3 px-4 md:px-0">
              {running && <ReactionBar onReact={react} counts={room?.reactions} note={reactNote} />}
              <div className="rail !gap-2 !px-0" role="group" aria-label="Move my avatar">
                {ZONES.map((z) => (
                  <button key={z.id} type="button" onClick={() => move(z.id)} aria-pressed={zone === z.id && showAvatar} className={cn("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border-2 px-4 text-sm font-bold", zone === z.id && showAvatar ? "border-acid bg-acid text-ink" : "border-line bg-surface")}>
                    <span className="size-2.5 rounded-full" style={{ background: z.color }} aria-hidden />
                    {z.name}
                    {(room?.zoneCounts?.[z.id] ?? 0) > 0 && <span className="text-[11px] opacity-70">{room!.zoneCounts[z.id]}</span>}
                  </button>
                ))}
              </div>
              <ToggleRow
                checked={hydrated && showAvatar}
                onChange={(v) => {
                  setLive({ liveShowAvatar: v });
                  toast({ title: v ? `${avatarName} joined the map` : "Avatar removed from the map", body: v ? "Only your avatar and chosen zone are shared. Never your real location." : undefined });
                  if (v) signal({ kind: "zone", zone });
                }}
                label="Show my avatar on the map"
                sub="本人の同意がある場合のみ表示。実際の位置情報（GPS）は使用しません。"
              />
              <div className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-3">
                <Alien look={look} className="size-16 shrink-0" />
                <div className="min-w-0 flex-1">
                  <b className="block truncate">{avatarName}</b>
                  <span className="text-[12px] text-mute">{visibility === "public" ? "Public" : visibility === "friends" ? "Friends only" : "Hidden"} · {dance} · {zoneById(zone).name}</span>
                </div>
                <button type="button" onClick={() => setAvatarOpen(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-line px-3 text-sm font-bold"><Pencil className="size-4" aria-hidden />Customize</button>
              </div>
              <VisibilityPicker value={visibility} onChange={(v) => { setLive({ liveVisibility: v }); toast({ title: `Avatar visibility: ${v}` }); }} />
            </div>
          </div>
        )}

        {/* SCHEDULE */}
        {tab === "schedule" && (
          <div className="px-4 md:px-0">
            <Schedule detail={detail} clockNow={clockNow} tz={tzVenue} userTz={userTz} />
          </div>
        )}

        {/* COMMUNITY */}
        {tab === "community" && (
          <div className="grid gap-6 px-4 md:px-0 lg:grid-cols-[1fr_380px]">
            <section aria-label="Live chat" className="flex h-[min(70vh,640px)] flex-col rounded-[26px] border border-line bg-surface p-3">
              <h2 className="px-1 text-lg uppercase">Live chat</h2>
              {running ? <Chat eventId={eventId} messages={room?.chat ?? []} onSent={refresh} className="flex-1" /> : <p className="p-2 text-sm text-mute">Chat opens when the festival starts.</p>}
            </section>
            <div className="space-y-4">
              {running && <EnergyMeter energy={energy} compact />}
              <QuestsPanel progress={progress} />
            </div>
          </div>
        )}

        {/* MORE */}
        {tab === "more" && (
          <div className="grid gap-6 px-4 md:px-0 lg:grid-cols-2 [&>*]:min-w-0">
            <div className="space-y-6">
              <CheckinPanel eventId={eventId} isDemoLive={detail.status === "demo_live"} onVerified={() => signal({ kind: "checkin_verified", demo: true })} />
              <AfterPartyPortal detail={detail} tz={tzVenue} onOpenPortal={running ? () => { setTab("map"); if (move("portal")) setSheetZone("portal"); } : undefined} />
              <AttendancePanel detail={detail} onlineViewers={viewers ?? 0} publicAvatars={room?.publicAvatars ?? detail.attendance.publicAvatars} />
            </div>
            <div className="space-y-6">
              <DaoPanel eventId={eventId} />
              <RankingsPanel eventId={eventId} />
              <Link href={`/events/${eventId}`} className="flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-line font-extrabold uppercase"><LayoutGrid className="size-4" aria-hidden />Event page & tickets</Link>
            </div>
          </div>
        )}
      </div>

      <DemoNotice className="mx-4 mt-8 md:mx-0">
        <Radio className="mr-1 inline size-4" aria-hidden />
        {detail.status === "demo_live" ? "DEMO LIVE: a simulation. No real stream, payment or door system is connected. Demo viewers, avatars, chat bots and energy are labelled as demo and never count as real attendance." : "Demo festival data. Live features open when a real, licensed stream is connected for this event."}
      </DemoNotice>

      {/* SHEETS */}
      <AvatarSheet open={avatarOpen} onClose={() => setAvatarOpen(false)} onSaved={() => toast({ title: "Avatar saved", tone: "success" })} />
      {sheetZone && (
        <ZoneSheet
          zoneId={sheetZone}
          onClose={() => setSheetZone(null)}
          here={zone === sheetZone && showAvatar}
          count={room?.zoneCounts?.[sheetZone] ?? 0}
          detail={detail}
          clockNow={clockNow}
          running={running}
          onMove={() => move(sheetZone)}
          onWatch={(sid) => { setStageId(sid); setTab("watch"); setSheetZone(null); }}
          onTab={(t) => { setTab(t); setSheetZone(null); }}
          onDance={(d) => setLive({ liveDance: d })}
          dance={dance}
          onReact={react}
          energy={energy}
          onPortal={() => signal({ kind: "portal_opened" })}
        />
      )}
      <BottomSheet open={chatOpen} onClose={() => setChatOpen(false)} title="Live chat">
        <div className="flex h-[60vh] flex-col">
          <Chat eventId={eventId} messages={room?.chat ?? []} onSent={refresh} className="flex-1" />
        </div>
      </BottomSheet>
    </div>
  );
}

/* ---------------- zone sheet ---------------- */

const FOOD = [
  { name: "Kaiju Ramen Cart", hours: "22:00–05:00", note: "Vegan broth available" },
  { name: "Slime Taiyaki", hours: "23:00–04:00", note: "Matcha & red bean" },
  { name: "Orbit Onigiri", hours: "22:00–06:00", note: "Gluten-free options" },
];
const DRINKS = ["Free water refill points: Bar + Entrance", "Neon yuzu soda", "Alien-green matcha tonic", "Local craft beer (20+, ID required)"];
const RULES = ["Ticket QR or wristband required for re-entry", "No GPS tracking: the app only knows the zone you choose", "Zero tolerance for harassment: report to staff or in chat", "Earplugs and water are free at the bar"];

function ZoneSheet({
  zoneId,
  onClose,
  here,
  count,
  detail,
  clockNow,
  running,
  onMove,
  onWatch,
  onTab,
  onDance,
  dance,
  onReact,
  energy,
  onPortal,
}: {
  zoneId: ZoneId;
  onClose: () => void;
  here: boolean;
  count: number;
  detail: LiveDetail;
  clockNow: number;
  running: boolean;
  onMove: () => boolean;
  onWatch: (stageId: string) => void;
  onTab: (t: TabId) => void;
  onDance: (d: "bounce" | "wiggle" | "spin") => void;
  dance: string;
  onReact: (k: ReactionKind) => void;
  energy: number;
  onPortal: () => void;
}) {
  const z = zoneById(zoneId);
  const stage = zoneId === "main" || zoneId === "second" ? zoneId : null;
  const cn2 = stage ? currentAndNext(detail.sets, stage, clockNow) : null;
  useEffect(() => {
    if (zoneId === "portal") onPortal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneId]);
  return (
    <BottomSheet
      open
      modal={false}
      onClose={onClose}
      title={z.name}
      footer={
        here ? (
          <p className="text-center text-sm font-bold text-acid">You are here</p>
        ) : (
          <button type="button" onClick={() => { if (onMove()) onClose(); }} className="flex min-h-12 w-full items-center justify-center rounded-full bg-acid font-extrabold uppercase text-ink" data-testid="zone-move">
            Move my avatar here
          </button>
        )
      }
    >
      <div className="space-y-3" data-testid="zone-sheet" data-zone={zoneId}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="size-3 rounded-full" style={{ background: z.color }} aria-hidden />
          <span className="text-[13px] text-mute">{count} public avatars here{running ? "" : " (preview)"}</span>
          {z.dance && <Tag color="#B6F05C" dark>Dance zone</Tag>}
        </div>
        <p className="text-sm">{z.desc}</p>

        {stage && cn2 && (
          <div className="rounded-2xl bg-surface-2 p-3 text-sm">
            <p><b>Now:</b> {cn2.current ? `${cn2.current.dj.name} (${fmtInTz(cn2.current.startAt, detail.tz)}–${fmtInTz(cn2.current.endAt, detail.tz)})` : running ? "Between sets" : "Not started"}</p>
            <p className="text-mute"><b className="text-cream">Next:</b> {cn2.next ? `${cn2.next.dj.name} at ${fmtInTz(cn2.next.startAt, detail.tz)}` : "—"}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => onWatch(stage)} className="min-h-11 rounded-full bg-coral font-bold text-ink">Watch this stage</button>
              <button type="button" onClick={() => onTab("schedule")} className="min-h-11 rounded-full border-2 border-line font-bold">Timetable</button>
            </div>
          </div>
        )}
        {zoneId === "dancefloor" && (
          <div className="space-y-2">
            <p className="text-[13px] text-mute">Energy {energy} (game metric). Pick your move:</p>
            <div className="grid grid-cols-3 gap-2">
              {(["bounce", "wiggle", "spin"] as const).map((d) => <button key={d} type="button" aria-pressed={dance === d} onClick={() => onDance(d)} className={cn("min-h-11 rounded-full border-2 text-sm font-bold capitalize", dance === d ? "border-acid bg-acid text-ink" : "border-line")}>{d}</button>)}
            </div>
            {running && <ReactionBar onReact={onReact} />}
          </div>
        )}
        {zoneId === "vip" && <p className="rounded-2xl bg-surface-2 p-3 text-[13px]">VIP access is checked at the venue door with a VIP ticket. Online avatars can&apos;t enter the VIP balcony.</p>}
        {zoneId === "lounge" && <button type="button" onClick={() => onTab("community")} className="min-h-11 w-full rounded-full border-2 border-line font-bold">Open lounge chat</button>}
        {zoneId === "bar" && <ul className="list-disc space-y-1 pl-5 text-[13px]">{DRINKS.map((d) => <li key={d}>{d}</li>)}</ul>}
        {zoneId === "food" && (
          <ul className="space-y-1.5 text-[13px]">
            {FOOD.map((f) => <li key={f.name} className="rounded-xl bg-surface-2 px-3 py-2"><b>{f.name}</b> · {f.hours} <span className="text-mute">· {f.note}</span></li>)}
          </ul>
        )}
        {zoneId === "community" && (
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => onTab("community")} className="min-h-11 rounded-full border-2 border-line text-sm font-bold">Chat</button>
            <button type="button" onClick={() => onTab("community")} className="min-h-11 rounded-full border-2 border-line text-sm font-bold">Quests</button>
            <Link href={`/dao/${detail.event.id}`} className="flex min-h-11 items-center justify-center rounded-full border-2 border-line text-sm font-bold">DAO</Link>
          </div>
        )}
        {zoneId === "entrance" && (
          <div className="space-y-2">
            <ul className="list-disc space-y-1 pl-5 text-[13px]">{RULES.map((r) => <li key={r}>{r}</li>)}</ul>
            <button type="button" onClick={() => onTab("more")} className="min-h-11 w-full rounded-full border-2 border-line font-bold">Ticket check-in (demo)</button>
          </div>
        )}
        {zoneId === "portal" && (
          <div className="space-y-2 text-sm">
            {detail.afterParty ? (
              <>
                <p><b>{detail.afterParty.name}</b> · {detail.afterParty.venueName} · from {fmtInTz(Date.parse(detail.afterParty.startsAt), detail.tz)}</p>
                <p className="text-mute">{detail.afterParty.seatsLeft} of {detail.afterParty.capacity} spots left · ${detail.afterParty.price}</p>
              </>
            ) : (
              <p className="text-mute">After party not confirmed yet.</p>
            )}
            <button type="button" onClick={() => onTab("more")} className="min-h-11 w-full rounded-full bg-purple font-bold text-ink" data-testid="portal-details">After party details</button>
          </div>
        )}
        {(z.id === "bar" || z.id === "food") && <p className="text-[11px] text-mute">Sample venue info for the demo.</p>}
      </div>
    </BottomSheet>
  );
}
