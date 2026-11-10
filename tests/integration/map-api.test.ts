import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/map/route";
import { EVENTS } from "@/lib/data";
import type { WorldMapResponse } from "@/lib/map/types";

afterEach(() => {
  delete process.env.MAP_DATA_MODE;
});

describe("GET /api/map", () => {
  it("returns every event once, with real coordinates", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as WorldMapResponse;
    expect(body.mode).toBe("demo");
    for (const e of EVENTS) {
      const m = body.events.find((x) => x.id === e.id)!;
      expect(m).toBeTruthy();
      expect(m.location.lat).toBe(e.lat);
      expect(m.location.lng).toBe(e.lng);
    }
    expect(new Set(body.events.map((e) => e.id)).size).toBe(body.events.length);
  });

  it("keeps demo live, viewers and attendance separate", async () => {
    const body = (await (await GET()).json()) as WorldMapResponse;
    const live = body.events.filter((e) => e.live);
    expect(live.map((e) => e.id)).toEqual(["bassmutant-tokyo"]);
    expect(live[0].status).toBe("live");
    expect(live[0].live!.demo).toBe(true);
    expect(live[0].live!.status).toBe("demo_live");
    expect(live[0].live!.onlineViewers).not.toBe(live[0].live!.checkedIn);
    // Events that haven't started never carry live info.
    for (const e of body.events.filter((x) => x.status !== "live")) expect(e.live).toBeNull();
  });

  it("separates staking from funding and marks approximate locations", async () => {
    const body = (await (await GET()).json()) as WorldMapResponse;
    const neon = body.events.find((e) => e.id === "neon-slime-summit")!;
    expect(neon.growth.fundingUsd).toBe(EVENTS.find((e) => e.id === "neon-slime-summit")!.raised);
    expect(neon.dao!.staked).toBeGreaterThan(0);
    expect(neon.growth.fundingUsd).not.toBe(neon.dao!.staked);
    const funding = body.events.filter((e) => e.status === "funding" || e.status === "planning");
    expect(funding.length).toBeGreaterThan(0);
    for (const e of funding) {
      expect(e.location.precision).toBe("city");
      expect(e.tickets.onSale).toBe(false);
    }
  });

  it("ranks the top 3 with period and time, and shows completed events", async () => {
    const body = (await (await GET()).json()) as WorldMapResponse;
    const top = body.events.filter((e) => e.ranking.badge).sort((a, b) => a.ranking.rank! - b.ranking.rank!);
    expect(top.map((e) => e.ranking.badge)).toEqual(["champion", "runner_up", "featured"]);
    expect(top[0].ranking.period).toBe("all");
    expect(top[0].ranking.asOf).toMatch(/^\d{4}-/);
    expect(body.events.some((e) => e.status === "completed")).toBe(true);
  });

  it("never serves demo data in production mode", async () => {
    process.env.MAP_DATA_MODE = "production";
    const res = await GET();
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("DATA_SOURCE_NOT_CONFIGURED");
  });
});
