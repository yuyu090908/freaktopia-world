import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { memoryStore, resetMemoryStore } from "@/lib/auth/memory";
import { createPgStore } from "@/lib/auth/pg";
import { getStore, setStore } from "@/lib/auth/store";
import type { AuthStore } from "@/lib/auth/types";
import * as music from "@/lib/music/service";
import { localPut } from "@/lib/music/storage";
import * as ops from "@/lib/ops/service";
import { createPgOpsStore, memoryOpsStore, resetOpsMemory, setOpsStore, type OpsStore } from "@/lib/ops/store";
import { OpsError } from "@/lib/ops/types";

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let n = 0;
const code = async (p: Promise<unknown>) => p.then(() => "OK", (e) => (e instanceof OpsError ? e.code : String(e)));
const day = 86_400_000;
const at = (days: number, h = 20) => new Date(Math.floor(Date.now() / day) * day + days * day + h * 3_600_000).toISOString();
const MP3 = readFileSync("tests/fixtures/audio/tone-8s-vbr.mp3");
const ADMIN = `music-admin-${RUN}@example.test`;

async function user(email = `music-${RUN}-${++n}@example.test`) {
  const u = await getStore().createUser({ email, passwordHash: null, emailVerified: true, locale: "en" });
  return { id: u.id, email };
}

async function dj(name = `DJ ${++n}`) {
  const u = await user();
  const p = await music.saveDjProfile(u.id, { stageName: name, genres: ["Techno"], city: "Tokyo", bookingStatus: "open", contactPolicy: "organizers" } as never);
  return { ...u, profile: p };
}

/** Browser → signed URL → storage, then the server-side check (local storage stands in for S3/R2). */
async function uploaded(uid: string, body: Buffer = MP3, declared = body.length) {
  const { track } = await music.createUpload(uid, { fileName: "set.mp3", size: declared, mime: "audio/mpeg" });
  await localPut(track.storageKey, body, "audio/mpeg");
  return music.completeUpload(uid, track.id);
}

async function published(uid: string, admin: string, visibility: "public" | "audition" | "unlisted" = "public") {
  const t = await uploaded(uid);
  await music.updateTrack(uid, t.id, { title: "Night mix", type: "original_mix", rights: { allOriginal: true, allowStreaming: true, statement: "Produced and mixed entirely by me." } });
  const sent = await music.submitTrack(uid, t.id, { visibility });
  expect(sent.publicationStatus).toBe("pending_review");
  return music.reviewTrack(admin, t.id, { decision: "approve", note: "" });
}

const stores: [string, () => AuthStore, () => OpsStore][] = [["memory", () => memoryStore, () => memoryOpsStore]];
if (process.env.TEST_DATABASE_URL) stores.push(["postgres", () => createPgStore(process.env.TEST_DATABASE_URL!), () => createPgOpsStore(process.env.TEST_DATABASE_URL!)]);

describe.each(stores)("DJ ARENA 2.0 on %s store", (_name, auth, opsStore) => {
  const env = { ...process.env };
  let admin: { id: string };
  beforeAll(() => {
    setStore(auth());
    setOpsStore(opsStore());
    process.env.MUSIC_STORAGE = "local";
    delete process.env.VERCEL;
    process.env.OPS_ADMIN_EMAILS = ADMIN;
  });
  afterAll(() => {
    setStore(undefined);
    setOpsStore(undefined);
    process.env = env;
  });
  beforeEach(async () => {
    resetMemoryStore();
    resetOpsMemory();
    admin = (await getStore().findUserByEmail(ADMIN)) ?? (await user(ADMIN));
  });

  it("uploads an MP3 through a signed URL and verifies it on the server", async () => {
    const d = await dj();
    const { track, upload } = await music.createUpload(d.id, { fileName: "set.mp3", size: MP3.length, mime: "audio/mpeg" });
    expect(upload.url).toMatch(/\/api\/music\/local\/put\?/);
    expect(track.storageKey).toContain(d.id); // each uploader writes only under their own prefix
    await localPut(track.storageKey, MP3, "audio/mpeg");
    const t = await music.completeUpload(d.id, track.id);
    expect(t.processingStatus).toBe("ready");
    expect(t.durationSec).toBeGreaterThanOrEqual(7);
    expect(t.playbackKey).toBe(t.storageKey); // the master is used as-is (never re-encoded)
    expect(t.publicationStatus).toBe("draft");
    expect(t.downloadable).toBe(false);
  });

  it("rejects invalid files before and after upload", async () => {
    const d = await dj();
    expect(await code(music.createUpload(d.id, { fileName: "x.wav", size: 5000, mime: "audio/wav" }))).toBe("FILE_TYPE");
    expect(await code(music.createUpload(d.id, { fileName: "x.mp3", size: 10, mime: "audio/mpeg" }))).toBe("FILE_EMPTY");
    expect(await code(music.createUpload(d.id, { fileName: "x.mp3", size: 400 * 1024 * 1024, mime: "audio/mpeg" }))).toBe("FILE_TOO_LARGE");
    const exe = Buffer.alloc(8000); exe.write("MZ");
    const t = await uploaded(d.id, exe);
    expect(t.processingStatus).toBe("failed");
    expect(t.processingError).toBe("DANGEROUS_FILE");
    const junk = await uploaded(d.id, Buffer.alloc(9000, 7));
    expect(junk.processingStatus).toBe("failed");
  });

  it("recovers a failed upload with a fresh URL and the same draft", async () => {
    const d = await dj();
    const { track } = await music.createUpload(d.id, { fileName: "set.mp3", size: MP3.length, mime: "audio/mpeg" });
    await music.updateTrack(d.id, track.id, { title: "Kept title" });
    expect(await code(music.completeUpload(d.id, track.id))).toBe("UPLOAD_NOT_FOUND"); // the transfer never arrived
    const half = MP3.subarray(0, 4000);
    await localPut(track.storageKey, half, "audio/mpeg");
    const bad = await music.completeUpload(d.id, track.id);
    expect(bad.processingError).toBe("SIZE_MISMATCH");
    const { upload } = await music.renewUpload(d.id, track.id);
    expect(upload.url).toBeTruthy();
    await localPut(track.storageKey, MP3, "audio/mpeg");
    const ok = await music.completeUpload(d.id, track.id);
    expect(ok.processingStatus).toBe("ready");
    expect(ok.title).toBe("Kept title");
  });

  it("publishing needs staff review; private tracks stay invisible to others", async () => {
    const d = await dj();
    const other = await user();
    const t = await uploaded(d.id);
    expect(await code(music.submitTrack(d.id, t.id, { visibility: "public" }))).toBe("RIGHTS_INCOMPLETE");
    const priv = await music.submitTrack(d.id, t.id, { visibility: "private" });
    expect(priv.publicationStatus).toBe("private");
    expect(await code(music.trackView(t.id, other.id))).toBe("NOT_FOUND");
    expect(await code(music.trackView(t.id, null))).toBe("NOT_FOUND");
    expect(await code(music.streamUrl(t.id, other.id))).toBe("NOT_FOUND");
    expect((await music.trackView(t.id, d.id)).track.id).toBe(t.id);
    expect((await music.search({ q: "" }, other.id)).tracks.find((x: { id: string }) => x.id === t.id)).toBeUndefined();
    const pub = await published(d.id, admin.id);
    expect(pub.rightsStatus).toBe("staff_reviewed");
    expect((await music.trackView(pub.id, other.id)).track.id).toBe(pub.id);
    expect(await music.streamUrl(pub.id, null)).toMatch(/local\/get/);
    expect(await code(music.streamUrl(pub.id, other.id, { download: true }))).toBe("DOWNLOAD_OFF");
  });

  it("a like counts once per account, even on double taps", async () => {
    const d = await dj();
    const t = await published(d.id, admin.id);
    const fan = await user();
    await Promise.all([music.setLike(fan.id, t.id, true), music.setLike(fan.id, t.id, true), music.setLike(fan.id, t.id, true)]);
    expect((await music.setLike(fan.id, t.id, true)).likes).toBe(1);
    expect((await music.setLike(fan.id, t.id, false)).likes).toBe(0);
    await music.setSave(fan.id, t.id, true);
    expect((await music.library(fan.id)).saved.map((x: { id: string }) => x.id)).toEqual([t.id]);
  });

  it("only qualified plays count; opening a page or the owner's plays never do", async () => {
    const d = await dj();
    const t = await published(d.id, admin.id);
    await music.trackView(t.id, null); // a page view
    const own = await music.startPlay(t.id, d.id, "k-owner");
    expect((await music.finishPlay(own.playId, own.sessionId, "k-owner", 0, "Mozilla/5.0")).reason).toBe("owner");
    const p = await music.startPlay(t.id, null, "k-anon");
    expect((await music.finishPlay(p.playId, p.sessionId, "k-anon", 60, "Mozilla/5.0")).reason).toBe("clock"); // can't listen longer than elapsed
    const bot = await music.startPlay(t.id, null, "k-bot");
    expect((await music.finishPlay(bot.playId, bot.sessionId, "k-bot", 0, "Googlebot")).reason).toBe("bot");
  });

  it("playlists: create, edit, reorder, hide non-public tracks from others", async () => {
    const d = await dj();
    const a = await published(d.id, admin.id);
    const b = await published(d.id, admin.id);
    const hidden = await uploaded(d.id);
    await music.submitTrack(d.id, hidden.id, { visibility: "private" });
    const pl = await music.createPlaylist(d.id, { title: "Warmup", visibility: "public" });
    const i1 = await music.addToPlaylist(d.id, pl.id, a.id);
    const i2 = await music.addToPlaylist(d.id, pl.id, b.id);
    await music.addToPlaylist(d.id, pl.id, hidden.id);
    expect(await code(music.addToPlaylist(d.id, pl.id, a.id))).toBe("ALREADY_IN_PLAYLIST");
    await music.updatePlaylist(d.id, pl.id, { title: "Warmup v2" });
    const own = await music.playlistView(pl.id, d.id);
    const ids = own.items.map((x: { itemId: string }) => x.itemId);
    await music.reorderPlaylist(d.id, pl.id, [...ids].reverse());
    const after = await music.playlistView(pl.id, d.id);
    expect(after.playlist.title).toBe("Warmup v2");
    expect(after.items.map((x: { itemId: string }) => x.itemId)).toEqual([...ids].reverse());
    const other = await music.playlistView(pl.id, null);
    expect(other.items.map((x: { track: { id: string } }) => x.track.id)).not.toContain(hidden.id);
    expect(other.items).toHaveLength(2);
    void i1; void i2;
    const priv = await music.createPlaylist(d.id, { title: "Mine", visibility: "private" });
    expect(await code(music.playlistView(priv.id, null))).toBe("NOT_FOUND");
  });

  it("search finds DJs by name, city and genre", async () => {
    const d = await dj("Neon Kaiju");
    await published(d.id, admin.id);
    const r = await music.search({ q: "kaiju" }, null);
    expect(r.djs.map((x: { slug: string }) => x.slug)).toContain(d.profile.slug);
    expect((await music.search({ genre: "Techno", city: "Tokyo" }, null)).djs.length).toBeGreaterThan(0);
    expect((await music.search({ q: "nobody-matches-this" }, null)).djs).toHaveLength(0);
  });

  it("booking: organizer offers, DJ counters/accepts, organizer confirms; conflicts detected", async () => {
    const d = await dj();
    const o = await user();
    const stranger = await user();
    expect(await code(music.createBooking(stranger.id, { kind: "booking", djSlug: d.profile.slug, event: { name: "x" }, message: "hi", send: true }))).toBe("ORGANIZERS_ONLY");
    const e = await ops.createEvent(o.id, {
      name: "Warehouse night", city: "Tokyo", venueName: "Dock 3", setting: "indoor", startAt: at(30), endAt: at(30, 26), genres: ["Techno"], attendance: 200, budgetUsd: 5000,
      ticketing: false, djs: true, streaming: false, templateId: "club_night", ownedEquipment: [], venueFacilities: [], services: [],
    } as ops.EventInput);
    let b = await music.createBooking(o.id, { kind: "booking", djSlug: d.profile.slug, eventId: e.id, terms: { feeAmount: 500, currency: "USD" }, message: "Can you play?", send: true });
    expect(b.booking.status).toBe("sent");
    expect(b.booking.event.name).toBe("Warehouse night");
    b = await music.bookingView(d.id, b.booking.id);
    expect(b.booking.status).toBe("viewed");
    b = await music.act(d.id, b.booking.id, "counter", { terms: { feeAmount: 700 } });
    expect(b.booking.status).toBe("negotiating");
    expect(await code(music.act(d.id, b.booking.id, "accept", { termsVersion: 1 }))).toBe("TERMS_CHANGED");
    b = await music.act(d.id, b.booking.id, "accept", { termsVersion: b.booking.termsVersion });
    expect(b.booking.status).toBe("accepted"); // not confirmed yet
    expect(await code(music.act(o.id, b.booking.id, "confirm", { termsVersion: b.booking.termsVersion }))).toBe("CONFIRMATION_REQUIRED");
    b = await music.act(o.id, b.booking.id, "confirm", { termsVersion: b.booking.termsVersion, confirm: true });
    expect(b.booking.status).toBe("confirmed");
    // The calendar now shows the day as booked; a second request on the same night is flagged.
    const c = await music.checkConflicts(d.id, at(30, 21), at(30, 25));
    expect(c.length).toBeGreaterThan(0);
    const days = await music.myDays(d.id);
    expect(days.some((x: { status: string }) => x.status === "booked")).toBe(true);
    // A decline path on a second request.
    const second = await music.createBooking(o.id, { kind: "booking", djSlug: d.profile.slug, event: { name: "After" }, terms: { performanceStart: at(50), performanceEnd: at(50, 23) }, message: "Another?", send: true });
    const declined = await music.act(d.id, second.booking.id, "decline", { reason: "busy" });
    expect(declined.booking.status).toBe("declined");
  });

  it("calendar: private days look unavailable to others and buffer catches near bookings", async () => {
    const d = await dj();
    const day1 = at(20).slice(0, 10);
    await music.setDays(d.id, [{ day: day1, status: "private", note: "family" }]);
    const pub = await music.publicDjProfile(d.profile.slug, null);
    const shown = pub.availability.find((x) => x?.day === day1);
    expect(shown?.status).toBe("unavailable");
    expect(JSON.stringify(pub)).not.toContain("family");
    expect((await music.checkConflicts(d.id, at(20, 20), at(20, 23))).length).toBeGreaterThan(0);
  });

  it("applications carry tracks; AUDITION tracks play only for that event's reviewers", async () => {
    const d = await dj();
    const audition = await published(d.id, admin.id, "audition");
    const o = await user();
    const outsider = await user();
    const e = await ops.createEvent(o.id, {
      name: "Open call night", city: "Tokyo", venueName: "Dock 3", setting: "indoor", startAt: at(40), endAt: at(40, 26), genres: ["Techno"], attendance: 120, budgetUsd: 3000,
      ticketing: false, djs: true, streaming: false, templateId: "club_night", ownedEquipment: [], venueFacilities: [], services: [],
    } as ops.EventInput);
    const req = (await ops.eventView(o.id, e.id)).requirements.find((r) => r.key === "dj_performer")!;
    const call = await ops.createOpening(o.id, e.id, { kind: "open", requirementIds: [req.id], slots: 1, budgetUsd: 500 });
    await ops.saveWorkProfile(d.id, { displayName: d.profile.stageName, roles: ["dj"] } as never);
    const listing = (await ops.createListing(d.id, { type: "person", title: "DJ set", city: "Tokyo", priceUsd: 400, items: [{ key: "dj_performer", quantity: 1, model: "Techno" }] } as never));
    expect(await code(music.trackView(audition.id, o.id))).toBe("NOT_FOUND"); // before applying: no access
    const fake = await uploaded(d.id);
    expect(await code(ops.apply(d.id, call.id, { listingId: listing.id, priceUsd: 400, trackIds: [fake.id] }))).toBe("TRACK_NOT_ATTACHABLE");
    const app = await ops.apply(d.id, call.id, { listingId: listing.id, priceUsd: 400, trackIds: [audition.id] });
    expect(app.trackIds).toEqual([audition.id]);
    expect((await music.trackView(audition.id, o.id)).track.id).toBe(audition.id);
    expect(await code(music.trackView(audition.id, outsider.id))).toBe("NOT_FOUND");
    const at2 = await music.applicationTracks(o.id, e.id);
    expect(at2.tracks?.[app.id]?.map((x: { id: string }) => x.id)).toEqual([audition.id]);
    expect(await music.applicationTracks(outsider.id, e.id)).toEqual({});
    const st = await ops.setApplicationStatus(o.id, e.id, app.id, "interview");
    expect(st.status).toBe("interview");
  });

  it("copyright claim → staff takedown → counter-notice → restore, all audited", async () => {
    const d = await dj();
    const t = await published(d.id, admin.id);
    const claim = await music.fileClaim(null, { trackId: t.id, claimantName: "Label X", claimantEmail: "rights@label.test", work: "Song A", details: "Uses the hook at 1:20", goodFaith: true });
    expect(await code(music.decideClaim(d.id, claim.id, { decision: "uphold", resolution: "no" }))).toBe("FORBIDDEN");
    await music.decideClaim(admin.id, claim.id, { decision: "uphold", resolution: "Sample confirmed" });
    expect(await code(music.trackView(t.id, null))).toBe("NOT_FOUND");
    expect(await code(music.streamUrl(t.id, null))).toBe("NOT_FOUND");
    await music.counterClaim(d.id, claim.id, "I have a licence from Label X, ref 42.");
    const restored = await music.decideClaim(admin.id, claim.id, { decision: "restore", resolution: "Licence shown" });
    expect(restored.status).toBe("restored");
    expect((await music.trackView(t.id, null)).track.id).toBe(t.id);
    const overview = await music.adminOverview(admin.id);
    const actions = overview.audit.map((a: { action: string }) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["music.claim.filed", "music.claim.uphold", "music.claim.restore", "music.review.approve"]));
  });
});
