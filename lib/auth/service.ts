import { z } from "zod";
import type { Locale } from "@/i18n/config";
import { rollAlien } from "@/lib/alien/generate";
import type { AlienIdentity } from "@/lib/alien/catalog";
import { RESET_TTL_MS, SESSION_TTL_MS, VERIFY_TTL_MS } from "./config";
import { hashPassword, randomToken, sha256hex, verifyPassword } from "./crypto";
import { sendMail } from "./mail";
import { getStore } from "./store";
import { AuthError, type UserRecord } from "./types";

export const zEmail = z.string().trim().toLowerCase().max(254).email();
/** 10–128 characters, not one repeated character, not a well-known password. */
export const zPassword = z
  .string()
  .min(10, "PASSWORD_SHORT")
  .max(128, "PASSWORD_LONG")
  .refine((p) => new Set(p).size > 3 && !COMMON.has(p.toLowerCase()), "PASSWORD_WEAK");
const COMMON = new Set(["password123", "1234567890", "qwertyuiop", "password1234", "iloveyou12", "freaktopia", "freaktopia1", "letmein123", "0123456789", "abcdefghij"]);

export interface Ctx {
  ip: string | null;
  baseUrl: string;
  locale: Locale;
}

const audit = (event: string, userId: string | null, ctx: Ctx, meta: Record<string, unknown> = {}) =>
  getStore().audit({ event, userId, ip: ctx.ip, meta }).catch(() => undefined);

async function issueToken(kind: "verify" | "reset", userId: string) {
  const token = randomToken();
  await getStore().invalidateTokens(kind, userId);
  await getStore().createToken(kind, userId, sha256hex(token), new Date(Date.now() + (kind === "verify" ? VERIFY_TTL_MS : RESET_TTL_MS)));
  return token;
}

export async function createSession(userId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await getStore().createSession(userId, sha256hex(token), expiresAt);
  return { token, expiresAt };
}

export async function userForSessionToken(token: string | undefined | null): Promise<UserRecord | null> {
  if (!token || token.length > 100) return null;
  const s = await getStore().getSession(sha256hex(token));
  return s ? getStore().findUserById(s.userId) : null;
}

export async function endSession(token: string | undefined | null, ctx: Ctx) {
  if (!token) return;
  const h = sha256hex(token);
  const s = await getStore().getSession(h);
  await getStore().deleteSession(h);
  if (s) await audit("logout", s.userId, ctx);
}

/**
 * Email sign-up. The answer is the same whether or not the address is already registered
 * (no account enumeration); the owner of an existing address gets a "you already have an account" email instead.
 */
export async function signUp(email: string, password: string, ctx: Ctx) {
  const store = getStore();
  const existing = await store.findUserByEmail(email);
  if (existing) {
    await sendMail(email, "signupExisting", ctx.locale, `${ctx.baseUrl}/auth/signin`);
    await audit("signup.existing", existing.id, ctx);
    return;
  }
  const passwordHash = await hashPassword(password);
  let user: UserRecord;
  try {
    user = await store.createUser({ email, passwordHash, emailVerified: false, locale: ctx.locale });
  } catch (e) {
    if (e instanceof AuthError && e.code === "EMAIL_TAKEN") return; // raced with another sign-up: same answer
    throw e;
  }
  const token = await issueToken("verify", user.id);
  const delivery = await sendMail(email, "verify", ctx.locale, `${ctx.baseUrl}/auth/verify?token=${token}`);
  await audit("signup", user.id, ctx, { delivery });
}

export async function resendVerification(email: string, ctx: Ctx) {
  const u = await getStore().findUserByEmail(email);
  if (!u || u.emailVerified) return; // same answer either way
  const token = await issueToken("verify", u.id);
  await sendMail(email, "verify", ctx.locale, `${ctx.baseUrl}/auth/verify?token=${token}`);
  await audit("verify.resend", u.id, ctx);
}

/** Consumes a verification link: verifies the email, creates the alien, starts a session. */
export async function verifyEmail(token: string, ctx: Ctx) {
  const userId = await getStore().consumeToken("verify", sha256hex(token));
  if (!userId) {
    await audit("verify.fail", null, ctx);
    throw new AuthError("TOKEN_INVALID");
  }
  await getStore().setEmailVerified(userId);
  const { created } = await ensureAlien(userId, ctx);
  await audit("verify.ok", userId, ctx);
  return { userId, session: await createSession(userId), alienCreated: created };
}

export async function signIn(email: string, password: string, ctx: Ctx) {
  const u = await getStore().findUserByEmail(email);
  const ok = await verifyPassword(password, u?.passwordHash ?? null);
  if (!u || !ok) {
    await audit("login.fail", u?.id ?? null, ctx);
    throw new AuthError("INVALID_CREDENTIALS");
  }
  if (!u.emailVerified) {
    await audit("login.unverified", u.id, ctx);
    throw new AuthError("EMAIL_NOT_VERIFIED");
  }
  await ensureAlien(u.id, ctx);
  await audit("login.ok", u.id, ctx);
  return { userId: u.id, session: await createSession(u.id) };
}

export async function requestReset(email: string, ctx: Ctx) {
  const u = await getStore().findUserByEmail(email);
  if (!u) {
    await sendMail(email, "resetNoAccount", ctx.locale, `${ctx.baseUrl}/auth/signup`);
    await audit("reset.request.unknown", null, ctx);
    return;
  }
  const token = await issueToken("reset", u.id);
  await sendMail(email, "reset", ctx.locale, `${ctx.baseUrl}/auth/reset?token=${token}`);
  await audit("reset.request", u.id, ctx);
}

/** Sets a new password from a single-use, 30-minute link. Signs out every session of the account. */
export async function confirmReset(token: string, password: string, ctx: Ctx) {
  const userId = await getStore().consumeToken("reset", sha256hex(token));
  if (!userId) {
    await audit("reset.fail", null, ctx);
    throw new AuthError("TOKEN_INVALID");
  }
  await getStore().setPassword(userId, await hashPassword(password));
  await getStore().setEmailVerified(userId); // the link proves the address
  await getStore().deleteUserSessions(userId);
  await getStore().invalidateTokens("reset", userId);
  await audit("reset.ok", userId, ctx);
  return { userId };
}

/**
 * Google (or the demo simulator) sign-in. Idempotent: a replayed callback or a second login finds the same user.
 * An existing account with the same, provider-verified email is linked instead of duplicated. If that account was
 * never verified, its password and sessions are dropped first, so a squatter who pre-registered the address loses access.
 */
export async function signInWithProvider(provider: "google", subject: string, email: string | null, emailVerified: boolean, ctx: Ctx) {
  const store = getStore();
  for (let attempt = 0; attempt < 3; attempt++) {
    let user = await store.findUserByProvider(provider, subject);
    if (!user) {
      if (!email || !emailVerified) throw new AuthError("PROVIDER_EMAIL_UNVERIFIED");
      const existing = await store.findUserByEmail(email);
      try {
        if (existing) {
          if (!existing.emailVerified) {
            await store.setPassword(existing.id, null);
            await store.deleteUserSessions(existing.id);
            await store.setEmailVerified(existing.id);
          }
          await store.linkProvider(existing.id, provider, subject, email);
          await audit(`${provider}.link`, existing.id, ctx);
          user = existing;
        } else {
          const created = await store.createUser({ email, passwordHash: null, emailVerified: true, locale: ctx.locale });
          await store.linkProvider(created.id, provider, subject, email);
          await audit(`${provider}.signup`, created.id, ctx);
          user = created;
        }
      } catch (e) {
        // A concurrent callback created/linked first: start over and find it.
        if (e instanceof AuthError && (e.code === "EMAIL_TAKEN" || e.code === "PROVIDER_TAKEN")) continue;
        throw e;
      }
    }
    const { created } = await ensureAlien(user.id, ctx);
    await audit(`${provider}.login`, user.id, ctx);
    return { userId: user.id, session: await createSession(user.id), alienCreated: created };
  }
  throw new AuthError("PROVIDER_RACE");
}

/** Exactly one alien per verified user. Safe to call on every login, from any device, any number of times. */
export async function ensureAlien(userId: string, ctx: Ctx): Promise<{ alien: AlienIdentity; created: boolean }> {
  const store = getStore();
  const cur = await store.getAlien(userId);
  if (cur) return { alien: cur, created: false };
  const res = await store.insertAlienOnce(userId, rollAlien());
  if (res.created) await audit("alien.created", userId, ctx, { family: res.alien.family, assetVersion: res.alien.assetVersion });
  return res;
}

export { AuthError };
