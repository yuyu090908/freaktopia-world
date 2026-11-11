"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/auth/client";
import { toast } from "@/lib/store";
import { useParty } from "@/components/party/shared";

/** Track as the API returns it (public fields + owner + this viewer's like/save state). */
export interface TrackDto {
  id: string;
  ownerId: string;
  title: string;
  type: string;
  genre: string;
  bpm: number | null;
  musicalKey: string | null;
  durationSec: number | null;
  description: string;
  coverId: string | null;
  waveform: number[];
  visibility: string;
  publishedAt: string | null;
  rightsStatus: string;
  downloadable: boolean;
  owner?: { stageName: string; slug: string | null };
  likes: number;
  saves: number;
  liked: boolean;
  saved: boolean;
}

export interface DjCardDto {
  userId: string;
  slug: string;
  stageName: string;
  city: string;
  country: string;
  genres: string[];
  bookingStatus: "open" | "limited" | "closed";
  imageId: string | null;
  look: import("@/lib/types").AlienLook | null;
  likes: number;
  trackCount: number;
  createdAt: string;
  topTrack: Omit<TrackDto, "owner" | "likes" | "saves" | "liked" | "saved"> | null;
}

export const imageUrl = (id: string | null | undefined) => (id ? `/api/music/images/${id}` : null);

export function fmtDuration(sec: number | null | undefined) {
  if (sec == null || !Number.isFinite(sec)) return "—";
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

/** GET /api/music/… (public data works signed out). */
export const useMusic = <T,>(url: string | null, initial: T | null = null) => useParty<T>(url, initial);

export function useMusicError() {
  const t = useTranslations("music");
  const to = useTranslations("ops");
  return useCallback((code: string) => (t.has(`err.${code}`) ? t(`err.${code}`) : to.has(`err.${code}`) ? to(`err.${code}`) : to("err.generic")), [t, to]);
}

/** POST to /api/music/…, toast errors (unless quiet), return data or null. */
export function useMusicPost() {
  const msg = useMusicError();
  return useCallback(
    async <T = Record<string, unknown>,>(path: string, body: unknown = {}, opts: { success?: string; quiet?: boolean } = {}): Promise<T | null> => {
      const r = await api<T>(`/api/music/${path}`, "POST", body);
      if (!r.ok) {
        if (!opts.quiet) toast({ title: msg(r.code), tone: "error" });
        return null;
      }
      if (opts.success) toast({ title: opts.success, tone: "success" });
      return r.data;
    },
    [msg],
  );
}

export function fileToB64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export const BOOKING_COLORS: Record<string, string> = {
  open: "#B6F05C", limited: "#FFAD5B", closed: "#5a5a5a",
  draft: "#5a5a5a", sent: "#55BCEB", viewed: "#55BCEB", negotiating: "#FFAD5B", accepted: "#A276E9", declined: "#5a5a5a", expired: "#5a5a5a", cancelled: "#FF625C", confirmed: "#B6F05C",
};
