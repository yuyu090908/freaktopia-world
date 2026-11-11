/**
 * 11.0 GLOBAL DISCOVERY — unit tests on MOCK data only (tests/fixtures/ticketmaster-mock.json).
 * No network: every fetch goes through a fake fetcher. Nothing here is real event data.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fixture from "../fixtures/ticketmaster-mock.json";
import { ticketmaster } from "@/lib/discovery/adapters/ticketmaster";
import { bandsintown } from "@/lib/discovery/adapters/bandsintown";
import { fetchJson, redact, type Fetcher } from "@/lib/discovery/adapters/types";
import { classify } from "@/lib/discovery/classify";
import { compare, dedupe } from "@/lib/discovery/dedupe";
import { resolveLocation } from "@/lib/discovery/geo";
import { plainText, safeUrl } from "@/lib/discovery/safe";
import { inWhen } from "@/lib/discovery/time";
import { artistsMatching, filterUnified } from "@/lib/discovery/view";
import * as svc from "@/lib/discovery/service";
import type { UnifiedEvent } from "@/lib/discovery/types";
import { EMPTY_FILTERS, kindMatches, readEventsUrl, writeEventsUrl } from "@/lib/filters";
import { buildWorldMap, externalDto } from "@/lib/map/api";
import { EMPTY_MAP_FILTERS, eventsHrefFor, filterWorld, readWorldUrl, toWorldEvents } from "@/lib/map/view";
import { DEFAULT_GROWTH_CONFIG } from "@/lib/map/growth";
import { resetOpsMemory } from "@/lib/ops/store";
import { GENRES } from "@/lib/data";

const NOW = Date.parse("2026-11-09T14:00:00Z"); // Monday (the test clock)
const SYNCED = new Date(NOW).toISOString();
const raw = (id: string) => fixture._embedded.events.find((e) => e.id === id)!;
const norm = (id: string) => ticketmaster.normalize(raw(id), SYNCED);

/** A fake fetch serving the mock fixture (or a mutated copy). */
const serve = (body: unknown, status = 200): Fetcher => async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const ENV = ["TICKETMASTER_API_KEY", "TICKETMASTER_TERMS_ACCEPTED", "TICKETMASTER_COUNTRIES", "BANDSINTOWN_APP_ID", "BANDSINTOWN_APPROVED", "BANDSINTOWN_ARTISTS"];
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of ENV) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  resetOpsMemory();
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});
const connectTicketmaster = () => {
  process.env.TICKETMASTER_API_KEY = "mock-secret-key";
  process.env.TICKETMASTER_TERMS_ACCEPTED = "1";
};

describe("normalisation (Ticketmaster adapter, mock data)", () => {
  it("keeps the source fields on every event", () => {
    const e = norm("MOCK-FEST-1")!;
    expect(e).toMatchObject({
      id: "ticketmaster:MOCK-FEST-1",
      sourceType: "external",
      sourceName: "Ticketmaster",
      sourceEventId: "MOCK-FEST-1",
      sourceUrl: "https://www.ticketmaster.de/event/mock-fest-1",
      lastSyncedAt: SYNCED,
      lastVerifiedAt: SYNCED,
      verificationStatus: "source_verified",
      externalStatus: "scheduled",
      city: "Berlin",
      countryCode: "DE",
      venueTimezone: "Europe/Berlin",
      priceRange: { min: 59, max: 129, currency: "EUR" },
    });
    expect(e.lineup).toEqual([{ id: "ticketmaster:K-MOCK-A", name: "DJ Mockingbird", genre: "Techno", url: "https://www.ticketmaster.de/artist/mock-a" }]);
  });

  it("drops listings that fail validation instead of guessing", () => {
    expect(norm("MOCK-INVALID-7")).toBeNull();
    expect(ticketmaster.normalize({ nonsense: true }, SYNCED)).toBeNull();
  });

  it("converts venue-local time with the venue's zone", () => {
    const e = norm("MOCK-CLUB-2")!;
    expect(e.startsAtUtc).toBe("2026-11-14T14:00:00.000Z"); // 23:00 in Tokyo
    expect(e.timeTbd).toBe(false);
    const tbd = norm("MOCK-NOLOC-6")!;
    expect(tbd.timeTbd).toBe(true);
  });
});

describe("classification is never guessed", () => {
  it("major_festival only when the source says Festival", () => {
    expect(norm("MOCK-FEST-1")!.category).toBe("major_festival");
    expect(norm("MOCK-CLUB-2")!.category).toBe("dj_show"); // electronic with an artist, but not a festival
    expect(classify({ sourceSaysFestival: false, sourceGenres: ["Festival-sized techno"], artistCount: 40 })).toBe("dj_show");
    expect(classify({ sourceSaysFestival: false, sourceGenres: ["Rock"], artistCount: 0 })).toBe("general_music");
    expect(classify({ sourceSaysFestival: false, sourceGenres: [], artistCount: 1, venueType: "Nightclub" })).toBe("club_event");
  });
});

describe("location priority", () => {
  it("venue coordinates → city centre (approximate) → list only", () => {
    expect(norm("MOCK-FEST-1")).toMatchObject({ latitude: 52.5, longitude: 13.45, locationPrecision: "venue" });
    expect(norm("MOCK-CLUB-2")).toMatchObject({ latitude: 35.68, longitude: 139.69, locationPrecision: "city" });
    expect(norm("MOCK-NOLOC-6")).toMatchObject({ latitude: null, longitude: null, locationPrecision: null });
    expect(resolveLocation("0", "0", null).precision).toBeNull(); // 0,0 is never a real venue
  });

  it("an event without coordinates is not drawn on the map; an approximate one is marked", () => {
    expect(externalDto(norm("MOCK-NOLOC-6")!)).toBeNull();
    expect(externalDto(norm("MOCK-CLUB-2")!)!.location.precision).toBe("city");
    expect(externalDto(norm("MOCK-FEST-1")!)!.location.precision).toBe("exact");
  });
});

describe("security: URLs and text from a source are data", () => {
  it("strips scripts and tags, drops unsafe URLs and image hosts", () => {
    const e = norm("MOCK-XSS-5")!;
    expect(e.title).toBe("MOCK Bold Night");
    expect(e.title).not.toMatch(/[<>]/);
    expect(e.description).toBe("Doors & bar");
    expect(e.ticketUrl).toBeNull();
    expect(e.officialUrl).toBeNull();
    expect(e.imageUrl).toBeNull();
  });

  it("safeUrl and plainText", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("http://www.ticketmaster.com/x", ["ticketmaster.com"])).toBeNull();
    expect(safeUrl("https://user:pw@www.ticketmaster.com/x", ["ticketmaster.com"])).toBeNull();
    expect(safeUrl("https://ticketmaster.com.evil.example/x", ["ticketmaster.com"])).toBeNull();
    expect(safeUrl("https://www.ticketmaster.com/x", ["ticketmaster.com"])).toBe("https://www.ticketmaster.com/x");
    expect(plainText('<style>x{}</style><a href="x">Hi</a>\u0000')).toBe("Hi");
  });

  it("API keys are masked in anything logged or stored", () => {
    expect(redact("GET https://app.ticketmaster.com/discovery/v2/events.json?apikey=abc123&size=1 failed")).not.toContain("abc123");
    expect(redact("app_id=secret")).toBe("app_id=***");
  });
});

describe("dedupe only when confident", () => {
  it("merges the same night at the same venue, keeps another night apart", () => {
    const a = norm("MOCK-FEST-1")!;
    const dup = norm("MOCK-FEST-DUP-8")!;
    const night2 = norm("MOCK-FEST-NIGHT2-9")!;
    expect(compare(a, dup)).toBe("same");
    expect(compare(a, night2)).toBe("different");
    const { events } = dedupe([a, dup, night2]);
    expect(events).toHaveLength(2);
    expect(events.find((e) => e.mergedFrom)?.mergedFrom).toHaveLength(1);
  });

  it("a FREAKTOPIA listing outranks an external copy of it", () => {
    const ext = norm("MOCK-FEST-1")!;
    const own: UnifiedEvent = { ...ext, id: "freaktopia:x", sourceType: "freaktopia", sourceName: "FREAKTOPIA", ticketUrl: null };
    const { events } = dedupe([ext, own]);
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe("freaktopia:x");
    expect(events[0].ticketUrl).toBe(ext.ticketUrl); // gaps filled, nothing overwritten
  });
});

describe("dates in the venue's time zone", () => {
  it("'today' differs between Tokyo and New York for the same instant", () => {
    const at = "2026-11-09T23:30:00Z"; // Tokyo: 10 Nov 08:30 · New York: 9 Nov 18:30
    expect(inWhen(at, null, "Asia/Tokyo", "today", NOW)).toBe(false);
    expect(inWhen(at, null, "America/New_York", "today", NOW)).toBe(true);
  });

  it("this weekend = Friday to Sunday, locally", () => {
    expect(inWhen(norm("MOCK-FEST-1")!.startsAtUtc, null, "Europe/Berlin", "weekend", NOW)).toBe(true); // Fri 13 Nov
    expect(inWhen("2026-11-16T20:00:00Z", null, "Europe/Berlin", "weekend", NOW)).toBe(false); // Monday
    expect(inWhen("2026-11-08T20:00:00Z", null, "Europe/Berlin", "7d", NOW)).toBe(false); // already over
  });
});

describe("sources stay off until connected and approved", () => {
  it("a key alone is not enough for Ticketmaster", async () => {
    expect(ticketmaster.state()).toBe("not_configured");
    process.env.TICKETMASTER_API_KEY = "mock-secret-key";
    expect(ticketmaster.state()).toBe("unapproved");
    const r = await svc.syncSource("ticketmaster", serve(fixture), NOW);
    expect(r.skipped).toBe("unapproved");
    expect((await svc.publicEvents({}, NOW)).events).toHaveLength(0);
  });

  it("Bandsintown with an app id but no written approval stays unapproved and fetches nothing", async () => {
    process.env.BANDSINTOWN_APP_ID = "mock-app";
    expect(bandsintown.state()).toBe("unapproved");
    let called = false;
    expect(await bandsintown.fetchEvents({ from: SYNCED, to: SYNCED }, async () => ((called = true), new Response("[]")))).toEqual([]);
    expect(called).toBe(false);
  });

  it("source status lists env var names, never values", async () => {
    process.env.TICKETMASTER_API_KEY = "mock-secret-key";
    const s = await svc.sourceStatuses();
    expect(JSON.stringify(s)).not.toContain("mock-secret-key");
    expect(s.find((x) => x.id === "ticketmaster")?.needs).toContain("TICKETMASTER_API_KEY");
  });
});

describe("sync, public list, changes and moderation (mock fetcher)", () => {
  it("serves only valid, upcoming, not-cancelled events", async () => {
    connectTicketmaster();
    const r = await svc.syncSource("ticketmaster", serve(fixture), NOW);
    expect(r).toMatchObject({ fetched: 9, invalid: 1, stored: 7 }); // 8 valid, the same-night duplicate merged
    const ids = (await svc.publicEvents({}, NOW)).events.map((e) => e.id);
    expect(ids).not.toContain("ticketmaster:MOCK-CANCEL-3");
    expect(ids).toContain("ticketmaster:MOCK-POSTPONED-4");
    expect(ids).toContain("ticketmaster:MOCK-NOLOC-6"); // list only, still public
  });

  it("detects changes and keeps the admin's hide flag across refreshes", async () => {
    connectTicketmaster();
    await svc.syncSource("ticketmaster", serve(fixture), NOW);
    await svc.setHidden("ticketmaster:MOCK-CLUB-2", true);
    const moved = structuredClone(fixture);
    moved._embedded.events[1].dates.start.localTime = "22:00:00";
    await svc.syncSource("ticketmaster", serve(moved), NOW + 3 * 36e5);
    const q = await svc.quality(NOW);
    expect(q.changes[0]).toMatchObject({ eventId: "ticketmaster:MOCK-CLUB-2", fields: ["date"] });
    expect(q.hidden.map((e) => e.id)).toEqual(["ticketmaster:MOCK-CLUB-2"]);
    expect((await svc.publicEvents({}, NOW)).events.map((e) => e.id)).not.toContain("ticketmaster:MOCK-CLUB-2");
  });

  it("a source error keeps the last good cache and never stores the key", async () => {
    connectTicketmaster();
    await svc.syncSource("ticketmaster", serve(fixture), NOW);
    const failing: Fetcher = async (url) => {
      throw new Error(`fetch failed: ${url}`);
    };
    const r = await svc.syncSource("ticketmaster", failing, NOW + 36e5);
    expect(r.error).toBeTruthy();
    expect(r.error).not.toContain("mock-secret-key");
    const st = (await svc.sourceStatuses()).find((s) => s.id === "ticketmaster")!;
    expect(st.state).toBe("error");
    expect(st.lastError).not.toContain("mock-secret-key");
    expect((await svc.publicEvents({}, NOW)).events.length).toBeGreaterThan(0);
  });

  it("the world map still loads FREAKTOPIA events when the source is down", async () => {
    connectTicketmaster();
    await svc.syncSource("ticketmaster", serve({ error: "boom" }, 500), NOW);
    const map = await buildWorldMap(NOW);
    expect(map.events.some((e) => e.source === "sample")).toBe(true);
    expect(map.events.some((e) => e.source === "external")).toBe(false);
  });

  it("purge removes cached data and pauses the source", async () => {
    connectTicketmaster();
    await svc.syncSource("ticketmaster", serve(fixture), NOW);
    expect(await svc.purgeSource("ticketmaster")).toBe(7);
    expect((await svc.publicEvents({}, NOW)).events).toHaveLength(0);
    expect((await svc.syncSource("ticketmaster", serve(fixture), NOW)).skipped).toBe("paused");
  });

  it("fetchJson retries 429 and gives up on 4xx", async () => {
    let n = 0;
    const flaky: Fetcher = async () => (++n < 2 ? new Response("", { status: 429 }) : new Response('{"ok":1}'));
    expect(await fetchJson(flaky, "https://x.test", { retries: 2 })).toEqual({ ok: 1 });
    await expect(fetchJson(serve({}, 403), "https://x.test")).rejects.toThrow("HTTP 403");
  });
});

describe("map entries for external events", () => {
  it("carry provenance and no FREAKTOPIA tickets, level growth, DAO or DJ calls", () => {
    const d = externalDto(norm("MOCK-FEST-1")!)!;
    expect(d.source).toBe("external");
    expect(d.external).toMatchObject({ sourceName: "Ticketmaster", sourceEventId: "MOCK-FEST-1", category: "major_festival", lastVerifiedAt: SYNCED });
    expect(d.tickets.onSale).toBe(false);
    expect(d.dao).toBeNull();
    expect(d.live).toBeNull();
    expect(d.djRecruiting).toBe(false);
    expect(d.growth.supporters).toBe(0);
  });
});

describe("DJ search by artist id", () => {
  it("two artists with the same name stay two", () => {
    const list = [norm("MOCK-FEST-1")!, norm("MOCK-CLUB-2")!];
    const found = artistsMatching(list, "mockingbird");
    expect(found.map((a) => a.id).sort()).toEqual(["ticketmaster:K-MOCK-A", "ticketmaster:K-MOCK-B"]);
    expect(filterUnified(list, EMPTY_FILTERS, NOW, "ticketmaster:K-MOCK-B").map((e) => e.city)).toEqual(["Tokyo"]);
  });
});

describe("shared filters across WORLD and EVENTS", () => {
  it("kind: festival / club / DJ come from source data; FREAKTOPIA only = own listings", () => {
    expect(kindMatches(["festival"], "major_festival")).toBe(true);
    expect(kindMatches(["festival"], null)).toBe(false);
    expect(kindMatches(["freaktopia"], null)).toBe(true);
    expect(kindMatches(["freaktopia"], "dj_show")).toBe(false);
    const world = toWorldEvents([externalDto(norm("MOCK-FEST-1")!)!, externalDto(norm("MOCK-CLUB-2")!)!], DEFAULT_GROWTH_CONFIG);
    expect(filterWorld(world, { ...EMPTY_MAP_FILTERS, kinds: ["festival"] }, NOW).map((e) => e.id)).toEqual(["ticketmaster:MOCK-FEST-1"]);
    expect(filterWorld(world, { ...EMPTY_MAP_FILTERS, kinds: ["freaktopia"] }, NOW)).toHaveLength(0);
  });

  it("the search carries from WORLD to EVENTS and back through the URL", () => {
    const href = eventsHrefFor({ ...EMPTY_MAP_FILTERS, q: "techno", genres: ["Techno"], date: "weekend", kinds: ["festival", "djs"] });
    expect(href).toBe("/events?q=techno&genre=Techno&date=weekend&kind=festival%2Cdjs");
    const ev = readEventsUrl(href.slice("/events".length), GENRES);
    expect(ev.filters).toMatchObject({ q: "techno", genres: ["Techno"], date: "weekend", kinds: ["festival", "djs"] });
    const w = readWorldUrl(new URLSearchParams(writeEventsUrl(ev.filters, "soonest")));
    expect(w.filters).toMatchObject({ q: "techno", genres: ["Techno"], date: "weekend", kinds: ["festival", "djs"] });
  });
});
