import { test, expect, type Browser, type Page } from "@playwright/test";
import mock from "./fixtures/map-external-mock.json";

/**
 * 11.0 GLOBAL DISCOVERY end to end, with NO outside source connected (the state of this build: no API keys).
 * Checks that nothing external is invented, the shared filters carry between WORLD and EVENTS,
 * and the admin API/page are closed. Mapping of real source data is covered by tests/unit/discovery.test.ts (mock data).
 */
const PW = "neon slime forever";
let seq = 0;
const fakeIp = () => `10.${(process.pid % 200) + 40}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const json = { "content-type": "application/json", origin: "http://localhost:3000" };

async function signedIn(browser: Browser, email: string) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { "x-forwarded-for": fakeIp() } });
  const page = await context.newPage();
  // An account from an earlier run on the same server (the fixed admin address) just signs in.
  if ((await page.request.post("/api/auth/signin", { data: { email, password: PW }, headers: { origin: "http://localhost:3000" } })).ok()) return page;
  expect((await page.request.post("/api/auth/signup", { data: { email, password: PW }, headers: { "content-type": "application/json" } })).ok()).toBeTruthy();
  await page.goto("/auth/mailbox");
  await page.getByTestId("mail-link").first().click();
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 20_000 });
  await expect.poll(async () => (await (await page.request.get("/api/me")).json()).user?.emailVerified ?? false).toBe(true);
  return page;
}

test.describe("global discovery (no source connected)", () => {
  test.setTimeout(120_000);

  test("public API: sources are listed as not configured, no events, no secrets", async ({ request }) => {
    const s = await (await request.get("/api/discovery/sources")).json();
    const tm = s.sources.find((x: { id: string }) => x.id === "ticketmaster");
    const bit = s.sources.find((x: { id: string }) => x.id === "bandsintown");
    expect(tm.state).toBe("not_configured");
    expect(bit.state).toBe("not_configured");
    const e = await (await request.get("/api/discovery/events")).json();
    expect(e).toMatchObject({ connected: false, events: [] });
    expect((await request.get("/api/discovery/events?when=yesterday")).status()).toBe(400);
    const map = await (await request.get("/api/map")).json();
    expect(map.events.some((x: { source?: string }) => x.source === "external")).toBe(false);
  });

  test("cron and admin endpoints are closed", async ({ request }) => {
    expect((await request.get("/api/discovery/cron")).status()).toBe(401);
    expect((await request.get("/api/discovery/cron", { headers: { authorization: "Bearer guess" } })).status()).toBe(401);
    expect((await request.get("/api/discovery/admin")).status()).toBe(401);
    expect((await request.post("/api/discovery/admin/sync", { data: { source: "ticketmaster" }, headers: { "content-type": "application/json", origin: "https://evil.example" } })).status()).toBe(403);
    expect((await request.post("/api/discovery/admin/sync", { data: { source: "ticketmaster" }, headers: json })).status()).toBe(401);
  });

  test("EVENTS says no outside source is connected and shows no world events", async ({ page }) => {
    await page.goto("/events");
    await expect(page.getByTestId("world-events-off")).toBeVisible();
    await expect(page.getByTestId("world-event-card")).toHaveCount(0);
    await page.goto("/ja/events");
    await expect(page.getByTestId("world-events-off")).toContainText("外部のイベントデータソースはまだ接続されていない");
  });

  test("filters carry from WORLD to EVENTS and back through the URL", async ({ page }) => {
    await page.goto("/world?view=list&q=tokyo&kind=freaktopia&date=30d");
    const link = page.getByTestId("world-to-events");
    await expect(link).toHaveAttribute("href", /\/events\?q=tokyo&date=30d&kind=freaktopia/);
    await expect(page.getByTestId("world-count")).toBeVisible(); // hydrated: the client router handles the click
    await link.click();
    // Under two workers the events page can take a while to stream in.
    await expect(page).toHaveURL(/\/events\?q=tokyo&date=30d&kind=freaktopia/, { timeout: 20_000 });
    await expect(page.locator("#event-search")).toHaveValue("tokyo");
    await expect(page.getByRole("button", { name: /FREAKTOPIA only/i })).toBeVisible(); // active filter chip
    const back = page.getByTestId("events-to-world");
    await expect(back).toHaveAttribute("href", /\/world\?q=tokyo&date=30d&kind=freaktopia/);
  });

  test("kind filter: festivals come only from outside sources, so none are invented", async ({ page }) => {
    await page.goto("/events?kind=festival");
    await expect(page.getByTestId("events-count")).toHaveAttribute("data-ready", "true");
    await expect(page.getByTestId("events-count")).toContainText(/^0 /);
    await page.goto("/world?view=list&kind=festival");
    await expect(page.getByTestId("world-count")).toContainText(/^0 /);
  });

  test("admin page: closed to members; an admin sees each source's real state", async ({ browser }) => {
    const m = await signedIn(browser, `disc-${Date.now()}-${process.pid}-${++seq}@example.test`);
    await m.goto("/admin/sources");
    await expect(m.getByText("Admins only").first()).toBeVisible();
    expect((await m.request.get("/api/discovery/admin")).status()).toBe(403);
    expect((await m.request.post("/api/discovery/admin/pause", { data: { source: "ticketmaster", paused: true }, headers: json })).status()).toBe(403);

    const adminEmail = process.env.E2E_ADMIN_EMAIL;
    test.skip(!adminEmail, "set E2E_ADMIN_EMAIL to an address in the server's OPS_ADMIN_EMAILS");
    const a = await signedIn(browser, adminEmail!);
    await a.goto("/admin/sources");
    const tm = a.getByTestId("source-ticketmaster");
    await expect(tm.getByTestId("source-state")).toHaveText(/not configured/i);
    await expect(tm).toContainText("TICKETMASTER_API_KEY");
    await expect(a.getByTestId("source-bandsintown")).toContainText("BANDSINTOWN_APPROVED=1");
    await expect(tm.getByRole("button", { name: "Sync now" })).toBeDisabled();
    await expect(a.getByTestId("q-duplicates")).toContainText("None");
  });

  /** The browser's /api/map answer gets MOCK external entries added (tests/fixtures), to check how WORLD renders them. */
  async function withMockExternal(page: Page) {
    await page.route("**/api/map", async (route) => {
      const r = await route.fetch();
      const body = await r.json();
      await route.fulfill({ response: r, json: { ...body, events: [...body.events, ...mock.events] } });
    });
  }

  test("WORLD (mocked map data): an external event shows its source and only links out", async ({ page }) => {
    await withMockExternal(page);
    await page.goto("/world?view=list&q=mock");
    await expect(page.getByTestId("world-count")).toContainText(/^3 /);
    await expect(page.getByTestId("world-breakdown-external")).toContainText("3");
    await expect(page.getByTestId("list-source").first()).toHaveText("Ticketmaster");
    await page.getByRole("button", { name: /MOCK Neon Fest/ }).click();
    const panel = page.getByTestId("event-sheet");
    await expect(panel.getByTestId("map-source-badge")).toContainText("Ticketmaster");
    const official = panel.getByTestId("map-official");
    await expect(official).toHaveAttribute("href", "https://www.ticketmaster.de/event/mock-fest-1");
    await expect(official).toHaveAttribute("target", "_blank");
    await expect(official).toHaveAttribute("rel", "noopener noreferrer");
    await panel.getByRole("button", { name: /more details|show all/i }).first().click();
    await expect(panel.getByTestId("map-last-verified")).toBeVisible();
    await expect(panel.getByTestId("map-external-tickets")).toHaveAttribute("href", /ticketmaster\.de/);
    // never a FREAKTOPIA ticket, support, DAO or DJ button for an outside event
    await expect(panel.locator('a[href*="/tickets"]:not([href^="https://"])')).toHaveCount(0);
    await expect(panel.locator('a[href*="/dao/"], a[href*="/djs/apply"]')).toHaveCount(0);
  });

  test("WORLD (mocked map data): approximate locations are said; kind filter keeps only festivals", async ({ page }) => {
    await withMockExternal(page);
    await page.goto("/world?view=list&q=mock&kind=festival");
    await expect(page.getByTestId("world-count")).toContainText(/^1 /);
    await page.goto("/world?view=list&q=tokyo club");
    await page.getByRole("button", { name: /MOCK Tokyo Club Night/ }).click();
    const panel = page.getByTestId("event-sheet");
    await panel.getByRole("button", { name: /more details|show all/i }).first().click();
    await expect(panel.getByTestId("map-approx")).toBeVisible();
    // postponed: no ticket link
    await page.goto("/world?view=list&q=postponed");
    await page.getByRole("button", { name: /MOCK Postponed Night/ }).click();
    await expect(page.getByTestId("event-sheet").getByTestId("map-external-tickets")).toHaveCount(0);
  });
});

