/**
 * Wallet sign-in (EIP-4361 style) and signed session cookies.
 *
 * - The server issues a nonce bound to an HMAC token with a 5-minute expiry.
 * - The client signs a message that names the domain, address, chain id and nonce.
 * - The server checks domain, chain id allowlist, expiry, nonce token and single use
 *   (replay protection), then verifies the signature with viem.
 * - A signature only proves control of the address. It never authorises moving assets.
 */
import { getAddress, isAddress, verifyMessage } from "viem";
import { hmac, randomId, safeEqual } from "./hash";
import { buildSignInMessage } from "./auth-message";
import { DAO_RULES, DEMO_CHAIN } from "./meta";
import type { DaoRole, DaoSession } from "./types";

export const SESSION_COOKIE = "fk_dao";
export const DEVICE_COOKIE = "fk_did";

export const daoMode = () => (process.env.DAO_DATA_MODE === "production" ? "production" : "demo");

export function sessionSecret(): string | null {
  const s = process.env.DAO_SESSION_SECRET;
  if (s && s.length >= 32) return s;
  // A fixed secret is acceptable only for the demo, where nothing of value is protected.
  return daoMode() === "demo" ? "freaktopia-demo-only-secret-not-for-production" : null;
}

export function allowedChainIds(): number[] {
  if (daoMode() === "demo") return [DEMO_CHAIN.id];
  return (process.env.DAO_ALLOWED_CHAIN_IDS ?? "")
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

/* ---------- nonce ---------- */

const usedNonces = new Map<string, number>();

export function issueNonce(now = Date.now()) {
  const secret = sessionSecret()!;
  const nonce = randomId("n", 8).slice(2);
  const exp = now + DAO_RULES.nonceTtlMs;
  return { nonce, token: `${nonce}.${exp}.${hmac(secret, `${nonce}.${exp}`)}`, expiresAt: exp };
}

function checkNonceToken(token: string, nonce: string, now: number): string | null {
  const [n, exp, sig] = token.split(".");
  if (!n || !exp || !sig) return "NONCE_INVALID";
  if (n !== nonce) return "NONCE_MISMATCH";
  if (!safeEqual(sig, hmac(sessionSecret()!, `${n}.${exp}`))) return "NONCE_INVALID";
  if (Number(exp) < now) return "NONCE_EXPIRED";
  if (usedNonces.has(n)) return "NONCE_REPLAYED";
  return null;
}

/* ---------- message ---------- */

export { buildSignInMessage };

export function parseSignInMessage(msg: string) {
  const lines = msg.split("\n");
  const domain = /^(.+) wants you to sign in with your Ethereum account:$/.exec(lines[0] ?? "")?.[1];
  const address = lines[1]?.trim();
  const field = (k: string) => lines.find((l) => l.startsWith(`${k}: `))?.slice(k.length + 2);
  return {
    domain,
    address,
    uri: field("URI"),
    chainId: Number(field("Chain ID")),
    nonce: field("Nonce"),
    issuedAt: field("Issued At"),
    expirationTime: field("Expiration Time"),
  };
}

export type VerifyError =
  | "MESSAGE_MALFORMED"
  | "DOMAIN_MISMATCH"
  | "CHAIN_NOT_ALLOWED"
  | "MESSAGE_EXPIRED"
  | "NONCE_INVALID"
  | "NONCE_MISMATCH"
  | "NONCE_EXPIRED"
  | "NONCE_REPLAYED"
  | "BAD_SIGNATURE";

export async function verifySignIn(
  message: string,
  signature: `0x${string}`,
  nonceToken: string,
  host: string,
  now = Date.now(),
): Promise<{ ok: true; address: `0x${string}`; chainId: number } | { ok: false; code: VerifyError }> {
  const m = parseSignInMessage(message);
  if (!m.domain || !m.address || !isAddress(m.address) || !m.nonce || !m.issuedAt || !m.expirationTime || !Number.isInteger(m.chainId)) return { ok: false, code: "MESSAGE_MALFORMED" };
  if (m.domain !== host) return { ok: false, code: "DOMAIN_MISMATCH" };
  if (!allowedChainIds().includes(m.chainId)) return { ok: false, code: "CHAIN_NOT_ALLOWED" };
  const issued = Date.parse(m.issuedAt);
  const exp = Date.parse(m.expirationTime);
  if (!(issued <= now + 60_000) || !(exp > now) || exp - issued > DAO_RULES.nonceTtlMs + 60_000) return { ok: false, code: "MESSAGE_EXPIRED" };
  const nErr = checkNonceToken(nonceToken, m.nonce, now);
  if (nErr) return { ok: false, code: nErr as VerifyError };
  let valid = false;
  try {
    valid = await verifyMessage({ address: getAddress(m.address), message, signature });
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, code: "BAD_SIGNATURE" };
  usedNonces.set(m.nonce, now);
  if (usedNonces.size > 50_000) usedNonces.delete(usedNonces.keys().next().value as string);
  return { ok: true, address: getAddress(m.address), chainId: m.chainId };
}

/* ---------- session cookie ---------- */

export function encodeSession(s: DaoSession): string {
  const body = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${body}.${hmac(sessionSecret()!, body)}`;
}

export function decodeSession(raw: string | undefined, now = Date.now()): DaoSession | null {
  const secret = sessionSecret();
  if (!raw || !secret) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig || !safeEqual(sig, hmac(secret, body))) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString()) as DaoSession;
    if (!s.uid || now - s.issuedAt > DAO_RULES.sessionTtlMs) return null;
    if (daoMode() !== "demo") {
      delete s.demoRoles;
      delete s.demoStakes;
    }
    return s;
  } catch {
    return null;
  }
}

export const uidForAddress = (address: string) => `u_${address.toLowerCase().slice(2, 14)}`;

export function readCookie(req: Request, name: string) {
  const c = req.headers.get("cookie") ?? "";
  for (const part of c.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return undefined;
}

export function cookieHeader(name: string, value: string, maxAgeSec: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`;
}

export function demoRolesFor(s: DaoSession | null, daoId: string): DaoRole[] {
  return s?.demoRoles?.[daoId] ?? [];
}
