import { test, expect, type Page } from "@playwright/test";

/**
 * FESTIVAL DAO end-to-end flows (demo mode).
 * The demo wallet signs a real EIP-4361 style message in the browser (viem); the server verifies it.
 * Each test uses a fresh browser context, so a fresh demo wallet and session.
 */

const EV = "neon-slime-summit";

const noHorizontalScroll = async (page: Page) => {
  const r = await page.evaluate(() => {
    window.scrollTo(500, window.scrollY);
    return { x: window.scrollX, doc: document.documentElement.scrollWidth - window.innerWidth };
  });
  expect(r.x).toBe(0);
  expect(r.doc).toBeLessThanOrEqual(0);
};

async function joinDao(page: Page) {
  await page.goto(`/dao/${EV}`);
  await page.getByRole("button", { name: /^Join DAO$/ }).first().click();
  const sheet = page.getByRole("dialog", { name: "Join this DAO" });
  await expect(sheet.getByText(/not connected to any blockchain/i)).toBeVisible();
  await sheet.getByRole("button", { name: /Connect demo wallet & sign/ }).click();
  // Staking display: network, contract, minimum, lock and 1p1v note
  await expect(sheet.getByText("Minimum stake")).toBeVisible();
  await expect(sheet.getByText("Staking contract")).toBeVisible();
  await expect(sheet.getByText(/Staking more does not add voting weight/)).toBeVisible();
  await sheet.getByRole("button", { name: /^Stake \d+ & join \(demo\)$/ }).click();
  await expect(sheet.getByText(/You’re in!/)).toBeVisible();
  await sheet.getByRole("button", { name: "Go to the DAO" }).click();
  await expect(page.getByText("Staked member")).toBeVisible();
}

test.describe("festival DAO", () => {
  test("non-members can read but not post; DAO home shows demo notice and current vote", async ({ page }) => {
    await page.goto(`/dao/${EV}`);
    await expect(page.getByRole("heading", { name: "DAO Home" })).toBeVisible();
    await expect(page.getByText(/No blockchain, token or payment is connected/)).toBeVisible();
    await expect(page.getByText("AI CONCEPT / NOT A CONSTRUCTION PLAN").first()).toBeVisible();
    await page.goto(`/dao/${EV}/discussion`);
    await expect(page.getByRole("button", { name: /New thread/ })).toHaveCount(0);
    // The API refuses posting without a wallet and stake.
    const r = await page.request.post(`/api/dao/${EV}/discussions`, { data: { title: "Anonymous post", body: "This should be refused because nobody is signed in.", category: "general" } });
    expect(r.status()).toBe(401);
    expect((await r.json()).error.code).toBe("WALLET_REQUIRED");
  });

  test("join with demo wallet, post a thread with an image, comment", async ({ page }) => {
    await joinDao(page);
    await page.goto(`/dao/${EV}/discussion`);
    await page.getByRole("button", { name: /New thread/ }).click();
    const sheet = page.getByRole("dialog", { name: "New thread" });
    await sheet.locator("#t-title").fill("Glow paint on the toilets?");
    await sheet.locator("#t-body").fill("UV glow paint on the toilet doors would help people find them in the dark.");
    // Image upload (server sniffs magic bytes): use a real PNG screenshot.
    const png = await page.screenshot();
    await sheet.locator('input[type="file"]').setInputFiles({ name: "door.png", mimeType: "image/png", buffer: png });
    await expect(sheet.locator('img[src*="/api/dao/media/"]').first()).toBeVisible();
    // A fake image is rejected
    await sheet.locator('input[type="file"]').setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("<svg/>") });
    await expect(sheet.getByText(/fake\.png/)).toBeVisible();
    await sheet.getByRole("button", { name: "Post thread" }).click();
    await expect(page.getByRole("heading", { name: "Glow paint on the toilets?" })).toBeVisible();
    await page.locator("#cmt").fill("Great idea, UV paint is cheap too.");
    await page.getByRole("button", { name: "Post comment" }).click();
    await expect(page.getByText("Great idea, UV paint is cheap too.")).toBeVisible();
  });

  test("create a proposal, open the vote, vote once, double vote blocked", async ({ page }) => {
    await joinDao(page);
    await page.goto(`/dao/${EV}/proposals?new=1`);
    const sheet = page.getByRole("dialog", { name: "New proposal" });
    await sheet.locator("#p-title").fill("Free water refill stations");
    await sheet.locator("#p-desc").fill("Put three free water refill stations next to the bars so nobody has to buy bottled water.");
    await sheet.locator("#p-change").fill("Rent three refill stations and place them by the bars.");
    await sheet.locator("#p-cost").fill("900");
    await sheet.getByRole("button", { name: "Open for discussion" }).click();
    await expect(page).toHaveURL(/\/proposals\/[^/?]+$/);
    const pid = page.url().split("/").pop()!;
    // Demo organizer view fast-tracks review and opens the vote (snapshot taken now, includes this member).
    expect((await page.request.post(`/api/dao/${EV}/demo-role`, { data: { roles: ["organizer"] } })).ok()).toBe(true);
    expect((await page.request.post(`/api/dao/${EV}/proposals/${pid}/transition`, { data: { to: "REVIEW" } })).ok()).toBe(true);
    expect((await page.request.post(`/api/dao/${EV}/proposals/${pid}/transition`, { data: { to: "VOTING" } })).ok()).toBe(true);
    await page.reload();
    await page.locator("label", { has: page.getByRole("radio", { name: "Yes" }) }).first().click();
    await expect(page.getByRole("radio", { name: "Yes" }).first()).toBeChecked();
    await page.getByRole("button", { name: /Review vote/ }).click();
    await page.getByRole("dialog", { name: "Confirm your vote" }).getByRole("button", { name: "Submit vote" }).click();
    await expect(page.getByText("Vote submitted")).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText(/Vote recorded/).first()).toBeVisible();
    const proposal = await (await page.request.get(`/api/dao/${EV}/proposals/${pid}`)).json();
    const again = await page.request.post(`/api/dao/${EV}/votes/${proposal.proposal.vote.id}/ballot`, { data: { choice: ["no"], proposalVersion: 1 } });
    expect(again.status()).toBe(409);
    expect((await again.json()).error.code).toBe("ALREADY_VOTED");
  });

  test("stage designer and gallery compare", async ({ page }) => {
    await page.goto(`/dao/${EV}/stage-designer`);
    await expect(page.getByRole("heading", { name: /Design the stage/i })).toBeVisible();
    await expect(page.getByText(/AI CONCEPT \/ NOT A CONSTRUCTION PLAN/).first()).toBeVisible();
    await page.goto(`/dao/${EV}/gallery`);
    const compare = page.getByRole("button", { name: /^Compare$/ });
    await compare.nth(0).click();
    await compare.nth(0).click(); // the first button now reads "Comparing", so nth(0) is the next one
    await expect(page.getByRole("heading", { name: /Compare 2/ })).toBeVisible();
    await expect(page.getByRole("rowheader", { name: "AI estimate" })).toBeVisible();
  });

  test("event detail, ranking and world map show DAO info", async ({ page }) => {
    await page.goto(`/events/${EV}`);
    await expect(page.getByRole("heading", { name: "Community DAO" })).toBeVisible();
    await expect(page.getByTestId("event-dao-panel").getByText(/Voting now/)).toBeVisible();
    await page.goto("/rankings?dao=1");
    await expect(page.getByRole("button", { name: "DAO active", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("rank-dao").first()).toBeVisible();
    await page.goto("/world");
    await expect(page.locator(".fk-dao").first()).toBeAttached({ timeout: 20_000 });
  });

  test("treasury keeps stakes separate and never claims real payments", async ({ page }) => {
    await page.goto(`/dao/${EV}/treasury`);
    await expect(page.getByRole("heading", { name: /Staking escrow \(separate\)/ })).toBeVisible();
    await expect(page.getByText(/No USDT, money or tokens move/)).toBeVisible();
  });
});

for (const width of [375, 390, 430, 768, 1440]) {
  test(`DAO pages fit at ${width}px with 44px tap targets`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["", "/votes", "/discussion", "/proposals", "/stage-designer", "/gallery", "/treasury", "/roadmap", "/members", "/settings"]) {
      await page.goto(`/dao/${EV}${path}`);
      await expect(page.locator("main h1").first()).toBeVisible();
      await noHorizontalScroll(page);
    }
    await page.goto(`/dao/${EV}`);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll("main a, main button, main [role=radio]")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          const st = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && !el.closest("p, li li, [data-inline]") && (r.height < 43.5 || r.width < 24);
        })
        .map((el) => `${el.tagName}:${(el.textContent ?? "").trim().slice(0, 30)}:${Math.round(el.getBoundingClientRect().height)}`),
    );
    expect(small).toEqual([]);
    await page.screenshot({ path: `test-results/dao-${width}.png` });
  });
}

test("DAO index lists DAOs and events without one", async ({ page }) => {
  await page.goto("/dao");
  await expect(page.getByRole("heading", { name: "Festival DAO" })).toBeVisible();
  await expect(page.getByRole("link", { name: /NEON SLIME SUMMIT/i }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "No DAO yet" })).toBeVisible();
  await noHorizontalScroll(page);
});
