import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { rollAlien } from "@/lib/alien/generate";
import { demoOutboxFor } from "@/lib/auth/mail";
import { memoryStore, resetMemoryStore } from "@/lib/auth/memory";
import { createPgStore } from "@/lib/auth/pg";
import { getStore, setStore } from "@/lib/auth/store";
import type { AuthStore } from "@/lib/auth/types";
import * as ops from "@/lib/ops/service";
import { createPgOpsStore, getOpsStore, memoryOpsStore, resetOpsMemory, setOpsStore, type OpsStore } from "@/lib/ops/store";
import { OpsError, type OpsEvent } from "@/lib/ops/types";
import * as party from "@/lib/party/service";
import * as loyalty from "@/lib/loyalty/service";
import { DEFAULT_RULES } from "@/lib/loyalty/rules";

let n = 0;
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const code = async (p: Promise<unknown>) => p.then(() => "OK", (e) => (e instanceof OpsError ? e.code : String(e)));
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();

async function user(opts: { verified?: boolean; avatar?: "public" | "private"; profile?: "public" | "private" } = {}) {
  const email = `party-${RUN}-${++n}@example.test`;
  const u = await getStore().createUser({ email, passwordHash: null, emailVerified: opts.verified ?? true, locale: "en" });
  const { alien } = await getStore().insertAlienOnce(u.id, rollAlien());
  await getStore().updateProfile(u.id, { displayName: `Raver ${n}` });
  await getStore().updatePrivacy(u.id, { avatar: opts.avatar ?? "public", profile: opts.profile ?? "public" });
  return { id: u.id, email, publicId: alien.publicId };
}

/** An event happening right now (door open), published in the owner's world. */
async function liveParty(ownerId: string, over: Partial<ops.EventInput> = {}) {
  const now = Date.now();
  const e = await ops.createEvent(ownerId, {
    name: `Party ${n}`, city: "Bangkok", venueName: "Club", setting: "indoor", startAt: iso(now - HOUR), endAt: iso(now + 3 * HOUR), genres: ["Tech House"],
    attendance: 80, budgetUsd: 1000, ticketing: false, djs: true, streaming: false, templateId: "club_night", ownedEquipment: [], venueFacilities: [], services: [], ...over,
  });
  // RSVP needs a published event that hasn't ended.
  await party.publishEvent(ownerId, e.id, true);
  return e;
}

/** Simulates time passing: the event has ended. */
async function endEvent(eventId: string) {
  const e = (await getOpsStore().get<OpsEvent>("events", eventId))!;
  await getOpsStore().put("events", { ...e, startAt: iso(Date.now() - 6 * HOUR), endAt: iso(Date.now() - HOUR) });
}

async function attend(eventId: string, people: { id: string }[], doorId: string) {
  for (const p of people) {
    const a = await party.rsvp(p.id, eventId);
    expect((await party.checkIn(doorId, eventId, a.passCode, "ip")).result).toBe("ok");
  }
}

const stores: [string, () => AuthStore, () => OpsStore][] = [["memory", () => memoryStore, () => memoryOpsStore]];
if (process.env.TEST_DATABASE_URL) stores.push(["postgres", () => createPgStore(process.env.TEST_DATABASE_URL!), () => createPgOpsStore(process.env.TEST_DATABASE_URL!)]);

describe.each(stores)("FREAK ID & loyalty on %s store", (_name, auth, opsStore) => {
  const admin = { email: "" };
  beforeAll(() => {
    setStore(auth());
    setOpsStore(opsStore());
  });
  afterAll(() => {
    setStore(undefined);
    setOpsStore(undefined);
    delete process.env.OPS_ADMIN_EMAILS;
  });
  beforeEach(async () => {
    resetMemoryStore();
    resetOpsMemory();
    await getOpsStore().remove("loyalty_rules", "current");
  });

  /** A held, verified party in a city: `fan` plus two other scanned guests. */
  async function heldParty(org: { id: string }, fan: { id: string } | null, city = "Bangkok", country = "TH") {
    const e = await liveParty(org.id, { city, country } as Partial<ops.EventInput>);
    const guests = [await user(), await user()];
    await attend(e.id, fan ? [fan, ...guests] : [await user(), ...guests], org.id);
    await endEvent(e.id);
    return e;
  }

  it("counts only the person's own verified check-ins, once per event, and moves the rank", async () => {
    const org = await user();
    const fan = await user();
    let id = await loyalty.freakId(fan.id);
    expect(id).toMatchObject({ verifiedEvents: 0, rank: "rookie", discountPct: 0, next: { rank: "explorer", remaining: 3 } });
    expect(id.freakId).toBe(fan.publicId);

    // RSVP only: never counts.
    const e0 = await liveParty(org.id);
    await party.rsvp(fan.id, e0.id);
    await attend(e0.id, [await user(), await user(), await user()], org.id);
    await endEvent(e0.id);
    expect((await loyalty.freakId(fan.id)).verifiedEvents).toBe(0);

    // Checked in at an event that is still running: pending, not counted yet.
    const live = await liveParty(org.id);
    const pass = await party.rsvp(fan.id, live.id);
    await party.checkIn(org.id, live.id, pass.passCode, "ip");
    expect((await party.checkIn(org.id, live.id, pass.passCode, "ip")).result).toBe("duplicate");
    id = await loyalty.freakId(fan.id);
    expect(id).toMatchObject({ verifiedEvents: 0, pendingEvents: 1 });

    // Three held parties in two countries → EXPLORER.
    await heldParty(org, fan, "Bangkok", "TH");
    await heldParty(org, fan, "Bangkok", "TH");
    await heldParty(org, fan, "Berlin", "DE");
    id = await loyalty.freakId(fan.id);
    expect(id).toMatchObject({ verifiedEvents: 3, rank: "explorer", discountPct: 20, cityCount: 2, countryCount: 2, pendingEvents: 1 });
    expect(id.cities[0]).toMatchObject({ city: "Bangkok", count: 2 });
  });

  it("someone else's ticket or check-in never counts for you; a cancelled event never counts", async () => {
    const org = await user();
    const fan = await user();
    const friend = await user();
    // The friend attends; the fan "holds" nothing that counts.
    await heldParty(org, friend);
    expect((await loyalty.freakId(fan.id)).verifiedEvents).toBe(0);
    expect((await loyalty.freakId(friend.id)).verifiedEvents).toBe(1);
    const e = await heldParty(org, fan);
    const ev = (await getOpsStore().get<OpsEvent>("events", e.id))!;
    await getOpsStore().put("events", { ...ev, status: "cancelled" });
    expect((await loyalty.freakId(fan.id)).verifiedEvents).toBe(0);
  });

  it("quotes are computed on the server from the rank; unverified e-mail and signed-out get ROOKIE", async () => {
    const org = await user();
    const fan = await user();
    for (let i = 0; i < 3; i++) await heldParty(org, fan);
    const q = await loyalty.quote(fan.id, 100);
    expect(q).toMatchObject({ rank: "explorer", regularFeeCents: 500, discountCents: 100, finalFeeCents: 400, totalCents: 10400, afterThisEvent: { rank: "raver", remaining: 2 } });
    expect(await loyalty.quote(null, 100)).toMatchObject({ rank: "rookie", discountCents: 0, signedIn: false });
    const unverified = await user({ verified: false });
    expect((await loyalty.quote(unverified.id, 100)).rank).toBe("rookie");
  });

  it("admins change rules; cuts need notice and 30 days; exclusions need a reason and are audited", async () => {
    const boss = await user();
    const org = await user();
    const fan = await user();
    for (let i = 0; i < 3; i++) await heldParty(org, fan);
    expect(await code(loyalty.adminOverview(boss.id))).toBe("FORBIDDEN");
    process.env.OPS_ADMIN_EMAILS = boss.email;
    admin.email = boss.email;
    const ov = await loyalty.adminOverview(boss.id);
    expect(ov.distribution.explorer).toBeGreaterThanOrEqual(1); // the postgres test database keeps earlier runs

    const better = { ...DEFAULT_RULES, ranks: DEFAULT_RULES.ranks.map((r) => (r.rank === "explorer" ? { ...r, discountPct: 25 } : r)) };
    expect(await code(loyalty.setRules(boss.id, better, { reason: "no" }))).toBe("REASON_REQUIRED");
    const r1 = await loyalty.setRules(boss.id, better, { reason: "Launch promo for explorers" });
    expect(r1.scheduled).toBe(false);
    expect((await loyalty.quote(fan.id, 100)).discountCents).toBe(125);

    const worse = { ...better, ranks: better.ranks.map((r) => (r.rank === "explorer" ? { ...r, discountPct: 10 } : r)) };
    expect(await code(loyalty.setRules(boss.id, worse, { reason: "Margin check" }))).toBe("NOTICE_REQUIRED");
    expect(await code(loyalty.setRules(boss.id, worse, { reason: "Margin check", notice: "Explorer discount changes to 10%", effectiveAt: iso(Date.now() + 2 * 86_400_000) }))).toBe("NOTICE_TOO_SHORT");
    const r2 = await loyalty.setRules(boss.id, worse, { reason: "Margin check", notice: "Explorer discount changes to 10%", effectiveAt: iso(Date.now() + 31 * 86_400_000) });
    expect(r2.scheduled).toBe(true);
    // Still the old rules until the date.
    expect((await loyalty.quote(fan.id, 100)).discountCents).toBe(125);
    expect((await loyalty.freakId(fan.id)).scheduled?.notice).toContain("10%");

    const [first] = (await loyalty.attendanceOf(fan.id)).verified;
    expect(await code(loyalty.setExclusion(boss.id, first.eventId, true, "x"))).toBe("REASON_REQUIRED");
    await loyalty.setExclusion(boss.id, first.eventId, true, "Suspected fake event, under review");
    expect(await loyalty.freakId(fan.id)).toMatchObject({ verifiedEvents: 2, rank: "rookie", excludedEvents: 1 });
    await loyalty.setExclusion(boss.id, first.eventId, false, "Appeal accepted: real event");
    expect((await loyalty.freakId(fan.id)).verifiedEvents).toBe(3);
    const log = (await loyalty.adminOverview(boss.id)).log.map((l) => l.action);
    expect(log).toEqual(expect.arrayContaining(["loyalty_rules", "loyalty_rules_scheduled", "loyalty_exclude", "loyalty_restore"]));
  });
});
