"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bookmark, Heart, ListPlus, Pause, Play, Plus, Share2 } from "lucide-react";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/primitives";
import { Input } from "@/components/forms/Fields";
import { useAuth } from "@/lib/auth/client";
import { toast } from "@/lib/store";
import { cn } from "@/lib/utils";
import { fmtDuration, useMusic, useMusicPost, type TrackDto } from "./shared";
import { Cover, usePlayerMaybe, type PlayerTrack } from "./PlayerProvider";

/**
 * Like and save: one tap toggles, the UI changes at once and goes back if the server says no.
 * The server keeps one like / one save per account and track, so double taps never double count.
 */
export function ReactButtons({ track, onChange, compact }: { track: Pick<TrackDto, "id" | "liked" | "saved" | "likes">; onChange?: (patch: Partial<TrackDto>) => void; compact?: boolean }) {
  const t = useTranslations("music");
  const post = useMusicPost();
  const signedIn = useAuth((s) => s.status === "signedIn");
  const player = usePlayerMaybe();
  const [liked, setLiked] = useState(track.liked);
  const [saved, setSaved] = useState(track.saved);
  const [likes, setLikes] = useState(track.likes);
  const [busy, setBusy] = useState<"like" | "save" | null>(null);
  const go = async (kind: "like" | "save") => {
    if (!signedIn) return toast({ title: t("signInToReact"), tone: "default" });
    if (busy === kind) return;
    setBusy(kind);
    if (kind === "like") {
      const on = !liked;
      setLiked(on);
      setLikes((n) => n + (on ? 1 : -1));
      const r = await post<{ likes: number }>(`tracks/${track.id}/like`, { on });
      if (!r) {
        setLiked(!on);
        setLikes((n) => n + (on ? -1 : 1));
      } else {
        setLikes(r.likes);
        onChange?.({ liked: on, likes: r.likes });
        player?.patchTrack(track.id, { liked: on, likes: r.likes });
      }
    } else {
      const on = !saved;
      setSaved(on);
      const r = await post(`tracks/${track.id}/save`, { on });
      if (!r) setSaved(!on);
      else {
        onChange?.({ saved: on });
        player?.patchTrack(track.id, { saved: on });
      }
    }
    setBusy(null);
  };
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" onClick={() => void go("like")} aria-pressed={liked} aria-label={liked ? t("unlike") : t("like")} className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full px-2 text-sm" data-testid="like">
        <Heart className={cn("size-5", liked && "fill-coral text-coral")} aria-hidden />
        <span className="tabular-nums" data-testid="like-count">{likes}</span>
      </button>
      <button type="button" onClick={() => void go("save")} aria-pressed={saved} aria-label={saved ? t("unsave") : t("save")} className="inline-flex size-11 items-center justify-center rounded-full" data-testid="save">
        <Bookmark className={cn("size-5", saved && "fill-acid text-acid")} aria-hidden />
      </button>
      {!compact && <AddButton trackId={track.id} />}
    </span>
  );
}

function AddButton({ trackId }: { trackId: string }) {
  const t = useTranslations("music");
  const signedIn = useAuth((s) => s.status === "signedIn");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => (signedIn ? setOpen(true) : toast({ title: t("signInToReact"), tone: "default" }))} aria-label={t("addToPlaylist")} className="inline-flex size-11 items-center justify-center rounded-full" data-testid="add-to-playlist">
        <ListPlus className="size-5" aria-hidden />
      </button>
      {open && <AddToPlaylistSheet trackId={trackId} onClose={() => setOpen(false)} />}
    </>
  );
}

interface LibraryRes {
  playlists: { id: string; title: string; visibility: string; count: number }[];
}

export function AddToPlaylistSheet({ trackId, onClose }: { trackId: string; onClose: () => void }) {
  const t = useTranslations("music");
  const post = useMusicPost();
  const { data, reload } = useMusic<LibraryRes>("/api/music/me/library");
  const [title, setTitle] = useState("");
  const add = async (pid: string) => {
    if (await post(`playlists/${pid}/items`, { trackId }, { success: t("addedToPlaylist") })) onClose();
  };
  const create = async () => {
    const r = await post<{ playlist: { id: string } }>("playlists", { title: title.trim(), visibility: "private" });
    if (r) {
      await add(r.playlist.id);
      void reload();
    }
  };
  return (
    <BottomSheet open onClose={onClose} title={t("addToPlaylist")}>
      <div className="space-y-3" data-testid="playlist-picker">
        {!data ? (
          <div className="h-16 animate-pulse rounded-2xl bg-surface-2" />
        ) : (
          <ul className="space-y-2">
            {data.playlists.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => void add(p.id)} className="flex min-h-12 w-full items-center justify-between rounded-2xl bg-surface-2 px-4 text-left font-bold">
                  <span className="truncate">{p.title}</span>
                  <span className="text-xs text-mute">{t(`plVis.${p.visibility}`)} · {p.count}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (title.trim()) void create(); }}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder={t("newPlaylistName")} aria-label={t("newPlaylistName")} data-testid="new-playlist-name" />
          <Button type="submit" disabled={!title.trim()} data-testid="create-playlist"><Plus className="size-4" aria-hidden /> {t("create")}</Button>
        </form>
      </div>
    </BottomSheet>
  );
}

export function ShareButton({ path, title }: { path: string; title: string }) {
  const t = useTranslations("music");
  const href = useLocalHref();
  return (
    <button
      type="button"
      aria-label={t("share")}
      className="inline-flex size-11 items-center justify-center rounded-full"
      onClick={async () => {
        const url = `${location.origin}${href(path)}`;
        try {
          if (navigator.share) await navigator.share({ title, url });
          else {
            await navigator.clipboard.writeText(url);
            toast({ title: t("linkCopied"), tone: "success" });
          }
        } catch {
          /* cancelled */
        }
      }}
    >
      <Share2 className="size-5" aria-hidden />
    </button>
  );
}

export const toPlayer = (t: TrackDto): PlayerTrack => ({ id: t.id, title: t.title, coverId: t.coverId, durationSec: t.durationSec, waveform: t.waveform, liked: t.liked, saved: t.saved, likes: t.likes, owner: t.owner });

/** A compact row: play, title, DJ, genre · BPM · key, duration, like / save / add. */
export function TrackRow({ track, list, index, hideOwner, extra }: { track: TrackDto; list: TrackDto[]; index: number; hideOwner?: boolean; extra?: React.ReactNode }) {
  const t = useTranslations("music");
  const href = useLocalHref();
  const player = usePlayerMaybe();
  const isCurrent = player?.current?.id === track.id;
  const playing = isCurrent && player?.playing;
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-surface-2 p-2" data-testid="track-row" data-track-id={track.id}>
      <button
        type="button"
        onClick={() => (isCurrent ? player?.toggle() : player?.play(list.map(toPlayer), index))}
        aria-label={playing ? t("pauseTrack", { title: track.title }) : t("playTrack", { title: track.title })}
        className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-full", isCurrent ? "bg-acid text-ink" : "bg-ink text-acid")}
        data-testid="play-track"
      >
        {playing ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
      </button>
      <Cover id={track.coverId} size={44} className="hidden min-[400px]:block" />
      <div className="min-w-0 flex-1">
        <Link href={href(`/music/tracks/${track.id}`)} className="block truncate font-extrabold hover:underline">{track.title}</Link>
        <div className="truncate text-xs text-mute">
          {!hideOwner && track.owner && (track.owner.slug ? <Link href={href(`/djs/u/${track.owner.slug}`)} className="font-bold text-cream/90 hover:underline">{track.owner.stageName}</Link> : track.owner.stageName)}
          {!hideOwner && " · "}
          {[t(`type.${track.type}`), track.genre, track.bpm ? `${track.bpm} BPM` : null, track.musicalKey].filter(Boolean).join(" · ")} · {fmtDuration(track.durationSec)}
        </div>
      </div>
      {extra}
      <ReactButtons track={track} compact />
    </div>
  );
}
