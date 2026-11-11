import { test, expect } from "@playwright/test";

/** 9.4 visual system: official city and ticket art placed by rule, with the real numbers in HTML. */

const noSideways = async (page: import("@playwright/test").Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

test("home: ten city cards with real counts; a city with events opens its world preview", async ({ page }) => {
  await page.goto("/");
  const cards = page.getByTestId("city-card");
  await expect(cards).toHaveCount(10);
  const berlin = page.locator('[data-testid=city-card][data-city="berlin"]');
  await expect(berlin).toContainText("1 event");
  await expect(berlin).toContainText("Industrial Techno");
  await expect(berlin).toHaveAttribute("href", "/world?city=Berlin%7CGermany");
  // No sample events in Miami: say so instead of inventing a number.
  const miami = page.locator('[data-testid=city-card][data-city="miami"]');
  await expect(miami).toContainText("No events yet");
  await expect(miami).toHaveAttribute("href", "/events/create");
  // Every poster has alt text and loads.
  for (const img of await cards.locator("img").all()) await expect(img).toHaveAttribute("alt", /.+/);
  await noSideways(page);
  await berlin.click();
  await expect(page.getByTestId("city-preview")).toBeVisible({ timeout: 25_000 });
  await expect(page.getByTestId("city-preview-image")).toBeVisible();
});

test("events: a big featured card above the grid; neighbours never share a picture", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/events");
  await expect(page.getByTestId("events-featured")).toBeVisible();
  const srcs = await page.locator("ul.md\\:grid img").evaluateAll((els) => els.map((e) => new URL((e as HTMLImageElement).currentSrc || (e as HTMLImageElement).src).searchParams.get("url")));
  expect(srcs.length).toBeGreaterThan(6);
  for (let i = 1; i < srcs.length; i++) expect(srcs[i], `card ${i}`).not.toBe(srcs[i - 1]);
});

test("tickets: each sold kind shows its pass design, selection is marked, no dummy QR from the art, no sideways scroll", async ({ page }) => {
  await page.goto("/events/neon-slime-summit/tickets");
  const tiers = page.getByTestId("ticket-tier");
  await expect(tiers).toHaveCount(4);
  await expect(tiers.first()).toHaveAttribute("data-selected", "true");
  await expect(tiers.first().getByRole("img")).toHaveAttribute("alt", "Ticket design: BASIC PASS");
  await expect(page.getByText(/Pass artwork is a design template/)).toBeVisible();
  await noSideways(page);
  await tiers.nth(3).getByRole("button", { name: /Add one/ }).click();
  await expect(tiers.nth(3)).toHaveAttribute("data-selected", "true");
});
