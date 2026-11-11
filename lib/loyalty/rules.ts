/**
 * FREAK LOYALTY rules (Phase 1). Pure functions shared by the server (source of truth) and the UI (display only).
 *
 * - The rank comes from the number of VERIFIED events the person attended (lib/party: own door check-in, event ended,
 *   not cancelled, ≥ 3 QR check-ins). Buying a ticket, holding someone else's ticket or an RSVP never counts.
 * - The discount applies ONLY to the FREAKTOPIA platform fee. Ticket price, payment-provider fees, taxes and external
 *   fees are never discounted.
 * - Money is calculated in cents to avoid rounding drift.
 */
export const RANKS = ["rookie", "explorer", "raver", "elite", "legend"] as const;
export type Rank = (typeof RANKS)[number];

export interface RankRule {
  rank: Rank;
  /** Verified events needed. */
  min: number;
  /** Discount on the platform fee, 0–100 %. */
  discountPct: number;
}

export interface LoyaltyRules {
  version: number;
  /** FREAKTOPIA platform fee as a share of the ticket subtotal, in %. */
  feeRatePct: number;
  ranks: RankRule[];
  /** Hard cap on any discount, in %. */
  maxDiscountPct: number;
  /** The platform fee never goes below this (USD), unless the fee itself is smaller. */
  minFeeUsd: number;
  /**
   * A 100 % discount is only applied when the platform has confirmed it can afford it. Until then a rank set to 100 %
   * gets the best discount below 100 % instead, and the UI says so.
   */
  fullDiscountEnabled: boolean;
}

/** Initial design from the spec. Must be checked for profitability before launch; admins can change it. */
export const DEFAULT_RULES: LoyaltyRules = {
  version: 1,
  feeRatePct: 5,
  ranks: [
    { rank: "rookie", min: 0, discountPct: 0 },
    { rank: "explorer", min: 3, discountPct: 20 },
    { rank: "raver", min: 6, discountPct: 40 },
    { rank: "elite", min: 15, discountPct: 60 },
    { rank: "legend", min: 30, discountPct: 100 },
  ],
  maxDiscountPct: 100,
  minFeeUsd: 0,
  fullDiscountEnabled: false,
};

/** Throws a short code when the rules are inconsistent. */
export function validateRules(r: LoyaltyRules) {
  if (!(r.feeRatePct >= 0 && r.feeRatePct <= 30)) throw new Error("FEE_RATE");
  if (!(r.maxDiscountPct >= 0 && r.maxDiscountPct <= 100)) throw new Error("MAX_DISCOUNT");
  if (!(r.minFeeUsd >= 0 && r.minFeeUsd <= 100)) throw new Error("MIN_FEE");
  if (r.ranks.length !== RANKS.length || r.ranks.some((x, i) => x.rank !== RANKS[i])) throw new Error("RANK_ORDER");
  if (r.ranks[0].min !== 0) throw new Error("ROOKIE_MIN");
  for (let i = 0; i < r.ranks.length; i++) {
    const x = r.ranks[i];
    if (!Number.isInteger(x.min) || x.min < 0 || x.min > 10_000) throw new Error("MIN");
    if (!(x.discountPct >= 0 && x.discountPct <= 100)) throw new Error("DISCOUNT");
    if (i > 0 && x.min <= r.ranks[i - 1].min) throw new Error("MIN_ORDER");
    if (i > 0 && x.discountPct < r.ranks[i - 1].discountPct) throw new Error("DISCOUNT_ORDER");
  }
}

export function rankFor(verifiedEvents: number, rules: LoyaltyRules): RankRule {
  let cur = rules.ranks[0];
  for (const r of rules.ranks) if (verifiedEvents >= r.min) cur = r;
  return cur;
}

export function nextRankOf(verifiedEvents: number, rules: LoyaltyRules) {
  const next = rules.ranks.find((r) => r.min > verifiedEvents) ?? null;
  return next ? { rank: next.rank, min: next.min, remaining: next.min - verifiedEvents } : null;
}

/** 0–1 progress from the current rank's threshold to the next one (1 at the top rank). */
export function progressOf(verifiedEvents: number, rules: LoyaltyRules) {
  const cur = rankFor(verifiedEvents, rules);
  const next = nextRankOf(verifiedEvents, rules);
  if (!next) return 1;
  return Math.max(0, Math.min(1, (verifiedEvents - cur.min) / (next.min - cur.min)));
}

/** The discount actually applied for a rank, after the 100 % gate and the cap. */
export function effectiveDiscountPct(rank: Rank, rules: LoyaltyRules) {
  const r = rules.ranks.find((x) => x.rank === rank)!;
  let pct = r.discountPct;
  if (pct >= 100 && !rules.fullDiscountEnabled) pct = Math.max(0, ...rules.ranks.filter((x) => x.discountPct < 100).map((x) => x.discountPct));
  return Math.min(pct, rules.maxDiscountPct);
}

/** True when the rank is configured for 100 % but the platform has not switched it on yet. */
export const fullDiscountPending = (rank: Rank, rules: LoyaltyRules) =>
  !rules.fullDiscountEnabled && (rules.ranks.find((x) => x.rank === rank)?.discountPct ?? 0) >= 100;

export interface FeeBreakdown {
  /** Ticket price total (never discounted). */
  ticketsCents: number;
  regularFeeCents: number;
  discountCents: number;
  finalFeeCents: number;
  /** Tickets + final platform fee. Payment-provider fees and taxes are not included. */
  totalCents: number;
  rank: Rank;
  discountPct: number;
  feeRatePct: number;
  rulesVersion: number;
}

const cents = (usd: number) => Math.round(usd * 100);

export function feeBreakdown(ticketsUsd: number, rank: Rank, rules: LoyaltyRules): FeeBreakdown {
  const ticketsCents = Math.max(0, cents(ticketsUsd));
  const regularFeeCents = Math.round((ticketsCents * rules.feeRatePct) / 100);
  const discountPct = effectiveDiscountPct(rank, rules);
  const floor = Math.min(regularFeeCents, cents(rules.minFeeUsd));
  const finalFeeCents = Math.max(floor, regularFeeCents - Math.round((regularFeeCents * discountPct) / 100));
  return {
    ticketsCents,
    regularFeeCents,
    discountCents: regularFeeCents - finalFeeCents,
    finalFeeCents,
    totalCents: ticketsCents + finalFeeCents,
    rank,
    discountPct,
    feeRatePct: rules.feeRatePct,
    rulesVersion: rules.version,
  };
}

/** True when switching from `cur` to `next` takes something away from anyone (needs notice + a future start date). */
export function reducesBenefits(cur: LoyaltyRules, next: LoyaltyRules) {
  if (next.feeRatePct > cur.feeRatePct || next.maxDiscountPct < cur.maxDiscountPct || next.minFeeUsd > cur.minFeeUsd) return true;
  if (cur.fullDiscountEnabled && !next.fullDiscountEnabled) return true;
  return next.ranks.some((r, i) => r.min > cur.ranks[i].min || r.discountPct < cur.ranks[i].discountPct);
}

/** Minimum notice before a rule change that reduces benefits takes effect. */
export const NOTICE_DAYS = 30;
