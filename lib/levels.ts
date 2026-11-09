import type { EventLevel } from "./types";

export interface LevelInfo {
  level: EventLevel;
  name: string;
  short: string;
  supporters: number; // required supporters to reach this level
  funding: number; // required funding (USD) to reach this level
  color: string;
  description: string;
}

export const LEVELS: LevelInfo[] = [
  { level: 1, name: "DJ BOOTH", short: "Booth", supporters: 0, funding: 0, color: "#55BCEB", description: "A tiny booth and one brave speaker. Every legend starts here." },
  { level: 2, name: "CLUB", short: "Club", supporters: 150, funding: 3000, color: "#B6F05C", description: "Four walls, a disco ball and a proper sound system." },
  { level: 3, name: "RAVE", short: "Rave", supporters: 600, funding: 15000, color: "#FFAD5B", description: "Speaker stacks, lasers and a crowd that won’t go home." },
  { level: 4, name: "FESTIVAL", short: "Fest", supporters: 2500, funding: 60000, color: "#FF625C", description: "A full festival stage with screens, flags and multiple acts." },
  { level: 5, name: "MEGA FEST", short: "Mega", supporters: 9000, funding: 220000, color: "#A276E9", description: "A city-sized spectacle. The alien mothership is watching." },
];

/** Level = highest level where BOTH supporter and funding thresholds are met. */
export function levelFor(supporters: number, raised: number): EventLevel {
  let lv: EventLevel = 1;
  for (const l of LEVELS) {
    if (supporters >= l.supporters && raised >= l.funding) lv = l.level;
  }
  return lv;
}

export function levelInfo(level: EventLevel): LevelInfo {
  return LEVELS[level - 1];
}

/** Progress (0–1) toward the next level, limited by the weaker of the two metrics. */
export function progressToNext(supporters: number, raised: number) {
  const level = levelFor(supporters, raised);
  if (level === 5) return { level, next: null as LevelInfo | null, pct: 1, supportersPct: 1, fundingPct: 1 };
  const cur = LEVELS[level - 1];
  const next = LEVELS[level];
  const sp = clamp01((supporters - cur.supporters) / (next.supporters - cur.supporters));
  const fp = clamp01((raised - cur.funding) / (next.funding - cur.funding));
  return { level, next, pct: Math.min(sp, fp), supportersPct: sp, fundingPct: fp };
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** User level from XP: each level needs 250 more XP than the last. */
export function userLevel(xp: number) {
  let level = 1;
  let need = 250;
  let floor = 0;
  while (xp >= floor + need) {
    floor += need;
    level += 1;
    need += 250;
  }
  return { level, intoLevel: xp - floor, need, pct: (xp - floor) / need };
}
