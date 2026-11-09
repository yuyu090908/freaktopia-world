import { test, expect, type Page } from "@playwright/test";

const noHorizontalScroll = async (page: Page) => {
  const x = await page.evaluate(() => {
    window.scrollTo(500, window.scrollY);
    return window.scrollX;
  });
  expect(x).toBe(0);
};

test("home → world map → pin → bottom sheet → event", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("dancefloor", { ignoreCase: true });
  await noHorizontalScroll(page);
  await page.getByRole("link", { name: /explore world/i }).click();
  await expect(page).toHaveURL(/\/world$/);
  const pin = page.getByRole("button", { name: /NEON SLIME SUMMIT, Berlin/ });
  await expect(pin).toBeVisible({ timeout: 15_000 });
  await pin.click(); // nearby pins are grouped at world zoom: first tap zooms in
  const sheet = page.getByRole("region", { name: /NEON SLIME SUMMIT summary/ });
  if (!(await sheet.isVisible())) {
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: /NEON SLIME SUMMIT, Berlin/ }).click();
  }
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("LV.5")).toBeVisible();
  await sheet.getByRole("link", { name: /view event/i }).click();
  await expect(page).toHaveURL(/\/events\/neon-slime-summit$/);
});

test("world map filters reduce results", async ({ page }) => {
  await page.goto("/world");
  await expect(page.getByText("18 events")).toBeVisible();
  await page.getByRole("button", { name: "Live now" }).click();
  await expect(page.getByText("1 event", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /clear/i }).click();
  await page.getByRole("searchbox").fill("Tokyo");
  await expect(page.getByText("1 event", { exact: true })).toBeVisible();
});

test("support event, simulator level-up", async ({ page }) => {
  await page.goto("/events/tuk-tuk-trance");
  await expect(page.getByRole("heading", { name: "TUK TUK TRANCE" })).toBeVisible();
  await page.getByRole("button", { name: /^support event$/i }).first().click();
  const dialog = page.getByRole("dialog", { name: "Support event" });
  await dialog.getByRole("radio", { name: "$50" }).click();
  await dialog.getByRole("button", { name: /pledge \$50/i }).click();
  await expect(page.getByText("You’re a supporter!")).toBeVisible();
  await page.getByRole("button", { name: "Jump LV.4" }).click();
  await expect(page.getByText("LEVEL UP! LV.4").first()).toBeVisible();
  await expect(page.getByRole("img", { name: /Stage at level 4/ })).toBeVisible();
});

test("ticket demo purchase", async ({ page }) => {
  await page.goto("/events/void-jelly-rave/tickets");
  await page.getByRole("button", { name: "Add one VIP" }).click();
  await page.getByRole("button", { name: "Review order" }).click();
  const dialog = page.getByRole("dialog", { name: "Confirm order" });
  await expect(dialog.getByText(/not a real purchase/i)).toBeVisible();
  await dialog.getByRole("button", { name: /complete demo purchase/i }).click();
  await expect(page).toHaveURL(/\/tickets\/FK-/);
  await expect(page.getByText("SAMPLE · NOT VALID")).toBeVisible();
  await page.goto("/tickets");
  await expect(page.getByText("VOID JELLY RAVE")).toBeVisible();
});

test("create event in 7 steps (draft persists)", async ({ page }) => {
  await page.goto("/events/create");
  await page.getByRole("button", { name: /next/i }).click();
  await expect(page.getByText("Give your event a name")).toBeVisible();
  await page.getByLabel("Event name", { exact: true }).fill("GOO GALAXY");
  await page.getByRole("button", { name: "Techno" }).click();
  await page.getByLabel("City", { exact: true }).fill("Tokyo");
  await page.getByRole("button", { name: /next/i }).click();
  await page.getByLabel("Date", { exact: true }).fill("2027-01-10");
  await page.reload(); // draft + step survive reload
  await expect(page.getByText("Step 2")).toBeVisible();
  await expect(page.getByLabel("Date", { exact: true })).toHaveValue("2027-01-10");
  await page.getByRole("button", { name: /next/i }).click();
  await page.getByText("KAIJU BASEMENT").click();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: /next/i }).click();
  await expect(page.getByText("Step 7")).toBeVisible();
  await expect(page.getByText("GOO GALAXY")).toBeVisible();
  await page.getByRole("button", { name: /publish/i }).click();
  await expect(page.getByRole("heading", { name: /GOO GALAXY is live/ })).toBeVisible();
  await page.getByRole("button", { name: /organizer dashboard/i }).click();
  await expect(page.getByText("GOO GALAXY")).toBeVisible();
});

test("avatar customize and profile reflects it", async ({ page }) => {
  await page.goto("/avatar");
  await page.getByRole("radio", { name: /COSMIC FUZZ/ }).click();
  await page.getByLabel("Name", { exact: true }).fill("ZORP");
  await page.getByRole("button", { name: "Jacket" }).click();
  await page.getByRole("button", { name: /save avatar/i }).click();
  await expect(page.getByText("Avatar saved")).toBeVisible();
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Profile" }).click();
  await expect(page.getByText(/ZORP/).first()).toBeVisible();
});

test("DJ application shows in organizer dashboard", async ({ page }) => {
  await page.goto("/djs/apply?event=void-jelly-rave");
  await page.getByLabel("DJ name", { exact: true }).fill("TEST TOAD");
  await page.getByLabel("City", { exact: true }).fill("Leeds");
  await page.getByRole("button", { name: "Garage" }).click();
  await page.getByRole("button", { name: /next/i }).click();
  await page.getByLabel("Mix link", { exact: true }).fill("https://example.com/mix");
  await page.getByLabel("Message to the organizer", { exact: true }).fill("Ready for a 30-minute audition.");
  await page.getByRole("button", { name: /submit application/i }).click();
  await expect(page.getByRole("heading", { name: "Application saved" })).toBeVisible();
  await page.goto("/dashboard?role=organizer");
  await expect(page.getByText("TEST TOAD")).toBeVisible();
});

test("audition: vote, like, comment", async ({ page }) => {
  await page.goto("/djs/kombu/audition");
  await page.getByRole("radio", { name: "4 stars" }).click();
  await page.getByRole("button", { name: "Like this audition" }).click();
  await page.getByLabel("Write a comment", { exact: true }).fill("so floaty");
  await page.getByRole("button", { name: "Send comment" }).click();
  await expect(page.getByText("so floaty")).toBeVisible();
});

test("live map: consent toggle and move zone", async ({ page }) => {
  await page.goto("/live");
  await page.getByRole("group", { name: "Move my avatar" }).getByRole("button", { name: "Bar" }).click();
  await expect(page.getByText("Turn on ‘Show my avatar’ first")).toBeVisible();
  await page.getByRole("switch", { name: /show my avatar/i }).click();
  await page.getByRole("group", { name: "Move my avatar" }).getByRole("button", { name: "Bar" }).click();
  await expect(page.getByText("Moved to Bar")).toBeVisible();
  await page.getByRole("button", { name: /check in/i }).click();
  await expect(page.getByText(/checked in \(demo\)/i)).toBeVisible();
});

test("venue listing flow", async ({ page }) => {
  await page.goto("/venues/new");
  await page.getByLabel("Venue name", { exact: true }).fill("MOSS CAVE");
  await page.getByLabel("City", { exact: true }).fill("Kyoto");
  await page.getByLabel("Description", { exact: true }).fill("A mossy cave with a big sound system.");
  await page.getByRole("button", { name: /next/i }).click();
  await page.getByRole("button", { name: /next/i }).click();
  await page.getByLabel("Address", { exact: true }).fill("1 Moss Lane");
  await page.getByLabel("Capacity", { exact: true }).fill("250");
  await page.getByLabel("Price / hour (USD)", { exact: true }).fill("200");
  await page.getByRole("button", { name: /next/i }).click();
  await page.getByRole("button", { name: "Bar" }).click();
  await page.getByRole("button", { name: /next/i }).click();
  await page.locator("button[aria-pressed]").first().click();
  await page.getByRole("button", { name: /publish listing/i }).click();
  await expect(page.getByRole("heading", { name: "MOSS CAVE" })).toBeVisible();
});

test("after party linked to main event", async ({ page }) => {
  await page.goto("/after-party/new?event=glass-noodle");
  await page.getByLabel("After party name", { exact: true }).fill("Noodle Nap");
  await page.getByLabel("Venue", { exact: true }).fill("Rooftop");
  await page.getByRole("button", { name: /create after party/i }).click();
  await expect(page.getByRole("heading", { name: "NOODLE NAP" })).toBeVisible();
  await expect(page.getByRole("link", { name: "GLASS NOODLE" })).toBeVisible();
});

test("header search finds DJs and events", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /search events/i }).click();
  await page.getByRole("dialog").getByRole("searchbox").fill("berlin");
  await expect(page.getByRole("dialog").getByRole("link", { name: /NEON SLIME SUMMIT/ })).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("link", { name: /MOTHERBOARD MIKA/ })).toBeVisible();
});

test("sticky CTA sits above bottom nav, tap targets ≥ 44px", async ({ page }) => {
  await page.goto("/events/neon-slime-summit");
  const nav = await page.getByRole("navigation", { name: "Primary" }).boundingBox();
  const cta = await page.getByRole("link", { name: "Tickets" }).last().boundingBox();
  expect(cta!.y + cta!.height).toBeLessThanOrEqual(nav!.y + 1);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll("main button, nav a, main a.rounded-full")]
      .filter((el) => (el as HTMLElement).offsetParent)
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && (r.height < 43.5 || r.width < 43.5)).length,
  );
  expect(small).toBe(0);
});
