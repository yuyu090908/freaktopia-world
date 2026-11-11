import { test, expect, type Browser, type Page } from "@playwright/test";

/**
 * FREAK ID & LOYALTY (Phase 1) end to end against the in-memory demo configuration.
 * Rank changes need events that have ended and were verified at the door; those paths are covered on both stores by
 * tests/integration/loyalty-service.test.ts. Here: what members and visitors see, and the checkout breakdown.
 */
const PW = "neon slime forever";
let seq = 0;
const fakeIp = () => `10.${(process.pid % 200) + 30}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const noSideways = async (p: Page) => expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

async function member(browser: Browser, width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width < 600, extraHTTPHeaders: { "x-forwarded-for": fakeIp() } });
  const page = await context.newPage();
  const email = `loyal-${Date.now()}-${process.pid}-${++seq}@example.test`;
  expect((await page.request.post("/api/auth/signup", { data: { email, password: PW }, headers: { "content-type": "application/json" } })).ok()).toBeTruthy();
  await page.goto("/auth/mailbox");
  await page.getByTestId("mail-link").first().click();
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 20_000 });
  let me: { alien?: { publicId: string }; user?: { emailVerified: boolean } } = {};
  await expect.poll(async () => (me = await (await page.request.get("/api/me")).json()).user?.emailVerified ?? false).toBe(true);
  return { page, publicId: me.alien!.publicId };
}

test.describe("FREAK ID & loyalty", () => {
  test.setTimeout(120_000);

  test("visitor: profile explains FREAK ID with the rank ladder; checkout shows the full fee and why", async ({ page }) => {
    await page.goto("/profile");
    const card = page.getByTestId("freak-id");
    await expect(card).toContainText("Every party counts");
    await expect(card.getByTestId("rank-ladder").locator("tbody tr")).toHaveCount(5);
    await expect(card.getByTestId("rank-ladder")).toContainText("LEGEND");
    await expect(card.getByTestId("rank-ladder")).toContainText("60%"); // LEGEND 100% stays off until enabled
    await noSideways(page);

    await page.goto("/events/neon-slime-summit/tickets");
    await page.getByRole("button", { name: /review order/i }).click();
    const note = page.getByTestId("loyalty-note");
    await expect(note).toContainText("Signed in members get their rank discount");
    await expect(page.getByTestId("loyalty-discount")).toHaveCount(0);
    await expect(page.getByText("FREAKTOPIA platform fee (5%)")).toBeVisible();
    await expect(page.getByText(/Ticket prices are never discounted/)).toBeVisible();
  });

  test("member: FREAK ID from the account, ROOKIE with nothing invented; the order keeps the server's fee snapshot", async ({ browser }) => {
    const m = await member(browser);
    await m.page.goto("/profile");
    const card = m.page.getByTestId("freak-id");
    await expect(card).toHaveAttribute("data-rank", "rookie");
    await expect(card.getByTestId("freak-id-number")).toHaveText(m.publicId);
    await expect(card.getByTestId("freak-id-stats")).toContainText("0%");
    await expect(card).toContainText("No verified events yet");
    await expect(card).toContainText("3 more to EXPLORER");
    await expect(card.getByTestId("freak-id-world")).toHaveAttribute("href", `/u/${m.publicId}/world`);
    await card.getByTestId("freak-id-history").locator("summary").click();
    await expect(card.getByTestId("freak-id-history")).toContainText("Check in at the door");
    await noSideways(m.page);

    await m.page.goto("/events/neon-slime-summit/tickets");
    await m.page.getByRole("button", { name: /review order/i }).click();
    await expect(m.page.getByTestId("loyalty-note")).toContainText("Your rank: ROOKIE");
    await expect(m.page.getByTestId("loyalty-note")).toContainText("Buying a ticket does not count by itself");
    const total = await m.page.getByTestId("order-total").textContent();
    await m.page.getByRole("button", { name: /complete demo purchase/i }).click();
    await expect(m.page).toHaveURL(/\/tickets\/FK/);
    await expect(m.page.getByText("FREAKTOPIA platform fee (5%)")).toBeVisible();
    await expect(m.page.getByText(total!.trim()).first()).toBeVisible();
  });

  test("Japanese, and the admin page is closed to non-admins", async ({ browser }) => {
    const m = await member(browser, 1280);
    await m.page.goto("/ja/profile");
    await expect(m.page.getByTestId("freak-id")).toContainText("確認済みの参加はまだありません");
    await expect(m.page.getByTestId("freak-id")).toContainText("EXPLORERまであと3回");
    await m.page.goto("/ja/admin/loyalty");
    await expect(m.page.getByText("管理者専用").first()).toBeVisible();
    expect((await m.page.request.get("/api/loyalty/admin")).status()).toBe(403);
    const r = await m.page.request.post("/api/loyalty/admin/rules", { data: { reason: "trying" }, headers: { "content-type": "application/json", origin: "http://localhost:3000" } });
    expect(r.status()).toBeGreaterThanOrEqual(400);
  });
});
