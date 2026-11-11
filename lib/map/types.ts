import type { EventLevel, Genre } from "@/lib/types";
import type { GrowthConfig, GrowthInputs } from "./growth";
import type { LandmarkType, MapStatus } from "./landmarks";
import type { EventCategory, ExternalStatus, SourceType, VerificationStatus } from "@/lib/discovery/types";

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
  /**
   * "sample" = fictional demo listing; "community" = a party an organizer published (lib/party);
   * "external" = an event from a connected, approved outside source (lib/discovery). External events link out only.
   */
  source?: "sample" | "community" | "external";
  /** Provenance of an external event (shown in the panel: source, last verified, approximate location). */
  external?: ExternalInfo;
  /** Where "view event" goes when it is not /events/[id] (community parties open in their organizer's world). */
  href?: string;
}

export interface ExternalInfo {
  sourceType: SourceType;
  sourceName: string;
  sourceEventId: string;
  sourceUrl: string | null;
  officialUrl: string | null;
  ticketUrl: string | null;
  category: EventCategory;
  verificationStatus: VerificationStatus;
  externalStatus: ExternalStatus;
  lastVerifiedAt: string;
  lastSyncedAt: string;
  venueTimezone: string | null;
  timeTbd: boolean;
  imageUrl: string | null;
  /** The source's own genre words (the map's genre list is FREAKTOPIA's). */
  genres: string[];
  priceRange: { min: number; max: number; currency: string } | null;
}

export interface WorldMapResponse {
  mode: "demo" | "production";
  asOf: string;
  growthConfig: GrowthConfig;
  events: MapEventDto[];
  notes: string[];
}
