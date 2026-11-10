/**
 * Ranking rewards: digital badges and cosmetics only. No money, payouts or
 * profit promises. NFT minting is optional and not part of Phase 1.
 */
export type RewardKind = "ranking_badge" | "festival_achievement" | "avatar_cosmetic" | "featured_placement" | "community_trophy";

export interface RewardDef {
  id: string;
  kind: RewardKind;
  name: string;
  desc: string;
  who: "event" | "user";
}

export const REWARDS: RewardDef[] = [
  { id: "badge_top1", kind: "ranking_badge", name: "World #1 Badge", desc: "Events that reached #1 in any ranking", who: "event" },
  { id: "featured_top3", kind: "featured_placement", name: "Featured Placement", desc: "TOP 3 events are featured on the home page", who: "event" },
  { id: "early_backer", kind: "festival_achievement", name: "Early Backer", desc: "An event you supported entered the TOP 10", who: "user" },
  { id: "trend_spotter", kind: "community_trophy", name: "Trend Spotter", desc: "An event you follow entered the TRENDING TOP 10", who: "user" },
  { id: "podium_crown", kind: "avatar_cosmetic", name: "Podium Crown (avatar)", desc: "An event you supported entered the MOST POPULAR TOP 3", who: "user" },
];

/** User rewards earned from this browser's demo activity. */
export function earnedRewards(input: { supported: string[]; followed: string[]; popularTop10: string[]; popularTop3: string[]; trendingTop10: string[] }) {
  const has = (list: string[], ids: string[]) => ids.some((id) => list.includes(id));
  return {
    early_backer: has(input.popularTop10, input.supported),
    trend_spotter: has(input.trendingTop10, input.followed),
    podium_crown: has(input.popularTop3, input.supported),
  } as Record<string, boolean>;
}
