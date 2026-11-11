import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, effectiveDiscountPct, feeBreakdown, fullDiscountPending, nextRankOf, progressOf, rankFor, reducesBenefits, validateRules, type LoyaltyRules } from "@/lib/loyalty/rules";

const R = DEFAULT_RULES;
const on: LoyaltyRules = { ...R, fullDiscountEnabled: true };

describe("FREAK LOYALTY ranks", () => {
  it("first, 3rd, 6th, 15th and 30th verified event move the rank up", () => {
    expect([0, 1, 2, 3, 5, 6, 14, 15, 29, 30, 99].map((n) => rankFor(n, R).rank)).toEqual([
      "rookie", "rookie", "rookie", "explorer", "explorer", "raver", "raver", "elite", "elite", "legend", "legend",
    ]);
  });

  it("knows what is left to the next rank and the progress", () => {
    expect(nextRankOf(0, R)).toEqual({ rank: "explorer", min: 3, remaining: 3 });
    expect(nextRankOf(18, R)).toEqual({ rank: "legend", min: 30, remaining: 12 });
    expect(nextRankOf(30, R)).toBeNull();
    expect(progressOf(10, R)).toBeCloseTo(4 / 9);
    expect(progressOf(30, R)).toBe(1);
  });
});

describe("platform fee discount", () => {
  it("matches the spec examples: $100 ELITE and $120 GOLD ELITE", () => {
    const a = feeBreakdown(100, "elite", R);
    expect(a).toMatchObject({ ticketsCents: 10000, regularFeeCents: 500, discountCents: 300, finalFeeCents: 200, totalCents: 10200, discountPct: 60 });
    const b = feeBreakdown(120, "elite", R);
    expect(b).toMatchObject({ regularFeeCents: 600, discountCents: 360, finalFeeCents: 240 });
  });

  it("never touches the ticket price; ROOKIE pays the full fee", () => {
    expect(feeBreakdown(57.5, "rookie", R)).toMatchObject({ ticketsCents: 5750, regularFeeCents: 288, discountCents: 0, finalFeeCents: 288 });
  });

  it("LEGEND 100 % only applies once the platform switches it on; until then the best discount below 100 %", () => {
    expect(effectiveDiscountPct("legend", R)).toBe(60);
    expect(fullDiscountPending("legend", R)).toBe(true);
    expect(feeBreakdown(100, "legend", on)).toMatchObject({ finalFeeCents: 0, discountCents: 500 });
    expect(fullDiscountPending("legend", on)).toBe(false);
  });

  it("respects the discount cap and the minimum fee", () => {
    expect(feeBreakdown(100, "elite", { ...R, maxDiscountPct: 50 }).finalFeeCents).toBe(250);
    expect(feeBreakdown(100, "legend", { ...on, minFeeUsd: 1 }).finalFeeCents).toBe(100);
    // A fee smaller than the minimum is not raised.
    expect(feeBreakdown(10, "rookie", { ...R, minFeeUsd: 1 }).finalFeeCents).toBe(50);
  });
});

describe("rule changes", () => {
  it("rejects inconsistent rules", () => {
    expect(() => validateRules(R)).not.toThrow();
    expect(() => validateRules({ ...R, ranks: R.ranks.map((r, i) => (i === 2 ? { ...r, min: 3 } : r)) })).toThrow("MIN_ORDER");
    expect(() => validateRules({ ...R, ranks: R.ranks.map((r, i) => (i === 3 ? { ...r, discountPct: 10 } : r)) })).toThrow("DISCOUNT_ORDER");
    expect(() => validateRules({ ...R, feeRatePct: 50 })).toThrow("FEE_RATE");
  });

  it("detects changes that take benefits away", () => {
    expect(reducesBenefits(R, { ...R, ranks: R.ranks.map((r) => (r.rank === "elite" ? { ...r, discountPct: 50 } : r)) })).toBe(true);
    expect(reducesBenefits(R, { ...R, ranks: R.ranks.map((r) => (r.rank === "raver" ? { ...r, min: 8 } : r)) })).toBe(true);
    expect(reducesBenefits(R, { ...R, feeRatePct: 6 })).toBe(true);
    expect(reducesBenefits(on, R)).toBe(true);
    expect(reducesBenefits(R, { ...R, ranks: R.ranks.map((r) => (r.rank === "explorer" ? { ...r, discountPct: 25 } : r)) })).toBe(false);
    expect(reducesBenefits(R, on)).toBe(false);
  });
});
