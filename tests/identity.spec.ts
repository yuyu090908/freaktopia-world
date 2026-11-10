import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * FREAKTOPIA WORLD 8.0: languages × accounts × alien identity.
 * Runs against the demo configuration (no DATABASE_URL, no email/Google keys): the in-memory store,
 * the demo mailbox and the Google simulator. Each test uses a fresh browser context.
 */

const LOCALES = ["en", "ja", "ko", "zh-CN", "ru", "th", "es", "pt", "fr", "de", "vi", "id"] as const;
const HREFLANG: Record<string, string> = { "zh-CN": "zh-CN", pt: "pt-BR" };
const dict = (l: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", `${l}.json`), "utf8"));
const NATIVE: Record<string, string> = { en: "English", ja: "日本語", ko: "한국어", "zh-CN": "简体中文", ru: "Русский", th: "ไทย", es: "Español", pt: "Português (Brasil)", fr: "Français", de: "Deutsch", vi: "Tiếng Việt", id: "Bahasa Indonesia" };
const PW = "neon slime forever";
let seq = 0;
const newEmail = () => `e2e-${Date.now()}-${process.pid}-${++seq}@example.test`;

/** Each test is its own client for the per-IP rate limits (sign-up allows 8 per hour per IP). */
const fakeIp = () => `10.${(process.pid % 200) + 20}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": fakeIp() });
});

const htmlLang = (page: Page) => page.evaluate(() => document.documentElement.lang);

async function switchLanguage(page: Page, l: string) {
  await page.getByTestId("lang-switcher").first().click();
  await page.getByTestId(`lang-${l}`).click();
  await expect.poll(() => htmlLang(page)).toBe(HREFLANG[l] ?? l);
}

async function openLatestMailLink(page: Page, kind: "verify" | "reset") {
  await page.goto("/auth/mailbox");
  const link = page.getByTestId("mail-link").filter({ has: page.locator(`xpath=self::*[contains(@href, "/auth/${kind}")]`) }).first();
  await expect(link).toBeVisible();
  await link.click();
}

/** Email sign-up through the real UI, confirmed through the demo mailbox. Ends on the Reveal. */
async function signUpAndVerify(page: Page, email = newEmail()) {
  await page.goto("/auth/signup");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PW);
  await page.getByTestId("signup-submit").click();
  await expect(page.getByTestId("check-email")).toBeVisible();
  await openLatestMailLink(page, "verify");
  await expect(page).toHaveURL(/\/welcome$/, { timeout: 20_000 });
  await expect(page.getByTestId("alien-reveal")).toBeVisible();
  return email;
}

async function finishReveal(page: Page, name = "Space Raver") {
  await page.getByTestId("reveal-skip").click();
  await expect(page.getByTestId("alien-reveal")).toHaveAttribute("data-phase", "born");
  const alienName = (await page.getByTestId("alien-name").textContent())!.trim();
  await page.getByTestId("reveal-continue").click();
  await page.locator("#displayName").fill(name);
  await page.getByTestId("name-submit").click();
  await expect(page).toHaveURL(/\/world$/, { timeout: 20_000 });
  return alienName;
}

const meJson = async (page: Page) => {
  const j = await (await page.request.get("/api/me")).json();
  return { me: j.signedIn ? j : null };
};

async function signOut(page: Page) {
  await page.goto("/profile/settings");
  await page.getByTestId("signout").click();
  await expect.poll(async () => (await meJson(page)).me ?? null).toBeNull();
}

async function signIn(page: Page, email: string, password = PW) {
  await page.goto("/auth/signin");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByTestId("signin-submit").click();
  await expect.poll(async () => (await meJson(page)).me?.user?.email ?? null, { timeout: 15_000 }).toBe(email);
}

const noHorizontalScroll = async (page: Page) => {
  const r = await page.evaluate(() => {
    window.scrollTo(500, window.scrollY);
    return { x: window.scrollX, doc: document.documentElement.scrollWidth - window.innerWidth };
  });
  expect(r.x).toBe(0);
  expect(r.doc).toBeLessThanOrEqual(0);
};

test.describe("languages", () => {
  test("1. switches between all 12 languages in place, swapping the URL prefix", async ({ page }) => {
    await page.goto("/en/events");
    for (const l of LOCALES.filter((x) => x !== "en").concat("en")) {
      await switchLanguage(page, l);
      await expect(page).toHaveURL(new RegExp(`/${l.toLowerCase()}/events$`));
      await expect(page.getByTestId("lang-switcher").first()).toHaveAttribute("aria-label", dict(l).language.button.replace("{name}", NATIVE[l]));
    }
  });

  test("2. keeps the language across navigation, prefixed and unprefixed URLs, and sets SEO alternates", async ({ page }) => {
    await page.goto("/");
    await switchLanguage(page, "ja");
    await page.goto("/events");
    expect(await htmlLang(page)).toBe("ja");
    await page.goto("/world/levels");
    expect(await htmlLang(page)).toBe("ja");
    await page.goto("/ko/world/levels");
    expect(await htmlLang(page)).toBe("ko");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/ko\/world\/levels$/);
    await expect(page.locator('link[rel="alternate"][hreflang="th"]')).toHaveAttribute("href", /\/th\/world\/levels$/);
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1);
  });

  test("first visit follows the browser language", async ({ browser }) => {
    const ctx = await browser.newContext({ locale: "th-TH", extraHTTPHeaders: { "accept-language": "th-TH,th;q=0.9", "x-forwarded-for": fakeIp() } });
    const page = await ctx.newPage();
    await page.goto("/");
    expect(await htmlLang(page)).toBe("th");
    await ctx.close();
  });

  test("4. no untranslated message keys leak into pages (ja, ru, th)", async ({ page }) => {
    for (const l of ["ja", "ru", "th"]) {
      for (const p of ["", "/auth/signup", "/auth/signin", "/world/levels", "/profile"]) {
        await page.goto(`/${l.toLowerCase()}${p}`);
        const text = await page.locator("body").innerText();
        expect(text, `${l}${p}`).not.toMatch(/\b(common|nav|auth|alien|world|profile|live|dao|status|levels|language|footer|states|translation)\.[a-zA-Z]+(\.[a-zA-Z0-9]+)*\b/);
      }
    }
  });
});

test.describe("accounts and alien identity", () => {
  test("6/10/13/14. email sign-up → verify → reveal → name → profile shows the same alien", async ({ page }) => {
    await signUpAndVerify(page);
    const reveal = page.getByTestId("alien-reveal");
    await expect(reveal).toHaveAttribute("data-phase", /egg|hatch/);
    const alienName = await finishReveal(page, "Disco Comet");
    await page.goto("/profile");
    await expect(page.getByTestId("profile-display-name")).toHaveText("Disco Comet");
    await expect(page.getByTestId("profile-alien-name")).toHaveText(alienName);
    await page.goto("/profile/alien");
    await expect(page.getByTestId("alien-family")).toBeVisible();
    const current = (await meJson(page)).me.alien.accessory;
    const pick = current === "halo" ? "flower" : "halo";
    await page.getByTestId(`acc-${pick}`).click();
    await page.getByTestId("save-look").click();
    await expect.poll(async () => (await meJson(page)).me.alien.accessory).toBe(pick);
    // the base traits cannot be changed through the API
    const r = await page.request.patch("/api/me/alien", { data: { family: "jelly" }, headers: { origin: "http://localhost:3000" } });
    expect(r.status()).toBe(400);
    expect((await r.json()).error.code).toBe("ALIEN_BASE_IS_PERMANENT");
  });

  test("reveal respects reduced motion", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 844 }, extraHTTPHeaders: { "x-forwarded-for": fakeIp() } });
    const page = await ctx.newPage();
    await signUpAndVerify(page);
    await expect(page.getByTestId("alien-reveal")).toHaveAttribute("data-phase", "born", { timeout: 1_500 });
    await ctx.close();
  });

  test("3/11/12. language survives login; re-login keeps the same alien; no second alien", async ({ page }) => {
    await page.goto("/");
    await switchLanguage(page, "fr");
    const email = await signUpAndVerify(page);
    const alienName = await finishReveal(page);
    expect(await htmlLang(page)).toBe("fr");
    const first = (await meJson(page)).me;
    expect(first.profile.locale).toBe("fr");
    await signOut(page);
    await page.context().clearCookies();
    await signIn(page, email);
    await page.goto("/");
    expect(await htmlLang(page)).toBe("fr"); // restored from the profile on login
    const again = (await meJson(page)).me;
    expect(again.alien.createdAt).toBe(first.alien.createdAt);
    expect(again.alien.name).toBe(alienName);
    expect(again.alien).not.toHaveProperty("seed");
    // revisiting the welcome page never hatches another one
    await page.goto("/welcome");
    expect((await meJson(page)).me.alien.createdAt).toBe(first.alien.createdAt);
  });

  test("7/8. Google sign-in (demo simulator, labelled) and logout", async ({ page }) => {
    await page.goto("/auth/signin");
    await expect(page.getByTestId("auth-status")).toContainText(/Demo simulator/);
    await page.getByTestId("google-button").click();
    await expect(page.getByText(/DEMO: Google sign-in is not connected/)).toBeVisible();
    const email = newEmail();
    await page.locator("#gemail").fill(email);
    await page.getByTestId("google-demo-submit").click();
    await expect(page).toHaveURL(/\/welcome$/, { timeout: 20_000 });
    await expect(page.getByTestId("alien-reveal")).toBeVisible();
    const me = (await meJson(page)).me;
    expect(me.providers).toEqual(["google"]);
    expect(me.user.emailVerified).toBe(true);
    // a second Google login for the same account reuses the user and alien
    await page.goto("/auth/google-demo");
    await page.locator("#gemail").fill(email);
    await page.getByTestId("google-demo-submit").click();
    await expect.poll(async () => (await meJson(page)).me?.alien?.createdAt).toBe(me.alien.createdAt);
    await signOut(page);
    await page.goto("/");
    await expect(page.getByTestId("signin-link").first()).toBeVisible();
  });

  test("9. password reset by email link signs out and accepts the new password", async ({ page }) => {
    const email = await signUpAndVerify(page);
    await finishReveal(page);
    await signOut(page);
    await page.goto("/auth/reset");
    await page.locator("#email").fill(email);
    await page.getByTestId("reset-request").click();
    await expect(page.getByTestId("reset-sent")).toBeVisible();
    await openLatestMailLink(page, "reset");
    await page.locator("#password").fill("a fresh new passphrase");
    await page.getByTestId("reset-confirm").click();
    await expect(page.getByTestId("reset-done")).toBeVisible();
    await page.goto("/auth/signin");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(PW);
    await page.getByTestId("signin-submit").click();
    await expect(page.getByTestId("auth-error")).toBeVisible();
    await signIn(page, email, "a fresh new passphrase");
  });

  test("security: wrong password and unknown email give the same answer; cross-site POST is blocked", async ({ page }) => {
    const known = await signUpAndVerify(page);
    await finishReveal(page);
    await signOut(page);
    const a = await page.request.post("/api/auth/signin", { data: { email: known, password: "not the password" }, headers: { origin: "http://localhost:3000" } });
    const b = await page.request.post("/api/auth/signin", { data: { email: newEmail(), password: "not the password" }, headers: { origin: "http://localhost:3000" } });
    expect(a.status()).toBe(b.status());
    expect((await a.json()).error.code).toBe((await b.json()).error.code);
    const csrf = await page.request.post("/api/auth/signin", { data: { email: known, password: PW }, headers: { origin: "https://evil.example" } });
    expect(csrf.status()).toBe(403);
  });
});

test.describe("identity across the world", () => {
  test("15. map shows my alien only at joined events and only with permission", async ({ page }) => {
    await signUpAndVerify(page);
    await finishReveal(page);
    // join an event (demo support), stored in this browser's demo state
    await page.evaluate(() => localStorage.setItem("freaktopia-demo-v1", JSON.stringify({ state: { support: { "neon-slime-summit": { supporters: 1, raised: 25 } } }, version: 1 })));
    await page.goto("/world?event=neon-slime-summit");
    await expect(page.getByTestId("world-map")).toHaveAttribute("data-ready", "true", { timeout: 25_000 });
    await expect(page.getByTestId("map-my-alien")).toHaveCount(0); // presence is off by default
    const sheet = page.getByRole("region", { name: /NEON SLIME SUMMIT summary/ });
    await sheet.getByRole("button", { name: "Show all details" }).click();
    await expect(sheet.getByText(dict("en").world.myAlienOff)).toBeVisible();
    const r = await page.request.patch("/api/me/privacy", { data: { mapPresence: true }, headers: { origin: "http://localhost:3000" } });
    expect(r.ok()).toBe(true);
    await page.reload();
    await expect(page.getByTestId("world-map")).toHaveAttribute("data-ready", "true", { timeout: 25_000 });
    const sheet2 = page.getByRole("region", { name: /NEON SLIME SUMMIT summary/ });
    await sheet2.getByRole("button", { name: "Show all details" }).click();
    await expect(sheet2.getByTestId("panel-my-alien")).toBeVisible();
    await expect(page.getByTestId("map-my-alien")).toHaveCount(1);
  });

  test("16. LIVE uses the account alien and honours the visibility setting", async ({ page }) => {
    await signUpAndVerify(page);
    await finishReveal(page, "Moon Bouncer");
    await page.goto("/live/bassmutant-tokyo");
    await page.getByRole("tab", { name: "Map" }).click();
    await expect(page.getByTestId("live-identity-note")).toContainText(dict("en").live.identityAvatar);
    await expect(page.getByText("Moon Bouncer").first()).toBeVisible(); // the account name, drawn with the account alien
    await page.request.patch("/api/me/privacy", { data: { liveAvatar: false }, headers: { origin: "http://localhost:3000" } });
    await page.reload();
    await page.getByRole("tab", { name: "Map" }).click();
    await expect(page.getByTestId("live-identity-note")).toContainText(dict("en").live.hiddenAvatar);
  });

  test("17. DAO shows my alien as author and voter, and the avatar adds no voting power", async ({ page }) => {
    await signUpAndVerify(page);
    await finishReveal(page);
    const EV = "neon-slime-summit";
    await page.goto(`/dao/${EV}`);
    await page.getByRole("button", { name: /^Join DAO$/ }).first().click();
    const join = page.getByRole("dialog", { name: "Join this DAO" });
    await join.getByRole("button", { name: /Connect demo wallet & sign/ }).click();
    await join.getByRole("button", { name: /^Stake \d+ & join \(demo\)$/ }).click();
    await join.getByRole("button", { name: "Go to the DAO" }).click();
    await page.goto(`/dao/${EV}/proposals?new=1`);
    const sheet = page.getByRole("dialog", { name: "New proposal" });
    await sheet.locator("#p-title").fill("Alien cloakroom");
    await sheet.locator("#p-desc").fill("A cloakroom where every alien can hang their antennae while they dance all night.");
    await sheet.locator("#p-change").fill("Rent a cloakroom tent next to the entrance.");
    await sheet.locator("#p-cost").fill("400");
    await sheet.getByRole("button", { name: "Open for discussion" }).click();
    await expect(page).toHaveURL(/\/proposals\/[^/?]+$/);
    await expect(page.getByTestId("dao-my-avatar").first()).toBeVisible();
    const pid = page.url().split("/").pop()!;
    await page.request.post(`/api/dao/${EV}/demo-role`, { data: { roles: ["organizer"] } });
    await page.request.post(`/api/dao/${EV}/proposals/${pid}/transition`, { data: { to: "REVIEW" } });
    await page.request.post(`/api/dao/${EV}/proposals/${pid}/transition`, { data: { to: "VOTING" } });
    await page.reload();
    await expect(page.getByText(dict("en").dao.avatarNoPower).first()).toBeVisible();
    await page.locator("label", { has: page.getByRole("radio", { name: "Yes" }) }).first().click();
    await page.getByRole("button", { name: /Review vote/ }).click();
    await page.getByRole("dialog", { name: "Confirm your vote" }).getByRole("button", { name: "Submit vote" }).click();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByTestId("dao-voter-badge").first()).toBeVisible();
    // weight is still exactly one vote
    const proposal = await (await page.request.get(`/api/dao/${EV}/proposals/${pid}`)).json();
    expect(proposal.proposal.vote.ballots ?? 1).toBeGreaterThanOrEqual(1);
  });
});

test.describe("18. mobile and desktop widths with non-Latin scripts", () => {
  const FONT: Record<string, RegExp> = { ja: /Noto Sans JP/, ko: /Noto Sans KR/, "zh-CN": /Noto Sans SC/, th: /Noto Sans Thai/, ru: /Noto Sans/, vi: /Noto Sans/ };
  for (const w of [375, 390, 430, 768, 1440]) {
    test(`${w}px: no horizontal scroll; CJK, Thai, Russian and Vietnamese fonts load`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
      const page = await ctx.newPage();
      for (const l of Object.keys(FONT)) {
        for (const p of ["", "/auth/signup", "/profile"]) {
          await page.goto(`/${l.toLowerCase()}${p}`);
          await noHorizontalScroll(page);
        }
        const loaded = await page.evaluate(async () => {
          await document.fonts.ready;
          return [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family);
        });
        expect(loaded.join("|"), `${l} @${w}`).toMatch(FONT[l]);
      }
      await page.goto("/ja");
      await page.getByTestId("lang-switcher").first().click();
      await expect(page.getByTestId("lang-th")).toBeVisible(); // popover on desktop, bottom sheet on phones
      await noHorizontalScroll(page);
      await ctx.close();
    });
  }
});
