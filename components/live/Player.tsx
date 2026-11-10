"use client";

import { useTranslations } from "next-intl";
/**
 * Live DJ player. In this build no stream provider is connected, so it renders a DEMO visualizer
 * (no video, no audio) and says so. With a provider (lib/live/streaming.ts) the <video> slot would
 * carry the provider's playback URL; recording/rights flags come from the stream record.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Eye, Heart, Maximize, Minimize, Pause, Play, Share2, ShieldAlert, SkipForward, UserPlus, UserCheck, Volume2, VolumeX } from "lucide-react";
import { AlienG } from "@/components/art/Alien";
import { DemoBadge, Tag } from "@/components/ui/primitives";
import type { LiveDetail, LiveSet } from "@/lib/live/client";
import { fmtCount } from "@/lib/live/client";
import { durationMin, fmtInTz, tzLabel } from "@/lib/live/time";
import { toast, useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";

export type Quality = "auto" | "1080p" | "720p" | "480p" | "audio";

export function setTimes(s: LiveSet, tz: string) {
  return `${fmtInTz(s.startAt, tz)}–${fmtInTz(s.endAt, tz)} ${tzLabel(s.startAt, tz)}`;
}

export function Player({
  detail,
  stageId,
  setStageId,
  current,
  next,
  viewers,
  playing,
  setPlaying,
  quality,
  setQuality,
  tz,
  onSkip,
  energyColor,
  saveData,
}: {
  detail: LiveDetail;
  stageId: string;
  setStageId: (s: string) => void;
  current: LiveSet | null;
  next: LiveSet | null;
  viewers: number | null;
  playing: boolean;
  setPlaying: (v: boolean) => void;
  quality: Quality;
  setQuality: (q: Quality) => void;
  tz: string;
  onSkip: (() => void) | null;
  energyColor: string;
  saveData: boolean;
}) {
  const tu = useTranslations("live");
  const box = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(70);
  const [full, setFull] = useState(false);
  const [rightsOpen, setRightsOpen] = useState(false);
  const favorites = useDemo((s) => s.favorites);
  const toggleFavorite = useDemo((s) => s.toggleFavorite);
  const liked = useDemo((s) => s.liveLikes.includes(detail.event.id));
  const toggleLike = useDemo((s) => s.toggleLiveLike);
  const stream = detail.streams.find((s) => s.stageId === stageId) ?? detail.streams[0];
  const isDemo = detail.status === "demo_live";
  const isLive = detail.status === "live" && stream?.live;
  const dj = current?.dj ?? null;
  const following = dj ? favorites.includes(dj.id) : false;

  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await box.current?.requestFullscreen();
    } catch {
      toast({ title: tu("fullscreenIsntAvailableHere") });
    }
  };

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) await navigator.share({ title: detail.event.name, text: tu("nameOnFreaktopiaDemoLive", { name: detail.event.name }), url });
      else {
        await navigator.clipboard.writeText(url);
        toast({ title: tu("linkCopied") });
      }
    } catch {
      /* user cancelled */
    }
  };

  const audioOnly = quality === "audio" || saveData;

  return (
    <section aria-label={tu("liveDjPlayer")} className="overflow-hidden rounded-none border-y-2 border-line bg-surface md:rounded-[26px] md:border-2" data-testid="player">
      <div ref={box} className={cn("relative bg-ink", full ? "flex h-full items-center justify-center" : "aspect-video")}>
        {/* Visual */}
        {detail.status === "upcoming" || detail.status === "ended" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <Tag color="#2a2a2a">{detail.status === "upcoming" ? tu("notLiveYet") : tu("ended")}</Tag>
            <p className="font-display text-xl uppercase">{detail.status === "upcoming" ? tu("startsFmtintzTzlabel", { fmtInTz: fmtInTz(Date.parse(detail.event.startsAt), tz, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }), tzLabel: tzLabel(Date.parse(detail.event.startsAt), tz) }) : tu("thisFestivalHasEnded")}</p>
            <p className="max-w-sm text-[13px] text-mute">{tu("noStreamIsShownBefore")}</p>
          </div>
        ) : (
          <div className={cn("absolute inset-0", !playing && "paused")}>
            <svg viewBox="0 0 320 180" className="h-full w-full" aria-hidden preserveAspectRatio="xMidYMid slice">
              <defs>
                <radialGradient id="pl-glow" cx="50%" cy="40%" r="70%">
                  <stop offset="0%" stopColor={energyColor} stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#080808" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width="320" height="180" fill="#0d0b12" />
              <rect width="320" height="180" fill="url(#pl-glow)" />
              {!audioOnly && dj && (
                <g transform="translate(122 34) scale(0.38)">
                  <g className={playing ? "fm-dance fm-bounce" : undefined}>
                    <AlienG look={dj.look} />
                  </g>
                </g>
              )}
              {!audioOnly && <rect x="96" y="108" width="128" height="24" rx="4" fill="#FFAD5B" stroke="#080808" strokeWidth="3" />}
              <g>
                {Array.from({ length: 24 }, (_, i) => (
                  <rect key={i} className="eq-bar" style={{ animationDelay: `${(i * 137) % 900 * -1}ms`, animationDuration: `${0.6 + ((i * 7) % 5) * 0.12}s` }} x={10 + i * 12.6} y={audioOnly ? 60 : 140} width="8" height={audioOnly ? 80 : 34} rx="3" fill={i % 3 ? energyColor : "#F5F2EA"} opacity="0.85" />
                ))}
              </g>
            </svg>
            {isDemo && (
              <div className="absolute inset-x-0 top-0 flex flex-wrap items-center gap-1.5 bg-gradient-to-b from-ink/90 to-transparent p-2.5">
                <Tag color="#FFAD5B" dark>{tu("demoLive2")}</Tag>
                <DemoBadge className="bg-ink" label={tu("visualizerNoRealVideoOr")} />
              </div>
            )}
            {isLive && <Tag color="#FF625C" dark className="absolute left-2.5 top-2.5">{tu("live")}</Tag>}
            {!playing && (
              <button type="button" onClick={() => setPlaying(true)} aria-label={tu("play")} className="absolute inset-0 m-auto flex size-16 items-center justify-center rounded-full bg-acid text-ink shadow-lg">
                <Play className="size-8" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Info + controls */}
      <div className="space-y-3 p-3 sm:p-4">
        {detail.stages.length > 1 && (
          <div className="flex gap-2" role="tablist" aria-label={tu("stage")}>
            {detail.stages.map((s) => (
              <button key={s.id} type="button" role="tab" aria-selected={stageId === s.id} onClick={() => setStageId(s.id)} className={cn("min-h-11 flex-1 rounded-full border-2 px-3 text-sm font-bold", stageId === s.id ? "border-acid bg-acid text-ink" : "border-line")}>
                {s.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-coral">{current ? tu("nowPlaying") : tu("betweenSets")}{detail.clock.demo && tu("demoClock2")}</p>
            <h2 className="font-display text-[22px] uppercase leading-tight [overflow-wrap:anywhere] sm:text-2xl" data-testid="now-dj">{dj?.name ?? "—"}</h2>
            {current && <p className="text-[13px] text-mute">{tu("settimesDurationminMin", { setTimes: setTimes(current, tz), durationMin: durationMin(current) })} {dj?.genres.join(" / ")}</p>}
            {next && <p className="truncate text-[13px] text-mute">{tu("next")} <b className="text-cream">{next.dj.name}</b> · {fmtInTz(next.startAt, tz)}</p>}
          </div>
          {viewers !== null && (
            <div className="shrink-0 rounded-2xl bg-surface-2 px-3 py-2 text-center">
              <Eye className="mx-auto size-4 text-blue" aria-hidden />
              <div className="font-display text-lg leading-none" data-testid="viewers">{fmtCount(viewers)}</div>
              <div className="text-[10px] font-bold uppercase text-mute">{isDemo ? tu("demoViewers") : tu("watching")}</div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <IconBtn label={playing ? tu("pause") : tu("play")} onClick={() => setPlaying(!playing)} disabled={!(isDemo || isLive)}>{playing ? <Pause className="size-5" /> : <Play className="size-5" />}</IconBtn>
          <IconBtn label={muted ? tu("unmute") : tu("mute")} onClick={() => { setMuted(!muted); if (isDemo) toast({ title: tu("demoHasNoAudio"), body: tu("theAudioControlsWorkOnce") }); }}>{muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}</IconBtn>
          <label className="hidden items-center gap-2 text-[12px] text-mute sm:flex">
            <span className="sr-only">{tu("volume")}</span>
            <input type="range" min={0} max={100} value={muted ? 0 : volume} onChange={(e) => { setVolume(Number(e.target.value)); setMuted(Number(e.target.value) === 0); }} className="w-24 accent-[#B6F05C]" aria-label={tu("volume")} />
          </label>
          <label className="ml-auto">
            <span className="sr-only">{tu("streamQuality")}</span>
            <select value={quality} onChange={(e) => setQuality(e.target.value as Quality)} className="min-h-11 rounded-full border-2 border-line bg-surface px-3 text-sm font-bold" aria-label={tu("streamQuality")}>
              {(stream?.qualities ?? ["auto"]).map((q) => <option key={q} value={q}>{q === "audio" ? tu("audioOnly") : q === "auto" ? tu("auto") : q}</option>)}
            </select>
          </label>
          <IconBtn label={full ? tu("exitFullscreen") : tu("fullscreen")} onClick={fullscreen}>{full ? <Minimize className="size-5" /> : <Maximize className="size-5" />}</IconBtn>
        </div>
        {saveData && <p className="text-[12px] text-orange">{tu("dataSaverIsOnSo")}</p>}

        <div className="grid grid-cols-3 gap-2">
          <button type="button" disabled={!dj} aria-pressed={following} onClick={() => { if (!dj) return; const on = toggleFavorite(dj.id); toast({ title: on ? tu("followingName", { name: dj.name }) : tu("unfollowedName", { name: dj.name }) }); }} className={cn("flex min-h-11 items-center justify-center gap-1.5 rounded-full border-2 text-sm font-bold", following ? "border-acid bg-acid text-ink" : "border-line")}>
            {following ? <UserCheck className="size-4" aria-hidden /> : <UserPlus className="size-4" aria-hidden />} {following ? tu("following") : tu("follow")}
          </button>
          <button type="button" aria-pressed={liked} onClick={() => toggleLike(detail.event.id)} className={cn("flex min-h-11 items-center justify-center gap-1.5 rounded-full border-2 text-sm font-bold", liked ? "border-coral bg-coral text-ink" : "border-line")}>
            <Heart className={cn("size-4", liked && "fill-current")} aria-hidden /> {liked ? tu("liked") : tu("like")}
          </button>
          <button type="button" onClick={share} className="flex min-h-11 items-center justify-center gap-1.5 rounded-full border-2 border-line text-sm font-bold">
            <Share2 className="size-4" aria-hidden /> {tu("share")}
          </button>
        </div>

        {onSkip && (
          <button type="button" onClick={onSkip} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border-2 border-dashed border-orange/60 text-sm font-bold text-orange">
            <SkipForward className="size-4" aria-hidden /> {tu("skipToNextSetDemo2")}
          </button>
        )}

        <div className="rounded-2xl bg-surface-2 text-[13px]">
          <button type="button" onClick={() => setRightsOpen(!rightsOpen)} aria-expanded={rightsOpen} className="flex min-h-11 w-full items-center gap-2 px-3 text-left font-bold">
            <ShieldAlert className="size-4 shrink-0 text-orange" aria-hidden /> {tu("streamRightsStatus")}
            {rightsOpen ? <ChevronUp className="ml-auto size-4" aria-hidden /> : <ChevronDown className="ml-auto size-4" aria-hidden />}
          </button>
          {rightsOpen && stream && (
            <ul className="space-y-1 px-3 pb-3 text-mute">
              <li>{tu("provider")} <b className="text-cream">{stream.provider === "demo" ? tu("demoVisualizerNoStreamConnected") : stream.provider === "none" ? tu("none") : stream.provider}</b></li>
              <li>{tu("performerOrganizerBroadcastConsent")} <b className="text-cream">{stream.rights.broadcastConsent ? tu("yes") : tu("notRecorded")}</b></li>
              <li>{tu("musicLicenceForStreaming")} <b className="text-cream">{stream.rights.musicLicensed ? tu("cleared") : tu("notCleared")}</b></li>
              <li>{tu("recordingReplay")} <b className="text-cream">{stream.recordingAllowed ? tu("allowed") : tu("notAllowed")}</b></li>
              <li className="pt-1 text-[12px]">{tu("aStageIsOnlyShown")}</li>
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function IconBtn({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} disabled={disabled} className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-surface-2 disabled:opacity-40">
      {children}
    </button>
  );
}

/** Sticky mini player for mobile when the full player is off-screen. */
export function MiniPlayer({ dj, playing, setPlaying, onOpen, demo }: { dj: string | null; playing: boolean; setPlaying: (v: boolean) => void; onOpen: () => void; demo: boolean }) {
  const tu = useTranslations("live");
  return (
    <div className="flex min-h-14 items-center gap-2 border-b border-line bg-surface/95 px-3 backdrop-blur" data-testid="mini-player">
      <span className={cn("flex h-6 items-end gap-0.5", !playing && "paused")} aria-hidden>
        {[0, 1, 2, 3].map((i) => <span key={i} className="eq-bar w-1 rounded bg-acid" style={{ height: 22, animationDelay: `${i * -0.2}s` }} />)}
      </span>
      <button type="button" onClick={onOpen} className="min-h-11 min-w-0 flex-1 truncate text-left text-sm">
        <span className="text-[10px] font-extrabold uppercase text-coral">{demo ? tu("demoLive3") : tu("now")} · </span>
        <b>{dj ?? tu("betweenSets")}</b>
      </button>
      <button type="button" onClick={() => setPlaying(!playing)} aria-label={playing ? tu("pause") : tu("play")} className="inline-flex size-11 items-center justify-center rounded-full bg-surface-2">
        {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
      </button>
    </div>
  );
}
