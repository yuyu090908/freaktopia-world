/**
 * FESTIVAL GROWTH LEVELS for the world map.
 *
 * The map level is a visual game level for the landmark. It is NOT the venue's capacity and it
 * never says more people can attend. It is computed from separate inputs:
 *   - valid supporters (unique, after anti-fraud)
 *   - staking participants (people, not money; staking principal is never counted as budget)
 *   - secured funding (USD actually confirmed for the event budget)
 *   - venue contract signed
 *   - organizer-approved preparation items
 *
 * Thresholds are data (GrowthConfig) so an admin can change them: /world/levels in the demo,
 * the `event_growth_levels` table in production.
 */
import type { EventLevel } from "@/lib/types";

export interface GrowthThreshold {
  level: EventLevel;
  name: string;
  /** What the landmark shows at this level (visual only). */
  visual: string;
  supporters: number;
  fundingUsd: number;
  stakers: number;
  venueContract: boolean;
  approvals: number;
}

export interface GrowthConfig {
  version: number;
  levels: GrowthThreshold[]; // index 0 = level 1
}

export interface GrowthInputs {
  supporters: number;
  stakers: number;
  fundingUsd: number;
  venueContract: boolean;
  approvals: number;
}

export const LEVEL_COLORS: Record<EventLevel, string> = { 1: "#55BCEB", 2: "#B6F05C", 3: "#FFAD5B", 4: "#FF625C", 5: "#A276E9" };

export const DEFAULT_GROWTH_CONFIG: GrowthConfig = {
  version: 1,
  levels: [
    { level: 1, name: "SEED", visual: "A small DJ booth and one speaker", supporters: 0, fundingUsd: 0, stakers: 0, venueContract: false, approvals: 0 },
    { level: 2, name: "GATHERING", visual: "Speaker stacks, flags and decorations", supporters: 150, fundingUsd: 3000, stakers: 0, venueContract: false, approvals: 0 },
    { level: 3, name: "RAVE", visual: "A stage with a roof, lights and a crowd", supporters: 600, fundingUsd: 15000, stakers: 0, venueContract: true, approvals: 0 },
    { level: 4, name: "MEGA FEST", visual: "A big stage, a giant alien and a second area", supporters: 2500, fundingUsd: 60000, stakers: 10, venueContract: true, approvals: 1 },
    { level: 5, name: "FREAKTOPIA LEGEND", visual: "Special architecture, a giant venue and its own animation", supporters: 9000, fundingUsd: 220000, stakers: 20, venueContract: true, approvals: 2 },
  ],
};

export type RequirementKey = "supporters" | "fundingUsd" | "stakers" | "venueContract" | "approvals";

export interface Requirement {
  key: RequirementKey;
  label: string;
  have: number;
  need: number;
  met: boolean;
  pct: number;
}

export interface GrowthResult {
  level: EventLevel;
  name: string;
  visual: string;
  next: GrowthThreshold | null;
  /** Requirements for the next level, each on its own. */
  requirements: Requirement[];
  /** Progress to the next level: the weakest requirement. */
  pct: number;
}

const LABELS: Record<RequirementKey, string> = {
  supporters: "Valid supporters",
  fundingUsd: "Secured funding (USD)",
  stakers: "Staking participants",
  venueContract: "Venue contract",
  approvals: "Approved prep items",
};

export function meets(inp: GrowthInputs, t: GrowthThreshold) {
  return inp.supporters >= t.supporters && inp.fundingUsd >= t.fundingUsd && inp.stakers >= t.stakers && (!t.venueContract || inp.venueContract) && inp.approvals >= t.approvals;
}

export function requirementsFor(inp: GrowthInputs, t: GrowthThreshold): Requirement[] {
  const r = (key: RequirementKey, have: number, need: number): Requirement => ({ key, label: LABELS[key], have, need, met: have >= need, pct: need <= 0 ? 1 : Math.max(0, Math.min(1, have / need)) });
  const list = [r("supporters", inp.supporters, t.supporters), r("fundingUsd", inp.fundingUsd, t.fundingUsd)];
  if (t.stakers > 0) list.push(r("stakers", inp.stakers, t.stakers));
  if (t.venueContract) list.push(r("venueContract", inp.venueContract ? 1 : 0, 1));
  if (t.approvals > 0) list.push(r("approvals", inp.approvals, t.approvals));
  return list;
}

/** Highest level whose every requirement is met (levels are cumulative: you can't skip one). */
export function computeFestivalLevel(inp: GrowthInputs, cfg: GrowthConfig = DEFAULT_GROWTH_CONFIG): GrowthResult {
  const levels = normalizeConfig(cfg).levels;
  let idx = 0;
  for (let i = 1; i < levels.length; i++) {
    if (meets(inp, levels[i])) idx = i;
    else break;
  }
  const cur = levels[idx];
  const next = levels[idx + 1] ?? null;
  const requirements = next ? requirementsFor(inp, next) : [];
  return { level: cur.level, name: cur.name, visual: cur.visual, next, requirements, pct: next ? Math.min(...requirements.map((x) => x.pct)) : 1 };
}

/** Clamp an edited config into a valid one: non-negative numbers, thresholds never decrease by level. */
export function normalizeConfig(cfg: GrowthConfig): GrowthConfig {
  const base = DEFAULT_GROWTH_CONFIG.levels;
  const levels = base.map((d, i) => {
    const c = cfg.levels?.[i] ?? d;
    const n = (v: unknown, fb: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : fb);
    return {
      ...d,
      name: typeof c.name === "string" && c.name.trim() ? c.name.trim().slice(0, 32) : d.name,
      supporters: i === 0 ? 0 : n(c.supporters, d.supporters),
      fundingUsd: i === 0 ? 0 : n(c.fundingUsd, d.fundingUsd),
      stakers: i === 0 ? 0 : n(c.stakers, d.stakers),
      venueContract: i === 0 ? false : !!c.venueContract,
      approvals: i === 0 ? 0 : n(c.approvals, d.approvals),
    };
  });
  for (let i = 1; i < levels.length; i++) {
    const p = levels[i - 1];
    const l = levels[i];
    l.supporters = Math.max(l.supporters, p.supporters);
    l.fundingUsd = Math.max(l.fundingUsd, p.fundingUsd);
    l.stakers = Math.max(l.stakers, p.stakers);
    l.approvals = Math.max(l.approvals, p.approvals);
    l.venueContract = l.venueContract || p.venueContract;
  }
  return { version: cfg.version ?? 1, levels };
}

export function validateConfig(cfg: GrowthConfig): string[] {
  const errs: string[] = [];
  cfg.levels.forEach((l, i) => {
    if (i === 0) return;
    const p = cfg.levels[i - 1];
    (["supporters", "fundingUsd", "stakers", "approvals"] as const).forEach((k) => {
      if (!(l[k] >= 0)) errs.push(`Level ${l.level}: ${LABELS[k]} must be 0 or more`);
      else if (l[k] < p[k]) errs.push(`Level ${l.level}: ${LABELS[k]} is lower than level ${p.level}`);
    });
  });
  return errs;
}
