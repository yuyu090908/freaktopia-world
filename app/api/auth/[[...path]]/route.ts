import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyMessage, isAddress } from "viem";
import { LOCALE_COOKIE, toLocale } from "@/i18n/config";
import { DEMO_INBOX_COOKIE, SESSION_COOKIE, authConfig } from "@/lib/auth/config";
import { randomToken, sha256hex } from "@/lib/auth/crypto";
import { clearSessionCookie, ctxFor, currentUser, fail, limit, ok, readJson, safeReturnTo, sameOrigin, setLocaleCookie, setSessionCookie, baseUrl } from "@/lib/auth/http";
import { AuthError, confirmReset, endSession, requestReset, resendVerification, signIn, signInWithProvider, signUp, verifyEmail, zEmail, zPassword } from "@/lib/auth/service";
import { getStore } from "@/lib/auth/store";
import { walletMessage } from "@/lib/auth/wallet";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ path?: string[] }> };
const OAUTH_COOKIE = "fk_oauth";
const WALLET_NONCE_COOKIE = "fk_wallet_nonce";
const HOUR = 3600_000;

function demoInbox(res: NextResponse, email: string) {
  if (authConfig().email === "demo-mailbox") res.cookies.set(DEMO_INBOX_COOKIE, email, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 3600 });
}

/** After sign-in: keep the language the visitor is using now; otherwise use the one saved on the profile. */
async function afterSignIn(userId: string) {
  const jar = await cookies();
  const cur = toLocale(jar.get(LOCALE_COOKIE)?.value);
  const profile = await getStore().getProfile(userId);
  if (cur && profile && profile.locale !== cur) await getStore().updateProfile(userId, { locale: cur });
  return { next: profile?.revealSeen ? null : "/welcome", setLocale: !cur && profile ? profile.locale : null };
}

/** JSON answer for a completed sign-in: session cookie (+ saved language when the visitor had none). */
async function signedIn(userId: string, session: { token: string; expiresAt: Date }, fallback: string, extra: Record<string, unknown> = {}) {
  const a = await afterSignIn(userId);
  const res = ok({ next: a.next ?? fallback, ...extra });
  setSessionCookie(res, session.token, session.expiresAt);
  if (a.setLocale) setLocaleCookie(res, a.setLocale);
  return res;
}

function authFail(e: unknown) {
  if (e instanceof AuthError) {
    const status = { INVALID_CREDENTIALS: 401, EMAIL_NOT_VERIFIED: 403, TOKEN_INVALID: 400, PROVIDER_EMAIL_UNVERIFIED: 403, WALLET_TAKEN: 409 }[e.code] ?? 400;
    return fail(status, e.code);
  }
  console.error("[auth]", e);
  return fail(500, "AUTH_ERROR");
}

export async function GET(req: Request, { params }: Params) {
  const path = (await params).path?.join("/") ?? "";
  const url = new URL(req.url);
  const cfg = authConfig();

  if (path === "config") return ok({ config: cfg });

  if (path === "google/start") {
    const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
    if (cfg.google === "demo-simulator") return NextResponse.redirect(new URL(`/auth/google-demo?returnTo=${encodeURIComponent(returnTo)}`, req.url));
    if (cfg.google !== "connected") return NextResponse.redirect(new URL(`/auth/signin?error=GOOGLE_NOT_CONFIGURED`, req.url));
    const state = randomToken(24);
    const verifier = randomToken(48);
    const challenge = Buffer.from(sha256hex(verifier), "hex").toString("base64url");
    const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    auth.search = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: `${baseUrl(req)}/api/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    const res = NextResponse.redirect(auth);
    res.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, verifier, returnTo }), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/google", maxAge: 600 });
    return res;
  }

  if (path === "google/callback") {
    const jar = await cookies();
    const back = (code: string) => {
      const r = NextResponse.redirect(new URL(`/auth/signin?error=${code}`, req.url));
      r.cookies.set(OAUTH_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
      return r;
    };
    if (cfg.google !== "connected") return back("GOOGLE_NOT_CONFIGURED");
    let saved: { state: string; verifier: string; returnTo: string } | null = null;
    try {
      saved = JSON.parse(jar.get(OAUTH_COOKIE)?.value ?? "null");
    } catch {}
    const code = url.searchParams.get("code");
    if (!saved || !code || url.searchParams.get("state") !== saved.state) return back("OAUTH_STATE");
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: `${baseUrl(req)}/api/auth/google/callback`, grant_type: "authorization_code", code_verifier: saved.verifier }),
    });
    if (!tokenRes.ok) return back("OAUTH_EXCHANGE");
    const { access_token } = (await tokenRes.json()) as { access_token?: string };
    const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${access_token}` } });
    if (!info.ok) return back("OAUTH_USERINFO");
    const u = (await info.json()) as { sub?: string; email?: string; email_verified?: boolean };
    if (!u.sub) return back("OAUTH_USERINFO");
    try {
      const r = await signInWithProvider("google", u.sub, u.email ?? null, u.email_verified === true, await ctxFor(req));
      const a = await afterSignIn(r.userId);
      const res = NextResponse.redirect(new URL(a.next ?? saved.returnTo, req.url));
      setSessionCookie(res, r.session.token, r.session.expiresAt);
      if (a.setLocale) setLocaleCookie(res, a.setLocale);
      res.cookies.set(OAUTH_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
      return res;
    } catch (e) {
      return back(e instanceof AuthError ? e.code : "AUTH_ERROR");
    }
  }

  if (path === "wallet/nonce") {
    const user = await currentUser();
    if (!user) return fail(401, "SIGN_IN_REQUIRED");
    const nonce = randomToken(16);
    const message = walletMessage(url.host, nonce);
    const res = ok({ message });
    res.cookies.set(WALLET_NONCE_COOKIE, nonce, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/auth/wallet", maxAge: 600 });
    return res;
  }

  return fail(404, "NOT_FOUND");
}

export async function POST(req: Request, { params }: Params) {
  const path = (await params).path?.join("/") ?? "";
  if (!sameOrigin(req)) return fail(403, "CSRF");
  const ctx = await ctxFor(req);
  const ip = ctx.ip ?? "local";
  const body = (await readJson(req)) ?? {};
  const cfg = authConfig();

  try {
    if (path === "signup") {
      const lim = limit("signup", ip, 8, HOUR);
      if (lim) return lim;
      const email = zEmail.safeParse(body.email);
      if (!email.success) return fail(400, "INVALID_EMAIL");
      const pw = zPassword.safeParse(body.password);
      if (!pw.success) return fail(400, pw.error.issues[0]?.message ?? "PASSWORD_WEAK");
      if (cfg.email === "not-configured") return fail(503, "EMAIL_NOT_CONFIGURED");
      await signUp(email.data, pw.data, ctx);
      const res = ok({ next: "check-email", demoMailbox: cfg.email === "demo-mailbox" }, 202);
      demoInbox(res, email.data);
      return res;
    }

    if (path === "signin") {
      const email = zEmail.safeParse(body.email);
      const lim = limit("signin", ip, 20, 15 * 60_000) ?? (email.success ? limit("signin-email", email.data, 8, 15 * 60_000) : null);
      if (lim) return lim;
      if (!email.success || typeof body.password !== "string" || body.password.length > 128) return fail(401, "INVALID_CREDENTIALS");
      const r = await signIn(email.data, body.password, ctx);
      return signedIn(r.userId, r.session, safeReturnTo(body.returnTo));
    }

    if (path === "signout") {
      const jar = await cookies();
      await endSession(jar.get(SESSION_COOKIE)?.value, ctx);
      const res = ok();
      clearSessionCookie(res);
      return res;
    }

    if (path === "verify") {
      const lim = limit("verify", ip, 20, HOUR);
      if (lim) return lim;
      if (typeof body.token !== "string" || body.token.length > 100) return fail(400, "TOKEN_INVALID");
      const r = await verifyEmail(body.token, ctx);
      return signedIn(r.userId, r.session, "/");
    }

    if (path === "verify/resend") {
      const email = zEmail.safeParse(body.email);
      const lim = limit("resend", ip, 6, HOUR) ?? (email.success ? limit("resend-email", email.data, 3, HOUR) : null);
      if (lim) return lim;
      if (email.success) await resendVerification(email.data, ctx);
      const res = ok({}, 202);
      if (email.success) demoInbox(res, email.data);
      return res;
    }

    if (path === "reset/request") {
      const email = zEmail.safeParse(body.email);
      const lim = limit("reset", ip, 6, HOUR) ?? (email.success ? limit("reset-email", email.data, 3, HOUR) : null);
      if (lim) return lim;
      if (!email.success) return fail(400, "INVALID_EMAIL");
      if (cfg.email === "not-configured") return fail(503, "EMAIL_NOT_CONFIGURED");
      await requestReset(email.data, ctx);
      const res = ok({ demoMailbox: cfg.email === "demo-mailbox" }, 202);
      demoInbox(res, email.data);
      return res;
    }

    if (path === "reset/confirm") {
      const lim = limit("reset-confirm", ip, 10, HOUR);
      if (lim) return lim;
      if (typeof body.token !== "string" || body.token.length > 100) return fail(400, "TOKEN_INVALID");
      const pw = zPassword.safeParse(body.password);
      if (!pw.success) return fail(400, pw.error.issues[0]?.message ?? "PASSWORD_WEAK");
      await confirmReset(body.token, pw.data, ctx);
      const res = ok();
      clearSessionCookie(res);
      return res;
    }

    if (path === "google/demo") {
      // DEMO ONLY: stands in for Google while no OAuth client is configured. Disabled with a real database.
      if (cfg.google !== "demo-simulator") return fail(404, "NOT_FOUND");
      const lim = limit("google-demo", ip, 20, HOUR);
      if (lim) return lim;
      const email = zEmail.safeParse(body.email);
      if (!email.success) return fail(400, "INVALID_EMAIL");
      const r = await signInWithProvider("google", `demo-${sha256hex(email.data).slice(0, 24)}`, email.data, true, ctx);
      return signedIn(r.userId, r.session, safeReturnTo(body.returnTo), { demo: true });
    }

    if (path === "wallet/link") {
      const user = await currentUser();
      if (!user) return fail(401, "SIGN_IN_REQUIRED");
      const lim = limit("wallet", user.id, 10, HOUR);
      if (lim) return lim;
      const jar = await cookies();
      const nonce = jar.get(WALLET_NONCE_COOKIE)?.value;
      const address = typeof body.address === "string" ? body.address : "";
      const signature = typeof body.signature === "string" ? body.signature : "";
      if (!nonce || !isAddress(address) || !/^0x[0-9a-fA-F]+$/.test(signature)) return fail(400, "WALLET_PROOF_INVALID");
      const valid = await verifyMessage({ address, message: walletMessage(new URL(req.url).host, nonce), signature: signature as `0x${string}` }).catch(() => false);
      if (!valid) return fail(400, "WALLET_PROOF_INVALID");
      const chainId = Number.isInteger(body.chainId) ? Number(body.chainId) : 1;
      const link = await getStore().linkWallet(user.id, address, chainId);
      await getStore().audit({ event: "wallet.link", userId: user.id, ip, meta: { address: link.address, chainId } });
      const res = ok({ wallet: link });
      res.cookies.set(WALLET_NONCE_COOKIE, "", { path: "/api/auth/wallet", maxAge: 0 });
      return res;
    }
  } catch (e) {
    return authFail(e);
  }
  return fail(404, "NOT_FOUND");
}
