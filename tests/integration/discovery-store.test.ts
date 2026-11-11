/**
 * 11.0 discovery cache on PostgreSQL (migration 0011), with MOCK data. Runs only when TEST_DATABASE_URL points at a
 * database with db/migrations applied; otherwise skipped (the same paths run on the memory store in tests/unit/discovery.test.ts).
 */
import { describe, expect, it } from "vitest";
import fixture from "../fixtures/ticketmaster-mock.json";
import { createPgOpsStore, setOpsStore } from "@/lib/ops/store";
import * as svc from "@/lib/discovery/service";

const NOW = Date.parse("2026-11-09T14:00:00Z");
const serve = (body: unknown) => async () => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

describe.skipIf(!process.env.TEST_DATABASE_URL)("discovery cache on PostgreSQL (mock data)", () => {
  it("sync → public list → change → hide → purge", async () => {
    setOpsStore(createPgOpsStore(process.env.TEST_DATABASE_URL!));
    process.env.TICKETMASTER_API_KEY = "mock-secret-key";
    process.env.TICKETMASTER_TERMS_ACCEPTED = "1";
    await svc.purgeSource("ticketmaster"); // clean start on a re-run
    await svc.setPaused("ticketmaster", false);
    expect(await svc.syncSource("ticketmaster", serve(fixture), NOW)).toMatchObject({ stored: 7, invalid: 1 });
    const ids = (await svc.publicEvents({}, NOW)).events.map((e) => e.id);
    expect(ids).toContain("ticketmaster:MOCK-FEST-1");
    expect(ids).not.toContain("ticketmaster:MOCK-CANCEL-3");
    await svc.setHidden("ticketmaster:MOCK-FEST-1", true);
    const moved = structuredClone(fixture);
    moved._embedded.events[0].dates.start.dateTime = "2026-11-13T22:00:00Z";
    await svc.syncSource("ticketmaster", serve(moved), NOW + 36e5);
    const q = await svc.quality(NOW);
    expect(q.hidden.map((e) => e.id)).toEqual(["ticketmaster:MOCK-FEST-1"]);
    expect(q.changes.some((c) => c.eventId === "ticketmaster:MOCK-FEST-1" && c.fields.includes("date"))).toBe(true);
    const st = (await svc.sourceStatuses()).find((s) => s.id === "ticketmaster")!;
    expect(st.eventCount).toBe(7);
    expect(await svc.purgeSource("ticketmaster")).toBe(7);
    expect((await svc.publicEvents({}, NOW)).events).toHaveLength(0);
  });
});
