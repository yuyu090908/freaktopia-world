import { test, expect, type Browser, type Page } from "@playwright/test";

/**
 * PERSONAL PARTY UNIVERSE (9.0) end to end, against the in-memory demo configuration.
 * Every person is a real signed-up, email-verified account in its own browser context.
 */

const PW = "neon slime forever";
let seq = 0;
const TAG = Math.random().toString(36).slice(2, 6).toUpperCase();
const newEmail = () => `party-${Date.now()}-${process.pid}-${++seq}@example.test`;
const fakeIp = () => `10.${(process.pid % 200) + 20}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const H = 3_600_000;
// 1×1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

interface Person {
  page: Page;
  email: string;
  userId: string;
  publicId: string;
}

async function person(browser: Browser, width = 390): Promise<Person> {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, hasTouch: width < 600, extraHTTPHeaders: { "x-forwarded-for": fakeIp() } });
  const page = await context.newPage();
  const email = newEmail();
  const r = await page.request.post("/api/auth/signup", { data: { email, password: PW }, headers: { "content-type": "application/json" } });
  expect(r.ok()).toBeTruthy();
  await page.goto("/auth/mailbox");
  await page.getByTestId("mail-link").first().click();
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 20_000 });
  let me: { user?: { id: string; emailVerified: boolean }; alien?: { publicId: string } } = {};
  await expect.poll(async () => (me = await (await page.request.get("/api/me")).json()).user?.emailVerified ?? false).toBe(true);
  return { page, email, userId: me.user!.id, publicId: me.alien!.publicId };
}

const post = async (p: Page, path: string, data: unknown = {}) => {
  const r = await p.request.post(path, { data, headers: { "content-type": "application/json", origin: new URL(p.url()).origin } });
  return { status: r.status(), json: await r.json().catch(() => ({})) };
};

async function liveParty(p: Page, name: string, startInHours = -1) {
  const now = Date.now() + (startInHours + 1) * H;
  const r = await post(p, "/api/ops/events", {
    name, city: "Bangkok", venueName: "Goo Hall", setting: "indoor", startAt: new Date(now - H).toISOString(), endAt: new Date(now + 3 * H).toISOString(), genres: ["Afro House"],
    attendance: 80, budgetUsd: 1000, ticketing: false, djs: true, streaming: false, templateId: "club_night", ownedEquipment: [], venueFacilities: [], services: [],
  });
  expect(r.status).toBe(201);
  return r.json.event.id as string;
}

const noHorizontalScroll = async (p: Page) => {
  expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
};

test.describe("party universe", () => {
  test.setTimeout(180_000);

  test("demo world: dashboard, lite and 3D views, planet → memories, exit, Japanese", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/u/demo/world");
    await page.evaluate(() => localStorage.setItem("fk-world-mode", "lite"));
    await page.reload();
    await expect(page.getByTestId("world-lite")).toBeVisible();
    await expect(page.getByTestId("dash-totalEvents").locator("[data-value]")).toHaveText("5");
    await expect(page.getByTestId("impact")).toBeVisible();
    await noHorizontalScroll(page);
    // Every planet link sits on the drawing (inside the SVG box).
    const svg = (await page.getByTestId("world-lite").locator("svg").first().boundingBox())!;
    for (const b of await page.getByTestId("planet").all()) {
      const bb = (await b.boundingBox())!;
      const cx = bb.x + bb.width / 2;
      const cy = bb.y + bb.height / 2;
      expect(cx).toBeGreaterThanOrEqual(svg.x - 1);
      expect(cx).toBeLessThanOrEqual(svg.x + svg.width + 1);
      expect(cy).toBeGreaterThanOrEqual(svg.y - 1);
      expect(cy).toBeLessThanOrEqual(svg.y + svg.height + 1);
    }
    // First tap selects, second opens the memories page.
    const verified = page.locator('[data-testid=planet][data-state="verified"]').first();
    await verified.click();
    await expect(page.getByTestId("planet-card")).toBeVisible();
    await page.getByTestId("planet-open").click();
    await expect(page).toHaveURL(/\/u\/demo\/world\/[0-9a-f-]{36}/);
    await expect(page.getByTestId("event-state")).toHaveText(/verified/i);
    await expect(page.getByTestId("fig-attendance").locator("dd")).not.toHaveText("—");
    await page.getByTestId("back-to-world").click();
    await expect(page.getByTestId("world-title")).toBeVisible();

    // 3D mode renders a canvas (WebGL), with the same accessible planet links.
    await page.getByTestId("mode-3d").click();
    await expect(page.getByTestId("world-3d").locator("canvas")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("world-3d").getByTestId("planet")).toHaveCount(6);

    await page.goto("/ja/u/demo/world");
    await expect(page.getByTestId("world-title")).toContainText("ワールド");
    await expect(page.getByTestId("world-exit")).toHaveAttribute("href", "/ja/u/demo");
  });

  test("RSVP never counts; door scan counts once; manual fix needs a reason; review, media, follow, privacy, delete", async ({ browser }) => {
    const org = await person(browser, 1440);
    const a = await person(browser);
    const b = await person(browser);
    const name = `Goo Hall ${TAG}`;
    const eid = await liveParty(org.page, name);

    // Organizer publishes from the Door tab.
    await org.page.goto(`/events/manage/${eid}?tab=door`);
    await org.page.getByRole("switch").first().click();
    await expect.poll(async () => (await (await org.page.request.get(`/api/party/door/${eid}`)).json()).door.published).toBe(true);

    // A follows the organizer before the next party is announced.
    await a.page.goto(`/u/${org.publicId}/world`);
    await a.page.getByTestId("follow").click();
    await expect(a.page.getByTestId("unfollow")).toBeVisible();

    // A RSVPs from the memories page (phone) and sees the QR pass.
    await a.page.goto(`/u/${org.publicId}/world/${eid}`);
    await a.page.getByTestId("rsvp").click();
    await a.page.getByTestId("show-pass").click();
    await expect(a.page.getByTestId("pass").locator("svg")).toBeVisible();
    const codeA = (await a.page.getByTestId("pass-code").textContent())!.trim();
    await noHorizontalScroll(a.page);
    // B RSVPs too.
    await b.page.goto(`/u/${org.publicId}/world/${eid}`);
    expect((await post(b.page, `/api/party/events/${eid}/rsvp`)).status).toBe(200);

    // RSVPs alone count nothing.
    let door = (await (await org.page.request.get(`/api/party/door/${eid}`)).json()).door;
    expect(door.going).toBe(2);
    expect(door.checkedIn).toBe(0);

    // Door: scan A by code → ok; again → duplicate, still one.
    await org.page.reload();
    await org.page.getByTestId("door-code").fill(codeA);
    await org.page.getByTestId("door-submit").click();
    await expect(org.page.getByTestId("door-result")).toHaveAttribute("data-result", "ok");
    await org.page.getByTestId("door-code").fill(`FKP1:${eid}:${codeA}`);
    await org.page.getByTestId("door-submit").click();
    await expect(org.page.getByTestId("door-result")).toHaveAttribute("data-result", "duplicate");
    await org.page.getByTestId("door-code").fill("ZZZZZZZZZZ");
    await org.page.getByTestId("door-submit").click();
    await expect(org.page.getByTestId("door-result")).toHaveAttribute("data-result", "not_found");
    await expect(org.page.getByTestId("doorCheckedIn").locator("dd")).toHaveText("1");

    // Manual confirm of B: blocked without a reason, then recorded with one.
    await org.page.getByTestId("manual-confirm").first().click();
    await org.page.getByTestId("confirm-check").check();
    await expect(org.page.getByTestId("confirm-action")).toBeDisabled();
    await org.page.getByTestId("fix-reason").fill("Phone battery died at the door");
    await org.page.getByTestId("confirm-action").click();
    await expect(org.page.getByTestId("doorManual").locator("dd")).toHaveText("1");
    await expect(org.page.getByTestId("door-people")).toContainText("Phone battery died");

    // The party is still running, so the world counts no verified party yet.
    const w = (await (await a.page.request.get(`/api/party/worlds/${org.publicId}`)).json()).world;
    expect(w.stats.totalEvents).toBe(0);
    expect(w.next?.id).toBe(eid);

    // A (checked in) reviews and posts a photo, then makes it private and deletes it.
    await a.page.reload();
    await expect(a.page.getByTestId("my-status")).toHaveText(/checked in/i);
    await a.page.getByTestId("star-5").click();
    await a.page.getByTestId("review-submit").click();
    await expect(a.page.getByTestId("review-list")).toBeVisible();
    await a.page.getByTestId("media-file").setInputFiles({ name: "goo.png", mimeType: "image/png", buffer: PNG });
    await a.page.getByTestId("media-upload").click();
    await expect(a.page.getByTestId("media-attendee").getByTestId("media-item")).toHaveCount(1);
    await a.page.getByTestId("media-visibility").selectOption("hidden");
    // Hidden: the organizer doesn't see it.
    const ev = (await (await org.page.request.get(`/api/party/events/${eid}`)).json());
    expect(ev.media.attendee).toHaveLength(0);
    await a.page.getByTestId("media-delete").click();
    await expect(a.page.getByTestId("media-attendee").getByTestId("media-item")).toHaveCount(0);
    // The organizer (team) can't review their own party.
    expect((await post(org.page, `/api/party/events/${eid}/review`, { rating: 5, text: "" })).json.error.code).toBe("TEAM_CANNOT_REVIEW");

    // Next party announced → A (following, notify on) gets one note in My parties.
    const eid2 = await liveParty(org.page, `Second ${TAG}`, 48); // announced for later: followers are told
    expect((await post(org.page, `/api/party/events/${eid2}/publish`, { published: true })).json.notified).toBe(1);
    await a.page.goto("/profile/parties");
    await expect(a.page.getByTestId("party-news")).toContainText(`Second ${TAG}`);

    // Privacy: off by default; turning on "show in worlds" is saved.
    const privacy = a.page.getByTestId("privacy");
    await privacy.getByRole("switch").first().click();
    await expect.poll(async () => (await (await a.page.request.get("/api/party/me")).json()).privacy.showInWorlds).toBe(true);

    // Delete my party data → the attendance is gone.
    await a.page.getByTestId("delete-party-data").click();
    await a.page.getByTestId("confirm-check").check();
    await a.page.getByTestId("confirm-action").click();
    await expect.poll(async () => (await (await a.page.request.get("/api/party/me")).json()).items.length).toBe(0);
    door = (await (await org.page.request.get(`/api/party/door/${eid}`)).json()).door;
    expect(door.checkedIn).toBe(1);

    // Desktop world of the organizer, with the owner tools and no horizontal scroll.
    await org.page.goto(`/u/${org.publicId}/world`);
    await expect(org.page.getByTestId("world-title")).toBeVisible();
    await expect(org.page.locator("#tagline")).toBeVisible();
    await noHorizontalScroll(org.page);
    // Public profile links to the world.
    await org.page.goto(`/u/${org.publicId}`);
    await org.page.getByTestId("open-world").click();
    await expect(org.page).toHaveURL(new RegExp(`/u/${org.publicId}/world$`));
  });

  test("free tickets with a waitlist, promotion on cancel, recording links, highlights, email opt-in", async ({ browser }) => {
    const org = await person(browser, 1440);
    const a = await person(browser);
    const b = await person(browser);
    const eid = await liveParty(org.page, `Tiny Room ${TAG}`);

    // Organizer: publish, set capacity 1 and a recording link from the Door tab.
    await org.page.goto(`/events/manage/${eid}?tab=door`);
    await org.page.getByRole("switch").first().click();
    await expect.poll(async () => (await (await org.page.request.get(`/api/party/door/${eid}`)).json()).door.published).toBe(true);
    // An official photo to highlight.
    const up = await post(org.page, `/api/party/events/${eid}/media`, { mime: "image/png", data: PNG.toString("base64"), caption: "Main floor", visibility: "public" });
    expect(up.status).toBe(200);
    await org.page.reload();
    await org.page.getByTestId("ps-capacity").fill("1");
    await org.page.getByTestId("ps-archive-0").fill("https://soundcloud.com/freaktopia/closing-set");
    await org.page.getByTestId("ps-highlight").first().click();
    await org.page.getByTestId("ps-save").click();
    await expect.poll(async () => (await (await org.page.request.get(`/api/party/door/${eid}`)).json()).door.settings.capacity).toBe(1);
    // A bad link is refused, not saved.
    await org.page.getByTestId("ps-archive-0").fill("https://evil.example/x");
    await org.page.getByTestId("ps-save").click();
    await expect.poll(async () => (await (await org.page.request.get(`/api/party/door/${eid}`)).json()).door.settings.archives[0]?.host).toBe("SoundCloud");

    // A takes the only ticket.
    await a.page.goto(`/u/${org.publicId}/world/${eid}`);
    await expect(a.page.getByTestId("tickets-left")).toBeVisible();
    await a.page.getByTestId("rsvp").click();
    await a.page.getByTestId("show-pass").click();
    await expect(a.page.getByTestId("pass-code")).toBeVisible();
    // Recording link and highlight are shown to everyone.
    await expect(a.page.getByTestId("archives").locator("a")).toHaveAttribute("href", "https://soundcloud.com/freaktopia/closing-set");
    await expect(a.page.getByTestId("archives").locator("a")).toHaveAttribute("target", "_blank");
    await expect(a.page.getByTestId("media-highlights").getByTestId("media-item")).toHaveCount(1);

    // B: full → waitlist, no pass code.
    await b.page.goto(`/u/${org.publicId}/world/${eid}`);
    await b.page.getByTestId("rsvp").click();
    await expect(b.page.getByTestId("my-status")).toHaveText(/waitlist/i);
    await b.page.getByTestId("show-pass").click();
    await expect(b.page.getByTestId("pass-waitlist")).toBeVisible();
    await expect(b.page.getByTestId("pass-code")).toHaveCount(0);
    await noHorizontalScroll(b.page);
    const door = (await (await org.page.request.get(`/api/party/door/${eid}`)).json()).door;
    expect(door.waitlist).toBe(1);

    // A cancels → B is promoted, gets a pass and a note.
    await a.page.getByTestId("rsvp-cancel").click();
    await expect.poll(async () => (await (await b.page.request.get(`/api/party/pass/${eid}`)).json()).pass?.waitlist).toBe(false);
    await b.page.reload();
    await b.page.getByTestId("show-pass").click();
    await expect(b.page.getByTestId("pass-code")).toBeVisible();
    const notes = (await (await b.page.request.get("/api/ops/notifications")).json()).notifications as { key: string }[];
    expect(notes.some((n) => n.key === "notif.partyPromoted")).toBe(true);

    // Email opt-in: shown only with notify on, saved per organizer, listed in My parties.
    await b.page.goto(`/u/${org.publicId}/world`);
    await b.page.getByTestId("follow").click();
    await expect(b.page.getByTestId("toggle-email")).toBeVisible();
    await b.page.getByTestId("toggle-email").click();
    await expect.poll(async () => (await (await b.page.request.get("/api/party/me")).json()).follows[0]?.email).toBe(true);
    const eid2 = await liveParty(org.page, `Mail ${TAG}`, 48);
    expect((await post(org.page, `/api/party/events/${eid2}/publish`, { published: true })).json.notified).toBe(1);
    await b.page.goto("/auth/mailbox");
    await expect(b.page.locator("body")).toContainText(`Mail ${TAG}`);
    await b.page.goto("/profile/parties");
    await b.page.getByTestId("mine-email").click();
    await expect.poll(async () => (await (await b.page.request.get("/api/party/me")).json()).follows[0]?.email).toBe(false);
  });
});
