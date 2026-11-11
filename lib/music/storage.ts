/**
 * Audio file storage. Large files never pass through the app server in production: the browser PUTs straight
 * to S3-compatible object storage (Cloudflare R2, AWS S3, Backblaze B2, MinIO…) with a short-lived presigned
 * URL that is bound to one object key, one content type and one exact size. The key is chosen by the server
 * (music/<owner>/<track>/master.mp3), so nobody can write into someone else's space.
 *
 * Modes:
 *  - s3:    MUSIC_S3_ENDPOINT, MUSIC_S3_BUCKET, MUSIC_S3_ACCESS_KEY_ID, MUSIC_S3_SECRET_ACCESS_KEY (+ MUSIC_S3_REGION).
 *  - local: MUSIC_STORAGE=local, for development and tests only. Files go through this server into the existing
 *           ops_blobs store, capped at 25 MB. Refused on Vercel. Shown as "local test storage" in the UI.
 *  - off:   nothing configured. Uploads are disabled and the UI says so.
 *
 * Presigning is AWS Signature V4 (query string), written here with node:crypto: no SDK dependency.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getOpsStore } from "@/lib/ops/store";

export const LOCAL_MAX_BYTES = 25 * 1024 * 1024;
const S3_VARS = ["MUSIC_S3_ENDPOINT", "MUSIC_S3_BUCKET", "MUSIC_S3_ACCESS_KEY_ID", "MUSIC_S3_SECRET_ACCESS_KEY"] as const;

export type StorageState =
  | { mode: "s3"; bucket: string; host: string }
  | { mode: "local" }
  | { mode: "off"; missing: string[]; reason?: "local_on_vercel" };

export function storageState(env = process.env): StorageState {
  if (S3_VARS.every((k) => env[k])) {
    try {
      return { mode: "s3", bucket: env.MUSIC_S3_BUCKET!, host: new URL(env.MUSIC_S3_ENDPOINT!).host };
    } catch {
      return { mode: "off", missing: ["MUSIC_S3_ENDPOINT"] };
    }
  }
  if (env.MUSIC_STORAGE === "local") return env.VERCEL ? { mode: "off", missing: [...S3_VARS], reason: "local_on_vercel" } : { mode: "local" };
  return { mode: "off", missing: S3_VARS.filter((k) => !env[k]) };
}

// ------------------------------------------------------------------ SigV4

const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
const hmac = (k: Buffer | string, s: string) => createHmac("sha256", k).update(s).digest();
/** RFC 3986 encoding as S3 expects it (slashes kept in paths). */
const enc = (s: string, keepSlash = false) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`).replace(keepSlash ? /%2F/g : /$^/, "/");

export interface PresignInput {
  method: "GET" | "PUT" | "HEAD" | "DELETE";
  protocol?: "https" | "http";
  host: string;
  path: string; // already including bucket for path-style, starting with "/"
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresSec: number;
  now?: Date;
  /** Extra signed headers (lowercase names), e.g. content-type and content-length for uploads. */
  headers?: Record<string, string>;
  query?: Record<string, string>;
}

export function presignV4(p: PresignInput) {
  const now = p.now ?? new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const day = amzDate.slice(0, 8);
  const scope = `${day}/${p.region}/s3/aws4_request`;
  const headers: Record<string, string> = Object.fromEntries(Object.entries({ host: p.host, ...(p.headers ?? {}) }).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
  const signedHeaders = Object.keys(headers).sort();
  const q: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${p.accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(p.expiresSec),
    "X-Amz-SignedHeaders": signedHeaders.join(";"),
    ...(p.query ?? {}),
  };
  const canonicalQuery = Object.keys(q).sort().map((k) => `${enc(k)}=${enc(q[k])}`).join("&");
  const canonicalHeaders = signedHeaders.map((h) => `${h}:${headers[h]}\n`).join("");
  const canonicalRequest = [p.method, enc(p.path, true), canonicalQuery, canonicalHeaders, signedHeaders.join(";"), "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
  const key = hmac(hmac(hmac(hmac(`AWS4${p.secretAccessKey}`, day), p.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", key).update(toSign).digest("hex");
  return `${p.protocol ?? "https"}://${p.host}${enc(p.path, true)}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function s3(env = process.env) {
  const u = new URL(env.MUSIC_S3_ENDPOINT!);
  return {
    protocol: (u.protocol === "http:" ? "http" : "https") as "http" | "https",
    host: u.host,
    base: u.pathname.replace(/\/$/, ""),
    bucket: env.MUSIC_S3_BUCKET!,
    region: env.MUSIC_S3_REGION || "auto",
    accessKeyId: env.MUSIC_S3_ACCESS_KEY_ID!,
    secretAccessKey: env.MUSIC_S3_SECRET_ACCESS_KEY!,
  };
}
function s3Url(method: PresignInput["method"], key: string, expiresSec: number, extra: Pick<PresignInput, "headers" | "query"> = {}) {
  const c = s3();
  return presignV4({ method, protocol: c.protocol, host: c.host, path: `${c.base}/${c.bucket}/${key}`, region: c.region, accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey, expiresSec, ...extra });
}

// ------------------------------------------------------------------ local (development / tests)

const g = globalThis as unknown as { __fkMusicSecret?: Buffer };
const localSecret = () => (process.env.MUSIC_LOCAL_SECRET ? Buffer.from(process.env.MUSIC_LOCAL_SECRET) : (g.__fkMusicSecret ??= randomBytes(32)));
const localSig = (parts: string[]) => createHmac("sha256", localSecret()).update(parts.join("|")).digest("hex");
const blobId = (key: string) => `music:${key}`;

export function verifyLocalSig(kind: "put" | "get", key: string, exp: string, sig: string, extra = "") {
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const want = Buffer.from(localSig([kind, key, exp, extra]));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

export async function localPut(key: string, data: Buffer, mime: string) {
  await getOpsStore().putBlob(blobId(key), null, mime, data);
}
export async function localGet(key: string) {
  return getOpsStore().getBlob(blobId(key));
}

// ------------------------------------------------------------------ the API used by the service

export const UPLOAD_URL_TTL = 15 * 60;
export const PLAY_URL_TTL = 10 * 60;

export function uploadUrl(key: string, contentType: string, size: number) {
  const st = storageState();
  const expiresAt = new Date(Date.now() + UPLOAD_URL_TTL * 1000).toISOString();
  if (st.mode === "s3") {
    const url = s3Url("PUT", key, UPLOAD_URL_TTL, { headers: { "content-type": contentType, "content-length": String(size) } });
    return { url, method: "PUT" as const, headers: { "Content-Type": contentType }, expiresAt, mode: "s3" as const };
  }
  if (st.mode === "local") {
    const exp = String(Date.now() + UPLOAD_URL_TTL * 1000);
    const extra = `${contentType}:${size}`;
    const url = `/api/music/local/put?key=${encodeURIComponent(key)}&exp=${exp}&size=${size}&sig=${localSig(["put", key, exp, extra])}`;
    return { url, method: "PUT" as const, headers: { "Content-Type": contentType }, expiresAt, mode: "local" as const };
  }
  return null;
}

export function readUrl(key: string, opts: { download?: string } = {}) {
  const st = storageState();
  if (st.mode === "s3") {
    const query = opts.download ? { "response-content-disposition": `attachment; filename="${opts.download.replace(/[^\w.\- ]/g, "_")}"` } : undefined;
    return s3Url("GET", key, PLAY_URL_TTL, { query });
  }
  if (st.mode === "local") {
    const exp = String(Date.now() + PLAY_URL_TTL * 1000);
    return `/api/music/local/get?key=${encodeURIComponent(key)}&exp=${exp}&sig=${localSig(["get", key, exp, ""])}${opts.download ? "&dl=1" : ""}`;
  }
  return null;
}

/** Size of the stored object, or null when it is not there (yet). */
export async function objectSize(key: string): Promise<number | null> {
  const st = storageState();
  if (st.mode === "local") return (await localGet(key))?.data.length ?? null;
  if (st.mode !== "s3") return null;
  const r = await fetch(s3Url("HEAD", key, 60), { method: "HEAD", signal: AbortSignal.timeout(10_000) });
  if (r.status === 404 || r.status === 403) return null;
  if (!r.ok) throw new Error(`storage HEAD ${r.status}`);
  return Number(r.headers.get("content-length") ?? NaN);
}

/** Reads bytes [start, end] (inclusive) of the stored object. */
export async function readRange(key: string, start: number, end: number): Promise<Uint8Array> {
  const st = storageState();
  if (st.mode === "local") {
    const b = await localGet(key);
    return b ? new Uint8Array(b.data.subarray(start, end + 1)) : new Uint8Array();
  }
  if (st.mode !== "s3") return new Uint8Array();
  const r = await fetch(s3Url("GET", key, 60), { headers: { Range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`storage GET ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

export async function removeObject(key: string) {
  const st = storageState();
  if (st.mode === "local") {
    await localPut(key, Buffer.alloc(0), "application/octet-stream");
    return;
  }
  if (st.mode !== "s3") return;
  await fetch(s3Url("DELETE", key, 60), { method: "DELETE", signal: AbortSignal.timeout(10_000) }).catch(() => undefined);
}
