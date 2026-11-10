"use client";

/**
 * Browser side of the live festival: API calls and the LiveRoom sync hook.
 *
 * Transport: HTTP polling against /api/live/:eventId/room (demo). The hook hides the transport
 * behind a small interface (state + send), so production can swap it for a WebSocket / LiveKit data
 * channel without touching the UI. It:
 *  - polls every 2.5s while visible, 15s when the tab is hidden (battery)
 *  - backs off exponentially on errors (max 30s) and resumes on `online`
 *  - passes `since` (last event seq) so the server only returns new realtime events
 *  - syncs one zone at a time: full avatars for the viewer's zone, counts for the others
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AlienLook } from "@/lib/types";
import type { DanceMove, Emote, LiveStatus, Quest, ReactionKind, RealtimeEvent, StreamRights, ZoneId } from "./types";

export interface LiveError {
  code: string;
  message: string;
  issues?: { path: string; message: string }[];
}

/*
 * The anonymous live identity is an HttpOnly cookie set by the first API response. Requests wait
 * for that first response, so parallel calls can't each mint a different identity (which would
 * also let one person get around the per-person reaction limit).
 */
let firstCall: Promise<unknown> | null = null;
let identityReady = false;

export async function liveApi<T = Record<string, unknown>>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<{ ok: true; data: T; status: number } | { ok: false; error: LiveError; status: number }> {
  const { json, ...rest } = init;
  if (!identityReady && firstCall) await firstCall.catch(() => {});
  try {
    const req = fetch(`/api/live${path ? "/" + path : ""}`, {
      ...rest,
      credentials: "same-origin",
      headers: json !== undefined ? { "content-type": "application/json", ...(rest.headers ?? {}) } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
    if (!identityReady && !firstCall) firstCall = req.then((r) => { if (r.ok || r.status < 500) identityReady = true; else firstCall = null; });
    const res = await req;
    const body = (await res.json().catch(() => ({}))) as { error?: LiveError };
    if (!res.ok) return { ok: false, error: body.error ?? { code: "HTTP_" + res.status, message: "Request failed." }, status: res.status };
    return { ok: true, data: body as T, status: res.status };
  } catch {
    return { ok: false, error: { code: "NETWORK", message: "Network error. Check your connection." }, status: 0 };
  }
}

export function useLiveQuery<T>(path: string | null) {
  const [state, setState] = useState<{ status: "loading" } | { status: "ok"; data: T } | { status: "error"; error: LiveError; httpStatus: number }>({ status: "loading" });
  const seq = useRef(0);
  const load = useCallback(
    async (quiet = false) => {
      if (path === null) return;
      const n = ++seq.current;
      if (!quiet) setState({ status: "loading" });
      const r = await liveApi<T>(path);
      if (n !== seq.current) return;
      setState(r.ok ? { status: "ok", data: r.data } : { status: "error", error: r.error, httpStatus: r.status });
    },
    [path],
  );
  useEffect(() => {
    void load();
  }, [load]);
  return { state, reload: load };
}

/* ---------------- response shapes ---------------- */

export interface DiscoveryEvent {
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  approximateLocation: boolean;
  venue: string | null;
  genres: string[];
  startsAt: string;
  endsAt: string;
  tz: string;
  status: LiveStatus;
  currentDj: { id: string; name: string } | null;
  attendance: { ticketsSold: number; checkedIn: number; publicAvatars: number; onlineViewers: number; demo: boolean };
  supporters: number;
  afterParty: { id: string; name: string; startsAt: string; venue: string } | null;
  djAudition: boolean;
  dao: boolean;
}

export interface Discovery {
  mode: "demo" | "production";
  asOf: number;
  realLiveCount: number;
  featured: string | null;
  demoLive: string[];
  nextUp: string[];
  events: DiscoveryEvent[];
}

export interface DjCard {
  id: string;
  name: string;
  genres: string[];
  look: AlienLook;
  city: string;
}

export interface LiveSet {
  id: string;
  stageId: string;
  djId: string;
  localStart: string;
  localEnd: string;
  startAt: number;
  endAt: number;
  dj: DjCard;
}

export interface LiveDetail {
  event: { id: string; name: string; city: string; country: string; genres: string[]; startsAt: string; endsAt: string; venueId: string; venue: string | null; capacity: number; organizer: string; palette: string[]; isDemo: boolean; lat: number; lng: number };
  status: LiveStatus;
  tz: string;
  clock: { demo: boolean; now: number; anchor: number | null };
  stages: { id: string; name: string; zone: string }[];
  sets: LiveSet[];
  streams: { stageId: string; provider: string; live: boolean; rights: StreamRights; qualities: string[]; recordingAllowed: boolean }[];
  afterParty: null | { id: string; name: string; startsAt: string; endsAt: string; venueName: string; city: string; price: number; capacity: number; seatsLeft: number; description: string; dj: DjCard[]; confirmed: boolean; online: boolean };
  attendance: { ticketsSold: number; checkedIn: number; currentlyPresent: number | null; onlineViewers: number; publicAvatars: number; doorDemo: { ticketsSold: number; checkedIn: number; currentlyPresent: number; presenceTracked: boolean }; demo: boolean; note: string };
  quests: Quest[];
  mode: string;
}

export interface RoomAvatar {
  id: string;
  name: string;
  look: AlienLook;
  zone: ZoneId;
  dance: DanceMove;
  emote: Emote;
  friend: boolean;
  demo: boolean;
  presence: "online" | "onsite_verified";
}

export interface RoomChat {
  id: string;
  authorId: string;
  name: string;
  look: AlienLook;
  badge: "dj" | "organizer" | "moderator" | null;
  body: string;
  hidden: boolean;
  replyTo: string | null;
  at: number;
  mine: boolean;
  demo: boolean;
}

export interface RoomView {
  live: true;
  seq: number;
  serverTime: number;
  energy: number;
  level: string;
  zoneCounts: Record<ZoneId, number>;
  avatars: RoomAvatar[];
  chat: RoomChat[];
  reactions: Record<ReactionKind, number>;
  events: (RealtimeEvent & { seq: number })[];
  onlineViewers: number;
  publicAvatars: number;
  you: { id: string; zone: ZoneId; visibility: string } | null;
  demo: true;
}

export type Connection = "connecting" | "live" | "reconnecting" | "offline";

/** Per-event room sync (see file header). `onEvents` receives new realtime events in order. */
export function useLiveRoom(eventId: string | null, zone: ZoneId, onEvents?: (ev: RoomView["events"]) => void) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [conn, setConn] = useState<Connection>("connecting");
  const since = useRef(0);
  const fails = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoneRef = useRef(zone);
  const cb = useRef(onEvents);
  cb.current = onEvents;
  zoneRef.current = zone;

  const pull = useCallback(async () => {
    if (!eventId) return;
    if (timer.current) clearTimeout(timer.current);
    const r = await liveApi<RoomView | { live: false }>(`${eventId}/room?zone=${zoneRef.current}&since=${since.current}`);
    if (r.ok && "seq" in r.data) {
      const v = r.data;
      fails.current = 0;
      setConn("live");
      if (since.current && v.events.length) cb.current?.(v.events);
      since.current = v.seq;
      setRoom(v);
    } else if (r.ok) {
      setConn("live");
    } else {
      fails.current += 1;
      setConn(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "reconnecting");
    }
    const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    const base = hidden ? 15_000 : 2500;
    const wait = fails.current ? Math.min(30_000, base * 2 ** Math.min(4, fails.current)) : base;
    timer.current = setTimeout(() => void pull(), wait);
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    since.current = 0;
    void pull();
    const wake = () => {
      fails.current = 0;
      void pull();
    };
    const vis = () => document.visibilityState === "visible" && wake();
    const off = () => setConn("offline");
    window.addEventListener("online", wake);
    window.addEventListener("offline", off);
    document.addEventListener("visibilitychange", vis);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("online", wake);
      window.removeEventListener("offline", off);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [eventId, pull]);

  // A zone change re-syncs immediately (zone-level subscription).
  useEffect(() => {
    if (eventId) void pull();
  }, [zone, eventId, pull]);

  return { room, conn, refresh: pull };
}

export const fmtCount = (n: number) => n.toLocaleString("en-US");
