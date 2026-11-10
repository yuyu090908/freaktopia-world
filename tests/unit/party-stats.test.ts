import { describe, expect, it } from "vitest";
import { detectAnomalies, growth, isVerifiedEvent, partyImpact, themeFor, worldStats, type EventInput, type WorldStats } from "@/lib/party/stats";
import { tierFor, type Attendance, type EventReview } from "@/lib/party/types";

const H = 3_600_000;
const NOW = Date.parse("2026-11-10T12:00:00Z");
const ev = (id: string, daysAgo: number, over: Partial<EventInput["facts"]> = {}): EventInput => ({
  facts: { id, name: id, city: "Bangkok", country: "TH", venueName: "", startAt: new Date(NOW - daysAgo * 24 * H).toISOString(), endAt: new Date(NOW - daysAgo * 24 * H + 6 * H).toISOString(), timezone: "UTC", genres: ["Tech House"], level: 3, status: "completed", plannedAttendance: 100, ...over },
  team: new Set(["owner"]),
  published: true,
});
const att = (eventId: string, userId: string, method: "qr" | "manual" | null = "qr", status: Attendance["status"] = "going"): Attendance => ({
  eventId, userId, status, passCode: `${eventId}${userId}`.slice(0, 10), checkedInAt: method ? new Date(NOW - 24 * H).toISOString() : null, method, by: "owner", createdAt: "", updatedAt: "", version: 0, history: [],
});
const rev = (eventId: string, userId: string, rating: EventReview["rating"], at = new Date(NOW).toISOString()): EventReview => ({ eventId, userId, rating, text: "", at });

describe("party stats", () => {
  it("held only after the end, not cancelled, with ≥ 3 door scans outside the team", () => {
    const e = ev("a", 1);
    const rows = [att("a", "u1"), att("a", "u2"), att("a", "owner"), att("a", "u3", "manual")];
    expect(isVerifiedEvent(e, rows, NOW)).toBe(false); // owner is team, u3 is manual
    expect(isVerifiedEvent(e, [...rows, att("a", "u4")], NOW)).toBe(true);
    expect(isVerifiedEvent(ev("a", 1, { status: "cancelled" }), [...rows, att("a", "u4")], NOW)).toBe(false);
    expect(isVerifiedEvent(ev("a", -1), [...rows, att("a", "u4")], NOW)).toBe(false); // not ended
  });

  it("definitions: total counts each person once per event; unique; returning = ≥ 2 different events; going and cancelled never count", () => {
    const events = [ev("a", 10), ev("b", 5)];
    const rows = [
      ...["u1", "u2", "u3"].map((u) => att("a", u)),
      ...["u1", "u2", "u4"].map((u) => att("b", u)),
      att("b", "u5", null), // going only
      att("b", "u6", "qr", "cancelled"), // revoked
    ];
    const s = worldStats(events, rows, [], new Map([["a", 30]]), NOW);
    expect(s).toMatchObject({ totalEvents: 2, totalAttendance: 6, uniqueVisitors: 4, returningVisitors: 2, guests: 30 });
  });

  it("PARTY IMPACT: no score without enough evidence; size is only 10 %; small and loved beats big and lukewarm", () => {
    const base: WorldStats = { totalEvents: 3, totalAttendance: 60, uniqueVisitors: 40, returningVisitors: 12, averageRating: 4.9, reviewCount: 30, guests: 0, cities: 1, genres: [], visits: new Map(), manualShare: 0, largestEvent: 25, firstEventAt: null, activeMonths: 3 };
    expect(partyImpact({ ...base, reviewCount: 4 }, 10).status).toBe("insufficient");
    expect(partyImpact({ ...base, uniqueVisitors: 9 }, 5).score).toBeNull();
    const small = partyImpact(base, 15);
    const big = partyImpact({ ...base, totalAttendance: 9000, uniqueVisitors: 8000, returningVisitors: 400, averageRating: 3.4, reviewCount: 300, largestEvent: 3000 }, 400);
    expect(small.score!).toBeGreaterThan(big.score!);
    expect(small.confidence).toBe("medium");
    expect(big.confidence).toBe("high");
    expect(small.score!).toBeGreaterThanOrEqual(0);
    expect(small.score!).toBeLessThanOrEqual(100);
    // Few reviews are pulled toward the middle (Bayesian): five 5-star reviews don't make a perfect score.
    expect(partyImpact({ ...base, reviewCount: 5, averageRating: 5 }, 10).parts.satisfaction!).toBeLessThan(90);
  });

  it("growth stages follow verified history only", () => {
    const s = (o: Partial<WorldStats>): WorldStats => ({ totalEvents: 0, totalAttendance: 0, uniqueVisitors: 0, returningVisitors: 0, averageRating: null, reviewCount: 0, guests: 0, cities: 0, genres: [], visits: new Map(), manualShare: 0, largestEvent: 0, firstEventAt: null, activeMonths: 0, ...o });
    expect(growth(s({}), []).stage).toBe(0);
    expect(growth(s({ totalEvents: 1 }), []).stage).toBe(1);
    expect(growth(s({ totalEvents: 3, returningVisitors: 2 }), []).stage).toBe(2);
    expect(growth(s({ totalEvents: 3, returningVisitors: 6 }), []).stage).toBe(3);
    expect(growth(s({ totalEvents: 3, returningVisitors: 6, largestEvent: 600 }), []).stage).toBe(4);
    expect(growth(s({ totalEvents: 12, returningVisitors: 60, largestEvent: 600, cities: 2 }), ["tech_house", "afro_house", "default"]).stage).toBe(5);
    expect(growth(s({ totalEvents: 12 }), ["tech_house", "afro_house", "default"]).areas).toEqual(["tech_house", "afro_house"]);
  });

  it("themes and visit tiers", () => {
    expect(themeFor(["Tech House"], 3)).toBe("tech_house");
    expect(themeFor(["Afro House"], 2)).toBe("afro_house");
    expect(themeFor(["Melodic Techno"], 3)).toBe("melodic_techno");
    expect(themeFor(["Tech House"], 5)).toBe("festival");
    expect([1, 2, 4, 5, 9, 10].map(tierFor)).toEqual(["first", "aura", "aura", "glow", "glow", "regular"]);
  });

  it("anomalies: manual share, over capacity, review bursts, new-account crowds, people in two places", () => {
    const e = ev("a", 1, { plannedAttendance: 10 });
    const rows = [...Array.from({ length: 12 }, (_, i) => att("a", `m${i}`, "manual")), ...Array.from({ length: 10 }, (_, i) => att("a", `q${i}`))];
    const reviews = Array.from({ length: 10 }, (_, i) => rev("a", `q${i}`, 5, new Date(NOW + i * 1000).toISOString()));
    const created = new Map(rows.map((r) => [r.userId, new Date(NOW - 2 * 24 * H).toISOString()]));
    const other = ["q1", "q2", "q3"].map((u) => att("b", u));
    const kinds = detectAnomalies(e, rows, [], reviews, created, other).map((a) => a.kind).sort();
    expect(kinds).toEqual(["double_presence", "manual_share", "new_account_crowd", "over_capacity", "review_burst"]);
    expect(detectAnomalies(ev("a", 1), rows.slice(12), [], [], new Map(), [])).toEqual([]);
  });
});
