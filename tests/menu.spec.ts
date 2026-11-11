import { test, expect, type Page } from "@playwright/test";

/** Mobile menu ("cosmic control panel"): structure, every link, open/close behaviour, focus, contrast and widths. */

const open = async (p: Page) => {
  // A tap before the page has hydrated does nothing, so retry until the menu is there.
  await expect(async () => {
    // getByRole skips a sheet that is still sliding out (it is aria-hidden while closing).
    const menu = p.getByRole("dialog").getByTestId("menu");
    if (!(await menu.isVisible())) await p.getByTestId("menu-open").click();
    await expect(menu).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
};

/** WCAG relative-luminance contrast of an element's text colour against the first opaque background behind it. */
const contrastOf = (p: Page, sel: string) =>
  p.locator(sel).evaluateAll((els) => {
    const rgb = (s: string) => (s.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const bgOf = (el: Element | null): number[] => {
      for (let e = el; e; e = e.parentElement) {
        const c = rgb(getComputedStyle(e).backgroundColor);
        if (c.length >= 3 && (c[3] ?? 1) > 0.9) return c.slice(0, 3);
      }
      return [0, 0, 0];
    };
    return els.map((el) => {
      const a = lum(rgb(getComputedStyle(el).color).slice(0, 3));
      const b = lum(bgOf(el));
      return { text: el.textContent?.trim(), ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
    });
  });

test.describe("mobile menu", () => {
  test("five colour-coded groups (discover, join, create, manage, info), quick access, every link opens a real page", async ({ page }) => {
    await page.goto("/events");
    await open(page);
    for (const g of ["discover", "join", "create", "manage", "info"]) await expect(page.getByTestId(`menu-group-${g}`)).toBeVisible();
    await expect(page.getByTestId("menu-quick")).toHaveCount(4);
    // The current page is marked.
    await expect(page.getByTestId("menu-group-discover").locator('[aria-current="page"]')).toHaveText(/Events/);
    const links = await page.getByTestId("menu").locator("a").evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")!))]);
    expect(links.length).toBeGreaterThanOrEqual(26);
    // Each page appears once in the groups (quick access is the only shortcut layer).
    const grouped = await page.locator("[data-testid^=menu-group-] a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(new Set(grouped).size).toBe(grouped.length);
    for (const href of links) {
      const r = await page.request.get(href);
      expect(r.status(), href).toBe(200);
    }
    // Labels are readable: white rows and accent headings meet WCAG AA on the dark panels.
    for (const c of await contrastOf(page, "[data-testid^=menu-group-] a span.text-white, [data-testid^=menu-group-] h3")) expect(c.ratio, c.text).toBeGreaterThanOrEqual(4.5);
    for (const c of await contrastOf(page, "[data-testid=menu-quick] span")) expect(c.ratio, c.text).toBeGreaterThanOrEqual(4.5);
  });

  test("closes by button, backdrop and Escape; focus returns; page behind doesn't scroll; menu scrolls on its own", async ({ page }) => {
    await page.goto("/events");
    const opener = page.getByTestId("menu-open");
    await open(page);
    await expect(page.getByRole("dialog").getByRole("button", { name: "Close" })).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    const before = await page.evaluate(() => scrollY);
    const panel = page.getByRole("dialog").locator(".overflow-y-auto");
    await panel.hover();
    await page.mouse.wheel(0, 600);
    await expect.poll(() => panel.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => scrollY)).toBe(before);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(opener).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");

    await open(page);
    await page.mouse.click(195, 20); // the dimmed backdrop above the sheet
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await open(page);
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(opener).toBeFocused();

    // A menu link navigates and the menu closes.
    await open(page);
    await page.getByTestId("menu-group-discover").getByRole("link", { name: "DJ Arena" }).click();
    await expect(page).toHaveURL(/\/djs$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  for (const [loc, width] of [["", 320], ["/ja", 320], ["/de", 375], ["/th", 430], ["/ru", 390], ["/ja", 768], ["", 1440]] as const) {
    test(`fits ${loc || "/en"} at ${width}px: no cut labels, no sideways scroll, 44px targets`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`${loc}/events`);
      await open(page);
      await page.waitForTimeout(300);
      const r = await page.evaluate(() => ({
        sideways: document.documentElement.scrollWidth - innerWidth,
        cut: [...document.querySelectorAll("[data-testid=menu] a, [data-testid=menu] a span")].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent),
        small: [...document.querySelectorAll("[role=dialog] a, [role=dialog] button")].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.height < 44 || b.width < 44); }).map((e) => e.textContent || e.getAttribute("aria-label")),
        offscreen: [...document.querySelectorAll("[data-testid=menu] a")].filter((e) => { const b = e.getBoundingClientRect(); return b.left < 0 || b.right > innerWidth; }).length,
      }));
      expect(r.sideways).toBeLessThanOrEqual(1);
      expect(r.cut).toEqual([]);
      expect(r.small).toEqual([]);
      expect(r.offscreen).toBe(0);
    });
  }
});

test("signed in: My World opens the person's own world", async ({ browser }) => {
  // Its own address, so repeated runs don't hit the sign-up rate limit.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, extraHTTPHeaders: { "x-forwarded-for": `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } });
  const page = await ctx.newPage();
  const email = `menu-${Date.now()}-${process.pid}@example.test`;
  expect((await page.request.post("/api/auth/signup", { data: { email, password: "neon slime forever" }, headers: { "content-type": "application/json" } })).ok()).toBeTruthy();
  await page.goto("/auth/mailbox");
  await page.getByTestId("mail-link").first().click();
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 20_000 });
  const me = await (await page.request.get("/api/me")).json();
  await page.goto("/events");
  await open(page);
  const tile = page.getByTestId("menu-quick").filter({ hasText: "My World" });
  await expect(tile).toHaveAttribute("href", `/u/${me.alien.publicId}/world`);
  await expect(page.getByTestId("menu-group-manage")).not.toContainText("Sign in to open your world");
  await tile.click();
  await expect(page.getByTestId("world-title")).toBeVisible();
});

test("desktop header: links never run under Create event and the buttons (1024–1600px, long languages)", async ({ page }) => {
  for (const loc of ["/ja", "/de", "/ru", "/fr", "/pt"]) {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto(`${loc}/events`);
    await page.waitForLoadState("networkidle");
    for (let w = 1024; w <= 1600; w += 48) {
      await page.setViewportSize({ width: w, height: 800 });
      await expect
        .poll(() =>
          page.evaluate(() => {
            const nav = document.querySelector("header nav")!;
            const right = nav.nextElementSibling!.getBoundingClientRect().left;
            const shown = [...nav.querySelectorAll("a")].filter((a) => getComputedStyle(a).visibility !== "hidden");
            return shown.length >= 3 && shown.every((a) => a.getBoundingClientRect().right <= right && a.getBoundingClientRect().bottom <= nav.getBoundingClientRect().bottom + 1);
          }),
          { message: `${loc} at ${w}px` },
        )
        .toBe(true);
    }
  }
});
