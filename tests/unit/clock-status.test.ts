import { describe, expect, it } from "vitest";
import { effectiveStatus } from "@/lib/clock";
import { displayStatus, fromPrice, showsSupport, ticketsOnSale } from "@/lib/event-status";
import { EMPTY_FILTERS, filterCommunity, filterEvents } from "@/lib/filters";
import { filterWorld, EMPTY_MAP_FILTERS, type WorldEvent } from "@/lib/map/view";
import { EVENTS } from "@/lib/data";

const H = 3600_000;
const ev = { startsAt: "2026-11-09T13:00:00Z", endsAt: "2026-11-09T21:00:00Z" };

describe("statuses follow the clock (no past event as upcoming or live)", () => {
  it("a live event outside its window is confirmed before and ended after", () => {
    expect(effectiveStatus({ ...ev, status: "live" }, Date.parse(ev.startsAt) - H)).toBe("confirmed");
    expect(effectiveStatus({ ...ev, status: "live" }, Date.parse(ev.startsAt) + H)).toBe("live");
    expect(effectiveStatus({ ...ev, status: "live" }, Date.parse(ev.endsAt) + 1)).toBe("ended");
  });
  it("any status becomes ended once the end has passed (real today: 2026-11-11)", () => {
    const today = Date.parse("2026-11-11T09:00:00Z");
    for (const s of ["funding", "confirmed", "live"] as const) expect(effectiveStatus({ ...ev, status: s }, today)).toBe("ended");
    expect(effectiveStatus({ startsAt: "2026-12-12T21:00:00Z", endsAt: "2026-12-14T08:00:00Z", status: "confirmed" }, today)).toBe("confirmed");
  });
  it("a sample event is never plain live: only demo_live", () => {
    expect(displayStatus({ status: "live", isDemo: true }, true)).toBe("demo_live");
    expect(displayStatus({ status: "ended", isDemo: true })).toBe("completed");
  });
});

describe("card rules", () => {
  it("price only while tickets are on sale; support only while funding", () => {
    const funding = EVENTS.find((e) => e.status === "funding")!;
    const confirmed = EVENTS.find((e) => e.status === "confirmed")!;
    expect(ticketsOnSale(funding)).toBe(false);
    expect(fromPrice(funding)).toBeNull();
    expect(showsSupport(funding)).toBe(true);
    expect(fromPrice(confirmed)).toBe(Math.min(...confirmed.tickets.map((t) => t.price)));
    expect(showsSupport(confirmed)).toBe(false);
    expect(fromPrice({ status: "ended", tickets: confirmed.tickets })).toBeNull();
  });
});

describe("filters: OR inside a group, AND across groups", () => {
  it("events", () => {
    const funding = filterEvents(EVENTS, { ...EMPTY_FILTERS, statuses: ["funding"] }).length;
    const confirmed = filterEvents(EVENTS, { ...EMPTY_FILTERS, statuses: ["confirmed"] }).length;
    expect(filterEvents(EVENTS, { ...EMPTY_FILTERS, statuses: ["funding", "confirmed"] }).length).toBe(funding + confirmed);
    const both = filterEvents(EVENTS, { ...EMPTY_FILTERS, statuses: ["funding"], djWanted: true });
    expect(both.every((e) => e.status === "funding" && e.djRecruiting)).toBe(true);
    // A price filter leaves out events with nothing on sale.
    expect(filterEvents(EVENTS, { ...EMPTY_FILTERS, price: "u60" }).every((e) => ticketsOnSale(e))).toBe(true);
  });
  it("community parties: no invented fields, so level/price/DJ filters leave them out", () => {
    const p = [{ id: "1", name: "SLIME SYSTEM", city: "Bangkok", startAt: "2026-12-02T13:00:00Z", endAt: "2026-12-02T20:00:00Z", genres: ["Techno"] }];
    expect(filterCommunity(p, EMPTY_FILTERS)).toHaveLength(1);
    expect(filterCommunity(p, { ...EMPTY_FILTERS, statuses: ["confirmed"] })).toHaveLength(1);
    expect(filterCommunity(p, { ...EMPTY_FILTERS, statuses: ["funding"] })).toHaveLength(0);
    expect(filterCommunity(p, { ...EMPTY_FILTERS, price: "free" })).toHaveLength(0);
    expect(filterCommunity(p, { ...EMPTY_FILTERS, place: "Tokyo" })).toHaveLength(0);
  });
  it("world map status flags are OR, feature flags AND", () => {
    const mk = (id: string, status: WorldEvent["status"], djRecruiting: boolean) => ({ id, name: id, city: "X", country: "Japan", venue: null, genres: [], lineup: [], status, djRecruiting, startsAt: "2027-01-01T00:00:00Z", endsAt: "2027-01-02T00:00:00Z", live: null, dao: null, afterParty: null, level: 1 }) as unknown as WorldEvent;
    const list = [mk("a", "funding", true), mk("b", "confirmed", false), mk("c", "confirmed", true)];
    expect(filterWorld(list, { ...EMPTY_MAP_FILTERS, flags: ["funding", "confirmed"] }).map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(filterWorld(list, { ...EMPTY_MAP_FILTERS, flags: ["confirmed", "djWanted"] }).map((e) => e.id)).toEqual(["c"]);
  });
});
