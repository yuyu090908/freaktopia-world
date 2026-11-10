import { test, expect, type Browser, type Page } from "@playwright/test";

/**
 * Event operations (STEP 5 scenarios), against the demo configuration (in-memory store with DEMO providers).
 * Every person is a real signed-up, email-verified account in its own browser context.
 */

const PW = "neon slime forever";
let seq = 0;
const TAG = Math.random().toString(36).slice(2, 6).toUpperCase(); // names stay unique when the suite runs again on the same server
const newEmail = () => `ops-${Date.now()}-${process.pid}-${++seq}@example.test`;
const fakeIp = () => `10.${(process.pid % 200) + 20}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const day = 86_400_000;
const isoDay = (days: number) => new Date(Date.now() + days * day).toISOString().slice(0, 10);

interface Person {
  page: Page;
  email: string;
}

async function person(browser: Browser): Promise<Person> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, extraHTTPHeaders: { "x-forwarded-for": fakeIp() } });
  const page = await context.newPage();
  const email = newEmail();
  const r = await page.request.post("/api/auth/signup", { data: { email, password: PW }, headers: { "content-type": "application/json" } });
  expect(r.ok()).toBeTruthy();
  await page.goto("/auth/mailbox");
  await page.getByTestId("mail-link").first().click();
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 20_000 });
  await expect.poll(async () => (await (await page.request.get("/api/me")).json()).user?.emailVerified ?? false).toBe(true);
  return { page, email };
}

const api = async (p: Page, path: string, data?: unknown) => {
  const r = data === undefined ? await p.request.get(`/api/ops/${path}`) : await p.request.post(`/api/ops/${path}`, { data, headers: { "content-type": "application/json", origin: new URL(p.url()).origin } });
  return { status: r.status(), json: await r.json().catch(() => ({})) };
};

async function createPlan(p: Page, opts: { template: string; name: string; attendance?: number; date?: string; budget?: number }) {
  await p.goto("/events/manage/new");
  await p.getByTestId(`tpl-${opts.template}`).click();
  await p.getByTestId("ev-name").fill(opts.name);
  if (opts.attendance) await p.getByTestId("ev-attendance").fill(String(opts.attendance));
  if (opts.date) await p.getByTestId("ev-date").fill(opts.date);
  if (opts.budget != null) await p.getByTestId("ev-budget").fill(String(opts.budget));
  await p.getByTestId("create-plan").click();
  await expect(p).toHaveURL(/\/events\/manage\/[0-9a-f-]{36}/, { timeout: 20_000 });
  await expect(p.getByTestId("ops-title")).toHaveText(opts.name);
  return p.url().match(/manage\/([0-9a-f-]{36})/)![1];
}

async function confirm(p: Page) {
  await p.getByTestId("confirm-check").check();
  await p.getByTestId("confirm-action").click();
}

const noHorizontalScroll = async (p: Page) => {
  const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over).toBeLessThanOrEqual(1);
};

async function makeListing(p: Page, l: { type: string; title: string; city: string; key: string; qty: number; price: number }) {
  await p.goto("/profile/work");
  await p.getByTestId("wp-name").fill(`${l.title} crew`);
  await p.getByTestId("save-work-profile").click();
  await expect(p.getByTestId("work-profile")).toBeVisible();
  await p.getByTestId("new-listing").click();
  await p.locator(`[data-type="${l.type}"]`).click();
  await p.getByTestId("listing-title").fill(l.title);
  await p.getByTestId("listing-city").selectOption(l.city);
  await p.getByTestId("item-key-0").selectOption(l.key);
  await p.getByTestId("item-qty-0").fill(String(l.qty));
  await p.getByTestId("listing-price").fill(String(l.price));
  await p.getByTestId("save-listing").click();
  await expect(p.getByTestId("my-listings")).toContainText(l.title);
}

test.describe("event operations", () => {
  test.setTimeout(150_000);

  test("small event: template → plan with level 1, only small-event items, safety separate from readiness", async ({ browser }) => {
    const a = await person(browser);
    await a.page.goto("/events/manage/new");
    await a.page.getByTestId("tpl-private_party").click();
    await expect(a.page.getByTestId("preview-level")).toContainText("L1");
    await expect(a.page.getByTestId("preview-list").locator('[data-key="led_screen"]')).toHaveCount(0);
    await expect(a.page.getByTestId("preview-list").locator('[data-key="barricades"]')).toHaveCount(0);
    await noHorizontalScroll(a.page);
    await createPlan(a.page, { template: "private_party", name: "Rooftop birthday" });
    await expect(a.page.getByTestId("ops-level")).toContainText("L1");
    await expect(a.page.getByTestId("safety-status")).toContainText(/not approved/i);
    await a.page.getByTestId("tab-planning").click();
    await expect(a.page.getByTestId("reqs-sound").locator('[data-key="main_pa"]')).toBeVisible();
    await expect(a.page.locator('[data-key="security_staff"]')).toHaveCount(0);
    await noHorizontalScroll(a.page);
  });

  test("2,000-person festival: L5, safety-critical items need verified credentials, override and safety approval with confirmation", async ({ browser }) => {
    const a = await person(browser);
    const id = await createPlan(a.page, { template: "outdoor_festival", name: "Solar Slime Fest", attendance: 2000, budget: 250000 });
    await expect(a.page.getByTestId("ops-level")).toContainText("L5");
    await a.page.getByTestId("tab-planning").click();
    const sec = a.page.getByTestId("reqs-staff").locator('[data-key="security_staff"]');
    await expect(sec).toContainText(/security licence/i);
    // Lowering a safety quantity asks for the qualified person who confirmed it.
    await a.page.getByTestId("qty-security_staff").fill("5");
    await a.page.getByTestId("qty-security_staff").blur();
    await a.page.getByTestId("expert-name").fill("K. Somchai, licensed security planner");
    await a.page.getByTestId("save-expert").click();
    await expect(sec).toContainText("K. Somchai");
    // Manual safety check: needs a reference and an explicit confirmation.
    await a.page.getByTestId("tab-safety").click();
    await a.page.getByTestId("approve-permits_insurance").click();
    await expect(a.page.getByTestId("confirm-action")).toBeDisabled();
    await a.page.getByTestId("approve-reference").fill("City permit B-2026-117");
    await confirm(a.page);
    await expect(a.page.getByTestId("checklist").locator('[data-key="permits_insurance"]')).toHaveAttribute("data-met", "1");
    await expect(a.page.getByTestId("safety-approved")).toContainText(/not approved/i); // other checks still open
    const view = await api(a.page, `events/${id}`);
    expect(view.json.view.readiness.safetyApproved).toBe(false);
  });

  test("quote request to a sound company (DEMO + real provider), quote with file, hire with confirmation, provider accepts", async ({ browser }) => {
    const a = await person(browser);
    const b = await person(browser);
    await makeListing(b.page, { type: "company", title: `Moonbass Audio ${TAG}`, city: "Bangkok", key: "main_pa", qty: 2, price: 1800 });
    const id = await createPlan(a.page, { template: "club_night", name: "Neon Basement", date: isoDay(60) });
    await a.page.getByTestId("tab-resources").click();
    await a.page.getByTestId("find-main_pa").click();
    const list = a.page.getByTestId("candidates-main_pa");
    await expect(list).toContainText(`Moonbass Audio ${TAG}`);
    await expect(list).toContainText("FESTIVAL SOUND PACKAGE"); // DEMO company, labelled
    await list.locator("li", { hasText: `Moonbass Audio ${TAG}` }).getByTestId("request-quote").click();
    await a.page.getByTestId("send-offer").click();
    await expect(a.page.getByTestId("openings")).toContainText(`Moonbass Audio ${TAG}`);

    // Provider side: the request shows up, they answer with a price, proposal and quote file.
    await b.page.goto("/profile/work");
    const opp = b.page.getByTestId("opportunities").locator('[data-kind="quote"]', { hasText: "Neon Basement" });
    await opp.getByTestId("apply").click();
    await b.page.getByTestId("apply-price").fill("1650");
    await b.page.getByTestId("apply-message").fill("2 tops, 4 subs, engineer included");
    await b.page.locator("#ap-f").setInputFiles({ name: "quote.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 quote") });
    await b.page.getByTestId("send-application").click();
    await expect(opp).toContainText(/submitted/i);

    // Organizer compares and hires (explicit confirmation), provider accepts the terms.
    await a.page.reload();
    await a.page.getByTestId("tab-resources").click();
    const row = a.page.getByTestId("applications").locator("tr", { hasText: `Moonbass Audio ${TAG}` });
    await expect(row).toContainText("1,650");
    await expect(row.getByRole("link")).toHaveAttribute("href", /\/api\/ops\/documents\//);
    await row.getByTestId("hire").click();
    await confirm(a.page);
    await expect(a.page.getByTestId("agreements")).toContainText(/proposed/i);
    await b.page.reload();
    await b.page.getByTestId("provider-accept").click();
    await confirm(b.page);
    await expect(b.page.getByTestId("my-agreements").locator('[data-status="agreed"]')).toBeVisible();
    const v = await api(a.page, `events/${id}`);
    expect(v.json.view.requirements.find((r: { key: string }) => r.key === "main_pa").status).toBe("booked");
    expect(v.json.view.members.some((m: { role: string }) => m.role === "vendor")).toBe(true);
  });

  test("DJ application to an open call, compared and hired; equipment rental booked; double booking blocked; budget overrun with alternatives", async ({ browser }) => {
    const a = await person(browser);
    const dj = await person(browser);
    const gear = await person(browser);
    const c = await person(browser);
    await makeListing(dj.page, { type: "person", title: "DJ Plasma Toad", city: "Tokyo", key: "dj_performer", qty: 1, price: 700 });
    await makeListing(gear.page, { type: "equipment", title: `My CDJ pair ${TAG}`, city: "Tokyo", key: "cdj", qty: 2, price: 900 });
    const date = isoDay(70);
    const id = await createPlan(a.page, { template: "club_night", name: `Tokyo Ooze Night ${TAG}`, date, budget: 8000 });

    // Open call for DJs → the DJ applies → organizer hires.
    await a.page.getByTestId("tab-resources").click();
    await a.page.getByTestId("call-dj_performer").click();
    await a.page.getByTestId("publish-call").click();
    await expect(a.page.getByTestId("openings").locator('[data-kind="open"]')).toBeVisible();
    await dj.page.goto("/profile/work");
    const call = dj.page.getByTestId("opportunities").locator('[data-kind="open"]', { hasText: `Tokyo Ooze Night ${TAG}` });
    await call.getByTestId("apply").click();
    await dj.page.getByTestId("apply-message").fill("Two-hour slime techno set");
    await dj.page.getByTestId("send-application").click();
    await a.page.reload();
    await a.page.getByTestId("tab-resources").click();
    await a.page.getByTestId("applications").locator("tr", { hasText: "DJ Plasma Toad" }).getByTestId("hire").click();
    await confirm(a.page);

    // Equipment rental: direct offer to the gear owner → apply → hire → accept → booking confirmed.
    await a.page.getByTestId("find-cdj").click();
    await a.page.getByTestId("candidates-cdj").locator("li", { hasText: `My CDJ pair ${TAG}` }).getByTestId("direct-offer").click();
    await a.page.getByTestId("send-offer").click();
    await gear.page.goto("/profile/work");
    await gear.page.getByTestId("opportunities").locator('[data-kind="direct"]').getByTestId("apply").click();
    await gear.page.getByTestId("send-application").click();
    await a.page.reload();
    await a.page.getByTestId("tab-resources").click();
    await a.page.getByTestId("applications").locator("tr", { hasText: `My CDJ pair ${TAG}` }).getByTestId("hire").click();
    await confirm(a.page);
    await gear.page.reload();
    await gear.page.getByTestId("provider-accept").click();
    await confirm(gear.page);
    await expect(gear.page.getByTestId("my-agreements").locator('[data-status="agreed"]')).toBeVisible();

    // Another organizer wants the same CDJs the same night: the booking is refused (no double booking).
    const cid = await createPlan(c.page, { template: "club_night", name: "Rival Rave", date });
    await c.page.getByTestId("tab-resources").click();
    await c.page.getByTestId("find-cdj").click();
    const pair = c.page.getByTestId("candidates-cdj");
    await expect(pair.getByTestId("excluded")).toContainText(`My CDJ pair ${TAG}`);
    await expect(pair.getByTestId("excluded").locator('[data-excluded*="fully_booked"]', { hasText: `My CDJ pair ${TAG}` })).toHaveCount(1);
    // Even forcing it through the API is refused.
    const cv = await api(c.page, `events/${cid}`);
    const cdjReq = cv.json.view.requirements.find((r: { key: string }) => r.key === "cdj");
    const op = await api(c.page, `events/${cid}/openings`, { kind: "direct", requirementIds: [cdjReq.id], targetListingId: (await api(gear.page, "profile")).json.listings[0].id });
    expect(op.status).toBe(201);
    const gearOpp = (await api(gear.page, "opportunities")).json.opportunities.find((o: { opening: { id: string } }) => o.opening.id === op.json.opening.id);
    const app = await api(gear.page, `openings/${gearOpp.opening.id}/apply`, { listingId: gearOpp.opening.targetListingId, priceUsd: 900 });
    const hire = await api(c.page, `events/${cid}/applications/${app.json.application.id}/accept`, { confirm: true });
    expect(hire.status).toBe(409);
    expect(hire.json.error.code).toBe("BOOKING_CONFLICT");

    // Budget overrun: the CDJs cost more than the sound estimate allows → flagged with cheaper alternatives.
    await a.page.getByTestId("tab-budget").click();
    const sound = a.page.getByTestId("budget-table").locator('[data-category="sound"]');
    await sound.locator("input").fill("200");
    await sound.locator("input").blur();
    await expect(sound).toHaveAttribute("data-over", "1");
    await expect(a.page.getByTestId("budget-over")).toBeVisible();
    await a.page.getByTestId("alternatives-sound").click();
    await expect(a.page.getByTestId("alternatives")).toContainText("KAITO"); // DEMO individual owner, cheaper
    await noHorizontalScroll(a.page);
    const v = await api(a.page, `events/${id}`);
    expect(v.json.view.budget.contracted).toBe(900);
  });

  test("staff shortage close to the event: warning, incident report by staff, replacements exclude unverified, contact needs approval", async ({ browser }) => {
    const a = await person(browser);
    const s = await person(browser);
    const id = await createPlan(a.page, { template: "warehouse_rave", name: "Short Notice Rave", date: isoDay(5), attendance: 800, budget: 60000 });
    await expect(a.page.getByTestId("conflicts").locator('[data-kind="key_role_missing"]').first()).toBeVisible();
    await a.page.getByTestId("tab-operations").click();
    await a.page.getByTestId("invite-email").fill(s.email);
    await a.page.getByTestId("invite-role").selectOption("staff");
    await a.page.getByTestId("invite-area").selectOption("safety");
    await a.page.getByTestId("invite").click();
    await expect(a.page.getByTestId("members")).toContainText(/staff/i);

    // Staff reports the shortage.
    await s.page.goto(`/events/manage/${id}?tab=safety`);
    await s.page.getByTestId("report-incident").click();
    await s.page.getByTestId("incident-type").selectOption("staff_shortage");
    await s.page.getByTestId("incident-severity").selectOption("high");
    const secId = (await api(a.page, `events/${id}`)).json.view.requirements.find((r: { key: string }) => r.key === "security_staff").id;
    await s.page.getByTestId("incident-req").selectOption(secId);
    await s.page.getByTestId("incident-desc").fill("Four guards cancelled this morning");
    await s.page.getByTestId("submit-incident").click();
    await expect(s.page.getByTestId("incidents").locator('[data-type="staff_shortage"]')).toBeVisible();
    await expect(s.page.getByTestId("replacements")).toHaveCount(0); // staff can't search or contact

    // Organizer sees it, gets replacements (licensed only) and must confirm before anyone is contacted.
    await a.page.goto(`/events/manage/${id}?tab=safety`);
    await a.page.getByTestId("replacements").click();
    const list = a.page.getByTestId("replacement-list");
    await expect(list).toContainText("GUARDIAN GECKO SECURITY");
    await expect(list).not.toContainText("NIGHTWATCH CREW"); // cheaper but its licence isn't verified
    const before = (await api(a.page, `events/${id}`)).json.view.openings.length;
    await list.locator("li", { hasText: "GUARDIAN GECKO SECURITY" }).getByRole("button").click();
    await expect.poll(async () => (await api(a.page, `events/${id}`)).json.view.openings.length).toBe(before);
    await confirm(a.page);
    await expect.poll(async () => (await api(a.page, `events/${id}`)).json.view.openings.length).toBe(before + 1);
  });

  test("permissions: outsiders get 404, staff see no money and can't recruit, contracts hidden from staff", async ({ browser }) => {
    const a = await person(browser);
    const s = await person(browser);
    const x = await person(browser);
    const id = await createPlan(a.page, { template: "club_night", name: "Private Ops Night" });
    // A stranger can't see that the event exists.
    await x.page.goto(`/events/manage/${id}`);
    await expect(x.page.getByText(/event not found/i)).toBeVisible();
    expect((await api(x.page, `events/${id}`)).status).toBe(404);
    expect((await api(x.page, `events/${id}/messages/general`)).status).toBe(404);
    // Staff: no budget tab, no recruiting, no money in the API, can't publish calls.
    await api(a.page, `events/${id}/members`, { email: s.email, role: "staff", area: "sound" });
    await s.page.goto(`/events/manage/${id}`);
    await expect(s.page.getByTestId("ops-role")).toContainText(/staff/i);
    await expect(s.page.getByTestId("tab-budget")).toHaveCount(0);
    await expect(s.page.getByTestId("tab-resources")).toHaveCount(0);
    const sv = (await api(s.page, `events/${id}`)).json.view;
    expect(sv.budget).toBeNull();
    expect(sv.event.budgetUsd).toBeNull();
    expect(sv.threads).toEqual(["general", "sound"]);
    expect((await api(s.page, `events/${id}/openings`, { kind: "open", requirementIds: [sv.requirements[0]?.id ?? "00000000-0000-4000-8000-000000000000"] })).status).toBe(403);
    expect((await api(s.page, `events/${id}/messages/safety`)).status).toBe(403);
    expect((await api(s.page, `events/${id}/safety/permits_insurance`, { approve: true, reference: "x", confirm: true })).status).toBe(403);
    // Cross-site POSTs are refused.
    const csrf = await s.page.request.post(`/api/ops/events/${id}/messages/general`, { data: { body: "hi" }, headers: { "content-type": "application/json", origin: "https://evil.example" } });
    expect(csrf.status()).toBe(403);
    // Team chat works for staff in their own threads.
    await s.page.getByTestId("tab-operations").click();
    await s.page.getByTestId("thread-sound").click();
    await s.page.getByTestId("chat-input").fill("PA arrives at 14:00");
    await s.page.getByTestId("chat-send").click();
    await expect(s.page.getByTestId("chat-log")).toContainText("PA arrives at 14:00");
    // Signed-out requests are refused.
    const anon = await browser.newContext();
    expect((await anon.request.get(`/api/ops/events/${id}`)).status()).toBe(401);
  });

  test("phone layout and language switching on the management screens", async ({ browser }) => {
    const a = await person(browser);
    const id = await createPlan(a.page, { template: "beach_party", name: "Beach Blob" });
    for (const tab of ["overview", "planning", "resources", "operations", "budget", "safety"]) {
      await a.page.getByTestId(`tab-${tab}`).click();
      await expect(a.page.getByTestId(`tab-${tab}`)).toHaveAttribute("aria-selected", "true");
      await noHorizontalScroll(a.page);
    }
    await a.page.goto(`/ja/events/manage/${id}?tab=planning`);
    await expect(a.page.getByTestId("tab-planning")).toHaveText("計画");
    await expect(a.page.getByTestId("tab-safety")).toHaveText("安全");
    await noHorizontalScroll(a.page);
    await a.page.goto(`/de/events/manage/${id}?tab=budget`);
    await expect(a.page.getByTestId("tab-budget")).toHaveText("Budget");
    await expect(a.page.getByText("Sicherheit & Genehmigungen").first()).toBeVisible();
    await a.page.setViewportSize({ width: 1280, height: 900 });
    await a.page.goto(`/events/manage/${id}`);
    await noHorizontalScroll(a.page);
  });
});
