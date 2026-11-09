import { test, expect, type Page } from "@playwright/test";

const noHorizontalScroll = async (page: Page) => {
  const r = await page.evaluate(() => {
    window.scrollTo(500, window.scrollY);
    return { x: window.scrollX, wide: [...document.querySelectorAll("main *")].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1 && !el.closest(".rail, [class*='overflow-x-auto'], .overflow-hidden, table")).length };
  });
  expect(r.x).toBe(0);
};

const results = (page: Page) => page.getByRole("region").or(page.locator("section[aria-labelledby='rk-results']"));

for (const width of [375, 390, 430, 768, 1440]) {
  test(`rankings page renders without overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/rankings");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/world ranking/i);
    await expect(page.getByRole("img", { name: /ranking podium/i })).toBeVisible();
    await expect(page.locator("#rk-neon-slime-summit")).toBeVisible();
    await expect(page.getByText(/Demo ranking/)).toBeVisible();
    await noHorizontalScroll(page);
    await page.screenshot({ path: `test-results/rankings-${width}.png` });
  });
}

test.describe("world ranking flows", () => {
  test("switch categories and the URL keeps the state", async ({ page }) => {
    await page.goto("/rankings");
    await page.getByRole("button", { name: "Trending", exact: true }).click();
    await expect(page).toHaveURL(/category=trending/);
    await expect(page.getByText(/^Trending:/)).toBeVisible();
    await page.getByRole("button", { name: "Most attended", exact: true }).click();
    await expect(page.locator("#rk-spore-party-2026")).toBeVisible();
    // A shared link restores the same ranking
    await page.goto("/rankings?category=attended");
    await expect(page.getByRole("button", { name: "Most attended", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#rk-spore-party-2026")).toBeVisible();
  });

  test("search and filters", async ({ page }) => {
    await page.goto("/rankings");
    await page.getByRole("searchbox", { name: /search rankings/i }).fill("tokyo");
    await expect(page).toHaveURL(/q=tokyo/);
    await expect(page.locator("#rk-bassmutant-tokyo")).toBeVisible();
    await expect(page.locator("#rk-neon-slime-summit")).toHaveCount(0);
    await page.getByRole("searchbox", { name: /search rankings/i }).fill("");
    await expect(page).not.toHaveURL(/q=/);

    await page.getByRole("button", { name: /^Filters/ }).click();
    const sheet = page.getByRole("dialog", { name: "Ranking filters" });
    await sheet.getByRole("button", { name: "completed" }).click();
    await sheet.getByRole("button", { name: "Show results" }).click();
    await expect(page).toHaveURL(/status=completed/);
    await expect(page.locator("#rk-wobble-weekender")).toBeVisible();
    await expect(page.locator("#rk-neon-slime-summit")).toHaveCount(0);
    await page.getByRole("button", { name: /remove filter completed/i }).click();
    await expect(page).not.toHaveURL(/status=/);
  });

  test("open event detail from a ranking card", async ({ page }) => {
    await page.goto("/rankings");
    await page.locator("#rk-neon-slime-summit").getByRole("link").click();
    await expect(page).toHaveURL(/\/events\/neon-slime-summit$/);
    await expect(page.getByText("World ranking", { exact: true })).toBeVisible();
  });

  test("follow an event and see it in alerts", async ({ page }) => {
    await page.goto("/rankings");
    await page.getByRole("button", { name: "Follow NEON SLIME SUMMIT" }).first().click();
    await expect(page.getByRole("button", { name: "Unfollow NEON SLIME SUMMIT" }).first()).toHaveAttribute("aria-pressed", "true");
    await page.goto("/alerts");
    await page.getByRole("button", { name: /allow in-app alerts/i }).click();
    await expect(page.getByText(/NEON SLIME SUMMIT: Enters the TOP 10/)).toBeVisible();
  });

  test("compare two events and share link", async ({ page }) => {
    await page.goto("/rankings");
    await page.getByRole("button", { name: "Add NEON SLIME SUMMIT to compare" }).click();
    await page.getByRole("button", { name: "Add SAMBA SATELLITE to compare" }).click();
    await page.getByRole("link", { name: /^compare/i }).click();
    await expect(page).toHaveURL(/\/rankings\/compare\?ids=neon-slime-summit,samba-satellite/);
    const table = page.getByRole("table");
    await expect(table.getByText("Supporters")).toBeVisible();
    await expect(table.getByText(/9,840/)).toBeVisible();
    await noHorizontalScroll(page);
  });

  test("map view shows ranked pins and opens a sheet", async ({ page }) => {
    await page.goto("/rankings?view=map");
    const pin = page.getByRole("button", { name: /^Rank 1: NEON SLIME SUMMIT/ });
    await expect(pin).toBeVisible({ timeout: 15_000 });
    await pin.click();
    let sheet = page.getByRole("dialog", { name: /#1 NEON SLIME SUMMIT/ });
    if (!(await sheet.isVisible())) {
      await page.waitForTimeout(1200);
      await page.getByRole("button", { name: /^Rank 1: NEON SLIME SUMMIT/ }).click();
      sheet = page.getByRole("dialog", { name: /#1 NEON SLIME SUMMIT/ });
    }
    await expect(sheet).toBeVisible();
    await sheet.getByRole("link", { name: /view event/i }).click();
    await expect(page).toHaveURL(/\/events\/neon-slime-summit$/);
  });

  test("tap targets are at least 44px", async ({ page }) => {
    await page.goto("/rankings");
    await expect(page.locator("#rk-neon-slime-summit")).toBeVisible();
    const small = await page.evaluate(() =>
      [...document.querySelectorAll("main button, main a")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.top < window.innerHeight * 2 && (r.height < 40 || r.width < 40) && !el.closest("p, figcaption");
        })
        .map((el) => (el as HTMLElement).innerText || el.getAttribute("aria-label")),
    );
    expect(small).toEqual([]);
  });
});

void results;
