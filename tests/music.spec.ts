import { readFileSync } from "node:fs";
import { test, expect, type Browser, type Page } from "@playwright/test";

/**
 * DJ ARENA 2.0 — the 20 required checks, against a server started with MUSIC_STORAGE=local (files go to this
 * server's database through the same signed-URL flow S3/R2 uses) and E2E_ADMIN_EMAIL in OPS_ADMIN_EMAILS.
 * Real accounts, real MP3 files (tests/fixtures/audio, generated sine tones), no mocked API answers.
 */

const PW = "neon slime forever";
const MP3 = readFileSync("tests/fixtures/audio/tone-8s-vbr.mp3");
const MP3_B = readFileSync("tests/fixtures/audio/tone-12s-id3.mp3");
const TAG = Math.random().toString(36).slice(2, 6).toUpperCase();
let seq = 0;
const fakeIp = () => `10.${(process.pid % 200) + 30}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const day = 86_400_000;
const isoAt = (days: number, h: number) => new Date(Math.floor(Date.now() / day) * day + days * day + h * 3_600_000).toISOString();
const MOBILE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };

async function signedIn(browser: Browser, email = `music-${Date.now()}-${process.pid}-${++seq}@example.test`, opts: Record<string, unknown> = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { "x-forwarded-for": fakeIp() }, ...opts });
  const page = await context.newPage();
  if ((await page.request.post("/api/auth/signin", { data: { email, password: PW }, headers: { origin: "http://localhost:3000" } })).ok()) return page;
  expect((await page.request.post("/api/auth/signup", { data: { email, password: PW }, headers: { "content-type": "application/json" } })).ok()).toBeTruthy();
  await page.goto("/auth/mailbox");
  await page.getByTestId("mail-link").first().click();
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 20_000 });
  await expect.poll(async () => (await (await page.request.get("/api/me")).json()).user?.emailVerified ?? false).toBe(true);
  return page;
}

const post = async (p: Page, path: string, data: unknown = {}) => {
  const r = await p.request.post(path, { data, headers: { "content-type": "application/json", origin: "http://localhost:3000" } });
  return { status: r.status(), json: await r.json().catch(() => ({})) };
};
const mpost = (p: Page, path: string, data: unknown = {}) => post(p, `/api/music/${path}`, data);

async function djProfile(p: Page, name: string) {
  const r = await mpost(p, "profile", { stageName: name, city: "Tokyo", country: "Japan", genres: ["Techno"], bookingStatus: "open", contactPolicy: "organizers", bufferHours: 12 });
  expect(r.status).toBe(200);
  return r.json.profile as { slug: string; userId: string };
}

/** Same steps as the browser uploader: signed URL → PUT the bytes → server check → details/rights → submit. */
async function apiTrack(p: Page, title: string, visibility: "public" | "private" | "audition" | "unlisted", body = MP3) {
  const c = await mpost(p, "uploads", { fileName: `${title}.mp3`, size: body.length, mime: "audio/mpeg", title });
  expect(c.status).toBe(201);
  const put = await p.request.put(c.json.upload.url, { data: body, headers: c.json.upload.headers });
  expect(put.ok()).toBeTruthy();
  const done = await mpost(p, `tracks/${c.json.track.id}/complete`);
  expect(done.json.track.processingStatus).toBe("ready");
  await mpost(p, `tracks/${c.json.track.id}`, { title, type: "original_mix", rights: { allOriginal: true, usesThirdParty: false, allowStreaming: true, statement: "Produced and mixed entirely by me." } });
  const s = await mpost(p, `tracks/${c.json.track.id}/submit`, { visibility });
  expect(s.status).toBe(200);
  return c.json.track.id as string;
}

async function approve(admin: Page, trackId: string) {
  const r = await mpost(admin, `admin/tracks/${trackId}/review`, { decision: "approve", note: "" });
  expect(r.status).toBe(200);
}

/** One sign-in per worker for the fixed admin address (sign-in is rate limited per address); later tests reuse the session. */
let adminState: Awaited<ReturnType<import("@playwright/test").BrowserContext["storageState"]>> | null = null;
async function adminPage(browser: Browser) {
  const email = process.env.E2E_ADMIN_EMAIL;
  test.skip(!email, "set E2E_ADMIN_EMAIL to an address in the server's OPS_ADMIN_EMAILS");
  if (adminState) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: adminState, extraHTTPHeaders: { "x-forwarded-for": fakeIp() } });
    const page = await ctx.newPage();
    if ((await (await page.request.get("/api/me")).json()).user) return page;
  }
  const page = await signedIn(browser, email!);
  adminState = await page.context().storageState();
  return page;
}

async function opsEvent(p: Page, name: string, daysAhead: number) {
  const r = await post(p, "/api/ops/events", {
    name, city: "Tokyo", venueName: "Dock 3", setting: "indoor", startAt: isoAt(daysAhead, 20), endAt: isoAt(daysAhead, 26), genres: ["Techno"], attendance: 150, budgetUsd: 5000,
    ticketing: false, djs: true, streaming: false, templateId: "club_night", ownedEquipment: [], venueFacilities: [], services: [],
  });
  expect(r.status).toBe(201);
  return r.json.event.id as string;
}

test.describe("DJ ARENA 2.0", () => {
  test.setTimeout(180_000);

  test("#1 #2 #3 upload in the browser: invalid files rejected, interrupted upload recovered, sent to staff review", async ({ browser }) => {
    const dj = await signedIn(browser);
    await dj.goto("/profile/dj");
    await dj.getByTestId("dp-name").fill(`Slime Oracle ${TAG}`);
    await dj.getByTestId("dp-city").fill("Tokyo");
    await dj.getByTestId("dp-save").click();
    await dj.goto("/profile/dj?tab=tracks");
    await expect(dj.getByTestId("local-storage-note")).toBeVisible();

    // #2: not an MP3 (name), a program renamed to .mp3, random bytes
    const input = dj.getByTestId("mp3-input");
    await input.setInputFiles({ name: "mix.wav", mimeType: "audio/wav", buffer: Buffer.alloc(5000, 1) });
    await expect(dj.getByTestId("file-problem")).toContainText(/Only MP3/i);
    const exe = Buffer.alloc(9000); exe.write("MZ");
    await input.setInputFiles({ name: "free-mix.mp3", mimeType: "audio/mpeg", buffer: exe });
    await expect(dj.getByTestId("file-problem")).toContainText(/program or archive/i);
    await input.setInputFiles({ name: "noise.mp3", mimeType: "audio/mpeg", buffer: Buffer.alloc(20_000, 0x41) });
    await expect(dj.getByTestId("file-problem")).toBeVisible();

    // #1: a real MP3
    await input.setInputFiles({ name: "sunrise.mp3", mimeType: "audio/mpeg", buffer: MP3 });
    await expect(dj.getByTestId("file-check")).toContainText(/valid MP3/i);
    await dj.getByTestId("to-details").click();
    await dj.getByTestId("tf-title").fill(`Sunrise ${TAG}`);
    await dj.getByTestId("to-rights").click();
    await expect(dj.getByTestId("rights-note")).toContainText(/not an automatic copyright check/i);
    await dj.getByRole("switch", { name: /my own work/i }).click();
    await dj.getByRole("switch", { name: /Streaming here is allowed/i }).click();
    await dj.getByTestId("r-statement").fill("Recorded and produced by me in my studio.");
    await dj.getByTestId("vis-public").check();

    // #3: the first transfer is cut off; retry uses a fresh signed URL and keeps the details
    let cut = true;
    await dj.route("**/api/music/local/put**", (route) => (cut ? ((cut = false), route.abort("connectionreset")) : route.continue()));
    await dj.getByTestId("start-upload").click();
    await expect(dj.getByTestId("upload-error")).toBeVisible();
    await dj.getByTestId("retry-upload").click();
    await expect(dj.getByTestId("upload-done")).toBeVisible({ timeout: 30_000 });
    await expect(dj.getByTestId("upload-outcome")).toContainText(/staff review/i);
    await dj.reload();
    const row = dj.getByTestId("my-track").filter({ hasText: `Sunrise ${TAG}` });
    await expect(row).toHaveCount(1);
    await expect(row.getByTestId("rights-status")).toContainText(/review pending/i);
    // Never auto-published: a stranger can't see it yet.
    const me = await (await dj.request.get("/api/music/me")).json();
    const id = me.tracks.find((t: { title: string }) => t.title === `Sunrise ${TAG}`).id;
    const anon = await browser.newContext();
    expect((await anon.request.get(`/api/music/tracks/${id}`)).status()).toBe(404);
    await anon.close();
  });

  test("#4 #15 private tracks hidden; AUDITION access only for that event's reviewers (#14 via the apply form)", async ({ browser }) => {
    const admin = await adminPage(browser);
    const dj = await signedIn(browser);
    const prof = await djProfile(dj, `Moss Diver ${TAG}`);
    const priv = await apiTrack(dj, `Private Sketch ${TAG}`, "private");
    const aud = await apiTrack(dj, `Audition Mix ${TAG}`, "audition");
    await approve(admin, aud);
    const org = await signedIn(browser);
    const stranger = await signedIn(browser);
    // #4
    for (const p of [org, stranger]) {
      expect((await p.request.get(`/api/music/tracks/${priv}`)).status()).toBe(404);
      expect((await p.request.get(`/api/music/tracks/${priv}/stream`, { maxRedirects: 0 })).status()).toBe(404);
    }
    await stranger.goto(`/djs/u/${prof.slug}`);
    await expect(stranger.getByTestId("dj-name")).toHaveText(`Moss Diver ${TAG}`);
    await expect(stranger.locator("body")).not.toContainText(`Private Sketch ${TAG}`);
    await expect(stranger.locator("body")).not.toContainText(`Audition Mix ${TAG}`);
    const search = await (await stranger.request.get(`/api/music/search?q=${encodeURIComponent("Private Sketch")}`)).json();
    expect(JSON.stringify(search)).not.toContain(priv);

    // #14: an open DJ call; the DJ applies in the browser and attaches the audition track
    const eid = await opsEvent(org, `Audition Night ${TAG}`, 45);
    const { view } = await (await org.request.get(`/api/ops/events/${eid}`)).json();
    const req = view.requirements.find((r: { key: string }) => r.key === "dj_performer");
    expect((await post(org, `/api/ops/events/${eid}/openings`, { kind: "open", requirementIds: [req.id], slots: 1, budgetUsd: 600 })).status).toBe(201);
    expect((await org.request.get(`/api/music/tracks/${aud}`)).status()).toBe(404); // not before the application
    await dj.goto("/profile/work");
    await dj.getByTestId("opportunities").locator('[data-kind="open"]', { hasText: `Audition Night ${TAG}` }).getByTestId("apply").click();
    await expect(dj.getByTestId("attach-tracks")).toContainText(`Audition Mix ${TAG}`);
    await expect(dj.getByTestId("attach-tracks")).not.toContainText(`Private Sketch ${TAG}`);
    await dj.getByTestId("attach-tracks").getByLabel(new RegExp(`Audition Mix ${TAG}`)).check();
    await dj.getByTestId("apply-message").fill("Deep techno, 2 hours");
    await dj.getByTestId("send-application").click();
    await expect(dj.getByTestId("attach-tracks")).toBeHidden();

    // #15: the organizer (reviewer) can play it in the applications list; others still can't
    await org.goto(`/events/manage/${eid}`);
    await org.getByTestId("tab-resources").click();
    await expect(org.getByTestId("applicant-tracks")).toContainText(`Audition Mix ${TAG}`);
    expect((await org.request.get(`/api/music/tracks/${aud}`)).status()).toBe(200);
    expect((await stranger.request.get(`/api/music/tracks/${aud}`)).status()).toBe(404);
    await org.getByTestId("app-review").click();
    await expect(org.getByTestId("applications")).toContainText(/Under review/i);
  });

  test("#5 #6 #7 #17 #18 #19 player on mobile: play, pause, seek, survives navigation, no overlap, slow network; likes count once", async ({ browser }) => {
    const admin = await adminPage(browser);
    const dj = await signedIn(browser);
    await djProfile(dj, `Glow Worm ${TAG}`);
    const id = await apiTrack(dj, `Tidepool ${TAG}`, "public", MP3_B);
    await approve(admin, id);
    const fan = await signedIn(browser, undefined, MOBILE);

    await fan.goto(`/music/tracks/${id}`);
    await expect(fan.getByTestId("track-page")).toContainText(`Tidepool ${TAG}`);
    const audio = fan.getByTestId("player-audio");
    // No autoplay: nothing plays until the listener asks.
    expect(await audio.evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
    await fan.getByTestId("track-play").click();
    const mini = fan.getByTestId("mini-player");
    await expect(mini).toBeVisible();
    await expect(fan.getByTestId("player-title")).toHaveText(`Tidepool ${TAG}`);
    await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.currentTime), { timeout: 15_000 }).toBeGreaterThan(0.5); // #17 really playing on mobile
    // #18: mini player sits above the bottom navigation
    const nav = fan.getByRole("navigation", { name: /primary/i }).locator("ul");
    const [mb, nb] = [await mini.boundingBox(), await nav.boundingBox()];
    expect(mb && nb).toBeTruthy();
    expect(mb!.y + mb!.height).toBeLessThanOrEqual(nb!.y + 1);
    // #5: pause / play / seek
    await fan.getByTestId("player-toggle").click();
    await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
    await fan.getByTestId("open-full-player").click();
    await expect(fan.getByTestId("full-player")).toBeVisible();
    await fan.getByTestId("player-seek").fill("7");
    await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => Math.round(a.currentTime))).toBeGreaterThanOrEqual(6);
    await fan.getByTestId("full-toggle").click();
    await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.paused)).toBe(false);
    await fan.keyboard.press("Escape");
    // #6: client-side navigation keeps the same player and position
    const before = await audio.evaluate((a: HTMLAudioElement) => a.currentTime);
    await nav.getByRole("link").nth(2).click(); // EVENTS
    await expect(fan).toHaveURL(/\/events/);
    await expect(fan.getByTestId("player-title")).toHaveText(`Tidepool ${TAG}`);
    expect(await audio.evaluate((a: HTMLAudioElement) => a.currentTime)).toBeGreaterThanOrEqual(before);
    await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.paused)).toBe(false);
    await fan.getByTestId("player-close").click();
    await expect(mini).toBeHidden();

    // #7: likes — a burst of taps and API calls is still one like
    await fan.goto(`/music/tracks/${id}`);
    await fan.getByTestId("like").first().click();
    await expect(fan.getByTestId("like-count").first()).toHaveText("1");
    await Promise.all([1, 2, 3].map(() => mpost(fan, `tracks/${id}/like`, { on: true })));
    const again = await mpost(fan, `tracks/${id}/like`, { on: true });
    expect(again.json.likes).toBe(1);
    await fan.reload();
    await expect(fan.getByTestId("like-count").first()).toHaveText("1");

    // #19: slow connection → the player says so instead of looking frozen
    const slow = await signedIn(browser, undefined, MOBILE);
    // The stream endpoint answers with a redirect to the file; delaying that first request is what a slow network looks like.
    await slow.route("**/api/music/tracks/*/stream**", async (route) => { await new Promise((r) => setTimeout(r, 9_000)); await route.continue(); });
    await slow.goto(`/music/tracks/${id}`);
    await slow.getByTestId("track-play").click();
    await expect(slow.getByTestId("mini-player")).toContainText(/Slow connection|Loading/i, { timeout: 3_000 });
    await expect(slow.getByTestId("mini-player")).toContainText(/Slow connection/i, { timeout: 8_000 });
  });

  test("#8 #9 #10 playlists created, edited and reordered; DJ search", async ({ browser }) => {
    const admin = await adminPage(browser);
    const dj = await signedIn(browser);
    const prof = await djProfile(dj, `Ooze Pilot ${TAG}`);
    const a = await apiTrack(dj, `Alpha ${TAG}`, "public");
    const b = await apiTrack(dj, `Bravo ${TAG}`, "public", MP3_B);
    await approve(admin, a);
    await approve(admin, b);
    const fan = await signedIn(browser);

    // #10: search by name, then by city + genre in the DJ ARENA
    await fan.goto("/djs");
    await fan.getByTestId("music-search").fill(`Ooze Pilot ${TAG}`);
    await expect(fan.getByTestId("search-results")).toContainText(`Ooze Pilot ${TAG}`, { timeout: 15_000 });
    const byCity = await (await fan.request.get(`/api/music/search?city=Tokyo&genre=Techno`)).json();
    expect(byCity.djs.some((d: { slug: string }) => d.slug === prof.slug)).toBe(true);

    // #8: create a playlist from the track page, add a second track
    await fan.goto(`/music/tracks/${a}`);
    await fan.getByTestId("add-to-playlist").first().click();
    await fan.getByTestId("new-playlist-name").fill(`Warmup ${TAG}`);
    await fan.getByTestId("create-playlist").click();
    await expect(fan.getByText(/Added to playlist/i).first()).toBeVisible();
    const lib = await (await fan.request.get("/api/music/me/library")).json();
    const pl = lib.playlists.find((x: { title: string }) => x.title === `Warmup ${TAG}`);
    expect((await mpost(fan, `playlists/${pl.id}/items`, { trackId: b })).status).toBe(201);
    await fan.goto(`/music/playlists/${pl.id}`);
    await expect(fan.getByTestId("playlist-items").getByTestId("track-row")).toHaveCount(2);
    await fan.getByTestId("playlist-edit").click();
    await fan.getByTestId("playlist-title-input").fill(`Warmup v2 ${TAG}`);
    await fan.getByTestId("playlist-save").click();
    await expect(fan.getByTestId("playlist-title")).toHaveText(`Warmup v2 ${TAG}`);
    // #9: reorder and save; the order survives a reload
    await fan.getByTestId("move-down").first().click();
    await fan.getByTestId("save-order").click();
    await expect(fan.getByText(/Order saved/i).first()).toBeVisible();
    await fan.reload();
    await expect(fan.getByTestId("playlist-items").getByTestId("track-row").first()).toContainText(`Bravo ${TAG}`);
  });

  test("#11 #12 #13 booking: organizer offers, DJ changes terms and accepts, organizer confirms; date conflict warned", async ({ browser }) => {
    const dj = await signedIn(browser);
    const prof = await djProfile(dj, `Bog Lantern ${TAG}`);
    const org = await signedIn(browser);
    const eventName = `Bog Night ${TAG}`;
    await opsEvent(org, eventName, 60);

    // #11: the organizer sends a request from the DJ's profile, autofilled from their event
    await org.goto(`/djs/u/${prof.slug}`);
    await org.getByTestId("request-booking").click();
    await org.getByTestId("bk-event").selectOption({ label: eventName });
    await expect(org.getByTestId("bk-name")).toHaveValue(eventName);
    await org.getByTestId("bk-message").fill("Peak-time set, 2 hours?");
    await org.getByTestId("send-booking").click();
    await expect(org.getByTestId("booking-sent")).toBeVisible();

    // #12: the DJ opens it (VIEWED), proposes a higher fee (NEGOTIATING), then accepts their terms (ACCEPTED)
    await dj.goto("/profile/dj?tab=bookings");
    await dj.getByTestId("received").getByTestId("booking-row").filter({ hasText: eventName }).click();
    const thread = dj.getByTestId("booking-thread");
    await expect(thread.getByTestId("booking-status")).toContainText(/Viewed/i);
    await dj.getByTestId("open-counter").click();
    await dj.locator("#bt-fee").fill("900");
    await dj.getByTestId("send-counter").click();
    await expect(thread.getByTestId("booking-status")).toContainText(/Negotiating/i);
    await dj.getByTestId("dj-accept").click();
    await expect(thread.getByTestId("booking-status")).toContainText(/Accepted/i);
    await expect(dj.getByTestId("status-explainer")).toContainText(/not locked/i);

    // The organizer confirms exactly those terms (CONFIRMED is a separate step)
    await org.goto("/profile/dj?tab=bookings");
    await org.getByTestId("sent").getByTestId("booking-row").filter({ hasText: eventName }).click();
    await expect(org.getByTestId("booking-terms")).toContainText("900");
    await org.getByTestId("confirm-check").check();
    await org.getByTestId("confirm-booking").click();
    await expect(org.getByTestId("booking-thread").getByTestId("booking-status")).toContainText(/Confirmed/i);

    // #13: another organizer asking for the same night sees the conflict before sending
    const org2 = await signedIn(browser);
    await opsEvent(org2, `Clash Party ${TAG}`, 60);
    await org2.goto(`/djs/u/${prof.slug}`);
    await org2.getByTestId("request-booking").click();
    await org2.getByTestId("bk-event").selectOption({ label: `Clash Party ${TAG}` });
    await expect(org2.getByTestId("conflict-warning")).toBeVisible({ timeout: 10_000 });
    // The public calendar only says "not available" for that day.
    const pub = await (await org2.request.get(`/api/music/djs/${prof.slug}`)).json();
    const d = isoAt(60, 20).slice(0, 10);
    expect(pub.availability.find((x: { day: string }) => x.day === d)?.status).toBe("unavailable");
    expect(JSON.stringify(pub)).not.toContain("900");
  });

  test("#16 copyright claim → staff takedown; restore after counter-notice", async ({ browser }) => {
    const admin = await adminPage(browser);
    const dj = await signedIn(browser);
    await djProfile(dj, `Spore Choir ${TAG}`);
    const id = await apiTrack(dj, `Borrowed Hook ${TAG}`, "public");
    await approve(admin, id);
    // A rights holder without an account files the claim from the track page.
    const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": fakeIp() } });
    const anon = await ctx.newPage();
    await anon.goto(`/music/tracks/${id}`);
    await expect(anon.getByTestId("rights-label")).toContainText(/not an automatic copyright check/i);
    await anon.getByTestId("open-claim").click();
    const form = anon.getByTestId("claim-form");
    await form.getByLabel(/Your name or organization/i).fill(`Hook Records ${TAG}`);
    await form.getByLabel(/Contact email/i).fill("rights@hook.test");
    await form.getByLabel(/Work being infringed/i).fill("Hook Song (2019)");
    await form.getByLabel(/What is infringed/i).fill("The vocal hook from 0:30 is our recording.");
    await form.getByRole("checkbox").check();
    await anon.getByTestId("send-claim").click();
    await expect(anon.getByTestId("claim-sent")).toBeVisible();

    await admin.goto("/admin/music");
    const claim = admin.getByTestId("admin-claim").filter({ hasText: `Hook Records ${TAG}` });
    await claim.getByTestId("claim-resolution").fill("Sample confirmed with the label.");
    await claim.getByTestId("claim-uphold").click();
    await expect(claim).toContainText(/Upheld/i);
    expect((await ctx.request.get(`/api/music/tracks/${id}`)).status()).toBe(404);
    expect((await ctx.request.get(`/api/music/tracks/${id}/stream`, { maxRedirects: 0 })).status()).toBe(404);
    await dj.goto("/profile/dj?tab=tracks");
    await expect(dj.getByTestId("my-track").filter({ hasText: `Borrowed Hook ${TAG}` })).toContainText(/Taken down/i);
    // The DJ answers with a counter-notice; staff restore the track (never automatic).
    const mine = dj.getByTestId("my-claims").locator("li", { hasText: `Hook Records ${TAG}` });
    await mine.getByLabel(/Counter-notice/i).fill("I licensed the hook from Hook Records, contract HR-2026-17.");
    await mine.getByRole("button", { name: /Send counter-notice/i }).click();
    await expect(mine).toContainText(/Counter-notice sent/i);
    await admin.reload();
    const claim2 = admin.getByTestId("admin-claim").filter({ hasText: `Hook Records ${TAG}` });
    await expect(claim2).toContainText("HR-2026-17");
    await claim2.getByTestId("claim-resolution").fill("Licence checked by staff.");
    await claim2.getByTestId("claim-restore").click();
    await expect(claim2).toContainText(/Track restored/i);
    expect((await ctx.request.get(`/api/music/tracks/${id}`)).status()).toBe(200);
    await expect(admin.getByTestId("music-audit")).toContainText(/claim\.uphold/);
    await expect(admin.getByTestId("music-audit")).toContainText(/claim\.restore/);
    await ctx.close();
  });

  test("#20 EVENTS, PROFILE and RANKINGS still work, with the DJ additions in place", async ({ browser }) => {
    const p = await signedIn(browser);
    await p.goto("/events");
    await expect(p.locator("main")).toBeVisible();
    await expect(p.locator("body")).not.toContainText(/Application error|Internal Server Error/);
    await p.goto("/profile");
    await p.getByRole("tab", { name: /Activity/i }).click();
    await expect(p.getByTestId("link-dj-studio")).toBeVisible();
    await p.goto("/rankings");
    await expect(p.getByTestId("dj-rankings")).toBeVisible();
    await expect(p.getByTestId("rank-method")).toContainText(/30 days/i);
    await expect(p.getByTestId("dj-rankings")).toContainText(/cannot be bought/i);
    await p.goto("/djs");
    await expect(p.getByTestId("music-arena")).toBeVisible();
    await expect(p.locator("body")).toContainText(/fictional examples/i);
  });
});
