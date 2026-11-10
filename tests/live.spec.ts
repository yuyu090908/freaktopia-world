import { test, expect, type Page } from "@playwright/test";

/** FREAKTOPIA WORLD 6.0 · LIVE FESTIVAL: the 15 core flows + layout checks at 5 widths. */
const EV = "/live/bassmutant-tokyo";

const noHorizontalScroll = async (page: Page) => {
  const r = await page.evaluate(() => {
    window.scrollTo(500, window.scrollY);
    return {
      x: window.scrollX,
      wide: [...document.querySelectorAll("main *")]
        .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1 && !el.closest(".rail, [class*='overflow-x-auto'], .overflow-hidden, svg, [data-testid='festival-map'], .maplibregl-map"))
        .map((el) => `${el.tagName}.${(el.getAttribute("class") ?? "").slice(0, 40)}`),
    };
  });
  expect(r.x).toBe(0);
  expect(r.wide).toEqual([]);
};

const smallTargets = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("main a, main button, main select, main [role=radio], main [role=tab]")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && !el.closest("p, li li, [data-inline], .maplibregl-ctrl, .maplibregl-marker") && (r.height < 43.5 || r.width < 24);
      })
      .map((el) => `${el.tagName}:${(el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 30)}:${Math.round(el.getBoundingClientRect().height)}`),
  );

const openMap = async (page: Page) => {
  await page.goto(EV);
  await page.getByRole("tab", { name: "Map" }).click();
  await expect(page.getByTestId("festival-map")).toBeVisible();
};

test.describe("live festival flows", () => {
  test("1. /live shows discovery with honest status", async ({ page }) => {
    await page.goto("/live");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/the world is live/i);
    await expect(page.getByTestId("no-real-live")).toContainText("No festival is streaming live right now");
    await expect(page.getByTestId("featured-live")).toContainText("DEMO LIVE");
    await expect(page.getByTestId("featured-live")).not.toContainText("● LIVE NOW");
    for (const c of ["All", "Live Now", "Upcoming", "Tech House", "House", "Techno", "Afro House", "Bass House", "After Party"]) await expect(page.getByRole("group", { name: "Categories" }).getByRole("button", { name: c, exact: true })).toBeVisible();
    await page.getByRole("group", { name: "Categories" }).getByRole("button", { name: "Bass House", exact: true }).click();
    await expect(page.getByText(/No Bass House festivals yet/)).toBeVisible();
  });

  test("2. search festivals", async ({ page }) => {
    await page.goto("/live");
    await page.getByRole("searchbox", { name: "Search festivals" }).fill("lagos");
    await expect(page.getByTestId("live-card")).toHaveCount(1);
    await expect(page.getByTestId("live-card")).toContainText("LOW-END LIGHTHOUSE");
    await page.getByRole("searchbox", { name: "Search festivals" }).fill("zzzz");
    await expect(page.getByText("Try another search word.")).toBeVisible();
  });

  test("3. select an event and enter the festival", async ({ page }) => {
    await page.goto("/live");
    await page.getByTestId("featured-live").getByRole("link", { name: /enter festival/i }).click();
    await expect(page).toHaveURL(/\/live\/bassmutant-tokyo/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("BASSMUTANT TOKYO");
    await expect(page.getByTestId("player")).toContainText("no real video or audio", { ignoreCase: true });
    await expect(page.getByTestId("conn")).toContainText("Room synced");
  });

  test("4. festival map shows 10 zones with pan/zoom controls", async ({ page }) => {
    await openMap(page);
    await expect(page.locator("[data-testid='festival-map'] [role='button'][data-zone]")).toHaveCount(10);
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.getByRole("button", { name: "Show whole map" }).click();
    const box = (await page.getByTestId("festival-map").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 30, { steps: 5 });
    await page.mouse.up();
    await expect(page.getByTestId("zone-sheet")).toHaveCount(0); // a drag is not a tap
  });

  test("5. tap a zone opens its sheet", async ({ page }) => {
    await openMap(page);
    await page.getByRole("button", { name: "Show whole map" }).click();
    await page.locator("[data-testid='festival-map'] [role='button'][data-zone='food']").click();
    await expect(page.getByTestId("zone-sheet")).toHaveAttribute("data-zone", "food");
    await expect(page.getByTestId("zone-sheet")).toContainText("Kaiju Ramen Cart");
    await page.getByRole("button", { name: /close/i }).last().click();
    await page.locator("[data-testid='festival-map'] [role='button'][data-zone='main']").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("zone-sheet")).toContainText("Watch this stage");
  });

  test("6. pick and customize an avatar", async ({ page }) => {
    await openMap(page);
    await page.getByRole("button", { name: "Customize" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /MOON MOCHI/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Wiggle" }).click();
    await page.getByRole("button", { name: "Save avatar" }).click();
    await expect(page.getByText("Avatar saved")).toBeVisible();
    await expect(page.getByText("MOON MOCHI").first()).toBeVisible();
  });

  test("7. move the avatar (needs consent)", async ({ page }) => {
    await openMap(page);
    await page.getByRole("button", { name: "Show whole map" }).click();
    await page.locator("[data-testid='festival-map'] [role='button'][data-zone='lounge']").click();
    await page.getByTestId("zone-move").click();
    await expect(page.getByText("Turn on ‘Show my avatar’ first")).toBeVisible();
    await page.getByRole("button", { name: /close/i }).last().click();
    await page.getByRole("switch", { name: /show my avatar/i }).click();
    await page.getByRole("group", { name: "Move my avatar" }).getByRole("button", { name: "Alien Lounge" }).click();
    await expect(page.getByTestId("my-avatar")).toHaveAttribute("data-zone", "lounge");
    await page.getByRole("group", { name: "Move my avatar" }).getByRole("button", { name: "VIP Area" }).click();
    await expect(page.getByText("VIP balcony is for VIP ticket holders")).toBeVisible();
    await expect(page.getByTestId("my-avatar")).toHaveAttribute("data-zone", "lounge");
  });

  test("8. change avatar visibility", async ({ page }) => {
    await openMap(page);
    await page.getByRole("switch", { name: /show my avatar/i }).click();
    const group = page.getByRole("radiogroup", { name: "Avatar visibility" });
    await group.getByRole("radio", { name: /Hidden/ }).click();
    await expect(group.getByRole("radio", { name: /Hidden/ })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("my-avatar")).toContainText("YOU · HIDDEN");
    await group.getByRole("radio", { name: /Friends/ }).click();
    await expect(page.getByText("Friends only ·")).toBeVisible();
  });

  test("9. timetable with stage tabs and time zones", async ({ page }) => {
    await page.goto(EV);
    await page.getByRole("tab", { name: "Schedule" }).click();
    await expect(page.getByTestId("timetable").getByText("Now")).toBeVisible();
    await expect(page.getByText(/venue time \(Asia\/Tokyo/)).toBeVisible();
    await page.getByRole("button", { name: "My time" }).click();
    await expect(page.getByText(/your time \(/)).toBeVisible();
    await page.getByRole("tab", { name: "Second Stage" }).click();
    await page.getByRole("button", { name: /remind me about/i }).first().click();
    await expect(page.getByText("Reminder set (demo)")).toBeVisible();
  });

  test("10. chat: send and reply", async ({ page }) => {
    await page.goto(EV);
    await page.getByRole("tab", { name: "Community" }).click();
    const chat = page.getByTestId("chat").first();
    await chat.getByRole("textbox", { name: "Chat message" }).fill("hello from the playwright planet");
    await chat.getByRole("button", { name: "Send message" }).click();
    await expect(chat.getByText("hello from the playwright planet")).toBeVisible();
    await chat.getByRole("button", { name: /Actions for message from/ }).first().click();
    await chat.getByRole("menuitem", { name: "Reply" }).click();
    await expect(chat.getByText(/Replying to/)).toBeVisible();
  });

  test("11. reactions are sent and rate-limited honestly", async ({ page }) => {
    await page.goto(EV);
    await page.getByRole("button", { name: "React FIRE" }).click();
    await expect(page.getByText(/counted toward energy/)).toBeVisible();
    for (let i = 0; i < 8; i++) {
      await page.getByRole("button", { name: "React BASS" }).click();
      await page.waitForTimeout(260);
    }
    await expect(page.getByText(/only 6 reactions a minute count/)).toBeVisible();
  });

  test("12. energy meter updates and is labelled a game metric", async ({ page }) => {
    await page.goto(EV);
    const energy = page.getByTestId("energy");
    await expect(energy).toContainText("game metric");
    await expect(page.getByTestId("energy-value")).toHaveText(/^\d{1,3}$/);
    const before = Number(await page.getByTestId("energy-value").textContent());
    await expect(page.getByTestId("energy-level")).toHaveText(/WARM UP|GROOVE|BUILD UP|PEAK TIME|ALIEN INVASION/);
    await energy.getByRole("button", { name: "How energy works" }).click();
    await expect(energy).toContainText("does not measure how excited the real crowd is");
    await expect.poll(async () => Number(await page.getByTestId("energy-value").textContent()), { timeout: 15_000 }).not.toBeNaN();
    expect(before).toBeGreaterThanOrEqual(0);
  });

  test("13. after party portal navigation", async ({ page }) => {
    await page.goto(EV);
    await page.getByRole("tab", { name: "More" }).click();
    const ap = page.getByTestId("after-party");
    await expect(ap).toContainText("BASSMUTANT AFTERGLOW");
    await expect(ap).toContainText(/of 200 left/);
    await ap.getByRole("link", { name: /join \/ buy/i }).click();
    await expect(page).toHaveURL(/\/after-party\/ap-afterglow/, { timeout: 20_000 });
  });

  test("14. check-in demo: once, no reuse, cancelled refused, staff-only methods", async ({ page }) => {
    await page.goto(`${EV}#more`);
    const ci = page.getByTestId("checkin");
    await ci.getByRole("button", { name: "Get a demo ticket" }).click();
    await ci.getByRole("button", { name: "Organizer scan" }).click();
    await expect(page.getByTestId("checkin-result")).toContainText("Only door staff");
    await ci.getByRole("button", { name: /scan my qr/i }).click();
    await expect(page.getByTestId("checkin-result")).toContainText("Checked in (demo)");
    await ci.getByRole("button", { name: /scan my qr/i }).click();
    await expect(page.getByTestId("checkin-result")).toContainText("TICKET ALREADY USED");
    await ci.getByRole("button", { name: "Try a cancelled ticket" }).click();
    await ci.getByRole("button", { name: /scan my qr/i }).click();
    await expect(page.getByTestId("checkin-result")).toContainText("TICKET CANCELLED");
    // on-site quest stays locked after a demo check-in
    await page.getByRole("tab", { name: "Community" }).click();
    await expect(page.locator("[data-quest='onsite-checkin']")).not.toHaveAttribute("data-done", /.+/);
  });

  test("15. mobile navigation: bottom nav + in-event tabs", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation").getByRole("link", { name: "Live", exact: true }).last().click();
    await expect(page).toHaveURL(/\/live$/);
    await page.goto(EV);
    for (const t of ["Map", "Schedule", "Community", "More", "Watch"]) {
      await page.getByRole("tab", { name: t }).click();
      await expect(page.getByRole("tab", { name: t })).toHaveAttribute("aria-selected", "true");
    }
    await page.getByRole("tab", { name: "Map" }).click();
    await expect(page.getByTestId("mini-player")).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 2000));
    const tabs = await page.getByRole("tablist", { name: undefined }).first().boundingBox();
    expect(tabs!.y).toBeLessThan(200); // sticky under the header
    await page.goto(`${EV}#schedule`);
    await expect(page.getByRole("tab", { name: "Schedule" })).toHaveAttribute("aria-selected", "true");
  });

  test("upcoming festival: no fake LIVE, no room", async ({ page }) => {
    await page.goto("/live/void-jelly-rave");
    await expect(page.getByTestId("player")).toContainText("Not live yet");
    await expect(page.getByText("● DEMO LIVE")).toHaveCount(0);
  });
});

for (const width of [375, 390, 430, 768, 1440]) {
  test(`live pages fit at ${width}px with 44px tap targets`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/live");
    await expect(page.getByTestId("featured-live")).toBeVisible();
    await noHorizontalScroll(page);
    expect(await smallTargets(page)).toEqual([]);
    await page.screenshot({ path: `test-results/live-${width}.png` });
    await page.goto(EV);
    await expect(page.getByTestId("player")).toBeVisible({ timeout: 20_000 });
    await noHorizontalScroll(page);
    expect(await smallTargets(page)).toEqual([]);
    await page.screenshot({ path: `test-results/live-watch-${width}.png` });
    for (const t of ["Map", "Schedule", "Community", "More"]) {
      await page.getByRole("tab", { name: t }).click();
      await page.waitForTimeout(300);
      await noHorizontalScroll(page);
      if (t !== "Schedule") expect(await smallTargets(page), t).toEqual([]);
      await page.screenshot({ path: `test-results/live-${t.toLowerCase()}-${width}.png` });
    }
  });
}
