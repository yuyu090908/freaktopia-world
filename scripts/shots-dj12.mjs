// Screenshots for the 12.0 report (local storage mode, fresh demo accounts). Usage: node scripts/shots-dj12.mjs <outDir>
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
const OUT = process.argv[2] ?? "shots";
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3000";
const PW = "neon slime forever";
const MP3 = readFileSync("tests/fixtures/audio/tone-12s-id3.mp3");
const ADMIN = process.env.E2E_ADMIN_EMAIL ?? "shot-admin@example.test";
const ip = () => `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const browser = await chromium.launch();

async function account(email, ctxOpts = {}) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, extraHTTPHeaders: { "x-forwarded-for": ip() }, ...ctxOpts });
  const page = await ctx.newPage();
  if ((await page.request.post("/api/auth/signin", { data: { email, password: PW }, headers: { origin: BASE } })).ok()) return page;
  await page.request.post("/api/auth/signup", { data: { email, password: PW } });
  await page.goto("/auth/mailbox");
  await page.getByTestId("mail-link").first().click();
  await page.waitForURL(/onboarding/);
  return page;
}
const post = async (p, path, data = {}) => { const j = await (await p.request.post(path, { data, headers: { origin: BASE } })).json(); if (j.error) console.log(path, JSON.stringify(j.error)); return j; };
const now = Date.now();
const dj = await account(`shot-dj-${now}@example.test`);
const prof = (await post(dj, "/api/music/profile", { stageName: "Mossy Signal", city: "Tokyo", country: "Japan", genres: ["Techno", "Melodic Techno"], bio: "Sample DJ account created for screenshots.", bookingStatus: "open", contactPolicy: "organizers", yearsExperience: 6 })).profile;
const admin = await account(ADMIN);
const ids = [];
for (const title of ["Night Bloom (sample)", "Fungal Drift (sample)"]) {
  const c = await post(dj, "/api/music/uploads", { fileName: "s.mp3", size: MP3.length, mime: "audio/mpeg", title });
  await dj.request.put(c.upload.url, { data: MP3, headers: c.upload.headers });
  await post(dj, `/api/music/tracks/${c.track.id}/complete`);
  await post(dj, `/api/music/tracks/${c.track.id}`, { title, type: "original_mix", genre: "Techno", bpm: 128, rights: { allOriginal: true, allowStreaming: true, statement: "Produced and mixed entirely by me." } });
  await post(dj, `/api/music/tracks/${c.track.id}/submit`, { visibility: "public" });
  ids.push(c.track.id);
}
await post(admin, `/api/music/admin/tracks/${ids[0]}/review`, { decision: "approve", note: "" });

await dj.goto("/profile/dj?tab=tracks");
await dj.getByTestId("my-tracks").waitFor();
await dj.screenshot({ path: `${OUT}/01-studio-tracks-desktop.png`, fullPage: true });
await dj.getByTestId("mp3-input").setInputFiles({ name: "sunrise.mp3", mimeType: "audio/mpeg", buffer: MP3 });
await dj.getByTestId("file-check").waitFor();
await dj.getByTestId("uploader").screenshot({ path: `${OUT}/02-upload-check.png` });
await dj.getByTestId("to-details").click();
await dj.getByTestId("to-rights").click();
await dj.getByTestId("uploader").screenshot({ path: `${OUT}/03-upload-rights.png` });

await admin.goto("/admin/music");
await admin.getByTestId("review-queue").waitFor();
await admin.screenshot({ path: `${OUT}/04-admin-review.png`, fullPage: true });

const fan = await account(`shot-fan-${now}@example.test`, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
await fan.goto(`/djs/u/${prof.slug}`);
await fan.getByTestId("dj-name").waitFor();
await fan.screenshot({ path: `${OUT}/05-dj-profile-mobile.png` });
await fan.getByTestId("play-all").click();
await fan.getByTestId("mini-player").waitFor();
await fan.waitForTimeout(1500);
await fan.screenshot({ path: `${OUT}/06-mini-player-mobile.png` });
await fan.getByTestId("open-full-player").click();
await fan.getByTestId("full-player").waitFor();
await fan.waitForTimeout(800);
await fan.screenshot({ path: `${OUT}/07-full-player-mobile.png` });
await fan.keyboard.press("Escape");
await fan.goto("/djs");
await fan.getByTestId("music-arena").waitFor();
await fan.waitForTimeout(800);
await fan.screenshot({ path: `${OUT}/08-arena-mobile.png` });

const org = await account(`shot-org-${now}@example.test`);
const day = 86_400_000;
const at = (d, h) => new Date(Math.floor(now / day) * day + d * day + h * 3_600_000).toISOString();
await post(org, "/api/ops/events", { name: "Spore Rave (sample)", city: "Tokyo", venueName: "Dock 3", setting: "indoor", startAt: at(40, 20), endAt: at(40, 26), genres: ["Techno"], attendance: 150, budgetUsd: 5000, ticketing: false, djs: true, streaming: false, templateId: "club_night", ownedEquipment: [], venueFacilities: [], services: [] });
await org.goto(`/djs/u/${prof.slug}`);
await org.getByTestId("request-booking").click();
await org.getByTestId("bk-event").selectOption({ label: "Spore Rave (sample)" });
await org.getByTestId("bk-message").fill("Would you play a 2-hour peak set?");
await org.waitForTimeout(500);
await org.screenshot({ path: `${OUT}/09-booking-request.png` });
await org.getByTestId("send-booking").click();
await org.getByTestId("booking-sent").waitFor();
await dj.goto("/profile/dj?tab=bookings");
await dj.getByTestId("booking-row").first().click();
await dj.getByTestId("booking-thread").waitFor();
await dj.waitForTimeout(500);
await dj.screenshot({ path: `${OUT}/10-booking-thread-dj.png` });
await fan.goto("/rankings#dj-rankings");
await fan.getByTestId("dj-rankings").scrollIntoViewIfNeeded();
await fan.waitForTimeout(500);
await fan.getByTestId("dj-rankings").screenshot({ path: `${OUT}/11-dj-rankings-mobile.png` });
await browser.close();
console.log("done");
