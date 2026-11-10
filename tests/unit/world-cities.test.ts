import { describe, expect, it } from "vitest";
import { SIGNATURE_CITIES, buildCities, cityScale, citySvg, countsOf, eventPriority, signatureOf } from "@/lib/map/cities";
import { REGION_COLOR, REGION_KEYS, REGION_VIEW, isRegionKey, mix, regionOfCountry } from "@/lib/map/regions";
import { EMPTY_MAP_FILTERS, filterCount, filterWorld, suggestRegions, type WorldEvent } from "@/lib/map/view";

const NOW = Date.parse("2026-11-09T12:00:00Z");

const ev = (p: Partial<WorldEvent>): WorldEvent =>
  ({
    id: "x",
    name: "X",
    city: "Berlin",
    country: "Germany",
    venue: null,
    location: { lat: 52.5, lng: 13.4, precision: "exact" },
    startsAt: "2026-12-01T20:00:00Z",
    endsAt: "2026-12-02T04:00:00Z",
    genres: ["Techno"],
    lineup: [],
    palette: ["#000000", "#000000", "#000000"],
    status: "confirmed",
    growth: { supporters: 0, stakers: 0, fundingUsd: 0, venueContract: false, approvals: 0 },
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
    growthResult: {} as never,
    ...p,
  }) as WorldEvent;

const LIVE = { status: "demo_live", currentDj: null, onlineViewers: 0, checkedIn: 0, publicAvatars: 0, ticketsSold: 0, demo: true } as const;

describe("display regions", () => {
  it("maps countries to the seven colour regions, keeping the Middle East apart from Asia", () => {
    expect(regionOfCountry("Japan")).toBe("as");
    expect(regionOfCountry("Germany")).toBe("eu");
    expect(regionOfCountry("United Arab Emirates")).toBe("me");
    expect(regionOfCountry("UAE")).toBe("me");
    expect(regionOfCountry("Brazil")).toBe("sa");
    expect(regionOfCountry("United States")).toBe("na");
    expect(regionOfCountry("USA")).toBe("na");
    expect(regionOfCountry("Nigeria")).toBe("af");
    expect(regionOfCountry("Australia")).toBe("oc");
    expect(regionOfCountry("Atlantis")).toBeNull();
  });

  it("has a colour for every region, a camera view for the seven focus regions, and rejects unknown keys", () => {
    expect(Object.keys(REGION_COLOR)).toHaveLength(8);
    expect(REGION_COLOR.na).toBe("#00DFFF");
    expect(REGION_COLOR.af).toBe("#39FF70");
    for (const k of REGION_KEYS) expect(REGION_VIEW[k].zoom).toBeGreaterThan(1);
    expect(isRegionKey("eu")).toBe(true);
    expect(isRegionKey("an")).toBe(false);
    expect(isRegionKey("mars")).toBe(false);
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("region focus filters by the event's country and counts as a filter", () => {
    const list = [ev({ id: "a" }), ev({ id: "b", city: "Tokyo", country: "Japan" }), ev({ id: "c", city: "Lagos", country: "Nigeria" })];
    expect(filterWorld(list, { ...EMPTY_MAP_FILTERS, region: "as" }, NOW).map((e) => e.id)).toEqual(["b"]);
    expect(filterWorld(list, { ...EMPTY_MAP_FILTERS, region: "eu" }, NOW).map((e) => e.id)).toEqual(["a"]);
    expect(filterCount({ ...EMPTY_MAP_FILTERS, region: "af" })).toBe(1);
    const s = suggestRegions(list, "afri", { af: ["アフリカ", "Africa"], eu: ["ヨーロッパ", "Europe"] });
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ kind: "region", region: "af", label: "アフリカ", eventIds: ["c"] });
    expect(suggestRegions(list, "a", { af: ["Africa"] })).toEqual([]);
  });
});

describe("party cities", () => {
  it("groups shown events by city at the average of their real coordinates", () => {
    const list = [
      ev({ id: "a", location: { lat: 52, lng: 13, precision: "exact" } }),
      ev({ id: "b", location: { lat: 53, lng: 14, precision: "city" } }),
      ev({ id: "c", city: "Ibiza", country: "Spain", location: { lat: 38.9, lng: 1.4, precision: "exact" } }),
    ];
    const cities = buildCities(list, NOW);
    expect(cities).toHaveLength(2);
    const berlin = cities.find((c) => c.city === "Berlin")!;
    expect(berlin).toMatchObject({ key: "Berlin|Germany", lat: 52.5, lng: 13.5, signature: "berlin", region: "eu" });
    expect(berlin.counts.total).toBe(2);
    expect(cities.find((c) => c.city === "Ibiza")!.signature).toBe("ibiza");
  });

  it("orders events live → soonest upcoming → featured → the rest", () => {
    const live = ev({ id: "live", status: "live", live: LIVE });
    const soon = ev({ id: "soon", startsAt: "2026-11-20T20:00:00Z" });
    const later = ev({ id: "later", startsAt: "2027-03-01T20:00:00Z" });
    const featuredPast = ev({ id: "feat", status: "completed", startsAt: "2026-01-01T20:00:00Z", ranking: { ...ev({}).ranking, rank: 1, badge: "champion" } });
    const past = ev({ id: "past", status: "completed", startsAt: "2026-01-01T20:00:00Z" });
    const sorted = [past, featuredPast, later, soon, live].sort((a, b) => eventPriority(b, NOW) - eventPriority(a, NOW)).map((e) => e.id);
    expect(sorted).toEqual(["live", "soon", "later", "feat", "past"]);
    const [city] = buildCities([past, later, live], NOW);
    expect(city.events[0].id).toBe("live");
  });

  it("counts the preview numbers from the shown events only", () => {
    const c = countsOf(
      [
        ev({ id: "1", status: "funding", djRecruiting: true }),
        ev({ id: "2", status: "live", live: LIVE, dao: { tier: 1 } as never }),
        ev({ id: "3", afterParty: { id: "ap", name: "AP", startsAt: "", venue: "" } }),
        ev({ id: "4", status: "completed", startsAt: "2026-01-01T00:00:00Z" }),
      ],
      NOW,
    );
    expect(c).toEqual({ total: 4, live: 1, upcoming: 2, djWanted: 1, funding: 1, dao: 1, afterParty: 1, completed: 1 });
  });

  it("knows the signature cities by name, accents and case", () => {
    expect(signatureOf("NEW YORK")).toBe("new_york");
    expect(signatureOf("Rio de Janeiro")).toBe("rio");
    expect(signatureOf(" dubai ")).toBe("dubai");
    expect(signatureOf("Lagos")).toBeNull();
    for (const s of ["berlin", "ibiza", "bangkok", "new_york", "dubai", "rio", "sydney"]) expect(SIGNATURE_CITIES).toContain(s);
  });

  it("scales icons by event count within a cap, with fixed rings and a live pulse (no popularity input)", () => {
    expect(cityScale(1)).toBeCloseTo(0.92);
    expect(cityScale(2)).toBeGreaterThan(cityScale(1));
    expect(cityScale(1000)).toBe(1.45);
    const rings = (svg: string) => (svg.match(/<ellipse cx="60" cy="102"/g) ?? []).length;
    expect(rings(citySvg({ signature: null, region: "af", live: false, count: 1, animate: false }))).toBe(1);
    expect(rings(citySvg({ signature: null, region: "af", live: false, count: 9, animate: false }))).toBe(3);
    const live = citySvg({ signature: "berlin", region: "eu", live: true, count: 2, animate: true });
    expect(live).toContain("wm-city-live");
    expect(live).not.toContain("lm-still");
    expect(citySvg({ signature: "berlin", region: "eu", live: false, count: 2, animate: false })).not.toContain("wm-city-live");
    // Every signature and the generic stage render.
    for (const s of SIGNATURE_CITIES) expect(citySvg({ signature: s, region: "eu", live: false, count: 1, animate: false })).toMatch(/^<svg[\s\S]*<\/svg>$/);
  });
});
