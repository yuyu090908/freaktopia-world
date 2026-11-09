import type { Currency, FxRate, RankingPeriod } from "./types";

/**
 * All tunables for ranking calculation. Changing a value here changes
 * `CALCULATION_VERSION`'s meaning, so bump it when you edit coefficients.
 */
export const RANKING_CONFIG = {
  calculationVersion: "rk-1.0.0",
  /** How often rankings are recomputed / cached. */
  refreshSeconds: 300,
  trending: {
    /** score = logWeight * log10(1 + new) + rateWeight * min(rateCap, new / (base + smoothing)) */
    logWeight: 1,
    rateWeight: 6,
    smoothing: 50,
    rateCap: 3,
    /** Events need at least this many supporters (base + new) to trend. */
    minSample: 30,
    /** …and at least this many new supporters in the period. */
    minNew: 5,
  },
  /** A presence ping older than this no longer counts as "currently present". */
  presenceTtlMs: 15 * 60 * 1000,
  antiFraud: {
    /** More supports than this from one IP hash inside the window → burst. */
    burstPerIp: 25,
    burstWindowMs: 10 * 60 * 1000,
  },
  pageSizeDefault: 20,
  pageSizeMax: 50,
} as const;

export const PERIOD_MS: Record<RankingPeriod, number | null> = {
  "24h": 24 * 3600 * 1000,
  "7d": 7 * 24 * 3600 * 1000,
  "30d": 30 * 24 * 3600 * 1000,
  all: null,
};

/** Demo FX table. Production must load rates from a provider and keep history. */
export const DEMO_FX: FxRate[] = [
  { currency: "USD", usd: 1, asOf: "2026-11-09T00:00:00Z", source: "demo-fixed" },
  { currency: "EUR", usd: 1.08, asOf: "2026-11-09T00:00:00Z", source: "demo-fixed" },
  { currency: "GBP", usd: 1.27, asOf: "2026-11-09T00:00:00Z", source: "demo-fixed" },
  { currency: "JPY", usd: 0.0066, asOf: "2026-11-09T00:00:00Z", source: "demo-fixed" },
];

export const toUsd = (amount: number, currency: Currency, fx: FxRate[]) => {
  const r = fx.find((f) => f.currency === currency);
  if (!r) throw new Error(`No FX rate for ${currency}`);
  return amount * r.usd;
};
