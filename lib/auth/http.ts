import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, fromAcceptLanguage, toLocale, type Locale } from "@/i18n/config";
import { clientKey, rateLimit } from "@/lib/ranking/guard";
import { SITE_URL } from "@/lib/utils";
import { SESSION_COOKIE, authConfig } from "./config";
import { userForSessionToken, type Ctx } from "./service";

export function fail(status: number, code: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, ...extra } }, { status, headers: { "Cache-Control": "no-store" } });
}

export function ok(body: Record<string, unknown> = {}, status = 200) {
  return NextResponse.json({ ok: true, ...body }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * CSRF: state-changing requests must come from this site. Browsers always send Origin on cross-site POSTs,
 * so a mismatching Origin (or Sec-Fetch-Site: cross-site) is rejected. The session cookie is also SameSite=Lax.
 */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function readJson(req: Request, maxBytes = 8_000): Promise<Record<string, unknown> | null> {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return null;
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/** Returns a 429 response when the bucket is exhausted. */
export function limit(bucket: string, key: string, max: number, windowMs: number) {
  const wait = rateLimit(`auth:${bucket}:${key}`, max, windowMs);
  return wait ? NextResponse.json({ error: { code: "RATE_LIMITED", retryAfter: wait } }, { status: 429, headers: { "Retry-After": String(wait) } }) : null;
}

export async function requestLocale(req: Request): Promise<Locale> {
  const jar = await cookies();
  return toLocale(jar.get(LOCALE_COOKIE)?.value) ?? fromAcceptLanguage(req.headers.get("accept-language")) ?? DEFAULT_LOCALE;
}

/**
 * Base URL for links in emails and the OAuth redirect. Never taken from the Host header in production
 * (host-header injection would point reset links elsewhere): APP_URL, else the canonical site.
 */
export function baseUrl(req: Request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (authConfig().mode === "demo") return new URL(req.url).origin;
  return SITE_URL;
}

export async function ctxFor(req: Request): Promise<Ctx> {
  return { ip: clientKey(req), baseUrl: baseUrl(req), locale: await requestLocale(req) };
}

export function setSessionCookie(res: NextResponse, token: string, expiresAt: Date) {
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}

export function setLocaleCookie(res: NextResponse, locale: Locale) {
  res.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}

/** The signed-in user for a route handler or server component, or null. */
export async function currentUser() {
  const jar = await cookies();
  return userForSessionToken(jar.get(SESSION_COOKIE)?.value);
}

/** The signed-in user from a Request's Cookie header (works outside Next's request scope too). */
export async function userFromRequest(req: Request) {
  const raw = req.headers.get("cookie") ?? "";
  const m = raw.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  return userForSessionToken(m ? decodeURIComponent(m.slice(SESSION_COOKIE.length + 1)) : null);
}

/** Only same-site relative paths: never "//evil.example" or "https://…". */
export function safeReturnTo(v: unknown, fallback = "/") {
  return typeof v === "string" && /^\/(?!\/)[^\s\\]*$/.test(v) && v.length < 300 ? v : fallback;
}
