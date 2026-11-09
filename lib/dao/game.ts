/**
 * Festival Build Game + XP.
 * Game progress is separate from real-world construction progress: it reflects DAO
 * decisions, never certifies that anything was built.
 */
import { DAO_RULES } from "./meta";
import type { BadgeId, DaoMembership, EventDao, Milestone, Proposal, VenuePhoto } from "./types";

export type XpAction = keyof typeof DAO_RULES.xp.cooldownMs;

export interface XpEvent {
  uid: string;
  daoId: string;
  action: XpAction;
  at: number;
  contentHash?: string;
  target?: string;
  xp: number;
}

/**
 * Anti-spam XP: minimum length, no duplicate content, per-action cooldown,
 * one award per target (e.g. per vote), daily cap and frozen XP for flagged accounts.
 */
export function xpFor(
  log: XpEvent[],
  m: DaoMembership,
  action: XpAction,
  now: number,
  opts: { contentHash?: string; target?: string; length?: number } = {},
): { xp: number; reason?: string } {
  if (m.flagged) return { xp: 0, reason: "FLAGGED_ACCOUNT" };
  const mine = log.filter((e) => e.uid === m.uid && e.daoId === m.daoId);
  if (action === "discussion" && (opts.length ?? 0) < DAO_RULES.minPostChars) return { xp: 0, reason: "TOO_SHORT" };
  if (action === "comment" && (opts.length ?? 0) < 12) return { xp: 0, reason: "TOO_SHORT" };
  if (opts.contentHash && mine.some((e) => e.contentHash === opts.contentHash)) return { xp: 0, reason: "DUPLICATE_CONTENT" };
  if (opts.target && mine.some((e) => e.action === action && e.target === opts.target)) return { xp: 0, reason: "ALREADY_AWARDED" };
  const cd = DAO_RULES.xp.cooldownMs[action];
  const last = mine.filter((e) => e.action === action && e.xp > 0).at(-1);
  if (cd && last && now - last.at < cd) return { xp: 0, reason: "COOLDOWN" };
  const today = mine.filter((e) => now - e.at < 86_400_000).reduce((s, e) => s + e.xp, 0);
  const base = DAO_RULES.xp[action];
  const xp = Math.max(0, Math.min(base, DAO_RULES.xp.dailyCap - today));
  return xp ? { xp } : { xp: 0, reason: "DAILY_CAP" };
}

export function badgesFor(m: DaoMembership, log: XpEvent[], dao: EventDao, firstVoteStart: number | null): BadgeId[] {
  const mine = log.filter((e) => e.uid === m.uid && e.daoId === m.daoId && e.xp > 0);
  const out = new Set<BadgeId>(m.badges);
  if (mine.filter((e) => e.action === "comment" || e.action === "discussion").length >= 5) out.add("community");
  if (mine.some((e) => e.action === "concept")) out.add("designer");
  if (mine.filter((e) => e.action === "vote").length >= 3) out.add("voter");
  if (dao.status === "forming" || (firstVoteStart !== null && m.joinedAt < firstVoteStart)) out.add("founder");
  if (m.xp >= 100) out.add("cosmetic_antenna");
  return [...out];
}

export function gameLevel(dao: EventDao, photos: VenuePhoto[], proposals: Proposal[], milestones: Milestone[], eventStatus: string) {
  const designWon = proposals.some((p) => (p.category === "stage_design" || p.conceptIds.length > 0) && ["APPROVED", "FEASIBILITY_CHECK", "ORGANIZER_CONFIRMATION", "EXECUTION", "COMPLETED"].includes(p.state));
  const building = proposals.some((p) => p.conceptIds.length > 0 && ["EXECUTION", "COMPLETED"].includes(p.state)) && milestones.some((m) => m.status === "doing" || m.status === "done");
  const venueOk = photos.some((p) => p.rights.status !== "rejected");
  let level = 1;
  if (venueOk) level = 2;
  if (venueOk && designWon) level = 3;
  if (level === 3 && building) level = 4;
  if (level >= 2 && (eventStatus === "live" || eventStatus === "ended" || dao.status === "festival")) level = Math.max(level, 5);
  return level as 1 | 2 | 3 | 4 | 5;
}
