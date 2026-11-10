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
import { MIN_QR_CHECKINS } from "@/lib/party/stats";

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

describe.each(stores)("personal party universe on %s store", (_name, auth, opsStore) => {
  beforeAll(() => {
    setStore(auth());
    setOpsStore(opsStore());
  });
  afterAll(() => {
    setStore(undefined);
    setOpsStore(undefined);
  });
  beforeEach(() => {
    resetMemoryStore();
    resetOpsMemory();
  });

  it("going never counts; door scans count once; re-scan is a duplicate; team is excluded; held only with enough scans", async () => {
    const org = await user();
    const e = await liveParty(org.id);
    let w = await party.world(null, org.publicId);
    expect(w.stats.totalEvents).toBe(0);
    expect(w.growth.stage).toBe(0);
    const ppl = [await user(), await user(), await user()];
    const going = await user();
    await party.rsvp(going.id, e.id); // registered, never scanned
    const a0 = await party.rsvp(ppl[0].id, e.id);
    expect((await party.rsvp(ppl[0].id, e.id)).passCode).toBe(a0.passCode); // idempotent
    expect((await party.checkIn(org.id, e.id, a0.passCode, "ip")).result).toBe("ok");
    expect((await party.checkIn(org.id, e.id, a0.passCode, "ip")).result).toBe("duplicate"); // re-entry / re-scan
    expect((await party.checkIn(org.id, e.id, `FKP1:${e.id}:${a0.passCode}`, "ip")).result).toBe("duplicate"); // QR payload form
    expect((await party.checkIn(org.id, e.id, "ZZZZZZZZZZ", "ip")).result).toBe("not_found");
    expect(await code(party.checkIn(going.id, e.id, a0.passCode, "ip"))).toBe("NOT_FOUND"); // not on the team: can't scan
    expect(await code(party.rsvp(org.id, e.id))).toBe("TEAM_MEMBER");
    await attend(e.id, ppl.slice(1, 2), org.id);
    await endEvent(e.id);
    w = await party.world(null, org.publicId);
    expect(MIN_QR_CHECKINS).toBe(3);
    expect(w.planets[0].state).toBe("unverified"); // only 2 scans: no "held" claim
    expect(w.stats.totalEvents).toBe(0);
    // A second event, 3 scans + a returning guest → verified; figures follow the definitions.
    const e2 = await liveParty(org.id, { name: "Second" });
    await attend(e2.id, [ppl[0], ppl[2], going], org.id);
    await endEvent(e2.id);
    w = await party.world(null, org.publicId);
    expect(w.planets.map((p) => p.state).sort()).toEqual(["unverified", "verified"]);
    expect(w.stats).toMatchObject({ totalEvents: 1, totalAttendance: 3, uniqueVisitors: 3, returningVisitors: 0 });
    // Third event brings two people back: returning = people at ≥ 2 different verified events.
    const e3 = await liveParty(org.id, { name: "Third" });
    await attend(e3.id, [ppl[0], ppl[2], await user()], org.id);
    await endEvent(e3.id);
    w = await party.world(null, org.publicId);
    expect(w.stats).toMatchObject({ totalEvents: 2, totalAttendance: 6, uniqueVisitors: 4, returningVisitors: 2 });
    expect(w.growth.stage).toBe(2);
    expect(w.impact.status).toBe("insufficient"); // no reviews yet: no score
    expect(w.impact.score).toBeNull();
    // Cancelled events never count, even with scans.
    await expect(party.rsvp((await user()).id, e3.id)).rejects.toThrow("EVENT_ENDED");
  });

  it("manual confirmation needs RSVP, start and a reason; it is audited; guests stay separate; admins see anomalies", async () => {
    const org = await user();
    const e = await liveParty(org.id);
    const ppl = await Promise.all(Array.from({ length: 6 }, () => user()));
    for (const p of ppl) await party.rsvp(p.id, e.id);
    const stranger = await user();
    expect(await code(party.confirmManually(org.id, e.id, stranger.id, "lost phone", true))).toBe("NOT_REGISTERED");
    expect(await code(party.confirmManually(org.id, e.id, ppl[0].id, "x", true))).toBe("REASON_REQUIRED");
    expect(await code(party.confirmManually(org.id, e.id, ppl[0].id, "lost phone", false))).toBe("CONFIRMATION_REQUIRED");
    expect(await code(party.confirmManually(ppl[1].id, e.id, ppl[0].id, "lost phone", true))).toBe("NOT_FOUND"); // not on the team
    for (const p of ppl.slice(0, 3)) await party.checkIn(org.id, e.id, (await party.myPass(p.id, e.id)).code, "ip");
    for (const p of ppl.slice(3)) await party.confirmManually(org.id, e.id, p.id, "QR screen broken at the door", true);
    // One more by hand tips the event over 50 % manual.
    const extra = await user();
    await party.rsvp(extra.id, e.id);
    await party.confirmManually(org.id, e.id, extra.id, "QR screen broken at the door", true);
    await party.setGuests(org.id, e.id, 40, "door list of guests without accounts");
    await endEvent(e.id);
    const w = await party.world(null, org.publicId);
    expect(w.stats.totalAttendance).toBe(7); // guests are not added
    expect(w.stats.guests).toBe(40);
    const door = await party.doorView(org.id, e.id);
    expect(door).toMatchObject({ qr: 3, manual: 4, verified: true, guests: 40 });
    const admin = await user();
    expect(await code(party.adminReview(admin.id))).toBe("FORBIDDEN");
    process.env.OPS_ADMIN_EMAILS = admin.email;
    const r = await party.adminReview(admin.id);
    expect(r.flags.some((f) => f.eventId === e.id && f.kind === "manual_share")).toBe(true);
    expect(r.log.filter((l) => l.eventId === e.id && l.action === "manual_confirm").length).toBe(4);
    delete process.env.OPS_ADMIN_EMAILS;
  });

  it("privacy: anonymous by default, shown only with opt-in AND a public alien; history private unless allowed", async () => {
    const org = await user();
    const e = await liveParty(org.id);
    const open = await user();
    const shy = await user();
    const hiddenAlien = await user({ avatar: "private" });
    const fourth = await user();
    await attend(e.id, [open, shy, hiddenAlien, fourth], org.id);
    await endEvent(e.id);
    await party.setWorldPrivacy(open.id, { showInWorlds: true });
    await party.setWorldPrivacy(hiddenAlien.id, { showInWorlds: true });
    const w = await party.world(null, org.publicId);
    expect(w.community.shown.map((s) => s.publicId)).toEqual([open.publicId]);
    expect(w.community.anonymous).toBe(3);
    expect(JSON.stringify(w)).not.toContain(shy.publicId);
    expect(JSON.stringify(w)).not.toContain(shy.id);
    let prof = await party.publicProfile(null, open.publicId);
    expect(prof.history).toBeNull();
    await party.setWorldPrivacy(open.id, { showHistory: true });
    prof = await party.publicProfile(null, open.publicId);
    expect(prof.history?.map((h) => h.eventId)).toEqual([e.id]);
    // The person can remove everything; figures are recomputed.
    await party.deleteMyPartyData(open.id, true);
    expect((await party.world(null, org.publicId)).stats.uniqueVisitors).toBe(3);
  });

  it("reviews only from counted attendees, one each; media visibility, author delete, organizer hide, type check", async () => {
    const org = await user();
    const e = await liveParty(org.id);
    const [a, b, c] = [await user(), await user(), await user()];
    await attend(e.id, [a, b, c], org.id);
    const outsider = await user();
    expect(await code(party.review(outsider.id, e.id, { rating: 5, text: "" }))).toBe("ATTENDEES_ONLY");
    expect(await code(party.review(org.id, e.id, { rating: 5, text: "" }))).toBe("TEAM_CANNOT_REVIEW");
    await party.review(a.id, e.id, { rating: 3, text: "ok" });
    await party.review(a.id, e.id, { rating: 5, text: "changed my mind" }); // replaces, never a second review
    await party.review(b.id, e.id, { rating: 4, text: "" });
    await party.review(c.id, e.id, { rating: 4, text: "" });
    await endEvent(e.id);
    let v = await party.partyEvent(null, e.id);
    expect(v.figures).toMatchObject({ reviewCount: 3, rating: 4.3, attendance: 3 });
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex").toString("base64");
    expect(await code(party.uploadMedia(outsider.id, e.id, { mime: "image/png", data: png }))).toBe("ATTENDEES_ONLY");
    expect(await code(party.uploadMedia(a.id, e.id, { mime: "image/png", data: Buffer.from("<html>").toString("base64") }))).toBe("FILE_TYPE");
    expect(await code(party.uploadMedia(a.id, e.id, { mime: "text/html", data: png }))).toBe("FILE_TYPE");
    const official = await party.uploadMedia(org.id, e.id, { mime: "image/png", data: png, caption: "Main floor" });
    const post = await party.uploadMedia(a.id, e.id, { mime: "image/png", data: png, visibility: "attendees" });
    expect(official.kind).toBe("official");
    expect(post.kind).toBe("attendee");
    v = await party.partyEvent(null, e.id);
    expect(v.media.official.map((m) => m.id)).toEqual([official.id]);
    expect(v.media.attendee).toEqual([]); // attendees-only post hidden from the public
    expect((await party.partyEvent(b.id, e.id)).media.attendee.map((m) => m.id)).toEqual([post.id]);
    expect(await code(party.mediaBlob(null, post.id))).toBe("NOT_FOUND");
    expect((await party.mediaBlob(b.id, post.id)).mime).toBe("image/png");
    expect(await code(party.deleteMedia(org.id, post.id))).toBe("FORBIDDEN"); // only the author deletes attendee posts
    await party.updateMedia(org.id, post.id, { hiddenByOrganizer: true });
    expect((await party.partyEvent(b.id, e.id)).media.attendee).toEqual([]);
    expect((await party.partyEvent(a.id, e.id)).media.attendee.length).toBe(1); // still visible to its author
    await party.deleteMedia(a.id, post.id);
    expect((await party.partyEvent(a.id, e.id)).media.attendee).toEqual([]);
  });

  it("follows: notifications only when asked for, once per event, never after a block; unpublished and demo events are closed", async () => {
    const org = await user();
    const fan = await user();
    const quiet = await user();
    const blocker = await user();
    await party.follow(fan.id, org.id, true);
    await party.follow(quiet.id, org.id, false);
    await party.follow(blocker.id, org.id, true);
    await party.block(blocker.id, org.id);
    const now = Date.now();
    const e = await ops.createEvent(org.id, {
      name: "Next one", city: "Bangkok", venueName: "Club", setting: "indoor", startAt: iso(now + 72 * HOUR), endAt: iso(now + 78 * HOUR), genres: ["Afro House"],
      attendance: 80, budgetUsd: 1000, ticketing: false, djs: true, streaming: false, templateId: "club_night", ownedEquipment: [], venueFacilities: [], services: [],
    });
    expect(await code(party.partyEvent(null, e.id))).toBe("NOT_FOUND"); // private until published
    expect(await code(party.rsvp(fan.id, e.id))).toBe("NOT_FOUND");
    expect((await party.publishEvent(org.id, e.id, true)).notified).toBe(1);
    expect((await party.publishEvent(org.id, e.id, true)).notified).toBe(0); // republish: no second notification
    const notes = async (u: string) => (await ops.notifications(u)).filter((x) => x.key === "notif.partyNew");
    expect((await notes(fan.id)).length).toBe(1);
    expect((await notes(quiet.id)).length).toBe(0);
    expect((await notes(blocker.id)).length).toBe(0);
    expect(await code(party.publishEvent(fan.id, e.id, false))).toBe("NOT_FOUND");
    const w = await party.world(fan.id, org.publicId);
    expect(w.next?.id).toBe(e.id);
    expect(w.follow).toMatchObject({ following: true, notify: true });
    await party.rsvp(fan.id, e.id);
    expect((await party.world(fan.id, org.publicId)).next?.myStatus).toBe("going");
    expect(await code(party.rsvp(blocker.id, e.id))).toBe("BLOCKED_ORGANIZER");
    expect(await code(party.rsvp((await user({ verified: false })).id, e.id))).toBe("EMAIL_NOT_VERIFIED");
    expect(await code(party.checkIn(org.id, e.id, (await party.myPass(fan.id, e.id)).code, "ip"))).toBe("OK"); // logged, not counted
    expect((await party.doorView(org.id, e.id)).checkedIn).toBe(0); // outside the entry window
  });

  it("free tickets: a full party puts RSVPs on the waitlist without a pass; a cancel promotes the next in line and tells them", async () => {
    const org = await user();
    const e = await liveParty(org.id);
    await party.setPartySettings(org.id, e.id, { capacity: 1 });
    const [a, b, c] = [await user(), await user(), await user()];
    expect((await party.rsvp(a.id, e.id)).status).toBe("going");
    expect((await party.rsvp(b.id, e.id)).status).toBe("waitlist");
    expect((await party.rsvp(b.id, e.id)).status).toBe("waitlist"); // idempotent
    expect((await party.rsvp(c.id, e.id)).status).toBe("waitlist");
    const pb = await party.myPass(b.id, e.id);
    expect(pb).toMatchObject({ waitlist: true, code: null, payload: null });
    expect((await party.myPass(c.id, e.id)).position).toBeGreaterThanOrEqual(pb.position!);
    // A waitlisted code can't be scanned in: there is no pass.
    const bRow = (await getOpsStore().get<{ passCode: string }>("attendance", `${e.id}:${b.id}`))!;
    expect((await party.checkIn(org.id, e.id, bRow.passCode, "ip")).result).toBe("waitlist");
    expect((await party.doorView(org.id, e.id)).checkedIn).toBe(0);
    let v = await party.partyEvent(b.id, e.id);
    expect(v.tickets).toMatchObject({ capacity: 1, taken: 1, waitlist: 2 });
    expect(v.my?.status).toBe("waitlist");
    // A cancels → B (first in line) is promoted and notified, C keeps waiting.
    await party.cancelRsvp(a.id, e.id);
    expect((await party.myPass(b.id, e.id))).toMatchObject({ waitlist: false });
    expect((await party.myPass(b.id, e.id)).code).toBe(bRow.passCode);
    expect((await party.myPass(c.id, e.id)).waitlist).toBe(true);
    const promoted = (await ops.notifications(b.id)).filter((x) => x.key === "notif.partyPromoted");
    expect(promoted.length).toBe(1);
    expect((await ops.notifications(c.id)).filter((x) => x.key === "notif.partyPromoted").length).toBe(0);
    // A re-joins: back of the line.
    expect((await party.rsvp(a.id, e.id)).status).toBe("waitlist");
    // Raising capacity promotes everyone who now fits; removing it promotes the rest.
    await party.setPartySettings(org.id, e.id, { capacity: 2 });
    expect((await party.myPass(c.id, e.id)).waitlist).toBe(false);
    expect((await party.myPass(a.id, e.id)).waitlist).toBe(true);
    await party.setPartySettings(org.id, e.id, { capacity: null });
    expect((await party.myPass(a.id, e.id)).waitlist).toBe(false);
    v = await party.partyEvent(null, e.id);
    expect(v.tickets).toMatchObject({ capacity: null, waitlist: 0 });
    // Only the owner or a manager can change it; bad values are refused.
    expect(await code(party.setPartySettings(a.id, e.id, { capacity: 5 }))).toBe("NOT_FOUND");
    expect(await code(party.setPartySettings(org.id, e.id, { capacity: 0 }))).toBe("INVALID_INPUT");
    expect(await code(party.setPartySettings(org.id, e.id, { capacity: 1.5 }))).toBe("INVALID_INPUT");
    // Manual confirmation also works for someone on the waitlist (e.g. let in at the door).
    await party.setPartySettings(org.id, e.id, { capacity: 3 });
    const d = await user();
    expect((await party.rsvp(d.id, e.id)).status).toBe("waitlist");
    expect(await code(party.confirmManually(org.id, e.id, d.id, "Space opened up at the door", true))).toBe("OK");
  });

  it("recording links only to known https hosts; highlights only from public, visible media", async () => {
    const org = await user();
    const e = await liveParty(org.id);
    const [a, b, c] = [await user(), await user(), await user()];
    await attend(e.id, [a, b, c], org.id);
    expect(await code(party.setPartySettings(org.id, e.id, { archives: [{ url: "http://youtube.com/watch?v=1" }] }))).toBe("INVALID_URL");
    expect(await code(party.setPartySettings(org.id, e.id, { archives: [{ url: "https://evil.example/watch" }] }))).toBe("INVALID_URL");
    expect(await code(party.setPartySettings(org.id, e.id, { archives: [{ url: "https://user:pw@youtube.com/x" }] }))).toBe("INVALID_URL");
    expect(await code(party.setPartySettings(org.id, e.id, { archives: [{ url: "javascript:alert(1)" }] }))).toBe("INVALID_URL");
    expect(await code(party.setPartySettings(org.id, e.id, { archives: [{ url: "not a url" }] }))).toBe("INVALID_URL");
    const s = await party.setPartySettings(org.id, e.id, { archives: [{ url: "https://soundcloud.com/freak/set", label: "Closing set" }, { url: "https://youtu.be/abc" }] });
    expect(s.archives.map((x) => x.host)).toEqual(["SoundCloud", "YouTube"]);
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex").toString("base64");
    const official = await party.uploadMedia(org.id, e.id, { mime: "image/png", data: png });
    const privatePost = await party.uploadMedia(a.id, e.id, { mime: "image/png", data: png, visibility: "attendees" });
    const publicPost = await party.uploadMedia(b.id, e.id, { mime: "image/png", data: png, visibility: "public" });
    expect(await code(party.setPartySettings(org.id, e.id, { highlights: [privatePost.id] }))).toBe("INVALID_INPUT");
    expect(await code(party.setPartySettings(org.id, e.id, { highlights: ["nope"] }))).toBe("INVALID_INPUT");
    await party.setPartySettings(org.id, e.id, { highlights: [official.id, publicPost.id, official.id] });
    let v = await party.partyEvent(null, e.id);
    expect(v.archives.map((x) => x.label)).toEqual(["Closing set", ""]);
    expect(v.highlights).toEqual([official.id, publicPost.id]);
    // Hidden or deleted later → it drops out of the highlights.
    await party.updateMedia(org.id, publicPost.id, { hiddenByOrganizer: true });
    v = await party.partyEvent(null, e.id);
    expect(v.highlights).toEqual([official.id]);
  });

  it("email: only for followers who asked, verified addresses only, once per party, in their language", async () => {
    const org = await user();
    const mailFan = await user();
    const appOnly = await user();
    await party.follow(mailFan.id, org.id, true, true);
    await party.follow(appOnly.id, org.id, true);
    expect((await party.follow(appOnly.id, org.id, false, true)).email).toBe(false); // email needs notify on
    await party.follow(appOnly.id, org.id, true);
    await getStore().updateProfile(mailFan.id, { locale: "ja" });
    const now = Date.now();
    const e = await ops.createEvent(org.id, {
      name: `Mail party ${RUN}`, city: "Bangkok", venueName: "Club", setting: "indoor", startAt: iso(now + 72 * HOUR), endAt: iso(now + 78 * HOUR), genres: ["Afro House"],
      attendance: 80, budgetUsd: 1000, ticketing: false, djs: true, streaming: false, templateId: "club_night", ownedEquipment: [], venueFacilities: [], services: [],
    });
    expect((await party.publishEvent(org.id, e.id, true, "https://freak.example")).notified).toBe(2);
    await party.publishEvent(org.id, e.id, true, "https://freak.example");
    const box = demoOutboxFor(mailFan.email);
    expect(box.length).toBe(1);
    expect(box[0].text).toContain(`Mail party ${RUN}`);
    expect(box[0].locale).toBe("ja");
    expect(box[0].link).toBe(`https://freak.example/u/${org.publicId}/world/${e.id}`);
    expect(demoOutboxFor(appOnly.email).length).toBe(0);
    // Keeping notify on keeps the email choice; turning notify off turns email off too.
    expect((await party.follow(mailFan.id, org.id, true)).email).toBe(true);
    expect((await party.follow(mailFan.id, org.id, false)).email).toBe(false);
  });
});

describe("demo world (memory store only)", () => {
  beforeAll(() => {
    setStore(memoryStore);
    setOpsStore(memoryOpsStore);
  });
  afterAll(() => {
    setStore(undefined);
    setOpsStore(undefined);
  });
  it("is labelled DEMO, has no media, and cannot be joined or followed", async () => {
    resetOpsMemory();
    const w = await party.world(null, "demo");
    expect(w.demo).toBe(true);
    expect(w.stats.totalEvents).toBe(5);
    expect(w.impact.status).toBe("ok");
    expect(w.planets.every((p) => p.demo)).toBe(true);
    expect(w.planets.every((p) => p.coverId === null)).toBe(true);
    const next = w.planets.find((p) => p.state === "upcoming")!;
    const u = await getStore().createUser({ email: `demo-${RUN}@example.test`, passwordHash: null, emailVerified: true, locale: "en" });
    expect(await code(party.rsvp(u.id, next.id))).toBe("DEMO_EVENT");
  });
});
