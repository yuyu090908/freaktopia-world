import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { demoOutboxFor } from "@/lib/auth/mail";
import { memoryStore, resetMemoryStore } from "@/lib/auth/memory";
import { createPgStore } from "@/lib/auth/pg";
import { setStore, getStore } from "@/lib/auth/store";
import { AuthError, type AuthStore } from "@/lib/auth/types";
import { confirmReset, ensureAlien, requestReset, signIn, signInWithProvider, signUp, userForSessionToken, verifyEmail, endSession, type Ctx } from "@/lib/auth/service";
import { me } from "@/lib/auth/me";

const ctx: Ctx = { ip: "10.0.0.1", baseUrl: "http://localhost:3000", locale: "en" };
let n = 0;
// Unique per run: the Postgres database keeps rows between runs.
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const email = () => `alien${Date.now()}-${++n}@example.test`;
const PW = "a long party sentence";
const linkToken = (to: string, kind: "verify" | "reset") => {
  const m = demoOutboxFor(to).find((x) => x.link?.includes(`${kind === "verify" ? "/verify-email" : "/forgot-password"}?token=`));
  return m ? new URL(m.link!).searchParams.get("token")! : null;
};
const code = async (p: Promise<unknown>) => p.then(() => "OK", (e) => (e instanceof AuthError ? e.code : String(e)));

async function verified(addr = email()) {
  await signUp(addr, PW, ctx);
  return verifyEmail(linkToken(addr, "verify")!, ctx);
}

// The suite runs on the in-memory store, and again on Postgres when TEST_DATABASE_URL points at a database with
// db/migrations/0005_identity_i18n.sql and 0006_identity_onboarding.sql applied.
const stores: [string, () => AuthStore][] = [["memory", () => memoryStore]];
if (process.env.TEST_DATABASE_URL) stores.push(["postgres", () => createPgStore(process.env.TEST_DATABASE_URL!)]);

describe.each(stores)("auth service on %s store", (_name, make) => {
  beforeAll(() => setStore(make()));
  afterAll(() => setStore(undefined));
  beforeEach(() => resetMemoryStore());

  it("email sign-up → verify link → session → exactly one alien", async () => {
    const addr = email();
    await signUp(addr, PW, ctx);
    const u = await getStore().findUserByEmail(addr);
    expect(u?.emailVerified).toBe(false);
    expect(u?.passwordHash).toMatch(/^scrypt\$/);
    expect(await getStore().getAlien(u!.id)).toBeNull(); // no alien before verification
    expect(await code(signIn(addr, PW, ctx))).toBe("EMAIL_NOT_VERIFIED");

    const token = linkToken(addr, "verify")!;
    const v = await verifyEmail(token, ctx);
    expect(v.alienCreated).toBe(true);
    expect((await userForSessionToken(v.session.token))?.id).toBe(u!.id);
    expect(await code(verifyEmail(token, ctx))).toBe("TOKEN_INVALID"); // single use
  });

  it("re-login keeps the same alien and never generates a second one", async () => {
    const addr = email();
    const v = await verified(addr);
    const first = await getStore().getAlien(v.userId);
    for (let i = 0; i < 3; i++) await signIn(addr, PW, ctx);
    const again = await Promise.all(Array.from({ length: 8 }, () => ensureAlien(v.userId, ctx)));
    expect(again.every((r) => !r.created && r.alien.seed === first!.seed)).toBe(true);
    expect((await getStore().getAlien(v.userId))?.seed).toBe(first!.seed);
  });

  it("does not reveal whether an email is registered (sign-up and reset answer the same)", async () => {
    const addr = email();
    await verified(addr);
    await expect(signUp(addr, PW, ctx)).resolves.toBeUndefined();
    expect(demoOutboxFor(addr)[0].subject).toMatch(/already have/);
    const nobody = email();
    await expect(requestReset(nobody, ctx)).resolves.toBeUndefined();
    expect(demoOutboxFor(nobody)[0].link).toContain("/signup");
    expect(await code(signIn(nobody, PW, ctx))).toBe("INVALID_CREDENTIALS");
    expect(await code(signIn(addr, "wrong password!!", ctx))).toBe("INVALID_CREDENTIALS");
  });

  it("password reset: single-use link, new password works, every session signed out", async () => {
    const addr = email();
    const v = await verified(addr);
    const s2 = (await signIn(addr, PW, ctx)).session;
    await requestReset(addr, ctx);
    const t = linkToken(addr, "reset")!;
    await confirmReset(t, "a brand new sentence", ctx);
    expect(await userForSessionToken(v.session.token)).toBeNull();
    expect(await userForSessionToken(s2.token)).toBeNull();
    expect(await code(confirmReset(t, "another new sentence", ctx))).toBe("TOKEN_INVALID");
    expect(await code(signIn(addr, PW, ctx))).toBe("INVALID_CREDENTIALS");
    expect(await code(signIn(addr, "a brand new sentence", ctx))).toBe("OK");
    expect((await getStore().getAlien(v.userId))?.seed).toBeDefined();
  });

  it("logout ends only that session", async () => {
    const addr = email();
    const v = await verified(addr);
    const other = (await signIn(addr, PW, ctx)).session;
    await endSession(v.session.token, ctx);
    expect(await userForSessionToken(v.session.token)).toBeNull();
    expect((await userForSessionToken(other.token))?.id).toBe(v.userId);
  });

  it("Google: replayed callbacks find the same user and alien; links to an existing verified account", async () => {
    const addr = email();
    const sub = `g-${RUN}-${n}`;
    const [a, b] = await Promise.all([signInWithProvider("google", sub, addr, true, ctx), signInWithProvider("google", sub, addr, true, ctx)]);
    expect(a.userId).toBe(b.userId);
    expect([a.alienCreated, b.alienCreated].filter(Boolean).length).toBeLessThanOrEqual(1);
    const c = await signInWithProvider("google", sub, addr, true, ctx);
    expect(c.userId).toBe(a.userId);
    expect(c.alienCreated).toBe(false);

    const existing = email();
    const v = await verified(existing);
    const linked = await signInWithProvider("google", `${sub}-2`, existing, true, ctx);
    expect(linked.userId).toBe(v.userId);
    expect(await getStore().providersOf(v.userId)).toEqual(["google"]);
    expect(await code(signInWithProvider("google", `${sub}-3`, email(), false, ctx))).toBe("PROVIDER_EMAIL_UNVERIFIED");
  });

  it("Google on an unverified pre-registered address drops the squatter's password and sessions", async () => {
    const addr = email();
    await signUp(addr, PW, ctx);
    const squat = await getStore().findUserByEmail(addr);
    const g = await signInWithProvider("google", `g-squat-${RUN}-${n}`, addr, true, ctx);
    expect(g.userId).toBe(squat!.id);
    expect((await getStore().findUserById(g.userId))?.passwordHash).toBeNull();
    expect(await code(signIn(addr, PW, ctx))).toBe("INVALID_CREDENTIALS");
  });

  it("wallet linking attaches to the existing account and refuses another account's wallet", async () => {
    const a = await verified();
    const b = await verified();
    const addr = "0x" + (RUN + "0".repeat(40)).replace(/[^0-9a-f]/g, "a").slice(0, 40);
    await getStore().linkWallet(a.userId, addr, 1);
    await getStore().linkWallet(a.userId, addr, 1); // idempotent
    expect(await code(getStore().linkWallet(b.userId, addr, 1))).toBe("WALLET_TAKEN");
    expect((await getStore().walletsOf(a.userId)).length).toBe(1);
  });

  it("privacy defaults are minimal and /me never exposes the alien seed", async () => {
    const v = await verified();
    const p = await getStore().getPrivacy(v.userId);
    expect(p).toMatchObject({ profile: "friends", activity: "private", showCountry: false, mapPresence: false });
    const m = await me(v.userId);
    expect(JSON.stringify(m)).not.toContain((await getStore().getAlien(v.userId))!.seed);
  });

  it("the alien's base traits are permanent: only cosmetics change", async () => {
    const v = await verified();
    const before = (await getStore().getAlien(v.userId))!;
    const after = await getStore().updateAlienCosmetics(v.userId, { outfit: "kimono", accessory: "halo" });
    expect(after.outfit).toBe("kimono");
    expect({ ...after, outfit: before.outfit, accessory: before.accessory, outfitColor: before.outfitColor, updatedAt: undefined }).toMatchObject({ ...before, updatedAt: undefined });
  });

  it("8.1: every alien gets a unique public Alien ID in the FREAK-00001284 format", async () => {
    const a = (await getStore().getAlien((await verified()).userId))!;
    const b = (await getStore().getAlien((await verified()).userId))!;
    expect(a.publicId).toMatch(/^FREAK-\d{8}$/);
    expect(b.publicId).toMatch(/^FREAK-\d{8}$/);
    expect(a.publicId).not.toBe(b.publicId);
    const m = await me(a.userId);
    expect(m?.alien?.publicId).toBe(a.publicId);
  });

  it("8.1: concurrent first-time generation creates exactly one alien", async () => {
    const addr = email();
    await signUp(addr, PW, ctx);
    const u = (await getStore().findUserByEmail(addr))!;
    const runs = await Promise.all(Array.from({ length: 10 }, () => ensureAlien(u.id, ctx)));
    expect(runs.filter((r) => r.created).length).toBe(1);
    expect(new Set(runs.map((r) => r.alien.publicId)).size).toBe(1);
    expect(new Set(runs.map((r) => r.alien.seed)).size).toBe(1);
  });

  it("8.1: onboarding resumes at the saved step and never goes back to the Reveal", async () => {
    const v = await verified();
    expect((await getStore().getProfile(v.userId))?.onboardingStep).toBe("reveal");
    await getStore().updateProfile(v.userId, { onboardingStep: "name" });
    expect((await getStore().getProfile(v.userId))).toMatchObject({ onboardingStep: "name", revealSeen: true });
    await getStore().updateProfile(v.userId, { onboardingStep: "genres", displayName: "Disco Comet" });
    await getStore().updateProfile(v.userId, { onboardingStep: "reveal" }); // a stale tab
    expect((await getStore().getProfile(v.userId))).toMatchObject({ onboardingStep: "genres", revealSeen: true, displayName: "Disco Comet" });
    await getStore().updateProfile(v.userId, { onboardingStep: "done", favoriteGenres: ["Techno"] });
    expect((await me(v.userId))?.profile).toMatchObject({ onboardingStep: "done", favoriteGenres: ["Techno"], displayName: "Disco Comet" });
  });

  it("writes an audit log without secrets", async () => {
    await verified();
    const log = await getStore().recentAudit(20);
    expect(log.some((e) => e.event === "alien.created")).toBe(true);
    expect(JSON.stringify(log)).not.toContain(PW);
  });
});
