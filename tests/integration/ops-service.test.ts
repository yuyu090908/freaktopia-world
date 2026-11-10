import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { memoryStore, resetMemoryStore } from "@/lib/auth/memory";
import { createPgStore } from "@/lib/auth/pg";
import { getStore, setStore } from "@/lib/auth/store";
import type { AuthStore } from "@/lib/auth/types";
import * as ops from "@/lib/ops/service";
import { createPgOpsStore, memoryOpsStore, resetOpsMemory, setOpsStore, type OpsStore } from "@/lib/ops/store";
import { OpsError, type Requirement } from "@/lib/ops/types";

let n = 0;
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const code = async (p: Promise<unknown>) => p.then(() => "OK", (e) => (e instanceof OpsError ? e.code : String(e)));
const status = async (p: Promise<unknown>) => p.then(() => 200, (e) => (e instanceof OpsError ? e.status : 500));
const day = 86_400_000;
const at = (days: number, h = 20) => new Date(Math.floor(Date.now() / day) * day + days * day + h * 3_600_000).toISOString();

async function user(verified = true) {
  const email = `ops-${RUN}-${++n}@example.test`;
  const u = await getStore().createUser({ email, passwordHash: null, emailVerified: verified, locale: "en" });
  return { id: u.id, email };
}

const base = (over: Partial<ops.EventInput> = {}): ops.EventInput => ({
  name: "Test night", city: "Bangkok", venueName: "Warehouse 9", setting: "indoor", startAt: at(40), endAt: at(40, 28), genres: ["Techno"],
  attendance: 25, budgetUsd: 3000, ticketing: false, djs: true, streaming: false, templateId: "private_party", ownedEquipment: [], venueFacilities: [], services: [], ...over,
});

async function provider(listing: Partial<ops.ListingInput> & Pick<ops.ListingInput, "items">) {
  const p = await user();
  await ops.saveWorkProfile(p.id, { displayName: `Provider ${n}`, roles: ["company"] });
  const l = await ops.createListing(p.id, { type: "company", title: `Listing ${n}`, city: "Bangkok", priceUsd: 1000, maxAudience: 5000, ...listing });
  return { ...p, listing: l };
}

const stores: [string, () => AuthStore, () => OpsStore][] = [["memory", () => memoryStore, () => memoryOpsStore]];
if (process.env.TEST_DATABASE_URL) stores.push(["postgres", () => createPgStore(process.env.TEST_DATABASE_URL!), () => createPgOpsStore(process.env.TEST_DATABASE_URL!)]);

describe.each(stores)("event operations on %s store", (name, auth, opsStore) => {
  beforeAll(() => {
    setStore(auth());
    setOpsStore(opsStore());
  });
  afterAll(() => {
    setStore(undefined);
    setOpsStore(undefined);
  });
  beforeEach(() => {
    resetMemoryStore();
    resetOpsMemory();
  });

  it("small event: level 1, small plan, budget split, owner membership, no festival items", async () => {
    const o = await user();
    const e = await ops.createEvent(o.id, base({ ownedEquipment: ["cdj", "dj_mixer"] }));
    expect(e.autoLevel).toBe(1);
    const v = await ops.eventView(o.id, e.id);
    const keys = v.requirements.map((r) => r.key);
    expect(keys).toContain("main_pa");
    expect(keys).not.toContain("led_screen");
    expect(keys).not.toContain("barricades");
    expect(v.requirements.find((r) => r.key === "cdj")?.status).toBe("covered");
    expect(v.me.role).toBe("owner");
    expect(v.budget!.rows.reduce((a, r) => a + r.estimate, 0)).toBe(3000);
    expect(v.readiness.safetyApproved).toBe(false);
  });

  it("2,000-person festival: level 5, safety-critical items with credentials, safety never auto-approved", async () => {
    const o = await user();
    const e = await ops.createEvent(o.id, base({ attendance: 2000, setting: "outdoor", templateId: "outdoor_festival", budgetUsd: 250_000, streaming: true, ticketing: true }));
    expect(e.autoLevel).toBe(5);
    const v = await ops.eventView(o.id, e.id);
    const get = (k: string) => v.requirements.find((r) => r.key === k);
    expect(get("security_staff")?.quantity).toBeGreaterThanOrEqual(20);
    expect(get("security_staff")?.credential).toBe("security_license");
    expect(get("medic")?.safetyCritical).toBe(true);
    expect(get("power_generator")).toBeTruthy();
    expect(get("weather_plan")).toBeTruthy();
    expect(v.safety.approved).toBe(false);
    // Safety items can't be marked not needed, and their quantity can't be lowered without a qualified person.
    expect(await code(ops.updateRequirement(o.id, e.id, get("medic")!.id, { notNeeded: true }))).toBe("SAFETY_ITEM_REQUIRED");
    expect(await code(ops.updateRequirement(o.id, e.id, get("security_staff")!.id, { quantity: 2 }))).toBe("EXPERT_CONFIRMATION_REQUIRED");
    const lowered = await ops.updateRequirement(o.id, e.id, get("security_staff")!.id, { quantity: get("security_staff")!.quantity - 2, expertName: "K. Somchai (licensed security planner)" });
    expect(lowered.expertConfirmation?.by).toContain("Somchai");
    // Override the size level, re-plan keeps the confirmed item.
    const e2 = await ops.updateEvent(o.id, e.id, { levelOverride: 4 }, e.version);
    expect(e2.levelOverride).toBe(4);
    expect((await ops.eventView(o.id, e.id)).requirements.find((r) => r.key === "security_staff")?.expertConfirmation).toBeTruthy();
    // Stale version is rejected (optimistic locking).
    expect(await status(ops.updateEvent(o.id, e.id, { name: "x" }, e.version))).toBe(409);
  });

  it("quote request to a sound company → quote → hire (confirm) → provider accepts → booking confirmed, member added", async () => {
    const o = await user();
    const e = await ops.createEvent(o.id, base({ attendance: 250, templateId: "club_night", budgetUsd: 20_000 }));
    const sound = await provider({ items: [{ key: "main_pa", quantity: 2, model: "Line array" }, { key: "sound_engineer", quantity: 2, model: "" }], priceUsd: 2500 });
    const v = await ops.eventView(o.id, e.id);
    const pa = v.requirements.find((r) => r.key === "main_pa")!;
    const c = await ops.candidates(o.id, e.id, pa.id);
    expect(c.eligible.some((m) => m.listing.id === sound.listing.id)).toBe(true);
    const q = await ops.createOpening(o.id, e.id, { kind: "quote", requirementIds: [pa.id], targetListingId: sound.listing.id, message: "Quote please" });
    const opp = await ops.opportunities(sound.id);
    expect(opp.find((x) => x.opening.id === q.id)).toBeTruthy();
    // Another provider can't answer a quote request addressed to someone else.
    const other = await provider({ items: [{ key: "main_pa", quantity: 1, model: "" }] });
    expect(await code(ops.apply(other.id, q.id, { listingId: other.listing.id, priceUsd: 10 }))).toBe("FORBIDDEN");
    const doc = await ops.uploadQuote(sound.id, q.id, { name: "quote.pdf", mime: "application/pdf", data: Buffer.from("%PDF-1.4 test") });
    const app = await ops.apply(sound.id, q.id, { listingId: sound.listing.id, priceUsd: 2400, message: "2 tops + engineer", quoteDocumentId: doc.id });
    expect(await code(ops.apply(sound.id, q.id, { listingId: sound.listing.id, priceUsd: 2300 }))).toBe("ALREADY_APPLIED");
    expect((await ops.eventView(o.id, e.id)).budget!.quoted).toBe(2400);
    expect(await code(ops.accept(o.id, e.id, app.id, { confirm: false }))).toBe("CONFIRMATION_REQUIRED");
    const { agreement, booking } = await ops.accept(o.id, e.id, app.id, { confirm: true });
    expect(booking.status).toBe("held");
    expect(agreement.status).toBe("proposed");
    const agreed = await ops.acceptAgreement(sound.id, agreement.id, { confirm: true, version: agreement.version });
    expect(agreed.status).toBe("agreed");
    expect(agreed.history.map((h) => h.action)).toEqual(["proposed", "accepted"]);
    const v2 = await ops.eventView(o.id, e.id);
    expect(v2.bookings[0].status).toBe("confirmed");
    expect(v2.members.find((m) => m.userId === sound.id)?.role).toBe("vendor");
    expect(v2.requirements.find((r) => r.id === pa.id)?.status).toBe("booked");
    expect(v2.budget!.contracted).toBe(2400);
    // The quote file is visible to the organizer, not to the general team.
    expect((await ops.readDocument(o.id, doc.id)).meta.kind).toBe("quote");
    // Payment is a record, needs confirmation and can't exceed the agreement.
    expect(await code(ops.recordPayment(o.id, e.id, { agreementId: agreement.id, amountUsd: 100, confirm: false }))).toBe("CONFIRMATION_REQUIRED");
    expect(await code(ops.recordPayment(o.id, e.id, { agreementId: agreement.id, amountUsd: 5000, confirm: true }))).toBe("AMOUNT_EXCEEDS_AGREEMENT");
    await ops.recordPayment(o.id, e.id, { agreementId: agreement.id, amountUsd: 1000, confirm: true });
    expect((await ops.eventView(o.id, e.id)).budget!.paid).toBe(1000);
    // Change → needs the other side again; history is kept.
    const changed = await ops.changeAgreement(sound.id, agreement.id, { terms: { amountUsd: 2600 }, version: agreed.version });
    expect(changed.status).toBe("changed");
    expect(await status(ops.changeAgreement(sound.id, agreement.id, { terms: { amountUsd: 1 }, version: agreed.version }))).toBe(409);
    const re = await ops.acceptAgreement(o.id, agreement.id, { confirm: true, version: changed.version });
    expect(re.status).toBe("agreed");
    expect(re.history.length).toBe(4);
  });

  it("DJ applies to an open call; organizer compares and hires one; the other is rejected", async () => {
    const o = await user();
    const e = await ops.createEvent(o.id, base({ attendance: 120, templateId: "club_night" }));
    const dj = (await ops.eventView(o.id, e.id)).requirements.find((r) => r.key === "dj_performer")!;
    const call = await ops.createOpening(o.id, e.id, { kind: "open", requirementIds: [dj.id], slots: 1, budgetUsd: 800 });
    const a = await provider({ type: "person", items: [{ key: "dj_performer", quantity: 1, model: "Techno" }], priceUsd: 600 });
    const b = await provider({ type: "person", items: [{ key: "dj_performer", quantity: 1, model: "House" }], priceUsd: 700 });
    const wrong = await provider({ items: [{ key: "main_pa", quantity: 1, model: "" }] });
    expect(await code(ops.apply(wrong.id, call.id, { listingId: wrong.listing.id, priceUsd: 1 }))).toBe("LISTING_DOES_NOT_PROVIDE");
    expect(await code(ops.apply(o.id, call.id, { listingId: a.listing.id, priceUsd: 1 }))).toBe("OWN_EVENT");
    const appA = await ops.apply(a.id, call.id, { listingId: a.listing.id, priceUsd: 600, portfolio: "mixes", message: "2h set" });
    const appB = await ops.apply(b.id, call.id, { listingId: b.listing.id, priceUsd: 700 });
    // An applicant sees only their own application, not the competitor's price.
    expect(await status(ops.eventView(a.id, e.id))).toBe(404);
    const v = await ops.eventView(o.id, e.id);
    expect(v.applications.map((x) => x.id).sort()).toEqual([appA.id, appB.id].sort());
    await ops.setApplicationStatus(o.id, e.id, appB.id, "rejected");
    await ops.accept(o.id, e.id, appA.id, { confirm: true });
    expect((await ops.opportunities(b.id)).find((x) => x.opening.id === call.id)).toBeUndefined(); // filled
    expect((await ops.notifications(b.id)).some((x) => x.key === "notif.applicationRejected")).toBe(true);
  });

  it("equipment rental booking + double-booking prevention across two events (incl. concurrency)", async () => {
    const o1 = await user();
    const o2 = await user();
    const gear = await provider({ type: "equipment", items: [{ key: "cdj", quantity: 2, model: "CDJ-3000" }, { key: "dj_mixer", quantity: 1, model: "DJM-A9" }], priceUsd: 260 });
    const e1 = await ops.createEvent(o1.id, base());
    const e2 = await ops.createEvent(o2.id, base({ startAt: at(40, 22), endAt: at(40, 30) })); // overlaps e1
    const hire = async (o: { id: string }, eid: string) => {
      const cdj = (await ops.eventView(o.id, eid)).requirements.find((r) => r.key === "cdj")!;
      const op = await ops.createOpening(o.id, eid, { kind: "direct", requirementIds: [cdj.id], targetListingId: gear.listing.id });
      const app = await ops.apply(gear.id, op.id, { listingId: gear.listing.id, priceUsd: 260 });
      return () => ops.accept(o.id, eid, app.id, { confirm: true });
    };
    const h1 = await hire(o1, e1.id);
    const h2 = await hire(o2, e2.id);
    // Both organizers press "hire" at the same moment: exactly one booking succeeds.
    const res = await Promise.all([code(h1()), code(h2())]);
    expect(res.filter((r) => r === "OK").length).toBe(1);
    expect(res.filter((r) => r === "BOOKING_CONFLICT").length).toBe(1);
    // A third event later that week doesn't overlap and can book.
    const o3 = await user();
    const e3 = await ops.createEvent(o3.id, base({ startAt: at(45), endAt: at(45, 26) }));
    expect(await code((await hire(o3, e3.id))())).toBe("OK");
  });

  it("staff shortage + cancellation: key-role warning, incident, replacements exclude unverified and the cancelled provider", async () => {
    const o = await user();
    const e = await ops.createEvent(o.id, base({ attendance: 800, templateId: "warehouse_rave", startAt: at(6), endAt: at(6, 30), budgetUsd: 60_000 }));
    let v = await ops.eventView(o.id, e.id);
    expect(v.conflicts.some((c) => c.kind === "key_role_missing" && c.values.role === "security_staff")).toBe(true);
    const sec = v.requirements.find((r) => r.key === "security_staff")!;
    const admin = await user();
    process.env.OPS_ADMIN_EMAILS = admin.email;
    const licensed = await provider({ items: [{ key: "security_staff", quantity: 40, model: "" }], priceUsd: 3000 });
    await ops.saveWorkProfile(licensed.id, { credentials: ["security_license"] });
    expect((await ops.getWorkProfile(licensed.id))!.credentials[0].status).toBe("pending"); // self-declared ≠ verified
    expect(await code(ops.verifyCredential(o.id, licensed.id, "security_license", "verified"))).toBe("FORBIDDEN");
    await ops.verifyCredential(admin.id, licensed.id, "security_license", "verified");
    const backup = await provider({ items: [{ key: "security_staff", quantity: 40, model: "" }], priceUsd: 3500 });
    await ops.saveWorkProfile(backup.id, { credentials: ["security_license"] });
    await ops.verifyCredential(admin.id, backup.id, "security_license", "verified");
    const unlicensed = await provider({ items: [{ key: "security_staff", quantity: 40, model: "" }], priceUsd: 900 });
    const c = await ops.candidates(o.id, e.id, sec.id);
    expect(c.eligible.map((m) => m.listing.id)).not.toContain(unlicensed.listing.id); // cheapest, but excluded
    expect(c.excluded.find((m) => m.listing.id === unlicensed.listing.id)?.excluded).toContain("credential_unverified");
    const op = await ops.createOpening(o.id, e.id, { kind: "direct", requirementIds: [sec.id], targetListingId: licensed.listing.id });
    const app = await ops.apply(licensed.id, op.id, { listingId: licensed.listing.id, priceUsd: 3000 });
    const { agreement } = await ops.accept(o.id, e.id, app.id, { confirm: true });
    const ag = await ops.acceptAgreement(licensed.id, agreement.id, { confirm: true, version: agreement.version });
    // The provider cancels → incident + replacement suggestions; nobody is contacted automatically.
    await ops.cancelAgreement(licensed.id, agreement.id, { confirm: true, version: ag.version, reason: "Team unavailable" });
    v = await ops.eventView(o.id, e.id);
    const inc = v.incidents.find((i) => i.type === "cancellation")!;
    expect(inc).toBeTruthy();
    const openingsBefore = v.openings.length;
    const rep = await ops.replacements(o.id, e.id, inc.id);
    // (Listings from earlier runs may exist in a persistent test database: look only at this test's providers.)
    const ours = new Set([licensed.listing.id, backup.listing.id, unlicensed.listing.id]);
    expect(rep.eligible.filter((m) => ours.has(m.listing.id)).map((m) => m.listing.id)).toEqual([backup.listing.id]);
    expect(rep.eligible.some((m) => m.listing.ownerId === licensed.id)).toBe(false);
    expect((await ops.eventView(o.id, e.id)).openings.length).toBe(openingsBefore);
    // Staff can report a shortage; only managers see replacements.
    await ops.inviteMember(o.id, e.id, { email: (await user()).email, role: "staff", area: "operations" });
    const staff = (await ops.eventView(o.id, e.id)).members.find((m) => m.role === "staff")!;
    const short = await ops.reportIncident(staff.userId, e.id, { type: "staff_shortage", severity: "high", description: "2 guards missing", requirementId: sec.id });
    expect(await code(ops.replacements(staff.userId, e.id, short.id))).toBe("FORBIDDEN");
    // Staff see which items an incident can point at (names only), and references must belong to this event.
    const sv = await ops.eventView(staff.userId, e.id);
    expect(sv.incidentTargets.some((r) => r.id === sec.id)).toBe(true);
    expect(Object.keys(sv.incidentTargets[0]).sort()).toEqual(["id", "key"]);
    const other = await ops.createEvent(o.id, base({ attendance: 150, templateId: "club_night", name: "Other night" }));
    const otherReq = (await ops.eventView(o.id, other.id)).requirements[0];
    expect(await code(ops.reportIncident(staff.userId, e.id, { type: "other", severity: "low", description: "x", requirementId: otherReq.id }))).toBe("UNKNOWN_REFERENCE");
    expect((await ops.notifications(o.id)).some((x) => x.key === "notif.incident")).toBe(true);
  });

  it("budget overrun: over-estimate category flagged, cheaper alternatives offered, safety never dropped", async () => {
    const o = await user();
    const e = await ops.createEvent(o.id, base({ attendance: 250, templateId: "club_night", budgetUsd: 10_000 }));
    const v = await ops.eventView(o.id, e.id);
    const pa = v.requirements.find((r) => r.key === "main_pa")!;
    const pricey = await provider({ items: [{ key: "main_pa", quantity: 1, model: "" }], priceUsd: 6000 });
    await provider({ items: [{ key: "main_pa", quantity: 1, model: "" }], priceUsd: 1200 });
    const op = await ops.createOpening(o.id, e.id, { kind: "direct", requirementIds: [pa.id], targetListingId: pricey.listing.id });
    await ops.apply(pricey.id, op.id, { listingId: pricey.listing.id, priceUsd: 6000 });
    const b = (await ops.eventView(o.id, e.id)).budget!;
    const sound = b.rows.find((r) => r.category === "sound")!;
    expect(sound.overPct).toBeGreaterThan(0);
    const alt = await ops.budgetAlternatives(o.id, e.id, "sound");
    const forPa = alt.find((x) => x.requirement.id === pa.id)!;
    expect(forPa.currentPrice).toBe(6000);
    expect(forPa.alternatives.length).toBeGreaterThan(0);
    expect(forPa.alternatives.every((m) => m.listing.priceUsd < 6000)).toBe(true);
    expect(b.rows.find((r) => r.category === "safety_permits")!.estimate).toBeGreaterThan(0);
  });

  it("permissions: non-members get 404, staff can't read money or decide, unverified accounts can't create", async () => {
    const o = await user();
    const e = await ops.createEvent(o.id, base({ attendance: 300, templateId: "club_night" }));
    const stranger = await user();
    expect(await status(ops.eventView(stranger.id, e.id))).toBe(404);
    expect(await status(ops.messages(stranger.id, e.id, "general"))).toBe(404);
    const unverified = await user(false);
    expect(await code(ops.createEvent(unverified.id, base()))).toBe("EMAIL_NOT_VERIFIED");
    const s = await user();
    expect((await ops.inviteMember(o.id, e.id, { email: s.email, role: "staff", area: "sound" })).invited).toBe(true);
    expect((await ops.inviteMember(o.id, e.id, { email: "nobody@example.test", role: "staff", area: "sound" })).invited).toBe(false);
    const sv = await ops.eventView(s.id, e.id);
    expect(sv.budget).toBeNull();
    expect(sv.event.budgetUsd).toBeNull();
    expect(sv.threads).toEqual(["general", "sound"]);
    expect(await code(ops.messages(s.id, e.id, "safety"))).toBe("FORBIDDEN");
    expect(await code(ops.createOpening(s.id, e.id, { kind: "open", requirementIds: [sv.requirements[0]?.id ?? "x"] }))).toBe("FORBIDDEN");
    expect(await code(ops.approveSafety(s.id, e.id, "permits_insurance", { approve: true, reference: "x", confirm: true }))).toBe("FORBIDDEN");
    expect(await code(ops.inviteMember(s.id, e.id, { email: stranger.email, role: "manager", area: "general" }))).toBe("FORBIDDEN");
    // A manager can't promote someone to manager (owner only), and nobody can add a second owner.
    const m = await user();
    await ops.inviteMember(o.id, e.id, { email: m.email, role: "manager", area: "general" });
    expect(await code(ops.inviteMember(m.id, e.id, { email: stranger.email, role: "manager", area: "general" }))).toBe("FORBIDDEN");
    expect(await code(ops.inviteMember(o.id, e.id, { email: stranger.email, role: "owner", area: "general" }))).toBe("FORBIDDEN");
    // Chat, tasks and documents respect areas and audiences.
    await ops.postMessage(s.id, e.id, "sound", "PA arriving 14:00");
    expect((await ops.messages(o.id, e.id, "sound"))[0].body).toBe("PA arriving 14:00");
    const doc = await ops.uploadDocument(o.id, e.id, { name: "contract.pdf", kind: "contract", audience: "team", mime: "application/pdf", data: Buffer.from("%PDF") });
    expect(doc.audience).toBe("managers"); // contracts never default to the whole team
    expect(await status(ops.readDocument(s.id, doc.id))).toBe(404);
    expect(await code(ops.uploadDocument(o.id, e.id, { name: "x.html", kind: "other", audience: "team", mime: "text/html", data: Buffer.from("<script>") }))).toBe("FILE_TYPE");
    const task = (await ops.eventView(o.id, e.id)).tasks.find((t) => t.area === "lighting");
    if (task) expect(await code(ops.saveTask(s.id, e.id, { id: task.id, status: "done" }))).toBe("FORBIDDEN");
    // Safety approval needs confirm + a reference; auto checks can't be approved by hand.
    expect(await code(ops.approveSafety(o.id, e.id, "permits_insurance", { approve: true, reference: "", confirm: true }))).toBe("REFERENCE_REQUIRED");
    expect(await code(ops.approveSafety(o.id, e.id, "contracts_complete", { approve: true, reference: "x", confirm: true }))).toBe("AUTO_CHECK");
    const ok = await ops.approveSafety(o.id, e.id, "permits_insurance", { approve: true, reference: "City permit #A-1", confirm: true });
    expect(ok.status).toBe("approved");
  });

  it("schedule conflicts, team reuse, reviews only after real work, notifications deduplicated", async () => {
    const o = await user();
    const past = await ops.createEvent(o.id, base({ startAt: at(30), endAt: at(30, 26) }));
    const dj = await provider({ type: "person", items: [{ key: "dj_performer", quantity: 1, model: "" }], priceUsd: 500 });
    const req = (await ops.eventView(o.id, past.id)).requirements.find((r) => r.key === "dj_performer")!;
    const op = await ops.createOpening(o.id, past.id, { kind: "direct", requirementIds: [req.id], targetListingId: dj.listing.id });
    const app = await ops.apply(dj.id, op.id, { listingId: dj.listing.id, priceUsd: 500 });
    const { agreement } = await ops.accept(o.id, past.id, app.id, { confirm: true });
    expect(await code(ops.review(o.id, agreement.id, { scores: { punctuality: 5, communication: 5, delivery: 5, quality: 5, overall: 5 } }))).toBe("NOT_FINISHED");
    const ag = await ops.acceptAgreement(dj.id, agreement.id, { confirm: true, version: agreement.version });
    await ops.completeAgreement(o.id, agreement.id, { version: ag.version });
    await ops.review(o.id, agreement.id, { scores: { punctuality: 5, communication: 4, delivery: 5, quality: 5, overall: 5 } });
    expect(await code(ops.review(o.id, agreement.id, { scores: { punctuality: 5, communication: 4, delivery: 5, quality: 5, overall: 5 } }))).toBe("ALREADY_REVIEWED");
    const stranger = await user();
    expect(await status(ops.review(stranger.id, agreement.id, { scores: { punctuality: 1, communication: 1, delivery: 1, quality: 1, overall: 1 } }))).toBe(404);
    expect((await ops.providerTrust(dj.id)).reviews.overall).toBe(5);

    // Overlapping DJ sets and a late load-in are flagged.
    const next = await ops.createEvent(o.id, base({ startAt: at(50), endAt: at(50, 28) }));
    await ops.saveScheduleItem(o.id, next.id, { kind: "set", startAt: at(50, 22), endAt: at(50, 24) });
    await ops.saveScheduleItem(o.id, next.id, { kind: "set", startAt: at(50, 23), endAt: at(50, 25) });
    const sched = (await ops.eventView(o.id, next.id)).schedule;
    const loadIn = sched.find((s) => s.kind === "load_in")!;
    await ops.saveScheduleItem(o.id, next.id, { id: loadIn.id, kind: "load_in", startAt: at(50, 19), endAt: at(50, 21) });
    const kinds = (await ops.eventView(o.id, next.id)).conflicts.map((c) => c.kind);
    expect(kinds).toContain("dj_set_overlap");
    expect(kinds).toContain("load_in_late");

    // Team reuse sends quote requests (not bookings) to last time's providers.
    const reused = await ops.reuseTeam(o.id, past.id, next.id);
    expect(reused.length).toBe(1);
    expect(reused[0].kind).toBe("quote");
    expect((await ops.eventView(o.id, next.id)).bookings.length).toBe(0);

    // Same dedupe key → one notification.
    const before = (await ops.notifications(dj.id)).length;
    await ops.createOpening(o.id, next.id, { kind: "quote", requirementIds: reused[0].requirementIds, targetListingId: dj.listing.id });
    expect((await ops.notifications(dj.id)).length).toBe(before + 1);
    const store = (await import("@/lib/ops/store")).getOpsStore();
    const dup = { id: crypto.randomUUID(), userId: dj.id, eventId: null, key: "x", values: {}, dedupeKey: `dup-${RUN}`, read: false, at: new Date().toISOString() };
    expect(await store.notifyOnce(dup)).toBe(true);
    expect(await store.notifyOnce({ ...dup, id: crypto.randomUUID() })).toBe(false);
  });

  it(`demo providers exist only on the memory store (${name})`, async () => {
    const o = await user();
    const e = await ops.createEvent(o.id, base({ attendance: 2000, templateId: "outdoor_festival", setting: "outdoor", budgetUsd: 250_000 }));
    const sec = (await ops.eventView(o.id, e.id)).requirements.find((r: Requirement) => r.key === "security_staff")!;
    const c = await ops.candidates(o.id, e.id, sec.id);
    const demo = [...c.eligible, ...c.excluded].filter((m) => m.listing.demo);
    if (name === "memory") {
      expect(demo.length).toBeGreaterThan(0);
      expect(c.excluded.some((m) => m.listing.demo && m.excluded.includes("credential_unverified"))).toBe(true);
    } else expect(demo.length).toBe(0);
  });
});
