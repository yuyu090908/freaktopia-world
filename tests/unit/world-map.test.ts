import { describe, expect, it } from "vitest";
import { DEFAULT_GROWTH_CONFIG, computeFestivalLevel, normalizeConfig, validateConfig, type GrowthInputs } from "@/lib/map/growth";
import { STATUS_META, landmarkSvg, landmarkTypeFor, orbSvg } from "@/lib/map/landmarks";
import { EMPTY_MAP_FILTERS, filterWorld, readWorldUrl, suggest, writeWorldUrl } from "@/lib/map/view";
import type { MapEventDto } from "@/lib/map/types";

const base: GrowthInputs = { supporters: 0, stakers: 0, fundingUsd: 0, venueContract: false, approvals: 0 };

describe("festival growth levels", () => {
  it("starts at SEED and needs every requirement of a level", () => {
    expect(computeFestivalLevel(base).level).toBe(1);
    expect(computeFestivalLevel(base).name).toBe("SEED");
    // Lots of supporters but no funding: still level 1.
    expect(computeFestivalLevel({ ...base, supporters: 50_000 }).level).toBe(1);
    expect(computeFestivalLevel({ ...base, supporters: 150, fundingUsd: 3000 }).level).toBe(2);
  });

  it("RAVE needs a venue contract; MEGA FEST needs stakers and an approval", () => {
    const rich = { ...base, supporters: 5000, fundingUsd: 100_000 };
    expect(computeFestivalLevel(rich).level).toBe(2);
    expect(computeFestivalLevel({ ...rich, venueContract: true }).level).toBe(3);
    expect(computeFestivalLevel({ ...rich, venueContract: true, stakers: 10, approvals: 1 }).level).toBe(4);
  });

  it("staking is counted as people, never as funding", () => {
    const r = computeFestivalLevel({ ...base, supporters: 700, stakers: 10_000, venueContract: true });
    expect(r.level).toBe(1); // no secured funding → can't pass GATHERING
    expect(r.requirements.find((x) => x.key === "fundingUsd")?.met).toBe(false);
  });

  it("levels can't be skipped and progress is the weakest requirement", () => {
    const r = computeFestivalLevel({ ...base, supporters: 300, fundingUsd: 1500 });
    expect(r.level).toBe(1);
    expect(r.next?.level).toBe(2);
    expect(r.pct).toBeCloseTo(0.5);
  });

  it("an edited config changes the level and is normalized", () => {
    const cfg = structuredClone(DEFAULT_GROWTH_CONFIG);
    cfg.levels[1].supporters = 50;
    cfg.levels[1].fundingUsd = 500;
    expect(computeFestivalLevel({ ...base, supporters: 60, fundingUsd: 600 }, cfg).level).toBe(2);
    cfg.levels[3].supporters = 10; // lower than level 3
    expect(validateConfig(cfg).length).toBeGreaterThan(0);
    const n = normalizeConfig(cfg);
    expect(n.levels[3].supporters).toBe(n.levels[2].supporters);
    expect(n.levels[0].supporters).toBe(0);
  });
});

describe("landmarks", () => {
  it("maps genres to landmark types", () => {
    expect(landmarkTypeFor(["Techno"])).toBe("monster_stage");
    expect(landmarkTypeFor(["House"])).toBe("psychedelic_tent");
    expect(landmarkTypeFor(["Amapiano"])).toBe("cosmic_portal");
    expect(landmarkTypeFor(["Drum & Bass"])).toBe("speaker_towers");
    expect(landmarkTypeFor(["Psytrance"])).toBe("alien_sculpture");
  });

  it("every status has a text label and a glyph (never colour only)", () => {
    for (const s of Object.values(STATUS_META)) {
      expect(s.label.length).toBeGreaterThan(3);
      expect(s.glyph.length).toBeGreaterThan(0);
    }
    expect(STATUS_META.live.label).toBe("DEMO LIVE");
  });

  it("higher levels draw more structure; overlays follow status", () => {
    const pal: [string, string, string] = ["#B6F05C", "#A276E9", "#55BCEB"];
    const l1 = landmarkSvg({ type: "neon_gate", level: 1, status: "confirmed", palette: pal });
    const l5 = landmarkSvg({ type: "neon_gate", level: 5, status: "confirmed", palette: pal });
    expect(l5.length).toBeGreaterThan(l1.length * 1.5);
    expect(l5).toContain("lm-halo");
    expect(landmarkSvg({ type: "neon_gate", level: 3, status: "live", palette: pal })).toContain("lm-beam");
    expect(landmarkSvg({ type: "neon_gate", level: 3, status: "funding", palette: pal, fundingPct: 0.5 })).toContain("lm-ring");
    expect(landmarkSvg({ type: "neon_gate", level: 3, status: "cancelled", palette: pal })).toContain("#FF625C");
    expect(landmarkSvg({ type: "neon_gate", level: 3, status: "confirmed", palette: pal, animate: false })).toContain("lm-still");
    expect(orbSvg(2, "completed", "#fff")).toContain("★");
  });
});

const ev = (p: Partial<MapEventDto>): MapEventDto =>
  ({
    id: "x",
    name: "X",
    city: "Berlin",
    country: "Germany",
    venue: "Power Plant 9",
    location: { lat: 0, lng: 0, precision: "exact" },
    startsAt: "2026-12-01T20:00:00Z",
    endsAt: "2026-12-02T04:00:00Z",
    genres: ["Techno"],
    lineup: [{ id: "mika", name: "MOTHERBOARD MIKA" }],
    palette: ["#000000", "#000000", "#000000"],
    status: "confirmed",
    growth: base,
    goalUsd: 1,
    level: 1,
    landmark: { type: "monster_stage", theme: "event", approvedDesign: null },
    ranking: { rank: null, badge: null, category: "popular", period: "all", trendingRank: null, trendingGrowth: null, trendingPeriod: "7d", asOf: "" },
    dao: null,
    live: null,
    tickets: { onSale: true, remaining: 1, fromUsd: 1, demo: true },
    djRecruiting: false,
    afterParty: null,
    updatedAt: "",
    isDemo: true,
    ...p,
  }) as MapEventDto;

describe("world search, filters and URL", () => {
  const list = [ev({ id: "a", name: "NEON SLIME" }), ev({ id: "b", name: "OSAKA DREAM", city: "Osaka", country: "Japan", status: "funding", genres: ["Ambient"], lineup: [], venue: null }), ev({ id: "c", name: "OLD ONE", status: "completed" })];

  it("searches name, city, country, venue, DJ and genre", () => {
    expect(filterWorld(list, { ...EMPTY_MAP_FILTERS, q: "power plant" }).map((e) => e.id)).toEqual(["a", "c"]);
    expect(filterWorld(list, { ...EMPTY_MAP_FILTERS, q: "mika" }).map((e) => e.id)).toEqual(["a", "c"]);
    expect(filterWorld(list, { ...EMPTY_MAP_FILTERS, q: "japan" }).map((e) => e.id)).toEqual(["b"]);
    expect(filterWorld(list, { ...EMPTY_MAP_FILTERS, q: "ambient" }).map((e) => e.id)).toEqual(["b"]);
  });

  it("hides completed events unless asked for", () => {
    expect(filterWorld(list, EMPTY_MAP_FILTERS).map((e) => e.id)).toEqual(["a", "b"]);
    expect(filterWorld(list, { ...EMPTY_MAP_FILTERS, flags: ["completed"] }).map((e) => e.id)).toEqual(["c"]);
    expect(filterWorld(list, { ...EMPTY_MAP_FILTERS, flags: ["funding"] }).map((e) => e.id)).toEqual(["b"]);
  });

  it("suggests grouped results", () => {
    const s = suggest(list, "osa");
    expect(s[0]).toMatchObject({ kind: "event", label: "OSAKA DREAM" });
    expect(s.some((x) => x.kind === "city" && x.label === "Osaka")).toBe(true);
    expect(suggest(list, "")).toEqual([]);
  });

  it("round-trips filters through the URL and drops junk", () => {
    const st = { filters: { q: "tokyo", flags: ["live", "dao"] as const, levels: [3, 5], genres: ["Techno"], date: "30d", region: "as", kinds: ["club"] }, view: "list", event: "bassmutant-tokyo", city: null } as never;
    const qs = writeWorldUrl(st);
    expect(readWorldUrl(new URLSearchParams(qs))).toEqual(st);
    const bad = readWorldUrl(new URLSearchParams("f=live,hack&lv=9,2&g=Polka&date=x&view=grid&kind=club,bogus"));
    expect(bad.filters).toMatchObject({ flags: ["live"], levels: [2], genres: [], date: "any", kinds: ["club"] });
    expect(bad.view).toBe("map");
    expect(readWorldUrl(new URLSearchParams("rg=mars")).filters.region).toBeNull();
    // A city preview is kept in the URL only while no festival is open.
    const cityState = { filters: EMPTY_MAP_FILTERS, view: "map", event: null, city: "Ibiza|Spain" } as const;
    expect(readWorldUrl(new URLSearchParams(writeWorldUrl(cityState))).city).toBe("Ibiza|Spain");
    expect(writeWorldUrl({ ...cityState, event: "x" })).not.toContain("city=");
  });
});
