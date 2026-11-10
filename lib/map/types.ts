import type { EventLevel, Genre } from "@/lib/types";
import type { GrowthConfig, GrowthInputs } from "./growth";
import type { LandmarkType, MapStatus } from "./landmarks";

export type LocationPrecision = "exact" | "city";
export type RankBadge = "champion" | "runner_up" | "featured";

export interface MapEventDto {
  id: string;
  name: string;
  city: string;
  country: string;
  venue: string | null;
  location: { lat: number; lng: number; precision: LocationPrecision };
  startsAt: string;
  endsAt: string;
  genres: Genre[];
  lineup: { id: string; name: string }[];
  palette: [string, string, string];
  status: MapStatus;
  /** Inputs for the festival level, each kept separate. */
  growth: GrowthInputs;
  goalUsd: number;
  /** Level with the server's default thresholds (the client recomputes with the admin config). */
  level: EventLevel;
  landmark: {
    type: LandmarkType;
    /** Where the landmark colours come from. */
    theme: "event" | "dao_approved";
    approvedDesign: { conceptId: string; name: string } | null;
  };
  ranking: {
    rank: number | null;
    badge: RankBadge | null;
    category: "popular";
    period: "all";
    trendingRank: number | null;
    trendingGrowth: number | null;
    trendingPeriod: "7d";
    asOf: string;
  };
  dao: {
    status: string;
    members: number;
    stakers: number;
    /** Staked demo tokens. Escrowed, never counted as event budget. */
    staked: number;
    tokenSymbol: string;
    activeProposals: number;
    openVotes: number;
    activeVote: string | null;
    participationRate: number;
    /** Community decoration tier from members (decoration only). */
    tier: 0 | 1 | 2 | 3;
  } | null;
  live: {
    status: "demo_live" | "live";
    currentDj: { id: string; name: string } | null;
    onlineViewers: number;
    checkedIn: number;
    publicAvatars: number;
    ticketsSold: number;
    demo: boolean;
  } | null;
  tickets: { onSale: boolean; remaining: number; fromUsd: number | null; demo: true };
  djRecruiting: boolean;
  afterParty: { id: string; name: string; startsAt: string; venue: string } | null;
  updatedAt: string;
  isDemo: boolean;
  /** Who runs the event. `handle` links to their party world; sample events have fictional organizers without one. */
  organizer?: { name: string; handle: string | null; demo: boolean };
}

export interface WorldMapResponse {
  mode: "demo" | "production";
  asOf: string;
  growthConfig: GrowthConfig;
  events: MapEventDto[];
  notes: string[];
}
