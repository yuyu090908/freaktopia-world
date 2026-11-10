"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { api, useAuth } from "@/lib/auth/client";
import { toast } from "@/lib/store";
import type { AlienLook } from "@/lib/types";

/** Translated message for a party (or shared ops) API error code. */
export function usePartyError() {
  const t = useTranslations("party");
  const to = useTranslations("ops");
  return useCallback((code: string) => (t.has(`err.${code}`) ? t(`err.${code}`) : to.has(`err.${code}`) ? to(`err.${code}`) : to("err.generic")), [t, to]);
}

/** POST to the party API, toast the error, return data or null. */
export function usePartyPost() {
  const msg = usePartyError();
  return useCallback(
    async <T = Record<string, unknown>,>(path: string, body: unknown = {}, success?: string): Promise<T | null> => {
      const r = await api<T>(`/api/party/${path}`, "POST", body);
      if (!r.ok) {
        toast({ title: msg(r.code), tone: "error" });
        return null;
      }
      if (success) toast({ title: success, tone: "success" });
      return r.data;
    },
    [msg],
  );
}

/** GET JSON from /api/party/… (works signed out for public data). `initial` is server-rendered data for the same URL. */
export function useParty<T>(url: string | null, initial: T | null = null) {
  const [data, setData] = useState<T | null>(initial);
  const skipFirst = useRef(initial !== null);
  const [error, setError] = useState<{ code: string; status: number } | null>(null);
  const load = useCallback(async () => {
    if (!url) return;
    try {
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setData(j as T);
        setError(null);
      } else setError({ code: j?.error?.code ?? "generic", status: r.status });
    } catch {
      setError({ code: "generic", status: 0 });
    }
  }, [url]);
  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    void load();
  }, [load]);
  // The first request already carries the session cookie, so it doesn't wait for the auth check.
  // If the person signs in or out afterwards, the viewer-specific parts are fetched again.
  const status = useAuth((s) => s.status);
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (status === "loading") return;
    if (seen.current !== null && seen.current !== status) void load();
    seen.current = status;
  }, [status, load]);
  return { data, error, reload: load };
}

// ------------------------------------------------------------------ API shapes (mirrors lib/party/service.ts)

export type Theme = "tech_house" | "afro_house" | "melodic_techno" | "festival" | "default";
export type PlanetState = "verified" | "unverified" | "upcoming" | "cancelled";
export type Tier = "first" | "aura" | "glow" | "regular";

export interface Planet {
  id: string;
  name: string;
  city: string;
  country: string;
  venueName: string;
  startAt: string;
  endAt: string;
  timezone: string;
  genres: string[];
  level: number;
  theme: Theme;
  state: PlanetState;
  attendance: number | null;
  rating: number | null;
  reviewCount: number;
  coverId: string | null;
  demo: boolean;
}

export interface Shown {
  key: string;
  publicId: string | null;
  name: string | null;
  look: AlienLook;
  visits: number;
  tier: Tier;
}

export interface WorldData {
  demo: boolean;
  owner: { userId: string | null; publicId: string | null; name: string | null; look: AlienLook | null; tagline: string };
  isOwner: boolean;
  stats: { totalEvents: number; totalAttendance: number; uniqueVisitors: number; returningVisitors: number; averageRating: number | null; reviewCount: number; guests: number; cities: number; genres: string[]; manualShare: number; largestEvent: number };
  impact: { score: number | null; status: "ok" | "insufficient"; confidence: "low" | "medium" | "high" | null; parts: Record<"satisfaction" | "community" | "engagement" | "consistency" | "scale", number | null>; reviewCount: number };
  growth: { stage: 0 | 1 | 2 | 3 | 4 | 5; milestones: { key: string; reached: boolean }[]; areas: Theme[] };
  planets: Planet[];
  next: (Planet & { myStatus: "going" | "waitlist" | null }) | null;
  community: { shown: Shown[]; anonymous: number; tiers: Record<Tier, number>; total: number };
  follow: { following: boolean; notify: boolean; email: boolean; blocked: boolean } | null;
  followers: number;
  me: { visits: number; tier: Tier | null; privacy: { showInWorlds: boolean; showHistory: boolean } } | null;
}

export const THEME_COLORS: Record<Theme, { base: string; glow: string; accent: string }> = {
  tech_house: { base: "#3b2a6b", glow: "#A276E9", accent: "#55BCEB" },
  afro_house: { base: "#7a3b16", glow: "#FFAD5B", accent: "#FF625C" },
  melodic_techno: { base: "#1d2f5c", glow: "#55BCEB", accent: "#F5F2EA" },
  festival: { base: "#2d4a14", glow: "#B6F05C", accent: "#FF8FD1" },
  default: { base: "#2b2b2b", glow: "#B6F05C", accent: "#A276E9" },
};

/** Rough device class from what the browser tells us (memory, cores, data saver). Unknown counts as "high". */
export function deviceTier(): "high" | "low" {
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (n.connection?.saveData) return "low";
  if (typeof n.deviceMemory === "number" && n.deviceMemory <= 2) return "low";
  if ((n.hardwareConcurrency ?? 8) <= 2) return "low";
  return "high";
}

/** True when the light 2D world fits better: reduced motion, a phone-width screen, no WebGL, or a low-power device.
 * Phones start in Lite (fast first paint, less battery); 3D is one tap away and the choice is remembered. */
export function prefersLite(): boolean {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  if (window.matchMedia("(max-width: 767px)").matches) return true;
  if (deviceTier() === "low") return true;
  try {
    const c = document.createElement("canvas");
    return !(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return true;
  }
}

export const TIERS: Tier[] = ["first", "aura", "glow", "regular"];
