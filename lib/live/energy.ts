/**
 * LIVE ENERGY: a game metric (0-100) built from participation signals.
 * It is NOT a measurement of how excited a real crowd is, and the UI says so.
 */
import type { EnergyInput, EnergyLevelKey, ReactionKind } from "./types";

export const ENERGY_LEVELS: { key: EnergyLevelKey; label: string; min: number; color: string }[] = [
  { key: "WARM_UP", label: "WARM UP", min: 0, color: "#55BCEB" },
  { key: "GROOVE", label: "GROOVE", min: 25, color: "#B6F05C" },
  { key: "BUILD_UP", label: "BUILD UP", min: 50, color: "#FFAD5B" },
  { key: "PEAK_TIME", label: "PEAK TIME", min: 75, color: "#FF625C" },
  { key: "ALIEN_INVASION", label: "ALIEN INVASION", min: 95, color: "#A276E9" },
];

export const levelFor = (energy: number) => [...ENERGY_LEVELS].reverse().find((l) => energy >= l.min)!;

const sat = (x: number, k: number) => 1 - Math.exp(-Math.max(0, x) / Math.max(1e-9, k));

/** Raw energy target from the last window's signals (0-100). */
export function energyTarget(i: EnergyInput) {
  const active = Math.max(0, i.activeParticipants);
  if (active === 0) return 0;
  const crowd = sat(active, 120);
  const reacts = sat(i.validReactions, Math.max(10, active * 0.5));
  const quests = sat(i.questCompletions, Math.max(3, active * 0.08));
  const stay = Math.min(1, i.setParticipants / active);
  return Math.round(100 * Math.min(1, 0.3 * crowd + 0.4 * reacts + 0.1 * quests + 0.2 * stay));
}

/** Smooth toward the target so a burst can't spike the meter (max ±step per tick). */
export function stepEnergy(current: number, target: number, step = 6) {
  const d = Math.max(-step, Math.min(step, target - current));
  return Math.max(0, Math.min(100, Math.round(current + d)));
}

/** Per-user reaction limiter: each person counts at most `max` reactions per window toward energy. */
export class ReactionLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private max = 6,
    private windowMs = 60_000,
  ) {}
  /** true = counts toward energy; false = shown locally but not counted. */
  allow(userId: string, now: number) {
    const list = (this.hits.get(userId) ?? []).filter((t) => now - t < this.windowMs);
    const ok = list.length < this.max;
    if (ok) list.push(now);
    this.hits.set(userId, list);
    if (this.hits.size > 50_000) this.hits.delete(this.hits.keys().next().value as string);
    return ok;
  }
  countSince(since: number) {
    let n = 0;
    for (const l of this.hits.values()) n += l.filter((t) => t >= since).length;
    return n;
  }
}

export const REACTION_META: Record<ReactionKind, { label: string; emoji: string; color: string }> = {
  fire: { label: "FIRE", emoji: "🔥", color: "#FF625C" },
  love: { label: "LOVE", emoji: "💚", color: "#B6F05C" },
  bass: { label: "BASS", emoji: "🔊", color: "#55BCEB" },
  alien: { label: "ALIEN", emoji: "👽", color: "#A276E9" },
  hands: { label: "HANDS UP", emoji: "🙌", color: "#FFAD5B" },
};
