/**
 * Request guards for ranking APIs: rate limiting, auth check and audit log.
 * In-memory implementations are per server instance (fine for the demo);
 * production should back them with Redis / the audit table.
 */
import { NextResponse } from "next/server";

const hits = new Map<string, number[]>();

/** Sliding-window rate limit. Returns seconds to wait, or 0 when allowed. */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= limit) {
    hits.set(key, list);
    return Math.ceil((windowMs - (now - list[0])) / 1000);
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 10000) hits.delete(hits.keys().next().value as string);
  return 0;
}

export function clientKey(req: Request) {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip") || "local";
}

export function apiError(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

/** Standard limiter for public GET endpoints: 120 requests / minute / client. */
export function limited(req: Request, bucket: string, limit = 120, windowMs = 60_000) {
  const wait = rateLimit(`${bucket}:${clientKey(req)}`, limit, windowMs);
  if (!wait) return null;
  const res = apiError(429, "RATE_LIMITED", "Too many requests. Try again shortly.");
  res.headers.set("Retry-After", String(wait));
  return res;
}

/**
 * Session lookup. Phase 1 has no auth provider, so this always returns null
 * and user-scoped endpoints answer 401 AUTH_REQUIRED with a login URL that
 * returns to the original action.
 */
export async function getSessionUser(_req: Request): Promise<{ id: string; role: "user" | "admin" } | null> {
  return null;
}

export function authRequired(returnTo: string) {
  return apiError(401, "AUTH_REQUIRED", "Sign in to do this.", { loginUrl: `/login?returnTo=${encodeURIComponent(returnTo)}` });
}

export interface AuditEntry {
  at: string;
  actor: string;
  action: string;
  detail: Record<string, unknown>;
}
const audit: AuditEntry[] = [];
export function writeAudit(e: Omit<AuditEntry, "at">) {
  audit.push({ ...e, at: new Date().toISOString() });
  if (audit.length > 1000) audit.shift();
}
export const readAudit = () => [...audit].reverse();

/** Admin check: bearer token from RANKING_ADMIN_TOKEN (disabled when unset). */
export function isAdmin(req: Request) {
  const token = process.env.RANKING_ADMIN_TOKEN;
  if (!token) return false;
  return req.headers.get("authorization") === `Bearer ${token}`;
}

export const PUBLIC_CACHE = "public, s-maxage=300, stale-while-revalidate=600";
