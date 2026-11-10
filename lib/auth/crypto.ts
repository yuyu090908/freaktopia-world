import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const scrypt = (pw: string, salt: Buffer, len: number, opts: ScryptOptions) =>
  new Promise<Buffer>((res, rej) => scryptCb(pw, salt, len, opts, (e, k) => (e ? rej(e) : res(k))));

const N = 1 << 15;
const R = 8;
const P = 1;
const LEN = 32;
const maxmem = (n: number, r: number) => 128 * n * r * 2;

/** "scrypt$N$r$p$salt$hash" (base64url). Passwords are never stored or logged in plaintext. */
export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw.normalize("NFKC"), salt, LEN, { N, r: R, p: P, maxmem: maxmem(N, R) });
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(pw: string, stored: string | null): Promise<boolean> {
  // A missing hash still costs one scrypt, so "no such user" and "wrong password" take the same time.
  const parts = (stored ?? "").split("$");
  const ok = parts.length === 6 && parts[0] === "scrypt";
  const n = ok ? Number(parts[1]) : N;
  const r = ok ? Number(parts[2]) : R;
  const p = ok ? Number(parts[3]) : P;
  if (ok && (!Number.isInteger(n) || n > 1 << 20 || r > 32 || p > 4)) return false;
  const salt = ok ? Buffer.from(parts[4], "base64url") : randomBytes(16);
  const expected = ok ? Buffer.from(parts[5], "base64url") : randomBytes(LEN);
  const key = await scrypt(pw.normalize("NFKC"), salt, expected.length, { N: n, r, p, maxmem: maxmem(n, r) });
  return ok && timingSafeEqual(key, expected);
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256hex = (s: string) => createHash("sha256").update(s).digest("hex");
