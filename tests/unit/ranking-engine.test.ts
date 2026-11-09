import { describe, expect, it } from "vitest";
import {
  checkedIn,
  compareRanked,
  computeMetrics,
  detectBurstIps,
  matchesFilters,
  presentNow,
  rank,
  securedFunding,
  trendingScore,
  uniqueSupporters,
  validTickets,
  windowFor,
} from "@/lib/ranking/engine";
import { DEMO_FX, RANKING_CONFIG, toUsd } from "@/lib/ranking/config";
import { parseRankingQuery, readUrlState, toSearchParams } from "@/lib/ranking/query";
import type { EventActivity, EventMetrics, RankableEvent, SupporterRecord } from "@/lib/ranking/types";

const H = 3600_000;
const D = 24 * H;
const NOW = Date.parse("2026-11-09T12:00:00Z");

const sup = (userId: string, t: number, extra: Partial<SupporterRecord> = {}): SupporterRecord => ({
  eventId: "e",
  userId,
  createdAt: t,
  fraud: "clear",
  ipHash: `ip-${userId}-${t}`,
  ...extra,
});

const ev = (id: string, extra: Partial<RankableEvent> = {}): RankableEvent => ({
  id,
  name: id.toUpperCase(),
  city: "Tokyo",
  country: "Japan",
  lat: 0,
  lng: 0,
  approximateLocation: false,
  startsAt: "2026-12-01T20:00:00Z",
  endsAt: "2026-12-02T04:00:00Z",
  genres: ["Techno"],
  status: "confirmed",
  djRecruiting: false,
  minPrice: 20,
  goal: 1000,
  lineup: [],
  capacity: 100,
  isDemo: true,
  ...extra,
});

const empty: EventActivity = { supporters: [], interests: [], tickets: [], checkIns: [], presence: [], payments: [] };

describe("duplicate supporter removal", () => {
  it("counts each user once and keeps the earliest support", () => {
    const r = uniqueSupporters([sup("a", NOW - 5 * D), sup("a", NOW - 1 * D, { walletAddress: "0x2" }), sup("b", NOW - 2 * D)], NOW);
    expect(r.firstSupport.size).toBe(2);
    expect(r.firstSupport.get("a")).toBe(NOW - 5 * D);
    expect(r.duplicates).toBe(1);
  });

  it("does not count wallets as people", () => {
    const r = uniqueSupporters([sup("a", NOW - D, { walletAddress: "0x1" }), sup("a", NOW - D + 1, { walletAddress: "0x2" }), sup("a", NOW - D + 2, { walletAddress: "0x3" })], NOW);
    expect(r.firstSupport.size).toBe(1);
  });

  it("excludes bot and held accounts", () => {
    const r = uniqueSupporters([sup("a", NOW - D), sup("bot", NOW - D, { fraud: "bot" }), sup("sus", NOW - D, { fraud: "held" })], NOW);
    expect(r.firstSupport.size).toBe(1);
    expect(r.flagged).toBe(2);
  });

  it("ignores supports after the as-of time", () => {
    expect(uniqueSupporters([sup("a", NOW + 1)], NOW).firstSupport.size).toBe(0);
  });
});

describe("anti-fraud burst detection", () => {
  it("flags an IP that supports in a burst and excludes it", () => {
    const burst = Array.from({ length: RANKING_CONFIG.antiFraud.burstPerIp + 5 }, (_, i) => sup(`x${i}`, NOW - H + i * 1000, { ipHash: "farm" }));
    const normal = Array.from({ length: 10 }, (_, i) => sup(`n${i}`, NOW - i * D));
    const ips = detectBurstIps([...burst, ...normal]);
    expect(ips.has("farm")).toBe(true);
    expect(uniqueSupporters([...burst, ...normal], NOW, ips).firstSupport.size).toBe(10);
  });

  it("does not flag the same IP when supports are spread out", () => {
    const spread = Array.from({ length: 40 }, (_, i) => sup(`s${i}`, NOW - i * H, { ipHash: "cafe-wifi" }));
    expect(detectBurstIps(spread).size).toBe(0);
  });
});

describe("tickets", () => {
  it("excludes refunded, void and fraud tickets and de-duplicates ids", () => {
    const w = windowFor("all", NOW);
    const t = (id: string, status: "valid" | "refunded" | "void" | "fraud") => ({ id, eventId: "e", userId: "u", kind: "main" as const, soldAt: NOW - D, status });
    const r = validTickets([t("1", "valid"), t("1", "valid"), t("2", "refunded"), t("3", "void"), t("4", "fraud"), t("5", "valid")], w);
    expect(r.valid.map((x) => x.id)).toEqual(["1", "5"]);
    expect(r.invalid).toBe(3);
  });

  it("counts check-ins once per valid ticket", () => {
    const w = windowFor("all", NOW);
    const scans = [
      { eventId: "e", ticketId: "1", userId: "u1", scannedAt: NOW - H },
      { eventId: "e", ticketId: "1", userId: "u1", scannedAt: NOW - H + 60_000 },
      { eventId: "e", ticketId: "2", userId: "u2", scannedAt: NOW - H },
      { eventId: "e", ticketId: "refunded", userId: "u3", scannedAt: NOW - H },
    ];
    const r = checkedIn(scans, new Set(["1", "2"]), w);
    expect(r.count).toBe(2);
    expect(r.duplicates).toBe(1);
  });
});

describe("presence expiry", () => {
  const p = (userId: string, ageMin: number, extra = {}) => ({ eventId: "e", userId, lastSeenAt: NOW - ageMin * 60_000, checkedOut: false, avatarPublic: true, profilePublic: true, ...extra });
  it("only counts fresh pings inside the TTL", () => {
    const r = presentNow([p("a", 1), p("b", 14), p("c", 16), p("d", 120)], NOW);
    expect(r.present).toBe(2);
  });
  it("excludes checked-out users and private avatars", () => {
    const r = presentNow([p("a", 1, { checkedOut: true }), p("b", 1, { avatarPublic: false }), p("c", 1, { profilePublic: false }), p("d", 1)], NOW);
    expect(r.present).toBe(3);
    expect(r.publicAvatars).toBe(1);
  });
});

describe("currency conversion", () => {
  it("converts with the recorded rate and keeps per-currency totals", () => {
    const w = windowFor("all", NOW);
    const pay = (amount: number, currency: "USD" | "JPY" | "EUR", status: "captured" | "pending" | "refunded" | "expired" = "captured") => ({ id: `${amount}${currency}${status}`, eventId: "e", userId: "u", amount, currency, status, createdAt: NOW - D });
    const r = securedFunding([pay(100, "USD"), pay(10000, "JPY"), pay(50, "EUR"), pay(999, "USD", "pending"), pay(999, "USD", "refunded"), pay(999, "USD", "expired")], w, DEMO_FX);
    expect(r.byCurrency).toEqual({ USD: 100, JPY: 10000, EUR: 50 });
    expect(r.usd).toBe(Math.round(100 + toUsd(10000, "JPY", DEMO_FX) + toUsd(50, "EUR", DEMO_FX)));
    expect(r.uncaptured).toBe(3);
  });
  it("throws on an unknown currency instead of guessing", () => {
    expect(() => toUsd(1, "XXX" as "USD", DEMO_FX)).toThrow();
  });
});

describe("period windows", () => {
  it("24h / 7d / 30d / all", () => {
    expect(windowFor("24h", NOW).start).toBe(NOW - D);
    expect(windowFor("7d", NOW).start).toBe(NOW - 7 * D);
    expect(windowFor("30d", NOW).start).toBe(NOW - 30 * D);
    expect(windowFor("all", NOW).start).toBeNull();
  });
  it("splits supporters into new (in period) and base", () => {
    const act = { ...empty, supporters: [sup("old", NOW - 20 * D), sup("week", NOW - 3 * D), sup("day", NOW - 2 * H)] };
    const m24 = computeMetrics(act, "24h", NOW, DEMO_FX);
    expect(m24.new_supporters).toBe(1);
    expect(m24.base_supporters).toBe(2);
    const m7 = computeMetrics(act, "7d", NOW, DEMO_FX);
    expect(m7.new_supporters).toBe(2);
    expect(computeMetrics(act, "all", NOW, DEMO_FX).new_supporters).toBe(3);
  });
});

describe("growth rate / trending", () => {
  it("smooths small samples so 2→6 does not beat 1000→1300", () => {
    const tiny = trendingScore(4, 2);
    const big = trendingScore(300, 1000);
    expect(tiny.eligible).toBe(false); // below minimum sample
    expect(big.score).toBeGreaterThan(tiny.score);
  });
  it("caps the growth rate", () => {
    expect(trendingScore(100000, 0).growth).toBe(RANKING_CONFIG.trending.rateCap);
  });
  it("combines log of new supporters with smoothed rate", () => {
    const t = RANKING_CONFIG.trending;
    const r = trendingScore(200, 300);
    const expected = t.logWeight * Math.log10(201) + t.rateWeight * (200 / (300 + t.smoothing));
    expect(r.score).toBeCloseTo(expected, 3);
  });
});

describe("ranking order and ties", () => {
  const m = (supporters: number): EventMetrics => ({
    supporters_count: supporters,
    interested_count: 0,
    tickets_sold: 10,
    checked_in_count: 0,
    currently_present_count: 0,
    public_avatar_count: 0,
    funding_usd: 0,
    funding_by_currency: {},
    new_supporters: supporters,
    base_supporters: 0,
    growth_rate: 0,
    trending_score: 0,
    excluded: { duplicate_supports: 0, flagged_supports: 0, invalid_tickets: 0, uncaptured_payments: 0, duplicate_scans: 0 },
  });

  it("ranks by score descending", () => {
    const events = [ev("a"), ev("b"), ev("c")];
    const metrics = new Map([["a", m(10)], ["b", m(30)], ["c", m(20)]]);
    expect(rank(events, metrics, "popular", { period: "all" }).map((e) => e.event.id)).toEqual(["b", "c", "a"]);
  });

  it("breaks ties: score → supporters → earlier start → id", () => {
    const a = { score: 5, ev: ev("b", { startsAt: "2026-12-01T00:00:00Z" }), m: m(10) };
    const b = { score: 5, ev: ev("a", { startsAt: "2026-12-02T00:00:00Z" }), m: m(10) };
    const c = { score: 5, ev: ev("c", { startsAt: "2026-12-01T00:00:00Z" }), m: m(10) };
    const d = { score: 5, ev: ev("d"), m: m(99) };
    expect([a, b, c, d].sort(compareRanked).map((x) => x.ev.id)).toEqual(["d", "b", "c", "a"]);
  });

  it("is deterministic regardless of input order", () => {
    const events = [ev("x"), ev("y"), ev("z")];
    const metrics = new Map([["x", m(5)], ["y", m(5)], ["z", m(5)]]);
    const one = rank(events, metrics, "tickets", { period: "all" }).map((e) => e.event.id);
    const two = rank([...events].reverse(), metrics, "tickets", { period: "all" }).map((e) => e.event.id);
    expect(one).toEqual(two);
  });

  it("assigns top badges", () => {
    const events = ["a", "b", "c", "d"].map((id) => ev(id));
    const metrics = new Map(events.map((e, i) => [e.id, m(100 - i)]));
    const r = rank(events, metrics, "popular", { period: "all" });
    expect(r[0].badges).toContain("top1");
    expect(r[2].badges).toContain("top3");
    expect(r[3].badges).toContain("top10");
  });

  it("LIVE needs live status and presence evidence", () => {
    const events = [ev("live", { status: "live" }), ev("noping", { status: "live" }), ev("up")];
    const withPresence = { ...m(1), currently_present_count: 5 };
    const metrics = new Map([["live", withPresence], ["noping", m(1)], ["up", withPresence]]);
    expect(rank(events, metrics, "live", { period: "all" }).map((e) => e.event.id)).toEqual(["live"]);
  });
});

describe("filters", () => {
  it("matches search, country, city, genre, status, price, level, DJ and after party", () => {
    const e = ev("x", { name: "Glass Noodle", city: "São Paulo", country: "Brazil", genres: ["House"], djRecruiting: true, minPrice: 0, afterParty: { id: "ap", name: "AP", capacity: 10, sold: 2, price: 5 } });
    expect(matchesFilters(e, 3, { period: "all", q: "sao paulo" })).toBe(true);
    expect(matchesFilters(e, 3, { period: "all", country: "brazil" })).toBe(true);
    expect(matchesFilters(e, 3, { period: "all", genre: "Techno" })).toBe(false);
    expect(matchesFilters(e, 3, { period: "all", status: "upcoming" })).toBe(true);
    expect(matchesFilters(e, 3, { period: "all", status: "completed" })).toBe(false);
    expect(matchesFilters(e, 3, { period: "all", price: "free" })).toBe(true);
    expect(matchesFilters(e, 3, { period: "all", price: "paid" })).toBe(false);
    expect(matchesFilters(e, 3, { period: "all", level: 3 })).toBe(true);
    expect(matchesFilters(e, 3, { period: "all", level: 4 })).toBe(false);
    expect(matchesFilters(e, 3, { period: "all", djRecruiting: true, afterParty: true })).toBe(true);
  });
});

describe("query parsing / URL sync", () => {
  it("round-trips filter state through the URL", () => {
    const s = readUrlState(new URLSearchParams("category=trending&period=7d&city=Tokyo&genre=Techno&dj=1&view=map"));
    expect(s).toMatchObject({ category: "trending", period: "7d", city: "Tokyo", genre: "Techno", dj: true, view: "map" });
    expect(readUrlState(toSearchParams(s))).toEqual(s);
  });
  it("rejects invalid values", () => {
    const r = parseRankingQuery(new URLSearchParams("category=nope&pageSize=999"));
    expect(r.ok).toBe(false);
  });
  it("caps page size and defaults", () => {
    const r = parseRankingQuery(new URLSearchParams(""));
    expect(r.ok && r.query.category).toBe("popular");
    expect(r.ok && r.query.pageSize).toBe(RANKING_CONFIG.pageSizeDefault);
  });
});
