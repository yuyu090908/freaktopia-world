/**
 * DJ ARENA 2.0 API. Same session, CSRF check, rate limits and zod validation as /api/ops. Every change goes
 * through lib/music/service.ts, which checks ownership and access. Private tracks and unpublished tracks answer
 * 404 to everyone but their owner (and staff), so their existence is not revealed.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser, fail, limit, ok, readJson, sameOrigin } from "@/lib/auth/http";
import { clientKey } from "@/lib/ranking/guard";
import { DJ_GENRES, MUSICAL_KEYS } from "@/lib/music/genres";
import * as music from "@/lib/music/service";
import { LOCAL_MAX_BYTES, localGet, localPut, storageState, verifyLocalSig } from "@/lib/music/storage";
import { TRACK_TYPES } from "@/lib/music/types";
import { OpsError } from "@/lib/ops/types";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ path?: string[] }> };

// ------------------------------------------------------------------ schemas

const zId = z.string().regex(/^[0-9a-f-]{36}$/i);
const zText = (max: number) => z.string().trim().max(max).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f]*$/u);
const zName = (max: number) => zText(max).min(1);
const zDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const zIso = z.string().max(40).refine((v) => Number.isFinite(Date.parse(v)), "date");
const zGenre = z.enum(DJ_GENRES);
const zVis = z.enum(["public", "unlisted", "private", "audition"]);
const zPlVis = z.enum(["public", "unlisted", "private"]);
const zB64 = (maxBytes: number) => z.string().max(Math.ceil((maxBytes * 4) / 3) + 8);

const zProfile = z
  .object({
    stageName: zName(40), bio: zText(1200).optional(), country: zText(60).optional(), city: zText(60).optional(), genres: z.array(zGenre).max(6).optional(),
    yearsExperience: z.number().int().min(0).max(60).optional(), equipment: zText(300).optional(), regions: z.array(zName(60)).max(10).optional(),
    bookingStatus: z.enum(["open", "limited", "closed"]).optional(), contactPolicy: z.enum(["none", "organizers", "anyone"]).optional(),
    bufferHours: z.number().int().min(0).max(72).optional(), links: z.array(z.object({ label: zText(30), url: z.string().url().max(300) }).strict()).max(6).optional(),
    pastEvents: z.array(zName(120)).max(20).optional(), imageId: zId.nullable().optional(), showAlien: z.boolean().optional(), visibility: z.enum(["public", "hidden"]).optional(),
  })
  .strict();
const zRights = z
  .object({
    allOriginal: z.boolean(), usesThirdParty: z.boolean(), licensor: zText(200), licenseRef: zText(300), territories: zText(200), licenseEnds: zDay.nullable(),
    allowStreaming: z.boolean(), allowDownload: z.boolean(), documentId: zId.nullable(), statement: zText(1000),
  })
  .partial()
  .strict();
const zTrackPatch = z
  .object({
    title: zName(100), type: z.enum(TRACK_TYPES), genre: zGenre, bpm: z.number().int().min(40).max(220).nullable(), musicalKey: z.enum(MUSICAL_KEYS).nullable(),
    description: zText(2000), recordedAt: zDay.nullable(), releaseAt: zDay.nullable(), coverId: zId.nullable(), waveform: z.array(z.number().min(0).max(1)).max(200),
    rights: zRights, downloadable: z.boolean(), visibility: zVis,
  })
  .partial()
  .strict();
const zTerms = z
  .object({
    feeAmount: z.number().min(0).max(10_000_000), currency: z.string().regex(/^[A-Za-z]{3}$/), performanceStart: zIso, performanceEnd: zIso, setMinutes: z.number().int().min(15).max(720),
    travel: zText(500), accommodation: zText(500), equipment: zText(500), notes: zText(1000),
  })
  .partial()
  .strict();
const zBooking = z
  .object({
    kind: z.enum(["booking", "inquiry"]), djSlug: z.string().max(60), eventId: zId.nullable().optional(),
    event: z.object({ name: zText(100), country: zText(60), city: zText(60), venue: zText(100), genres: z.array(zName(32)).max(8), listPublicly: z.boolean() }).partial().strict().optional(),
    terms: zTerms.optional(), message: zName(2000), send: z.boolean(),
  })
  .strict();

// ------------------------------------------------------------------ helpers

function fromError(e: unknown) {
  if (e instanceof OpsError) return fail(e.status, e.code, e.extra);
  console.error("[music]", e);
  return fail(500, "SERVER_ERROR");
}
function parse<T extends z.ZodType>(schema: T, body: unknown): { data: z.infer<T> } | { error: Response } {
  const r = schema.safeParse(body);
  return r.success ? { data: r.data } : { error: fail(400, "INVALID_INPUT", { field: r.error.issues[0]?.path.join(".") }) };
}
const num = (v: string | null) => (v == null || v === "" || !Number.isFinite(Number(v)) ? undefined : Number(v));
const bytesOf = (b64: string) => Buffer.from(b64, "base64");

function serveBlob(blob: { mime: string; data: Buffer }, req: Request, opts: { cache?: string; download?: string; inline?: boolean } = {}) {
  const total = blob.data.length;
  const base: Record<string, string> = {
    "Content-Type": blob.mime, "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes", "Cache-Control": opts.cache ?? "private, no-store",
    "Content-Security-Policy": "sandbox",
  };
  if (opts.download) base["Content-Disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(opts.download)}`;
  const range = req.headers.get("range");
  const m = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (m && total > 0) {
    let start = m[1] ? Number(m[1]) : total - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : total - 1;
    if (!m[1]) end = total - 1;
    start = Math.max(0, start);
    end = Math.min(total - 1, end);
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
    return new Response(new Uint8Array(blob.data.subarray(start, end + 1)), { status: 206, headers: { ...base, "Content-Range": `bytes ${start}-${end}/${total}`, "Content-Length": String(end - start + 1) } });
  }
  return new Response(new Uint8Array(blob.data), { headers: { ...base, "Content-Length": String(total) } });
}

// ------------------------------------------------------------------ GET

export async function GET(req: Request, { params }: Params) {
  const p = (await params).path ?? [];
  const url = new URL(req.url);
  const sp = url.searchParams;
  try {
    // Local test storage (MUSIC_STORAGE=local only): signed, short-lived, range-capable.
    if (p[0] === "local" && p[1] === "get" && p.length === 2) {
      if (storageState().mode !== "local") return fail(404, "NOT_FOUND");
      const key = sp.get("key") ?? "";
      if (!verifyLocalSig("get", key, sp.get("exp") ?? "", sp.get("sig") ?? "")) return fail(403, "BAD_SIGNATURE");
      const blob = await localGet(key);
      if (!blob || !blob.data.length) return fail(404, "NOT_FOUND");
      return serveBlob(blob, req, { download: sp.get("dl") ? "track.mp3" : undefined });
    }
    if (p[0] === "images" && p.length === 2) {
      if (!zId.safeParse(p[1]).success) return fail(404, "NOT_FOUND");
      const blob = await music.getImage(p[1]);
      if (!blob) return fail(404, "NOT_FOUND");
      return serveBlob(blob, req, { cache: "public, max-age=86400, immutable" });
    }

    const user = await currentUser();
    const uid = user?.id ?? null;
    const lim = limit("music-read", uid ?? clientKey(req), 300, 60_000);
    if (lim) return lim;

    if (p[0] === "storage" && p.length === 1) return ok({ storage: music.storageInfo() });
    if (p[0] === "arena" && p.length === 1) return ok(await music.arena(uid));
    if (p[0] === "search" && p.length === 1) {
      const sort = sp.get("sort");
      return ok(
        await music.search(
          {
            q: (sp.get("q") ?? "").slice(0, 80), genre: DJ_GENRES.includes(sp.get("genre") as never) ? sp.get("genre")! : undefined, city: (sp.get("city") ?? "").slice(0, 60),
            available: sp.get("available") === "1", bpmMin: num(sp.get("bpmMin")), bpmMax: num(sp.get("bpmMax")), key: MUSICAL_KEYS.includes(sp.get("key") as never) ? sp.get("key")! : undefined,
            sort: sort === "recent" || sort === "liked" || sort === "trending" ? sort : "relevance", newDjs: sp.get("new") === "1",
          },
          uid,
        ),
      );
    }
    if (p[0] === "rankings" && p.length === 1) {
      const b = sp.get("board");
      const board = b === "liked" || b === "saved" || b === "booked" || b === "rising" ? b : "trending";
      return ok({ board, windowDays: 30, ranking: await music.djRankings(board) });
    }
    if (p[0] === "djs" && p.length === 2) return ok(await music.publicDjProfile(p[1].slice(0, 60), uid));
    if (p[0] === "djs" && p[2] === "conflicts" && p.length === 3) {
      if (!uid) return fail(401, "SIGN_IN_REQUIRED");
      const start = sp.get("start") ?? "";
      const end = sp.get("end") ?? "";
      if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end))) return fail(400, "INVALID_INPUT");
      const prof = await music.publicDjProfile(p[1].slice(0, 60), uid);
      return ok({ conflicts: await music.checkConflicts(prof.profile.userId, start, end) });
    }
    if (p[0] === "tracks" && p.length >= 2) {
      if (!zId.safeParse(p[1]).success) return fail(404, "NOT_FOUND");
      if (p.length === 2) return ok(await music.trackView(p[1], uid));
      if (p[2] === "stream" || p[2] === "download") {
        const to = await music.streamUrl(p[1], uid, { download: p[2] === "download" });
        return NextResponse.redirect(new URL(to, url.origin), { status: 302, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
      }
    }
    if (p[0] === "playlists" && p.length === 2) {
      if (!zId.safeParse(p[1]).success) return fail(404, "NOT_FOUND");
      return ok(await music.playlistView(p[1], uid));
    }

    if (!uid) return fail(401, "SIGN_IN_REQUIRED");
    if (p[0] === "me" && p.length === 1) {
      const [profile, tracks, claims] = await Promise.all([music.myDjProfile(uid), music.myTracks(uid), music.myClaims(uid)]);
      return ok({ profile, ...tracks, claims, emailVerified: user!.emailVerified, admin: await music.isAdmin(uid) });
    }
    if (p[0] === "me" && p[1] === "library" && p.length === 2) return ok(await music.library(uid));
    if (p[0] === "me" && p[1] === "analytics" && p.length === 2) return ok(await music.analytics(uid));
    if (p[0] === "me" && p[1] === "availability" && p.length === 2) return ok({ days: await music.myDays(uid) });
    if (p[0] === "me" && p[1] === "bookings" && p.length === 2) return ok(await music.myBookings(uid));
    if (p[0] === "me" && p[1] === "attachable" && p.length === 2) return ok({ tracks: await music.attachableTracks(uid) });
    if (p[0] === "bookings" && p.length === 2 && zId.safeParse(p[1]).success) return ok(await music.bookingView(uid, p[1]));
    if (p[0] === "bookings" && p[1] === "files" && p.length === 3) {
      const { meta, blob } = await music.readBookingFile(uid, p[2]);
      return serveBlob(blob, req, { download: meta.name ?? "file" });
    }
    if (p[0] === "rights-docs" && p.length === 2) {
      const { meta, blob } = await music.readRightsDocument(uid, p[1]);
      return serveBlob(blob, req, { download: meta.name ?? "licence" });
    }
    if (p[0] === "events" && p[2] === "application-tracks" && p.length === 3) return ok(await music.applicationTracks(uid, p[1]));
    if (p[0] === "events" && p[2] === "suggested-djs" && p.length === 3) {
      const genres = (sp.get("genres") ?? "").split(",").filter(Boolean).slice(0, 8);
      return ok({ suggestions: await music.suggestDjs(genres) });
    }
    if (p[0] === "admin" && p.length === 1) return ok(await music.adminOverview(uid));
    return fail(404, "NOT_FOUND");
  } catch (e) {
    return fromError(e);
  }
}

// ------------------------------------------------------------------ PUT (local test storage only)

export async function PUT(req: Request, { params }: Params) {
  const p = (await params).path ?? [];
  if (!(p[0] === "local" && p[1] === "put" && p.length === 2) || storageState().mode !== "local") return fail(404, "NOT_FOUND");
  const sp = new URL(req.url).searchParams;
  const key = sp.get("key") ?? "";
  const size = Number(sp.get("size"));
  const ct = req.headers.get("content-type") ?? "";
  if (!verifyLocalSig("put", key, sp.get("exp") ?? "", sp.get("sig") ?? "", `${ct}:${size}`)) return fail(403, "BAD_SIGNATURE");
  if (!/^music\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/master\.mp3$/.test(key) || size > LOCAL_MAX_BYTES) return fail(400, "INVALID_INPUT");
  const data = Buffer.from(await req.arrayBuffer());
  if (data.length !== size) return fail(400, "SIZE_MISMATCH");
  await localPut(key, data, "audio/mpeg");
  return new Response(null, { status: 200 });
}

// ------------------------------------------------------------------ POST

export async function POST(req: Request, { params }: Params) {
  const p = (await params).path ?? [];
  const path = p.join("/");
  if (!sameOrigin(req)) return fail(403, "CSRF");
  const user = await currentUser();
  const uid = user?.id ?? null;
  const big = path === "images" || path === "rights-docs" || /^bookings\/[^/]+\/files$/.test(path);
  const body = await readJson(req, big ? 7_200_000 : 64_000);
  if (!body) return fail(400, "INVALID_BODY");

  try {
    // ---- signed-out allowed: plays (counted only after real listening) and copyright claims
    if (path === "plays/start") {
      const lim = limit("music-play", uid ?? clientKey(req), 240, 60 * 60_000);
      if (lim) return lim;
      const r = parse(z.object({ trackId: zId }).strict(), body);
      if ("error" in r) return r.error;
      const key = music.listenerKeyFor(uid, clientKey(req), req.headers.get("user-agent"));
      return ok(await music.startPlay(r.data.trackId, uid, key));
    }
    if (path === "plays/finish") {
      const r = parse(z.object({ playId: zId, sessionId: zId, seconds: z.number().min(0).max(36_000) }).strict(), body);
      if ("error" in r) return r.error;
      const key = music.listenerKeyFor(uid, clientKey(req), req.headers.get("user-agent"));
      return ok(await music.finishPlay(r.data.playId, r.data.sessionId, key, r.data.seconds, req.headers.get("user-agent")));
    }
    if (path === "claims") {
      const lim = limit("music-claim", uid ?? clientKey(req), 10, 60 * 60_000);
      if (lim) return lim;
      const r = parse(z.object({ trackId: zId, claimantName: zName(120), claimantEmail: z.string().email().max(200), work: zName(300), details: zName(3000), goodFaith: z.boolean() }).strict(), body);
      if ("error" in r) return r.error;
      return ok({ claim: await music.fileClaim(uid, r.data) }, 201);
    }

    if (!uid) return fail(401, "SIGN_IN_REQUIRED");
    const lim = limit("music-write", uid, 120, 60_000);
    if (lim) return lim;

    if (path === "profile") {
      const r = parse(zProfile, body);
      if ("error" in r) return r.error;
      return ok({ profile: await music.saveDjProfile(uid, r.data) });
    }
    if (path === "images") {
      const lim2 = limit("music-image", uid, 30, 60 * 60_000);
      if (lim2) return lim2;
      const r = parse(z.object({ data: zB64(2 * 1024 * 1024) }).strict(), body);
      if ("error" in r) return r.error;
      return ok({ image: await music.uploadImage(uid, { data: bytesOf(r.data.data) }) }, 201);
    }
    if (path === "rights-docs") {
      const r = parse(z.object({ name: zName(120), data: zB64(5 * 1024 * 1024) }).strict(), body);
      if ("error" in r) return r.error;
      return ok({ document: await music.uploadRightsDocument(uid, { name: r.data.name, data: bytesOf(r.data.data) }) }, 201);
    }
    if (path === "uploads") {
      const lim2 = limit("music-upload", uid, 30, 60 * 60_000);
      if (lim2) return lim2;
      const r = parse(z.object({ fileName: zName(160), size: z.number().int().min(0).max(5 * 1024 ** 3), mime: z.string().max(60), title: zText(100).optional() }).strict(), body);
      if ("error" in r) return r.error;
      return ok(await music.createUpload(uid, r.data), 201);
    }
    if (p[0] === "tracks" && p.length >= 2) {
      const tid = p[1];
      if (!zId.safeParse(tid).success) return fail(404, "NOT_FOUND");
      if (p.length === 2) {
        const r = parse(zTrackPatch, body);
        if ("error" in r) return r.error;
        return ok({ track: await music.updateTrack(uid, tid, r.data) });
      }
      if (p[2] === "renew") return ok(await music.renewUpload(uid, tid));
      if (p[2] === "complete") return ok({ track: await music.completeUpload(uid, tid) });
      if (p[2] === "submit") {
        const r = parse(z.object({ visibility: zVis }).strict(), body);
        if ("error" in r) return r.error;
        return ok({ track: await music.submitTrack(uid, tid, r.data) });
      }
      if (p[2] === "delete") {
        await music.deleteTrack(uid, tid);
        return ok();
      }
      if (p[2] === "like" || p[2] === "save") {
        const lim2 = limit("music-react", uid, 120, 60_000);
        if (lim2) return lim2;
        const r = parse(z.object({ on: z.boolean() }).strict(), body);
        if ("error" in r) return r.error;
        return ok(p[2] === "like" ? await music.setLike(uid, tid, r.data.on) : await music.setSave(uid, tid, r.data.on));
      }
    }
    if (path === "playlists") {
      const r = parse(z.object({ title: zName(80), description: zText(500).optional(), visibility: zPlVis.optional(), coverId: zId.nullable().optional() }).strict(), body);
      if ("error" in r) return r.error;
      return ok({ playlist: await music.createPlaylist(uid, r.data) }, 201);
    }
    if (p[0] === "playlists" && p.length >= 2) {
      const pid = p[1];
      if (p.length === 2) {
        const r = parse(z.object({ title: zName(80), description: zText(500), visibility: zPlVis, coverId: zId.nullable() }).partial().strict(), body);
        if ("error" in r) return r.error;
        return ok({ playlist: await music.updatePlaylist(uid, pid, r.data) });
      }
      if (p[2] === "delete" && p.length === 3) {
        await music.deletePlaylist(uid, pid);
        return ok();
      }
      if (p[2] === "items" && p.length === 3) {
        const r = parse(z.object({ trackId: zId }).strict(), body);
        if ("error" in r) return r.error;
        return ok({ item: await music.addToPlaylist(uid, pid, r.data.trackId) }, 201);
      }
      if (p[2] === "items" && p[4] === "delete" && p.length === 5) {
        await music.removeFromPlaylist(uid, pid, p[3]);
        return ok();
      }
      if (p[2] === "order" && p.length === 3) {
        const r = parse(z.object({ itemIds: z.array(zId).max(500) }).strict(), body);
        if ("error" in r) return r.error;
        return ok(await music.reorderPlaylist(uid, pid, r.data.itemIds));
      }
    }
    if (path === "availability") {
      const r = parse(z.object({ days: z.array(z.object({ day: zDay, status: z.enum(["available", "tentative", "booked", "unavailable", "private", "clear"]), note: zText(200).optional() }).strict()).min(1).max(62) }).strict(), body);
      if ("error" in r) return r.error;
      return ok({ days: await music.setDays(uid, r.data.days) });
    }
    if (path === "bookings") {
      const lim2 = limit("music-booking", uid, 20, 60 * 60_000);
      if (lim2) return lim2;
      const r = parse(zBooking, body);
      if ("error" in r) return r.error;
      return ok(await music.createBooking(uid, r.data), 201);
    }
    if (p[0] === "bookings" && p.length === 3 && zId.safeParse(p[1]).success) {
      if (p[2] === "files") {
        const r = parse(z.object({ name: zName(120), data: zB64(5 * 1024 * 1024) }).strict(), body);
        if ("error" in r) return r.error;
        return ok(await music.attachToBooking(uid, p[1], { name: r.data.name, data: bytesOf(r.data.data) }));
      }
      const action = z.enum(["send", "accept", "decline", "counter", "request_details", "confirm", "cancel", "message"]).safeParse(p[2]);
      if (!action.success) return fail(404, "NOT_FOUND");
      if (action.data === "message") {
        const lim3 = limit("music-chat", uid, 30, 60_000);
        if (lim3) return lim3;
      }
      const r = parse(z.object({ terms: zTerms.optional(), message: zText(2000).optional(), confirm: z.boolean().optional(), reason: zText(1000).optional(), termsVersion: z.number().int().min(1).optional() }).strict(), body);
      if ("error" in r) return r.error;
      return ok(await music.act(uid, p[1], action.data, r.data));
    }
    if (path === "blocks") {
      const r = parse(z.object({ userId: zId, on: z.boolean() }).strict(), body);
      if ("error" in r) return r.error;
      return ok(await music.setBlock(uid, r.data.userId, r.data.on));
    }
    if (path === "reports") {
      const r = parse(z.object({ targetType: z.enum(["track", "booking", "user"]), targetId: z.string().max(60), reason: z.enum(["spam", "abuse", "fraud", "other"]), details: zText(1000) }).strict(), body);
      if ("error" in r) return r.error;
      return ok({ report: await music.report(uid, r.data) }, 201);
    }
    if (p[0] === "claims" && p[2] === "counter" && p.length === 3) {
      const r = parse(z.object({ statement: zName(3000) }).strict(), body);
      if ("error" in r) return r.error;
      return ok({ claim: await music.counterClaim(uid, p[1], r.data.statement) });
    }

    // ---- staff (OPS_ADMIN_EMAILS)
    if (p[0] === "admin") {
      const lim2 = limit("music-admin", uid, 60, 60_000);
      if (lim2) return lim2;
      if (p[1] === "tracks" && p[3] === "review" && p.length === 4) {
        const r = parse(z.object({ decision: z.enum(["approve", "reject"]), note: zText(1000) }).strict(), body);
        if ("error" in r) return r.error;
        return ok({ track: await music.reviewTrack(uid, p[2], r.data) });
      }
      if (p[1] === "tracks" && p[3] === "delete" && p.length === 4) {
        if (!(await music.isAdmin(uid))) return fail(403, "FORBIDDEN");
        await music.deleteTrack(uid, p[2], { admin: true });
        return ok();
      }
      if (p[1] === "claims" && p.length === 3) {
        const r = parse(z.object({ decision: z.enum(["uphold", "dismiss", "restore"]), resolution: zName(1000) }).strict(), body);
        if ("error" in r) return r.error;
        return ok({ claim: await music.decideClaim(uid, p[2], r.data) });
      }
      if (p[1] === "settings" && p.length === 2) {
        const r = parse(z.object({ maxFileMb: z.number(), maxDurationMin: z.number(), quotaMbPerUser: z.number(), uploadsPerDay: z.number(), strikeLimit: z.number() }).partial().strict(), body);
        if ("error" in r) return r.error;
        return ok({ settings: await music.saveSettings(uid, r.data) });
      }
      if (p[1] === "reports" && p[3] === "close" && p.length === 4) {
        await music.closeReport(uid, p[2]);
        return ok();
      }
    }
    return fail(404, "NOT_FOUND");
  } catch (e) {
    return fromError(e);
  }
}
