/**
 * WORLD RANKING domain types.
 * Raw activity records mirror the production tables (see db/migrations):
 * event_supporters, tickets, event_attendance, payments, presence pings.
 * The engine only ever sees these records, never pre-baked totals.
 */
import type { EventLevel, EventStatus, Genre } from "@/lib/types";

export const RANKING_CATEGORIES = [
  "popular",
  "attended",
  "trending",
  "funded",
  "live",
  "dj_wanted",
  "after_party",
  "tickets",
  "for_you",
] as const;
export type RankingCategory = (typeof RANKING_CATEGORIES)[number];

export const RANKING_PERIODS = ["24h", "7d", "30d", "all"] as const;
export type RankingPeriod = (typeof RANKING_PERIODS)[number];

export const STATUS_FILTERS = ["upcoming", "live", "completed"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export type Currency = "USD" | "EUR" | "GBP" | "JPY";

/* ---------- raw records ---------- */

export interface SupporterRecord {
  eventId: string;
  userId: string;
  /** Wallets are attributes of a user, never counted as people. */
  walletAddress?: string;
  createdAt: number; // epoch ms
  /** Set by anti-fraud review. "held" = suspicious, excluded until reviewed. */
  fraud: "clear" | "bot" | "held";
  ipHash: string;
}

export interface TicketRecord {
  id: string;
  eventId: string;
  userId: string;
  kind: "main" | "afterparty" | "allnight" | "vip";
  soldAt: number;
  status: "valid" | "refunded" | "void" | "fraud";
}

export interface CheckInRecord {
  eventId: string;
  ticketId: string;
  userId: string;
  scannedAt: number;
}

export interface PresenceRecord {
  eventId: string;
  userId: string;
  lastSeenAt: number;
  checkedOut: boolean;
  /** User allowed their avatar to be shown on the live map. */
  avatarPublic: boolean;
  /** Profile not hidden / not under moderation. */
  profilePublic: boolean;
}

export interface PaymentRecord {
  id: string;
  eventId: string;
  userId: string;
  amount: number; // minor units are avoided in demo; major units here
  currency: Currency;
  status: "captured" | "pending" | "refunded" | "expired";
  createdAt: number;
}

export interface InterestRecord {
  eventId: string;
  userId: string;
  createdAt: number;
}

export interface FxRate {
  currency: Currency;
  /** 1 unit of `currency` in USD. */
  usd: number;
  asOf: string; // ISO
  source: string;
}

/** Event as the ranking engine needs it (subset of FreakEvent). */
export interface RankableEvent {
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  /** true when the venue is not confirmed: map shows city-level position. */
  approximateLocation: boolean;
  startsAt: string;
  endsAt: string;
  genres: Genre[];
  status: EventStatus;
  djRecruiting: boolean;
  afterParty?: { id: string; name: string; capacity: number; sold: number; price: number };
  minPrice: number;
  goal: number;
  lineup: string[];
  capacity: number;
  isDemo: boolean;
}

export interface EventActivity {
  supporters: SupporterRecord[];
  interests: InterestRecord[];
  tickets: TicketRecord[];
  checkIns: CheckInRecord[];
  presence: PresenceRecord[];
  payments: PaymentRecord[];
}

/* ---------- computed ---------- */

export interface EventMetrics {
  supporters_count: number;
  interested_count: number;
  tickets_sold: number;
  checked_in_count: number;
  currently_present_count: number;
  public_avatar_count: number;
  /** Secured funding converted to USD for comparison. */
  funding_usd: number;
  /** Secured funding kept per original currency. */
  funding_by_currency: Partial<Record<Currency, number>>;
  /** Supporters gained inside the period / at period start. */
  new_supporters: number;
  base_supporters: number;
  growth_rate: number; // smoothed, 0..n
  trending_score: number;
  excluded: { duplicate_supports: number; flagged_supports: number; invalid_tickets: number; uncaptured_payments: number; duplicate_scans: number };
}

export interface RankingFilters {
  q?: string;
  country?: string;
  city?: string;
  genre?: Genre;
  period: RankingPeriod;
  status?: StatusFilter;
  price?: "free" | "paid";
  level?: EventLevel;
  djRecruiting?: boolean;
  afterParty?: boolean;
}

export interface Personalization {
  genres: Genre[];
  cities: string[];
  djIds: string[];
  followedEventIds: string[];
}

export interface RankingQuery extends RankingFilters {
  category: RankingCategory;
  page: number;
  pageSize: number;
  personalization?: Personalization;
}

export interface RankedEntry {
  rank: number;
  previousRank: number | null;
  event: RankableEvent & { level: EventLevel };
  metrics: EventMetrics;
  score: number;
  primary: { key: keyof EventMetrics | "after_party_sold" | "match"; value: number };
  badges: string[];
}

export interface RankingResult {
  mode: "demo" | "production";
  category: RankingCategory;
  period: RankingPeriod;
  calculationVersion: string;
  generatedAt: string;
  asOf: string;
  refreshSeconds: number;
  fx: FxRate[];
  total: number;
  page: number;
  pageSize: number;
  items: RankedEntry[];
}
