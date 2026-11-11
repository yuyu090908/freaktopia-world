import { test, expect, type Page } from "@playwright/test";

/** FREAKTOPIA WORLD 7.0 · world map: core flows, honest data, layout at 5 widths. */

const ready = async (page: Page) => {
  await expect(page.getByTestId("world-map")).toHaveAttribute("data-ready", "true", { timeout: 25_000 });
};
const camera = (page: Page) => page.getByTestId("world-map").getAttribute("data-camera");
const panel = (page: Page, name: RegExp) => page.getByRole("region", { name });

const noHorizontalScroll = async (page: Page) => {
  const x = await page.evaluate(() => {
    window.scrollTo(500, window.scrollY);
    return window.scrollX;
  });
  expect(x).toBe(0);
};

const smallTargets = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-testid=world-explorer] a, [data-testid=world-explorer] button")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && !el.closest(".maplibregl-ctrl, .maplibregl-marker, [data-inline], dd, p") && (r.height < 39.5 || r.width < 24);
      })
      .map((el) => `${el.tagName}:${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}:${Math.round(el.getBoundingClientRect().height)}`),
  );

test.describe("world map 7.0", () => {
  test("loads real-geography map with festival landmarks", async ({ page }) => {
    await page.goto("/world");
    await ready(page);
    // Samples plus published community parties: other tests publish parties, so read the total from the API.
    // Completed events are hidden until the Completed filter is on.
    const total = (await (await page.request.get("/api/map")).json()).events.filter((e: { status: string }) => e.status !== "completed").length;
    await expect(page.getByTestId("world-count")).toHaveText(`${total} events`);
    await expect(page.locator("[data-testid=landmark], [data-testid=landmark-cluster], [data-testid=city-marker]").first()).toBeVisible();
    await expect(page.getByText("Sample events")).toBeVisible();
    // Attribution for the geography and terrain sources is present.
    await expect(page.locator(".maplibregl-ctrl-attrib")).toContainText("Natural Earth");
  });

  test("search suggestions fly the camera and select a festival", async ({ page }) => {
    await page.goto("/world");
    await ready(page);
    const before = await camera(page);
    await page.getByRole("combobox").fill("kim");
    await expect(page.getByRole("option", { name: /KIMCHI COSMOS/ })).toBeVisible();
    await page.getByRole("option", { name: /KIMCHI COSMOS/ }).click();
    await expect(panel(page, /KIMCHI COSMOS summary/)).toBeVisible();
    await expect(page).toHaveURL(/event=kimchi-cosmos/);
    await expect.poll(() => camera(page), { timeout: 15_000 }).not.toBe(before);
    await expect.poll(async () => (await camera(page))!.split(",").slice(0, 2).map(Number), { timeout: 15_000 }).toEqual([126.92, 37.56]);
    // Close returns to the previous view.
    await page.getByRole("button", { name: "Close festival details" }).click();
    await expect(panel(page, /KIMCHI COSMOS summary/)).toHaveCount(0);
    await expect.poll(() => camera(page), { timeout: 15_000 }).toBe(before);
  });

  test("search by DJ, venue and country", async ({ page }) => {
    await page.goto("/world");
    await ready(page);
    await page.getByRole("combobox").fill("mika");
    await expect(page.getByRole("option", { name: /MOTHERBOARD MIKA/ })).toBeVisible();
    await page.getByRole("combobox").fill("japan");
    await expect(page.getByRole("option", { name: /^Japan/ })).toBeVisible();
    await page.getByRole("combobox").press("Enter");
    await expect(page.getByTestId("world-count")).toHaveText("3 events"); // search includes the completed KAIJU FREE PICNIC
  });

  test("filters combine and sync to a shareable URL", async ({ page }) => {
    await page.goto("/world");
    await ready(page);
    await page.getByRole("button", { name: "DJ wanted", exact: true }).click();
    // "Confirmed" is not a quick chip any more: it is under all conditions in the filter sheet.
    await page.getByRole("button", { name: /^Filters/ }).click();
    await page.getByRole("dialog", { name: "Filters" }).getByRole("button", { name: "Confirmed", exact: true }).click();
    await page.getByRole("dialog", { name: "Filters" }).getByRole("button", { name: /^Show/ }).click();
    await expect(page).toHaveURL(/f=djWanted%2Cconfirmed|f=djWanted,confirmed/);
    const n = await page.getByTestId("world-count").textContent();
    await page.reload();
    await ready(page);
    await expect(page.getByTestId("world-count")).toHaveText(n!);
    await expect(page.getByRole("button", { name: "DJ wanted", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /^Filters/ }).click();
    const dlg = page.getByRole("dialog", { name: "Filters" });
    await dlg.getByRole("button", { name: "LV.1 SEED" }).click();
    await dlg.getByRole("button", { name: /^Show/ }).click();
    await expect(page).toHaveURL(/lv=1/);
    await page.goto("/world?f=completed");
    await ready(page);
    await expect(page.getByTestId("world-count")).toHaveText("3 events");
  });

  test("Map / List toggle", async ({ page }) => {
    await page.goto("/world");
    await ready(page);
    await page.getByRole("button", { name: "List", exact: true }).click();
    const list = page.getByTestId("world-list");
    await expect(list).toBeVisible();
    await expect(page).toHaveURL(/view=list/);
    await list.getByRole("button", { name: /VOID JELLY RAVE/ }).click();
    await expect(list).toHaveCount(0);
    await expect(panel(page, /VOID JELLY RAVE summary/)).toBeVisible();
  });

  test("LIVE: demo live shows viewers and check-ins separately and enters the festival", async ({ page }) => {
    await page.goto("/world");
    await ready(page);
    await page.getByRole("button", { name: "Live now", exact: true }).click();
    await expect(page.getByTestId("world-count")).toHaveText("1 event");
    await page.getByRole("button", { name: /^BASSMUTANT TOKYO, Tokyo/ }).click();
    const sheet = panel(page, /BASSMUTANT TOKYO summary/);
    await expect(sheet.getByText("DEMO LIVE").first()).toBeVisible();
    await sheet.getByRole("button", { name: "Show all details" }).click();
    const info = sheet.getByTestId("map-live-info");
    await expect(info).toContainText("Online viewers");
    await expect(info).toContainText("Checked in on site");
    await expect(info).toContainText("never added together");
    await expect(info).toContainText("No licensed stream is connected");
    await sheet.getByTestId("map-enter-live").click();
    await expect(page).toHaveURL(/\/live\/bassmutant-tokyo/, { timeout: 20_000 });
  });

  test("events not yet held never offer WATCH LIVE", async ({ page }) => {
    await page.goto("/world?event=void-jelly-rave");
    await ready(page);
    const sheet = panel(page, /VOID JELLY RAVE summary/);
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "Show all details" }).click();
    await expect(sheet.getByText(/watch live|enter festival/i)).toHaveCount(0);
    await expect(sheet.getByRole("link", { name: "Buy ticket" })).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Apply as DJ" })).toHaveAttribute("href", "/djs/apply?event=void-jelly-rave");
  });

  test("funding event: support action, approximate location, staking separate from funding", async ({ page }) => {
    await page.goto("/world?event=mothership-motel");
    await ready(page);
    const sheet = panel(page, /MOTHERSHIP MOTEL summary/);
    await expect(sheet.getByText("(approx.)")).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Support event" })).toBeVisible();
    await sheet.getByRole("button", { name: "Show all details" }).click();
    await expect(sheet).toContainText("Staking is held separately and is not event budget");
    await expect(sheet).toContainText("not venue capacity");
    await expect(sheet.getByRole("link", { name: "Buy ticket" })).toHaveCount(0);
  });

  test("DAO and ranking information link to their pages", async ({ page }) => {
    await page.goto("/world?event=neon-slime-summit");
    await ready(page);
    const sheet = panel(page, /NEON SLIME SUMMIT summary/);
    await sheet.getByRole("button", { name: "Show all details" }).click();
    await expect(sheet.getByTestId("map-dao")).toContainText("members");
    await expect(sheet.getByTestId("map-rank")).toContainText(/#1 Most popular · all time/i);
    await expect(page.locator(".fk-dao").first()).toBeAttached();
    await sheet.getByTestId("map-rank").click();
    await expect(page).toHaveURL(/\/rankings\?category=popular/, { timeout: 20_000 });
  });

  test("mobile sheet: peek, expand, close shows the whole map", async ({ page }) => {
    await page.goto("/world?event=samba-satellite");
    await ready(page);
    const sheet = page.getByTestId("event-sheet");
    await expect(sheet).toHaveAttribute("data-expanded", "false");
    await expect(sheet.getByRole("link", { name: "Buy ticket" })).toBeVisible();
    await sheet.getByRole("button", { name: "Show all details" }).click();
    await expect(sheet).toHaveAttribute("data-expanded", "true");
    await expect(sheet.getByText("Festival level", { exact: true })).toBeVisible();
    await sheet.getByRole("button", { name: "Show less" }).first().click();
    await expect(sheet).toHaveAttribute("data-expanded", "false");
    await sheet.getByRole("button", { name: "Close festival details" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page).not.toHaveURL(/event=/);
    await expect(page.getByRole("button", { name: "Map", exact: true })).toBeVisible();
  });

  test("zoom controls and drag move the camera", async ({ page }) => {
    await page.goto("/world");
    await ready(page);
    const c0 = await camera(page);
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await expect.poll(() => camera(page)).not.toBe(c0);
    const c1 = await camera(page);
    const box = (await page.getByTestId("world-map").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2 + 10, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => camera(page)).not.toBe(c1);
    await page.getByRole("button", { name: /Reset view/ }).click();
    await expect.poll(() => camera(page), { timeout: 10_000 }).toBe(c0);
  });

  test("clusters open into landmarks", async ({ page }) => {
    await page.goto("/world");
    await ready(page);
    const cluster = page.getByTestId("landmark-cluster").first();
    if ((await cluster.count()) === 0) test.skip(true, "no cluster at this viewport");
    const ids = (await cluster.getAttribute("data-ids"))!.split(",");
    const zoom = async () => Number((await camera(page))!.split(",")[2]);
    let z = await zoom();
    await cluster.dispatchEvent("click"); // it may sit under the top bar at this size; the tap itself is what we test
    // A cluster of cities can open into smaller clusters first: each tap zooms further in until the festival stands alone.
    const id = ids[0];
    for (let i = 0; i < 5; i++) {
      await expect.poll(zoom, { timeout: 15_000 }).toBeGreaterThan(z);
      await expect(page.getByTestId("world-map")).toHaveAttribute("data-idle", "true", { timeout: 15_000 });
      if (await page.locator(`[data-testid=landmark][data-ids="${id}"]`).count()) break;
      z = await zoom();
      await page.locator(`[data-testid=landmark-cluster][data-ids*="${id}"]`).first().dispatchEvent("click");
    }
    await expect(page.locator(`[data-testid=landmark][data-ids="${id}"]`)).toBeVisible({ timeout: 10_000 });
    // Festivals that stood together in the tapped cluster and are still on screen are separate landmarks too.
    const near = await page.locator("[data-testid=landmark]").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.ids));
    expect(near.length).toBeGreaterThan(0);
  });

  test("lite renderer without WebGL still shows landmarks", async ({ page }) => {
    await page.goto("/world?renderer=lite");
    await expect(page.locator("[data-renderer=lite]")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /^GLASS NOODLE, New York/ }).dispatchEvent("click");
    await expect(panel(page, /GLASS NOODLE summary/)).toBeVisible();
  });

  test("admin level rules change landmark levels (demo)", async ({ page }) => {
    await page.goto("/world/levels");
    await expect(page.getByRole("heading", { name: "Festival level rules" })).toBeVisible();
    await expect(page.getByTestId("gallery-status")).toContainText("CANCELLED");
    await expect(page.getByTestId("preview-lv5")).toContainText("NEON SLIME SUMMIT");
    await page.getByRole("spinbutton", { name: "Level 5 Valid supporters" }).fill("20000");
    await expect(page.getByTestId("preview-lv5")).not.toContainText("NEON SLIME SUMMIT");
    await page.getByRole("button", { name: "Save rules" }).click();
    await page.goto("/world?event=neon-slime-summit");
    await ready(page);
    await expect(panel(page, /NEON SLIME SUMMIT summary/).getByText("LV.4 MEGA FEST").first()).toBeVisible();
    await page.goto("/world/levels");
    await page.getByRole("button", { name: "Reset to defaults" }).click();
    await expect(page.getByTestId("preview-lv5")).toContainText("NEON SLIME SUMMIT");
  });
});

for (const width of [375, 390, 430, 768, 1440]) {
  test(`world map fits at ${width}px with large tap targets`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: width >= 768 ? 900 : 844 });
    await page.goto("/world");
    await ready(page);
    await noHorizontalScroll(page);
    expect(await smallTargets(page)).toEqual([]);
    await page.screenshot({ path: `test-results/world-${width}.png` });
    await page.goto("/world?event=bassmutant-tokyo");
    await ready(page);
    await expect(panel(page, /BASSMUTANT TOKYO summary/)).toBeVisible();
    await noHorizontalScroll(page);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `test-results/world-${width}-selected.png` });
  });
}

test.describe("neon party planet 9.3", () => {
  test("globe in space: coloured regions, backdrop and aliens are decoration only", async ({ page }) => {
    await page.goto("/world");
    await ready(page);
    const space = page.getByTestId("space-backdrop");
    await expect(space).toBeAttached();
    await expect(space).toHaveAttribute("aria-hidden", "true");
    expect(await space.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe("none");
    // The map is a real interactive globe (not an image): a WebGL canvas with the globe projection.
    await expect(page.locator("[data-testid=world-map] canvas.maplibregl-canvas")).toBeVisible();
    await expect(page.locator(".wm-globe")).toBeAttached();
  });

  test("party city: tap opens the preview with counts from shown events, then a festival or the list", async ({ page }) => {
    await page.goto("/world");
    await ready(page);
    const lagos = page.locator('[data-testid=city-marker][data-city="Lagos|Nigeria"]');
    await expect(lagos).toBeAttached();
    await expect(lagos).toHaveAttribute("aria-label", /Lagos, Nigeria: 1 event shown/);
    await lagos.dispatchEvent("click");
    const preview = page.getByTestId("city-preview");
    await expect(preview).toBeVisible();
    await expect(page).toHaveURL(/city=Lagos/);
    await expect(preview.getByTestId("city-preview-name")).toHaveText("Lagos");
    await expect(preview.getByTestId("city-preview-total")).toHaveText("1 event shown here");
    await expect(preview.getByTestId("city-preview-stats")).toContainText("Upcoming");
    await expect.poll(async () => Number((await camera(page))!.split(",")[2]), { timeout: 15_000 }).toBeGreaterThan(4);
    await preview.getByRole("button", { name: /LOW-END LIGHTHOUSE/ }).click();
    await expect(page.getByTestId("city-preview")).toHaveCount(0);
    await expect(page).toHaveURL(/event=lagos-lighthouse/);
    await expect(page).not.toHaveURL(/city=/);

    await page.goto("/world?city=Lagos%7CNigeria");
    await ready(page);
    await page.getByTestId("city-see-events").click();
    await expect(page.getByTestId("world-list")).toBeVisible();
    await expect(page).toHaveURL(/q=Lagos/);
    await expect(page.getByTestId("world-count")).toHaveText("1 event");
  });

  test("city search opens the preview; community parties link to the organizer's party world", async ({ page }) => {
    await page.goto("/world");
    await ready(page);
    await page.getByRole("combobox").fill("bangk");
    await page.getByRole("option", { name: /^Bangkok/ }).click();
    const preview = page.getByTestId("city-preview");
    await expect(preview.getByTestId("city-preview-name")).toHaveText("Bangkok");
    await expect(preview).toContainText("Rooftops, golden temples");
    const parties = preview.getByTestId("city-preview-parties");
    // Published Bangkok parties (the demo world's SLIME SYSTEM, or ones other tests published) link to their organizer's world.
    const organizer = parties.getByTestId("city-organizer-world").first();
    await expect(organizer).toHaveAttribute("href", /\/u\/[^/]+\/world$/);
    await organizer.click();
    await expect(page).toHaveURL(/\/u\/[^/]+\/world$/, { timeout: 20_000 });
    await expect(page.getByTestId("world-title")).toBeVisible();
  });

  test("region focus filters, syncs to the URL and works from search", async ({ page }) => {
    await page.goto("/world");
    await ready(page);
    await page.getByRole("button", { name: /^Filters/ }).click();
    const dlg = page.getByRole("dialog", { name: "Filters" });
    await dlg.getByTestId("region-filter").getByRole("button", { name: "Africa" }).click();
    await dlg.getByRole("button", { name: /^Show/ }).click();
    await expect(page).toHaveURL(/rg=af/);
    await expect(page.getByTestId("world-count")).toHaveText("2 events");
    await expect(page.getByTestId("region-active")).toContainText("Africa");
    await page.getByTestId("region-active").click();
    await expect(page).not.toHaveURL(/rg=/);
    // Samples plus published community parties: other tests publish parties, so read the total from the API.
    // Completed events are hidden until the Completed filter is on.
    const total = (await (await page.request.get("/api/map")).json()).events.filter((e: { status: string }) => e.status !== "completed").length;
    await expect(page.getByTestId("world-count")).toHaveText(`${total} events`);

    await page.getByRole("combobox").fill("oceania");
    await page.getByRole("option", { name: /^Oceania/ }).click();
    await expect(page).toHaveURL(/rg=oc/);
    await expect(page.getByTestId("world-count")).toHaveText("1 event");
    await expect.poll(async () => Number((await camera(page))!.split(",")[0]), { timeout: 15_000 }).toBeGreaterThan(100);
  });

  test("sample events name their organizer honestly; the legend explains the city rings", async ({ page }) => {
    await page.goto("/world?event=tuk-tuk-trance");
    await ready(page);
    const sheet = panel(page, /TUK TUK TRANCE summary/);
    await sheet.getByRole("button", { name: "Show all details" }).click();
    await expect(sheet).toContainText("Mochi Crew");
    await expect(sheet).toContainText("Sample organizer: no party world yet");
    await sheet.getByRole("button", { name: "Close festival details" }).click();
    await page.getByRole("button", { name: "Legend" }).click();
    await expect(page.getByTestId("legend-city-note")).toContainText("not popularity or quality");
  });
});
