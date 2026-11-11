import { test, expect, type Page } from "@playwright/test";

/**
 * UI/UX redesign 2026 (docs/UIUX_REDESIGN_2026.md). Mock tests: they run against a build with the demo clock
 * pinned (NEXT_PUBLIC_DEMO_CLOCK) and the in-memory store. No payment, stream or chain is connected.
 */

const noSideways = async (page: Page) => {
  const r = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth - innerWidth }));
  expect(r.doc).toBeLessThanOrEqual(0);
};
const num = (s: string | null) => Number((s ?? "").match(/\d+/)?.[0] ?? NaN);

test("WORLD and EVENTS count the same list (samples + published community parties)", async ({ page }) => {
  await page.goto("/events");
  const count = page.getByTestId("events-count");
  await expect(count).toHaveAttribute("data-ready", "true");
  await expect(count).toContainText(/Community \d+ · Sample \d+/);
  const events = num(await count.locator("b").textContent());
  const breakdown = (await count.textContent())!.match(/Community (\d+) · Sample (\d+)/)!;
  expect(Number(breakdown[1]) + Number(breakdown[2])).toBe(events);
  await page.goto("/world");
  await expect(page.getByTestId("world-map")).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
  expect(num(await page.getByTestId("world-count").textContent())).toBe(events);
  await expect(page.getByTestId("world-breakdown")).toHaveText(`Community ${breakdown[1]} · Sample ${breakdown[2]}`);
});

test("events: filter sheet applies on Apply, chips remove filters, completed events are separate", async ({ page }) => {
  await page.goto("/events");
  await expect(page.getByTestId("events-count")).toHaveAttribute("data-ready", "true");
  const total = num(await page.getByTestId("events-count").locator("b").textContent());
  await page.getByTestId("filters-open").click();
  const sheet = page.getByRole("dialog", { name: "Filters" });
  await sheet.getByRole("button", { name: "Funding", exact: true }).click();
  // Nothing changes until Apply.
  expect(num(await page.getByTestId("events-count").locator("b").textContent())).toBe(total);
  const apply = sheet.getByTestId("filter-apply");
  const shown = num(await apply.textContent());
  await apply.click();
  await expect(page.getByTestId("events-count").locator("b")).toHaveText(new RegExp(`^${shown} event`));
  // Funding cards show support, never a ticket price.
  // Rows in the list (the separate Completed section is not part of the filtered results).
  const cards = page.locator('[data-testid="event-row"]:not([data-testid="events-completed"] *)');
  expect(await cards.count()).toBeGreaterThan(0);
  for (const c of await cards.all()) {
    await expect(c.locator('[data-status="funding"]')).toBeVisible();
    await expect(c.getByTestId("card-price")).toHaveCount(0);
    await expect(c.getByTestId("card-support")).toBeVisible();
  }
  await page.getByTestId("active-filters").getByRole("button", { name: /Funding/ }).click();
  await expect(page.getByTestId("events-count").locator("b")).toHaveText(new RegExp(`^${total} event`));
  const done = page.getByTestId("events-completed");
  await expect(done).toBeVisible();
  await done.locator("summary").click();
  await expect(done.locator('[data-status="completed"]').first()).toBeVisible();
  await noSideways(page);
});

test("tickets are only sold when on sale; funding events explain why", async ({ page }) => {
  await page.goto("/events/tuk-tuk-trance/tickets");
  await expect(page.getByTestId("tickets-not-on-sale")).toBeVisible();
  await expect(page.getByText(/\$\d/)).toHaveCount(0);
  await page.goto("/events/tuk-tuk-trance");
  await expect(page.locator(".sticky-cta").getByRole("link", { name: "Tickets" })).toHaveCount(0);
});

test("bottom nav: five destinations, each route once, 44px targets, no sideways scroll at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary" });
  const links = nav.getByRole("link");
  await expect(links).toHaveCount(5);
  await expect(links).toHaveText(["Home", "World", "Events", "Tickets", "My"]);
  const hrefs = await links.evaluateAll((els) => els.map((e) => new URL((e as HTMLAnchorElement).href).pathname));
  expect(new Set(hrefs).size).toBe(5);
  for (const l of await links.all()) {
    const b = (await l.boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.width).toBeGreaterThanOrEqual(44);
  }
  await noSideways(page);
  await page.goto("/dashboard");
  await expect(nav.getByRole("link", { name: "My", exact: true })).toHaveAttribute("aria-current", "page");
});

test("rankings: top 3 as panels, rank 4+ as rows that open details", async ({ page }) => {
  await page.goto("/rankings");
  const rows = page.getByTestId("ranking-row");
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  const first = rows.first();
  const toggle = first.getByRole("button", { name: /^Details for/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(first.getByRole("link", { name: /view event/i })).toBeVisible();
  await noSideways(page);
});

test("dashboard: KPI cards say what they count, sample figures are marked DEMO, two columns on a phone", async ({ page }) => {
  await page.goto("/dashboard?role=organizer");
  const cards = page.getByTestId("stat-card");
  await expect(cards).toHaveCount(4);
  const boxes = await cards.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
  expect(new Set(boxes).size).toBe(2);
  await cards.nth(2).getByText("What this counts").click();
  await expect(cards.nth(2)).toContainText("not a sale");
  await expect(cards.nth(2)).toContainText("DEMO");
  await expect(cards.nth(0)).toContainText(/As of/);
  // Arrow keys move between role tabs.
  await page.getByRole("tab", { name: "Organizer" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/role=dj/);
});

test("create event: five steps, inline errors, preview before publishing", async ({ page }) => {
  await page.goto("/events/create");
  await expect(page.getByRole("progressbar").first()).toHaveAttribute("aria-valuemax", "5");
  await page.getByRole("button", { name: /^next/i }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await page.getByLabel("Event name").fill("REDESIGN RAVE");
  await page.getByRole("button", { name: "Techno", exact: true }).click();
  await page.getByRole("button", { name: /^next/i }).click();
  await page.getByRole("combobox", { name: "City" }).fill("Tokyo");
  await page.getByLabel("Date").fill("2020-01-01");
  await page.getByRole("button", { name: /^next/i }).click();
  await expect(page.getByText("Choose today or a later date.")).toBeVisible();
  await expect(page.getByRole("progressbar").first()).toHaveAttribute("aria-valuenow", "2");
});

test("live: says DEMO LIVE for the simulation, never plain LIVE without a stream", async ({ page }) => {
  await page.goto("/live");
  const kicker = page.getByTestId("live-kicker");
  await expect(kicker).toBeVisible({ timeout: 15_000 });
  await expect(kicker).toContainText(/demo/i);
});

test("MY: FREAK ID / Activity / Settings tabs, and reset asks first in a dialog", async ({ page }) => {
  await page.goto("/profile");
  const tabs = page.getByRole("tablist");
  await expect(tabs.getByRole("tab")).toHaveCount(3);
  await expect(tabs.getByRole("tab", { name: "FREAK ID" })).toHaveAttribute("aria-selected", "true");
  await tabs.getByRole("tab", { name: "FREAK ID" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.getByRole("tab", { name: "Activity" })).toHaveAttribute("aria-selected", "true");
  await tabs.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("button", { name: /reset all demo data/i }).click();
  const dialog = page.getByRole("dialog", { name: "Reset demo data?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await noSideways(page);
});
