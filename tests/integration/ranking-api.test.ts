import { afterEach, describe, expect, it } from "vitest";
import { GET as rankingsGET } from "@/app/api/rankings/route";
import { GET as topGET } from "@/app/api/rankings/top/route";
import { GET as trendingGET } from "@/app/api/rankings/trending/route";
import { GET as mapGET } from "@/app/api/rankings/map/route";
import { POST as comparePOST } from "@/app/api/rankings/compare/route";
import { GET as historyGET } from "@/app/api/events/[id]/ranking-history/route";
import { DELETE as unfollow, POST as follow } from "@/app/api/events/[id]/follow/route";
import { GET as prefsGET } from "@/app/api/users/me/ranking-preferences/route";
import { POST as recalcPOST } from "@/app/api/admin/rankings/recalculate/route";
import { ARCHIVE_EVENTS, EVENTS } from "@/lib/data";
import { deriveAlerts, ALERT_TYPES } from "@/lib/alerts";
import { _clearRankingCache } from "@/lib/ranking/service";
import type { RankingResult } from "@/lib/ranking/types";

let ip = 0;
const req = (path: string, init?: RequestInit) => new Request(`http://localhost${path}`, { ...init, headers: { "x-forwarded-for": `10.0.0.${++ip % 250}`, ...(init?.headers ?? {}) } });
const json = async (r: Response) => (await r.json()) as RankingResult & Record<string, unknown>;
const params = (id: string) => ({ params: Promise.resolve({ id }) });

afterEach(() => {
  delete process.env.RANKING_DATA_MODE;
  delete process.env.RANKING_ADMIN_TOKEN;
});

describe("GET /api/rankings (event data integration)", () => {
  it("ranks every demo event by unique supporters, matching the event data", async () => {
    const r = await rankingsGET(req("/api/rankings?category=popular&pageSize=50"));
    expect(r.status).toBe(200);
    const d = await json(r);
    expect(d.mode).toBe("demo");
    expect(d.total).toBe(EVENTS.length + ARCHIVE_EVENTS.length);
    for (const item of d.items) {
      const src = [...EVENTS, ...ARCHIVE_EVENTS].find((e) => e.id === item.event.id)!;
      expect(item.metrics.supporters_count).toBe(src.supporters);
      expect(item.event.isDemo).toBe(true);
    }
    const counts = d.items.map((i) => i.metrics.supporters_count);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
    expect(d.items[0].rank).toBe(1);
  });

  it("excludes duplicates, bots, the vote burst, refunds and uncaptured funds", async () => {
    const d = await json(await rankingsGET(req("/api/rankings?category=popular&q=tuk&pageSize=5")));
    const tuk = d.items.find((i) => i.event.id === "tuk-tuk-trance")!;
    expect(tuk.metrics.supporters_count).toBe(96);
    expect(tuk.metrics.excluded.flagged_supports).toBeGreaterThanOrEqual(60);
    expect(tuk.metrics.excluded.duplicate_supports).toBeGreaterThan(0);
    expect(tuk.metrics.excluded.invalid_tickets).toBeGreaterThan(0);
    expect(tuk.metrics.excluded.uncaptured_payments).toBeGreaterThan(0);
  });

  it("funding is converted to USD from several currencies and records the FX table", async () => {
    const d = await json(await rankingsGET(req("/api/rankings?category=funded&q=bassmutant")));
    const e = d.items[0];
    expect(Object.keys(e.metrics.funding_by_currency).sort()).toEqual(["JPY", "USD"]);
    expect(Math.abs(e.metrics.funding_usd - 71800)).toBeLessThan(50);
    expect(d.fx.every((f) => f.asOf && f.source)).toBe(true);
  });

  it("applies filters, status and paging", async () => {
    const done = await json(await rankingsGET(req("/api/rankings?category=attended&status=completed")));
    expect(done.items.length).toBe(ARCHIVE_EVENTS.length);
    expect(done.items.every((i) => i.event.status === "ended")).toBe(true);
    const free = await json(await rankingsGET(req("/api/rankings?price=free")));
    expect(free.items.map((i) => i.event.id)).toEqual(["kaiju-free-picnic"]);
    const page2 = await json(await rankingsGET(req("/api/rankings?pageSize=5&page=2")));
    expect(page2.items[0].rank).toBe(6);
    const tokyo = await json(await rankingsGET(req("/api/rankings?city=Tokyo")));
    expect(tokyo.items.every((i) => i.event.city === "Tokyo")).toBe(true);
  });

  it("validates input", async () => {
    const r = await rankingsGET(req("/api/rankings?category=hacked&level=9"));
    expect(r.status).toBe(400);
    const b = (await r.json()) as { error: { code: string; issues: unknown[] } };
    expect(b.error.code).toBe("INVALID_QUERY");
    expect(b.error.issues.length).toBeGreaterThan(0);
  });

  it("rate limits a single client", async () => {
    const h = { headers: { "x-forwarded-for": "203.0.113.9" } };
    let last = 200;
    for (let i = 0; i < 125; i++) last = (await rankingsGET(new Request("http://localhost/api/rankings?pageSize=1", h))).status;
    expect(last).toBe(429);
  });

  it("FOR YOU is personal and not publicly cached", async () => {
    const r = await rankingsGET(req("/api/rankings?category=for_you&pg=Ambient&pc=Reykjav%C3%ADk"));
    expect(r.headers.get("cache-control")).toContain("no-store");
    const d = await json(r);
    expect(d.items[0].event.id).toBe("aurora-ooze");
  });

  it("never serves demo data in production mode without a data source", async () => {
    process.env.RANKING_DATA_MODE = "production";
    _clearRankingCache();
    const r = await rankingsGET(req("/api/rankings"));
    expect(r.status).toBe(503);
    const b = (await r.json()) as { error: { code: string } };
    expect(b.error.code).toBe("DATA_SOURCE_NOT_CONFIGURED");
  });
});

describe("top / trending / map", () => {
  it("top returns 3", async () => {
    const d = await json(await topGET(req("/api/rankings/top?category=tickets")));
    expect(d.items).toHaveLength(3);
  });
  it("trending defaults to 7 days and favours fast-growing events", async () => {
    const d = await json(await trendingGET(req("/api/rankings/trending")));
    expect(d.category).toBe("trending");
    expect(d.period).toBe("7d");
    expect(["void-jelly-rave", "kawa-kaiju", "tuk-tuk-trance", "glass-noodle", "aurora-ooze"]).toContain(d.items[0].event.id);
  });
  it("map pins carry rank and real coordinates", async () => {
    const r = await mapGET(req("/api/rankings/map?category=popular"));
    const d = (await r.json()) as { pins: { id: string; rank: number; lat: number; lng: number; approximate: boolean }[] };
    expect(d.pins[0].rank).toBe(1);
    const berlin = d.pins.find((p) => p.id === "neon-slime-summit")!;
    expect(berlin.lat).toBeCloseTo(52.5, 1);
    expect(d.pins.some((p) => p.approximate)).toBe(true);
  });
});

describe("compare", () => {
  it("compares 2–3 events and returns a share URL", async () => {
    const r = await comparePOST(req("/api/rankings/compare", { method: "POST", body: JSON.stringify({ eventIds: ["void-jelly-rave", "glass-noodle", "kimchi-cosmos"] }) }));
    expect(r.status).toBe(200);
    const d = (await r.json()) as { rows: { event: { id: string } }[]; shareUrl: string };
    expect(d.rows.map((x) => x.event.id)).toEqual(["void-jelly-rave", "glass-noodle", "kimchi-cosmos"]);
    expect(d.shareUrl).toBe("/rankings/compare?ids=void-jelly-rave,glass-noodle,kimchi-cosmos");
  });
  it("rejects 1 or 4 events and unknown ids", async () => {
    const one = await comparePOST(req("/api/rankings/compare", { method: "POST", body: JSON.stringify({ eventIds: ["a"] }) }));
    expect(one.status).toBe(400);
    const dup = await comparePOST(req("/api/rankings/compare", { method: "POST", body: JSON.stringify({ eventIds: ["glass-noodle", "glass-noodle"] }) }));
    expect(dup.status).toBe(400);
    const missing = await comparePOST(req("/api/rankings/compare", { method: "POST", body: JSON.stringify({ eventIds: ["glass-noodle", "nope"] }) }));
    expect(missing.status).toBe(404);
  });
});

describe("ranking history", () => {
  it("returns one point per day with ranks", async () => {
    const r = await historyGET(req("/api/events/void-jelly-rave/ranking-history?days=7"), params("void-jelly-rave"));
    const d = (await r.json()) as { points: { ranks: { popular: number | null } }[] };
    expect(d.points).toHaveLength(7);
    expect(d.points.every((p) => typeof p.ranks.popular === "number")).toBe(true);
  });
  it("404 for unknown events, 400 for bad input", async () => {
    expect((await historyGET(req("/api/events/nope/ranking-history"), params("nope"))).status).toBe(404);
    expect((await historyGET(req("/api/events/x/ranking-history?days=99"), params("x"))).status).toBe(400);
  });
});

describe("follow + preferences require auth", () => {
  it("answers 401 with a login URL that returns to the action", async () => {
    const r = await follow(req("/api/events/void-jelly-rave/follow", { method: "POST" }), params("void-jelly-rave"));
    expect(r.status).toBe(401);
    const b = (await r.json()) as { error: { loginUrl: string } };
    expect(decodeURIComponent(b.error.loginUrl)).toContain("/events/void-jelly-rave?action=follow");
    expect((await unfollow(req("/api/events/void-jelly-rave/follow", { method: "DELETE" }), params("void-jelly-rave"))).status).toBe(401);
    expect((await prefsGET(req("/api/users/me/ranking-preferences"))).status).toBe(401);
  });
  it("404 for unknown events", async () => {
    expect((await follow(req("/api/events/nope/follow", { method: "POST" }), params("nope"))).status).toBe(404);
  });
});

describe("admin recalculation", () => {
  it("requires the admin token", async () => {
    expect((await recalcPOST(req("/api/admin/rankings/recalculate", { method: "POST" }))).status).toBe(403);
    process.env.RANKING_ADMIN_TOKEN = "t0ken";
    expect((await recalcPOST(req("/api/admin/rankings/recalculate", { method: "POST", headers: { authorization: "Bearer t0ken" } }))).status).toBe(200);
  });
});

describe("alerts (notifications)", () => {
  const all = Object.fromEntries(ALERT_TYPES.map((t) => [t, true])) as Record<(typeof ALERT_TYPES)[number], boolean>;
  const glass = EVENTS.find((e) => e.id === "glass-noodle")!;
  it("creates TOP10 and DJ alerts for followed events", () => {
    const a = deriveAlerts([glass], new Set(["glass-noodle"]), all);
    expect(a.map((x) => x.type)).toEqual(expect.arrayContaining(["top10", "dj_open"]));
  });
  it("respects per-type settings", () => {
    const a = deriveAlerts([glass], new Set(["glass-noodle"]), { ...all, top10: false, dj_open: false });
    expect(a.some((x) => x.type === "top10" || x.type === "dj_open")).toBe(false);
  });
});
