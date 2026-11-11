"use client";

/**
 * FREAKTOPIA MUSIC PLAYER: one <audio> element for the whole site, mounted in the root layout so playback
 * survives client-side navigation (not reloads or leaving the site). Nothing plays until the person presses
 * play; starting a track stops the previous one (there is only one element).
 *
 * Plays are reported to /api/music/plays only after playback actually starts, with the seconds actually listened
 * (seeking forward adds nothing). The server decides whether that counts.
 */
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Heart, Bookmark, ListPlus, Pause, Play, Repeat, Repeat1, Share2, Shuffle, SkipBack, SkipForward, Volume2, VolumeX, X, Loader2 } from "lucide-react";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useAuth } from "@/lib/auth/client";
import { toast } from "@/lib/store";
import { cn } from "@/lib/utils";
import { fmtDuration, imageUrl, useMusicPost, type TrackDto } from "./shared";
import { Waveform } from "./Waveform";
import { AddToPlaylistSheet } from "./TrackActions";

export type PlayerTrack = Pick<TrackDto, "id" | "title" | "coverId" | "durationSec" | "waveform" | "liked" | "saved" | "likes" | "owner">;

type Repeat = "off" | "all" | "one";
interface PlayerState {
  queue: PlayerTrack[];
  index: number;
  current: PlayerTrack | null;
  playing: boolean;
  buffering: boolean;
  slow: boolean;
  time: number;
  duration: number;
  volume: number;
  muted: boolean;
  repeat: Repeat;
  shuffle: boolean;
  error: string | null;
  play: (tracks: PlayerTrack[], start?: number) => void;
  toggle: () => void;
  seek: (sec: number) => void;
  next: () => void;
  prev: () => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  close: () => void;
  patchTrack: (id: string, patch: Partial<PlayerTrack>) => void;
}

const Ctx = createContext<PlayerState | null>(null);
export function usePlayer() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePlayer outside PlayerProvider");
  return c;
}
/** Optional variant for components that may render outside the provider (tests, isolated pages). */
export const usePlayerMaybe = () => useContext(Ctx);

const errorKey = (code: number | undefined) => (code === 2 ? "playerErrNetwork" : code === 3 || code === 4 ? "playerErrFormat" : "playerErrGeneric");

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [slow, setSlow] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVol] = useState(1);
  const [muted, setMuted] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>("off");
  const [shuffle, setShuffle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = queue[index] ?? null;

  // ---- play reporting
  const play = useRef<{ trackId: string; playId: string | null; sessionId: string | null; listened: number; last: number; sent: boolean; starting: boolean } | null>(null);
  const retried = useRef<string | null>(null);
  const finish = useCallback((beacon = false) => {
    const p = play.current;
    if (!p || p.sent || !p.playId) return;
    p.sent = true;
    const body = JSON.stringify({ playId: p.playId, sessionId: p.sessionId, seconds: Math.round(p.listened) });
    if (beacon && navigator.sendBeacon) navigator.sendBeacon("/api/music/plays/finish", new Blob([body], { type: "application/json" }));
    else void fetch("/api/music/plays/finish", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => undefined);
  }, []);
  const threshold = (d: number | null | undefined) => Math.max(1, Math.min(30, Math.floor((d ?? 60) / 2)));

  const load = useCallback(
    (t: PlayerTrack, autoplay: boolean) => {
      const el = audio.current;
      if (!el) return;
      finish();
      play.current = { trackId: t.id, playId: null, sessionId: null, listened: 0, last: 0, sent: false, starting: false };
      setError(null);
      setTime(0);
      setDuration(t.durationSec ?? 0);
      el.src = `/api/music/tracks/${t.id}/stream`;
      if (autoplay) void el.play().catch(() => undefined);
    },
    [finish],
  );

  const playList = useCallback(
    (tracks: PlayerTrack[], start = 0) => {
      if (!tracks.length) return;
      setQueue(tracks);
      setIndex(start);
      retried.current = null;
      load(tracks[start], true); // always from a click: no autoplay on page load
    },
    [load],
  );

  const toggle = useCallback(() => {
    const el = audio.current;
    if (!el || !current) return;
    if (el.paused) void el.play().catch(() => undefined);
    else el.pause();
  }, [current]);

  const seek = useCallback((sec: number) => {
    const el = audio.current;
    if (!el || !Number.isFinite(sec)) return;
    el.currentTime = Math.max(0, Math.min(sec, Number.isFinite(el.duration) ? el.duration : sec));
    setTime(el.currentTime);
    if (play.current) play.current.last = el.currentTime; // a jump never counts as listening time
  }, []);

  const go = useCallback(
    (dir: 1 | -1, auto = false) => {
      if (!queue.length) return;
      let i: number;
      if (shuffle && queue.length > 1) {
        do i = Math.floor(Math.random() * queue.length);
        while (i === index);
      } else i = index + dir;
      if (i >= queue.length) {
        if (repeat !== "all") {
          if (auto) setPlaying(false);
          return;
        }
        i = 0;
      }
      if (i < 0) i = repeat === "all" ? queue.length - 1 : 0;
      setIndex(i);
      retried.current = null;
      load(queue[i], true);
    },
    [queue, index, shuffle, repeat, load],
  );
  const next = useCallback(() => go(1), [go]);
  const prev = useCallback(() => {
    const el = audio.current;
    if (el && el.currentTime > 3) return seek(0);
    go(-1);
  }, [go, seek]);

  // ---- element events
  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    let slowTimer: ReturnType<typeof setTimeout> | null = null;
    const clearSlow = () => {
      if (slowTimer) clearTimeout(slowTimer);
      slowTimer = null;
      setSlow(false);
    };
    const onPlaying = () => {
      setPlaying(true);
      setBuffering(false);
      clearSlow();
      const p = play.current;
      if (p && !p.playId && !p.starting) {
        p.starting = true;
        void fetch("/api/music/plays/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trackId: p.trackId }) })
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => {
            if (j && play.current === p) {
              p.playId = j.playId;
              p.sessionId = j.sessionId;
            }
          })
          .catch(() => undefined);
      }
    };
    const onPause = () => setPlaying(false);
    const onWaiting = () => {
      setBuffering(true);
      if (!slowTimer) slowTimer = setTimeout(() => setSlow(true), 4000);
    };
    const onTime = () => {
      setTime(el.currentTime);
      const p = play.current;
      if (!p) return;
      const d = el.currentTime - p.last;
      if (d > 0 && d < 1.5 && !el.paused) p.listened += d;
      p.last = el.currentTime;
      if (!p.sent && p.playId && p.listened >= threshold(el.duration)) finish();
    };
    const onMeta = () => {
      if (Number.isFinite(el.duration)) setDuration(el.duration);
      setBuffering(false);
    };
    const onEnded = () => {
      finish();
      if (repeat === "one") {
        el.currentTime = 0;
        play.current = { ...play.current!, playId: null, sessionId: null, listened: 0, last: 0, sent: false, starting: false };
        void el.play().catch(() => undefined);
      } else go(1, true);
    };
    const onError = () => {
      setBuffering(false);
      clearSlow();
      const code = el.error?.code;
      const t = queue[index];
      // A playback link is short-lived: on a network error get a fresh one once and continue where it stopped.
      if (t && code === 2 && retried.current !== t.id) {
        retried.current = t.id;
        const at = el.currentTime;
        el.src = `/api/music/tracks/${t.id}/stream?r=${Date.now()}`;
        el.currentTime = at;
        void el.play().catch(() => undefined);
        return;
      }
      setPlaying(false);
      setError(errorKey(code));
    };
    el.addEventListener("playing", onPlaying);
    el.addEventListener("pause", onPause);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
      if (slowTimer) clearTimeout(slowTimer);
    };
  }, [go, repeat, finish, queue, index]);

  useEffect(() => {
    const onHide = () => finish(true);
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [finish]);

  useEffect(() => {
    if (audio.current) {
      audio.current.volume = volume;
      audio.current.muted = muted;
    }
  }, [volume, muted]);

  // ---- Media Session (lock screen, headphones)
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator) || !current) return;
    const ms = navigator.mediaSession;
    const art = imageUrl(current.coverId);
    ms.metadata = new MediaMetadata({ title: current.title, artist: current.owner?.stageName ?? "", album: "FREAKTOPIA", artwork: art ? [{ src: art, sizes: "512x512" }] : [] });
    const set = (a: MediaSessionAction, h: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(a, h);
      } catch {
        /* unsupported action */
      }
    };
    set("play", () => toggle());
    set("pause", () => toggle());
    set("nexttrack", () => next());
    set("previoustrack", () => prev());
    set("seekto", (d) => d.seekTime != null && seek(d.seekTime));
  }, [current, toggle, next, prev, seek]);

  useEffect(() => {
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) navigator.mediaSession.playbackState = current ? (playing ? "playing" : "paused") : "none";
  }, [playing, current]);

  // Pages leave room for the mini player (globals.css: --player-h).
  useEffect(() => {
    document.documentElement.style.setProperty("--player-h", current ? "72px" : "0px");
  }, [current]);

  const close = useCallback(() => {
    finish();
    audio.current?.pause();
    if (audio.current) audio.current.removeAttribute("src");
    setQueue([]);
    setIndex(0);
    setPlaying(false);
    setError(null);
  }, [finish]);

  const patchTrack = useCallback((tid: string, patch: Partial<PlayerTrack>) => setQueue((q) => q.map((t) => (t.id === tid ? { ...t, ...patch } : t))), []);

  const value = useMemo<PlayerState>(
    () => ({
      queue, index, current, playing, buffering, slow, time, duration, volume, muted, repeat, shuffle, error,
      play: playList, toggle, seek, next, prev,
      setVolume: (v: number) => { setVol(Math.max(0, Math.min(1, v))); if (v > 0) setMuted(false); },
      toggleMute: () => setMuted((m) => !m),
      cycleRepeat: () => setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off")),
      toggleShuffle: () => setShuffle((s) => !s),
      close, patchTrack,
    }),
    [queue, index, current, playing, buffering, slow, time, duration, volume, muted, repeat, shuffle, error, playList, toggle, seek, next, prev, close, patchTrack],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <audio ref={audio} preload="none" className="hidden" data-testid="player-audio" />
      <MiniPlayer />
    </Ctx.Provider>
  );
}

// ------------------------------------------------------------------ UI

function useReact(current: PlayerTrack | null, patchTrack: PlayerState["patchTrack"]) {
  const post = useMusicPost();
  const signedIn = useAuth((s) => s.status === "signedIn");
  const t = useTranslations("music");
  return async (kind: "like" | "save") => {
    if (!current) return;
    if (!signedIn) return toast({ title: t("signInToReact"), tone: "default" });
    const on = kind === "like" ? !current.liked : !current.saved;
    patchTrack(current.id, kind === "like" ? { liked: on, likes: (current.likes ?? 0) + (on ? 1 : -1) } : { saved: on });
    const r = await post<{ likes?: number }>(`tracks/${current.id}/${kind}`, { on });
    if (!r) patchTrack(current.id, kind === "like" ? { liked: !on, likes: current.likes } : { saved: !on });
    else if (kind === "like" && typeof r.likes === "number") patchTrack(current.id, { likes: r.likes });
  };
}

function MiniPlayer() {
  const p = usePlayer();
  const t = useTranslations("music");
  const [full, setFull] = useState(false);
  if (!p.current) return null;
  const c = p.current;
  const pct = p.duration ? (p.time / p.duration) * 100 : 0;
  return (
    <>
      <div
        role="region"
        aria-label={t("player")}
        data-testid="mini-player"
        className="hide-on-kb fixed inset-x-2 z-40 mx-auto max-w-xl overflow-hidden rounded-2xl border border-acid/40 bg-surface/95 shadow-[0_-4px_24px_-6px_rgba(193,255,83,0.35)] backdrop-blur lg:inset-x-auto lg:right-4 lg:w-[420px]"
        style={{ bottom: "var(--player-bottom)" }}
      >
        <div className="h-1 bg-line" aria-hidden><div className="h-full bg-acid" style={{ width: `${pct}%` }} /></div>
        <div className="flex h-[64px] items-center gap-2 px-2">
          <button type="button" onClick={() => setFull(true)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left" aria-label={t("openPlayer")} data-testid="open-full-player">
            <Cover id={c.coverId} size={44} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold" data-testid="player-title">{c.title}</span>
              <span className="block truncate text-xs text-mute">
                {p.error ? <span className="text-coral" role="alert">{t(p.error)}</span> : p.slow ? t("playerSlow") : p.buffering ? t("playerLoading") : c.owner?.stageName}
              </span>
            </span>
          </button>
          <button type="button" onClick={p.toggle} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-acid text-ink" aria-label={p.playing ? t("pause") : t("play")} data-testid="player-toggle">
            {p.buffering && p.playing ? <Loader2 className="size-5 animate-spin" aria-hidden /> : p.playing ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
          </button>
          <button type="button" onClick={p.next} disabled={p.queue.length < 2} className="hidden size-11 shrink-0 items-center justify-center rounded-full disabled:opacity-40 min-[380px]:inline-flex" aria-label={t("next")}>
            <SkipForward className="size-5" aria-hidden />
          </button>
          <button type="button" onClick={p.close} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-mute" aria-label={t("closePlayer")} data-testid="player-close">
            <X className="size-5" aria-hidden />
          </button>
        </div>
      </div>
      <FullPlayer open={full} onClose={() => setFull(false)} />
    </>
  );
}

export function Cover({ id, size, className }: { id: string | null; size: number; className?: string }) {
  const src = imageUrl(id);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} className={cn("shrink-0 rounded-xl object-cover", className)} style={{ width: size, height: size }} loading="lazy" />
  ) : (
    <span aria-hidden className={cn("shrink-0 rounded-xl bg-[radial-gradient(circle_at_30%_30%,#C1FF53_0,#7B3FE4_45%,#0B0910_100%)]", className)} style={{ width: size, height: size }} />
  );
}

function FullPlayer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const p = usePlayer();
  const t = useTranslations("music");
  const href = useLocalHref();
  const react = useReact(p.current, p.patchTrack);
  const [addOpen, setAddOpen] = useState(false);
  const c = p.current;
  if (!c) return null;
  const share = async () => {
    const url = `${location.origin}${href(`/music/tracks/${c.id}`)}`;
    try {
      if (navigator.share) await navigator.share({ title: c.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast({ title: t("linkCopied"), tone: "success" });
      }
    } catch {
      /* cancelled */
    }
  };
  return (
    <BottomSheet open={open} onClose={onClose} title={t("nowPlaying")}>
      <div className="space-y-4 pb-2" data-testid="full-player">
        <div className="flex items-center gap-4">
          <Cover id={c.coverId} size={96} />
          <div className="min-w-0">
            <h3 className="text-xl font-extrabold leading-tight">{c.title}</h3>
            {c.owner?.slug ? (
              <Link href={href(`/djs/u/${c.owner.slug}`)} onClick={onClose} className="text-sm font-bold text-acid underline" data-testid="player-dj-link">
                {c.owner.stageName}
              </Link>
            ) : (
              <span className="text-sm text-mute">{c.owner?.stageName}</span>
            )}
          </div>
        </div>
        <Waveform peaks={c.waveform} progress={p.duration ? p.time / p.duration : 0} onSeek={(f) => p.seek(f * (p.duration || 0))} label={t("seek")} />
        <div className="flex justify-between text-xs tabular-nums text-mute">
          <span data-testid="player-time">{fmtDuration(p.time)}</span>
          <span>{fmtDuration(p.duration || c.durationSec)}</span>
        </div>
        <input type="range" min={0} max={Math.max(1, Math.floor(p.duration || c.durationSec || 0))} step={1} value={Math.floor(p.time)} onChange={(e) => p.seek(Number(e.target.value))} aria-label={t("seek")} className="w-full accent-[var(--color-acid)]" data-testid="player-seek" />
        {p.error && <p role="alert" className="rounded-xl bg-coral/15 p-3 text-sm text-coral">{t(p.error)}</p>}
        {p.slow && !p.error && <p className="text-sm text-mute" role="status">{t("playerSlow")}</p>}
        <div className="flex items-center justify-center gap-2">
          <IconBtn label={t("shuffle")} pressed={p.shuffle} onClick={p.toggleShuffle}><Shuffle className="size-5" /></IconBtn>
          <IconBtn label={t("previous")} onClick={p.prev}><SkipBack className="size-6" /></IconBtn>
          <button type="button" onClick={p.toggle} className="inline-flex size-16 items-center justify-center rounded-full bg-acid text-ink" aria-label={p.playing ? t("pause") : t("play")} data-testid="full-toggle">
            {p.playing ? <Pause className="size-7" aria-hidden /> : <Play className="size-7" aria-hidden />}
          </button>
          <IconBtn label={t("next")} onClick={p.next}><SkipForward className="size-6" /></IconBtn>
          <IconBtn label={p.repeat === "one" ? t("repeatOne") : p.repeat === "all" ? t("repeatAll") : t("repeatOff")} pressed={p.repeat !== "off"} onClick={p.cycleRepeat}>
            {p.repeat === "one" ? <Repeat1 className="size-5" /> : <Repeat className="size-5" />}
          </IconBtn>
        </div>
        <div className="flex items-center gap-2">
          <IconBtn label={p.muted ? t("unmute") : t("mute")} onClick={p.toggleMute}>{p.muted || p.volume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}</IconBtn>
          <input type="range" min={0} max={1} step={0.05} value={p.muted ? 0 : p.volume} onChange={(e) => p.setVolume(Number(e.target.value))} aria-label={t("volume")} className="flex-1 accent-[var(--color-acid)]" />
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <IconBtn label={c.liked ? t("unlike") : t("like")} pressed={!!c.liked} onClick={() => void react("like")}><Heart className={cn("size-5", c.liked && "fill-coral text-coral")} /></IconBtn>
          <IconBtn label={c.saved ? t("unsave") : t("save")} pressed={!!c.saved} onClick={() => void react("save")}><Bookmark className={cn("size-5", c.saved && "fill-acid text-acid")} /></IconBtn>
          <IconBtn label={t("addToPlaylist")} onClick={() => setAddOpen(true)}><ListPlus className="size-5" /></IconBtn>
          <IconBtn label={t("share")} onClick={() => void share()}><Share2 className="size-5" /></IconBtn>
          <IconBtn label={t("closeFull")} onClick={onClose}><ChevronDown className="size-5" /></IconBtn>
        </div>
        {p.queue.length > 1 && (
          <div>
            <h4 className="mb-1 text-xs font-extrabold uppercase text-mute">{t("upNext")}</h4>
            <ol className="max-h-48 space-y-1 overflow-y-auto">
              {p.queue.map((q, i) => (
                <li key={`${q.id}-${i}`} className={cn("truncate rounded-lg px-2 py-1 text-sm", i === p.index ? "bg-acid/15 font-bold text-acid" : "text-mute")}>{q.title}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
      {addOpen && <AddToPlaylistSheet trackId={c.id} onClose={() => setAddOpen(false)} />}
    </BottomSheet>
  );
}

function IconBtn({ label, onClick, pressed, children }: { label: string; onClick: () => void; pressed?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={pressed} className={cn("inline-flex size-11 items-center justify-center rounded-full border border-line", pressed && "border-acid text-acid")}>
      {children}
    </button>
  );
}
