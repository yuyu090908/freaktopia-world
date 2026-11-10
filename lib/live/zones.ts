/**
 * Festival map: 10 zones on an isometric tile grid. Everything on the map is stored in
 * grid coordinates (gx, gy in tiles) and projected at render time, so objects, avatars
 * and hit areas stay coordinate-based and resolution independent.
 */
import type { ZoneId } from "./types";

export const TILE_W = 64;
export const TILE_H = 32;
export const GRID = 15;

export interface ZoneDef {
  id: ZoneId;
  name: string;
  short: string;
  color: string;
  /** footprint in tiles */
  gx: number;
  gy: number;
  w: number;
  h: number;
  /** avatars dance here instead of idling */
  dance: boolean;
  /** building height in px for the 2.5D block */
  height: number;
  desc: string;
}

export const ZONES: ZoneDef[] = [
  { id: "main", name: "Main Stage", short: "MAIN", color: "#FF625C", gx: 0, gy: 0, w: 7, h: 4, dance: true, height: 54, desc: "The big rig. Live stream, current DJ and the full timetable." },
  { id: "second", name: "Second Stage", short: "STAGE 2", color: "#A276E9", gx: 8, gy: 0, w: 6, h: 4, dance: true, height: 40, desc: "Deeper cuts and B2B sets." },
  { id: "dancefloor", name: "Dancefloor", short: "FLOOR", color: "#B6F05C", gx: 0, gy: 5, w: 7, h: 3, dance: true, height: 4, desc: "Where avatars dance. Reactions here push the energy meter." },
  { id: "vip", name: "VIP Area", short: "VIP", color: "#FFAD5B", gx: 8, gy: 5, w: 6, h: 3, dance: false, height: 22, desc: "Balcony view for VIP ticket holders (verified at the door)." },
  { id: "lounge", name: "Alien Lounge", short: "LOUNGE", color: "#55BCEB", gx: 8, gy: 9, w: 4, h: 3, dance: false, height: 26, desc: "Chill seats, slow tempo, chat with other aliens." },
  { id: "bar", name: "Bar", short: "BAR", color: "#FFAD5B", gx: 12, gy: 9, w: 2, h: 3, dance: false, height: 30, desc: "Drinks menu and water refill points (venue info)." },
  { id: "food", name: "Food Area", short: "FOOD", color: "#B6F05C", gx: 0, gy: 9, w: 3, h: 3, dance: false, height: 24, desc: "Food stalls and opening hours." },
  { id: "community", name: "Community Zone", short: "COMMUNITY", color: "#A276E9", gx: 4, gy: 9, w: 3, h: 3, dance: false, height: 18, desc: "Live chat, quests and the festival DAO." },
  { id: "entrance", name: "Entrance", short: "ENTRANCE", color: "#F5F2EA", gx: 4, gy: 13, w: 3, h: 2, dance: false, height: 34, desc: "Ticket check-in and venue rules." },
  { id: "portal", name: "After Party Portal", short: "PORTAL", color: "#A276E9", gx: 9, gy: 13, w: 4, h: 2, dance: false, height: 10, desc: "Jump to the after party: venue, time, tickets." },
];

export const zoneById = (id: string) => ZONES.find((z) => z.id === id) ?? ZONES[8];

/** Project tile coordinates to map pixels (origin at the grid's top corner). */
export function iso(gx: number, gy: number) {
  return { x: (gx - gy) * (TILE_W / 2), y: (gx + gy) * (TILE_H / 2) };
}

export const zoneCenter = (z: ZoneDef) => ({ gx: z.gx + z.w / 2, gy: z.gy + z.h / 2 });

/** Map bounds in pixels (for the viewBox). */
export const MAP_BOUNDS = (() => {
  const pts = [iso(0, 0), iso(GRID, 0), iso(0, GRID), iso(GRID, GRID)];
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const pad = 70;
  return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad * 1.6, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2.4 };
})();

/** Deterministic spot inside a zone for the i-th avatar (tile coords). */
export function spotIn(z: ZoneDef, i: number, seed = 0) {
  const r = (n: number) => {
    const x = Math.sin((i + 1) * 12.9898 + seed * 78.233 + n * 37.719) * 43758.5453;
    return x - Math.floor(x);
  };
  return { gx: z.gx + 0.5 + r(1) * (z.w - 1), gy: z.gy + 0.5 + r(2) * (z.h - 1) };
}

/** Walk path between zones through the central plaza (tile coords). */
export function walkPath(from: ZoneDef, to: ZoneDef) {
  const a = zoneCenter(from);
  const b = zoneCenter(to);
  const plaza = { gx: 7.5, gy: 8.5 };
  if (from.id === to.id) return [a, b];
  return [a, plaza, b];
}

export function pathLength(pts: { gx: number; gy: number }[]) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].gx - pts[i - 1].gx, pts[i].gy - pts[i - 1].gy);
  return d;
}

/** Point at fraction t (0..1) along a path. */
export function pointAt(pts: { gx: number; gy: number }[], t: number) {
  const total = pathLength(pts);
  let left = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].gx - pts[i - 1].gx, pts[i].gy - pts[i - 1].gy);
    if (left <= seg || i === pts.length - 1) {
      const f = seg ? Math.min(1, left / seg) : 1;
      return { gx: pts[i - 1].gx + (pts[i].gx - pts[i - 1].gx) * f, gy: pts[i - 1].gy + (pts[i].gy - pts[i - 1].gy) * f };
    }
    left -= seg;
  }
  return pts[pts.length - 1];
}
