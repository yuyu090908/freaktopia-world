import { describe, expect, it } from "vitest";
import { buildSets, currentAndNext, localDate, tzOffset, zonedToUtc } from "@/lib/live/time";
import { ReactionLimiter, energyTarget, levelFor, stepEnergy } from "@/lib/live/energy";
import { LIVE_QUESTS, applySignal, emptyProgress } from "@/lib/live/quests";
import { attendance, parseQr, qrFor, verifyCheckin, type TicketRow } from "@/lib/live/checkin";
import { isRealLive, DEMO_RIGHTS } from "@/lib/live/streaming";
import { ZONES, iso, pointAt, walkPath, zoneById } from "@/lib/live/zones";
import type { CheckinRecord } from "@/lib/live/types";
import { getEvent } from "@/lib/data";

describe("live time zones", () => {
  it("converts venue wall-clock to UTC, DST-safe", () => {
    expect(new Date(zonedToUtc("2026-11-09", "22:00", "Asia/Tokyo")).toISOString()).toBe("2026-11-09T13:00:00.000Z");
    // Berlin: CEST (+2) in July, CET (+1) in January
    expect(new Date(zonedToUtc("2026-07-01", "22:00", "Europe/Berlin")).toISOString()).toBe("2026-07-01T20:00:00.000Z");
    expect(new Date(zonedToUtc("2027-01-01", "22:00", "Europe/Berlin")).toISOString()).toBe("2027-01-01T21:00:00.000Z");
    // New York across the November DST end
    expect(new Date(zonedToUtc("2026-11-01", "12:00", "America/New_York")).toISOString()).toBe("2026-11-01T17:00:00.000Z");
    expect(tzOffset(Date.parse("2026-07-01T00:00:00Z"), "America/New_York")).toBe(-4 * 3600_000);
    expect(localDate(Date.parse("2026-11-09T16:00:00Z"), "Asia/Tokyo")).toBe("2026-11-10");
  });

  it("rolls sets after midnight to the next local day and finds now/next", () => {
    const e = getEvent("bassmutant-tokyo")!;
    const sets = buildSets(e);
    expect(sets[0].startAt).toBe(Date.parse("2026-11-09T13:00:00Z"));
    for (let i = 1; i < sets.length; i++) expect(sets[i].startAt).toBeGreaterThan(sets[i - 1].startAt - 1);
    for (const s of sets) expect(s.endAt).toBeGreaterThan(s.startAt);
    const main = sets.filter((s) => s.stageId === "main");
    const mid = main[0].startAt + 60_000;
    const r = currentAndNext(sets, "main", mid);
    expect(r.current?.id).toBe(main[0].id);
    expect(r.next?.id).toBe(main[1]?.id ?? null);
    expect(currentAndNext(sets, "main", main.at(-1)!.endAt + 1).current).toBeNull();
  });
});

describe("energy (game metric)", () => {
  it("maps levels to the spec ranges", () => {
    expect(levelFor(0).key).toBe("WARM_UP");
    expect(levelFor(24).key).toBe("WARM_UP");
    expect(levelFor(25).key).toBe("GROOVE");
    expect(levelFor(50).key).toBe("BUILD_UP");
    expect(levelFor(75).key).toBe("PEAK_TIME");
    expect(levelFor(94).key).toBe("PEAK_TIME");
    expect(levelFor(95).key).toBe("ALIEN_INVASION");
    expect(levelFor(100).key).toBe("ALIEN_INVASION");
  });
  it("stays within 0-100 and is 0 with nobody there", () => {
    expect(energyTarget({ activeParticipants: 0, validReactions: 999, questCompletions: 9, setParticipants: 0 })).toBe(0);
    const t = energyTarget({ activeParticipants: 5000, validReactions: 1e6, questCompletions: 1e5, setParticipants: 5000 });
    expect(t).toBeLessThanOrEqual(100);
    expect(t).toBeGreaterThan(95);
  });
  it("one person can't spike it: rate limit + capped steps", () => {
    const lim = new ReactionLimiter(6, 60_000);
    const counted = Array.from({ length: 50 }, (_, i) => lim.allow("spammer", 1000 + i)).filter(Boolean).length;
    expect(counted).toBe(6);
    expect(lim.allow("someone-else", 2000)).toBe(true);
    expect(lim.allow("spammer", 1000 + 61_000)).toBe(true);
    // solo user with 6 counted reactions
    const solo = energyTarget({ activeParticipants: 1, validReactions: 6, questCompletions: 0, setParticipants: 1 });
    expect(solo).toBeLessThan(70);
    expect(stepEnergy(10, 100)).toBe(16);
    expect(stepEnergy(90, 0)).toBe(84);
  });
});

describe("live quests", () => {
  it("completes online quests from signals", () => {
    let p = emptyProgress();
    const done: string[] = [];
    for (const z of ["main", "lounge", "bar", "food", "entrance", "portal"] as const) {
      const r = applySignal(p, { kind: "zone", zone: z });
      p = r.next;
      done.push(...r.completed.map((q) => q.id));
    }
    expect(done).toEqual(expect.arrayContaining(["visit-main", "explore-lounge", "festival-tour"]));
    // completed quests don't complete twice
    expect(applySignal(p, { kind: "zone", zone: "main" }).completed).toEqual([]);
    let w = emptyProgress();
    for (let i = 0; i < 17; i++) w = applySignal(w, { kind: "watch_seconds", seconds: 10 }).next;
    expect(w.completed).not.toContain("watch-set");
    expect(applySignal(w, { kind: "watch_seconds", seconds: 10 }).completed.map((q) => q.id)).toEqual(["watch-set"]);
  });
  it("watching or a demo check-in never completes the on-site quest", () => {
    let p = emptyProgress();
    p = applySignal(p, { kind: "watch_seconds", seconds: 99999 }).next;
    p = applySignal(p, { kind: "checkin_verified", demo: true }).next;
    expect(p.completed).not.toContain("onsite-checkin");
    expect(applySignal(p, { kind: "checkin_verified", demo: false }).completed.map((q) => q.id)).toEqual(["onsite-checkin"]);
    expect(LIVE_QUESTS.find((q) => q.id === "onsite-checkin")!.kind).toBe("onsite");
  });
});

describe("ticket check-in", () => {
  const secret = "x".repeat(40);
  const tickets = new Map<string, TicketRow>([
    ["t-ok-1", { id: "t-ok-1", eventId: "ev-a", holder: "a", kind: "main", status: "valid", demo: false }],
    ["t-cxl-1", { id: "t-cxl-1", eventId: "ev-a", holder: "b", kind: "main", status: "cancelled", demo: false }],
    ["t-b-1", { id: "t-b-1", eventId: "ev-b", holder: "c", kind: "main", status: "valid", demo: false }],
  ]);
  const base = { eventId: "ev-a", now: 5000, entryOpensAt: 0, entryClosesAt: 10_000, method: "ticket_qr" as const, by: "door", demo: false };

  it("accepts once, then rejects re-use", () => {
    const checkins: CheckinRecord[] = [];
    const r = verifyCheckin({ ...base, qr: qrFor(secret, "ev-a", "t-ok-1") }, secret, tickets, checkins);
    expect(r.ok).toBe(true);
    if (r.ok) checkins.push(r.record);
    const again = verifyCheckin({ ...base, qr: qrFor(secret, "ev-a", "t-ok-1") }, secret, tickets, checkins);
    expect(again).toEqual({ ok: false, code: "TICKET_ALREADY_USED" });
  });
  it("rejects malformed, forged, wrong event, unknown, cancelled and out-of-window", () => {
    const v = (qr: string, extra = {}) => verifyCheckin({ ...base, qr, ...extra }, secret, tickets, []);
    expect(v("hello")).toEqual({ ok: false, code: "QR_MALFORMED" });
    expect(v(qrFor("y".repeat(40), "ev-a", "t-ok-1"))).toEqual({ ok: false, code: "QR_SIGNATURE_INVALID" });
    expect(v(qrFor(secret, "ev-b", "t-b-1"))).toEqual({ ok: false, code: "WRONG_EVENT" });
    expect(v(qrFor(secret, "ev-a", "nope-1"))).toEqual({ ok: false, code: "TICKET_NOT_FOUND" });
    expect(v(qrFor(secret, "ev-a", "t-b-1"))).toEqual({ ok: false, code: "TICKET_NOT_FOUND" });
    expect(v(qrFor(secret, "ev-a", "t-cxl-1"))).toEqual({ ok: false, code: "TICKET_CANCELLED" });
    expect(v(qrFor(secret, "ev-a", "t-ok-1"), { now: 20_000 })).toEqual({ ok: false, code: "NOT_ENTRY_TIME" });
    expect(parseQr(qrFor(secret, "ev-a", "t-ok-1"))?.ticketId).toBe("t-ok-1");
  });
  it("keeps demo check-ins out of production attendance", () => {
    const t: TicketRow[] = [...tickets.values(), { id: "d-1", eventId: "ev-a", holder: "x", kind: "main", status: "valid", demo: true }];
    const c: CheckinRecord[] = [
      { ticketId: "t-ok-1", eventId: "ev-a", at: 1, method: "ticket_qr", by: "door", demo: false },
      { ticketId: "d-1", eventId: "ev-a", at: 2, method: "ticket_qr", by: "door", demo: true },
    ];
    expect(attendance(t, c, [], "ev-a", false)).toMatchObject({ ticketsSold: 1, checkedIn: 1, currentlyPresent: 1 });
    expect(attendance(t, c, [], "ev-a", true)).toMatchObject({ ticketsSold: 2, checkedIn: 2 });
    expect(attendance(t, c, [{ ticketId: "t-ok-1", at: 3 }], "ev-a", false).currentlyPresent).toBe(0);
  });
});

describe("streams & map", () => {
  it("only a licensed, consented, connected stream is real LIVE", () => {
    expect(isRealLive({ stageId: "main", provider: "demo", playbackId: "x", rights: { ...DEMO_RIGHTS, broadcastConsent: true, musicLicensed: true }, qualities: ["auto"] })).toBe(false);
    expect(isRealLive({ stageId: "main", provider: "mux", playbackId: null, rights: DEMO_RIGHTS, qualities: ["auto"] })).toBe(false);
  });
  it("has 10 non-overlapping zones and walk paths end at the target", () => {
    expect(ZONES).toHaveLength(10);
    for (const a of ZONES)
      for (const b of ZONES) {
        if (a === b) continue;
        const overlap = a.gx < b.gx + b.w && b.gx < a.gx + a.w && a.gy < b.gy + b.h && b.gy < a.gy + a.h;
        expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    const path = walkPath(zoneById("entrance"), zoneById("main"));
    expect(pointAt(path, 1)).toEqual(path.at(-1));
    expect(iso(1, 1)).toEqual({ x: 0, y: 32 });
  });
});
