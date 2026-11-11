/**
 * DJ ARENA 2.0 service: the only place that changes music, playlist, booking and claim data.
 *
 * Reused, not duplicated: accounts and sessions (lib/auth), the work profile and person listing (lib/ops) that
 * event dashboards already send offers to, event applications (ops applications, now with audio attached),
 * messages (ops_messages, a booking thread instead of an event thread), notifications (ops_notifications),
 * blocks and the audit log (party), small files (ops_blobs) and the admin list (OPS_ADMIN_EMAILS).
 *
 * Never automatic: publishing (staff look at the rights first), CONFIRMED bookings (organizer confirms terms the
 * DJ accepted), takedowns and restores (staff decide), downloads (owner opts in, rights allow it).
 */
import { createHash, randomUUID } from "node:crypto";
import { getStore as getAuthStore } from "@/lib/auth/store";
import { toLook } from "@/lib/alien/catalog";
import { assertAdmin } from "@/lib/loyalty/service";
import * as ops from "@/lib/ops/service";
import { can } from "@/lib/ops/permissions";
import { getOpsStore } from "@/lib/ops/store";
import { OpsError, type Application, type EventMember, type Message, type Notification, type Opening, type OpsEvent, type Requirement, type WorkProfile } from "@/lib/ops/types";
import type { Block, PartyAudit } from "@/lib/party/types";
import { DJ_GENRES, genreFit, isDjGenre, type DjGenre } from "./genres";
import { id3Size, verifyMp3 } from "./mp3";
import {
  canDownload, canPlay, conflictsFor, isExpired, isListed, judgePlay, nextStatus, publicDay, rankDjs, rightsProblems, RANK_WINDOW_DAYS,
  type BookingAction, type DjSignals, type RankBoard, type Viewer,
} from "./rules";
import { objectSize, readRange, readUrl, removeObject, storageState, uploadUrl, LOCAL_MAX_BYTES } from "./storage";
import {
  DEFAULT_SETTINGS, TRACK_TYPES,
  type AudioTrack, type BookingEventInfo, type BookingOffer, type BookingRequest, type BookingTerms, type CopyrightClaim, type DayStatus, type DjAvailability,
  type DjProfile, type MusicReport, type MusicSettings, type Playlist, type PlaylistItem, type RightsInfo, type SavedTrack, type TrackLike, type TrackPlay,
  type TrackType, type TrackVisibility,
} from "./types";

const store = () => getOpsStore();
const auth = () => getAuthStore();
const id = () => randomUUID();
const nowIso = () => new Date().toISOString();
const err = (status: number, code: string, extra: Record<string, unknown> = {}) => new OpsError(status, code, extra);
const notFound = () => err(404, "NOT_FOUND");

async function verifiedUser(uid: string) {
  const u = await auth().findUserById(uid);
  if (!u) throw err(401, "SIGN_IN_REQUIRED");
  if (!u.emailVerified) throw err(403, "EMAIL_NOT_VERIFIED");
  return u;
}

export async function isAdmin(uid: string | null) {
  if (!uid) return false;
  try {
    await assertAdmin(uid);
    return true;
  } catch {
    return false;
  }
}

async function audit(actorId: string, action: string, entityType: string, entityId: string, meta: Record<string, string | number | boolean | null> = {}, reason = "") {
  await store().insert<PartyAudit>("party_audit", { id: id(), eventId: null, actorId, action: `music.${action}`, reason, meta: { entityType, entityId, ...meta }, at: nowIso() });
}

async function notify(userId: string, key: string, values: Record<string, string | number>, dedupeKey: string) {
  const n: Notification = { id: id(), userId, eventId: null, key, values, dedupeKey, read: false, at: nowIso() };
  return store().notifyOnce(n);
}

export async function settings(): Promise<MusicSettings> {
  return { ...DEFAULT_SETTINGS, ...((await store().get<MusicSettings>("music_settings", "global")) ?? {}) };
}

const slugify = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "dj";

// ------------------------------------------------------------------ DJ profile (on the existing account)

export interface DjProfileInput {
  stageName: string;
  bio?: string;
  country?: string;
  city?: string;
  genres?: string[];
  yearsExperience?: number;
  equipment?: string;
  regions?: string[];
  bookingStatus?: DjProfile["bookingStatus"];
  contactPolicy?: DjProfile["contactPolicy"];
  bufferHours?: number;
  links?: { label: string; url: string }[];
  pastEvents?: string[];
  imageId?: string | null;
  showAlien?: boolean;
  visibility?: DjProfile["visibility"];
}

export async function myDjProfile(uid: string) {
  return store().get<DjProfile>("dj_profiles", uid);
}

const safeLink = (u: string) => {
  try {
    const x = new URL(u);
    return x.protocol === "https:" && !x.username && !x.password ? x.toString() : null;
  } catch {
    return null;
  }
};

export async function saveDjProfile(uid: string, input: DjProfileInput) {
  await verifiedUser(uid);
  const cur = await myDjProfile(uid);
  const stageName = input.stageName.trim().slice(0, 40);
  if (!stageName) throw err(400, "INVALID_INPUT", { field: "stageName" });
  let slug = cur?.slug;
  if (!slug) {
    const base = slugify(stageName);
    slug = base;
    for (let n = 2; (await store().list<DjProfile>("dj_profiles", { slug })).length; n++) slug = `${base}-${n}`;
  }
  if (input.imageId) {
    const meta = await store().get<{ ownerId: string }>("music_images", input.imageId);
    if (!meta || meta.ownerId !== uid) throw err(400, "UNKNOWN_IMAGE");
  }
  const next: DjProfile = {
    userId: uid, slug, stageName,
    bio: (input.bio ?? cur?.bio ?? "").slice(0, 1200),
    country: (input.country ?? cur?.country ?? "").slice(0, 60),
    city: (input.city ?? cur?.city ?? "").slice(0, 60),
    genres: (input.genres ?? cur?.genres ?? []).filter(isDjGenre).slice(0, 6) as DjGenre[],
    yearsExperience: Math.max(0, Math.min(60, Math.round(input.yearsExperience ?? cur?.yearsExperience ?? 0))),
    equipment: (input.equipment ?? cur?.equipment ?? "").slice(0, 300),
    regions: (input.regions ?? cur?.regions ?? []).map((r) => r.trim().slice(0, 60)).filter(Boolean).slice(0, 10),
    bookingStatus: input.bookingStatus ?? cur?.bookingStatus ?? "open",
    contactPolicy: input.contactPolicy ?? cur?.contactPolicy ?? "organizers",
    bufferHours: Math.max(0, Math.min(72, Math.round(input.bufferHours ?? cur?.bufferHours ?? 12))),
    links: (input.links ?? cur?.links ?? []).slice(0, 6).flatMap((l) => {
      const url = safeLink(l.url);
      return url ? [{ label: l.label.trim().slice(0, 30) || new URL(url).host, url }] : [];
    }),
    pastEvents: (input.pastEvents ?? cur?.pastEvents ?? []).map((s) => s.trim().slice(0, 120)).filter(Boolean).slice(0, 20),
    imageId: input.imageId !== undefined ? input.imageId : cur?.imageId ?? null,
    showAlien: input.showAlien ?? cur?.showAlien ?? true,
    visibility: input.visibility ?? cur?.visibility ?? "public",
    listingId: cur?.listingId ?? null,
    createdAt: cur?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
    version: (cur?.version ?? 0) + 1,
  };
  // The existing work profile gets the DJ role, and the existing person listing is what event dashboards
  // send direct offers to. A city outside the ops city list just means no listing yet (booking requests still work).
  const wp = await ops.saveWorkProfile(uid, { displayName: stageName });
  if (!wp.roles.includes("dj")) await ops.saveWorkProfile(uid, { roles: [...wp.roles.filter((r) => r !== "attendee"), "dj"] });
  try {
    const listingInput = { type: "person" as const, title: `${stageName} (DJ)`, items: [{ key: "dj_performer", quantity: 1, model: "" }], city: next.city, priceUsd: 0, active: next.bookingStatus !== "closed" };
    if (next.listingId) await ops.updateListing(uid, next.listingId, listingInput);
    else if (next.city) next.listingId = (await ops.createListing(uid, listingInput)).id;
  } catch (e) {
    if (!(e instanceof OpsError)) throw e;
  }
  await store().put("dj_profiles", next);
  return next;
}

async function alienFor(uid: string) {
  const [alien, privacy] = await Promise.all([auth().getAlien(uid).catch(() => null), auth().getPrivacy(uid).catch(() => null)]);
  return alien ? { look: toLook(alien), name: alien.name, public: privacy?.avatar === "public" } : null;
}

/** Card data for lists: never private fields (notes, contact, calendar). */
export async function djCard(p: DjProfile) {
  const tracks = (await store().list<AudioTrack>("audio_tracks", { ownerId: p.userId })).filter(isListed);
  const likes = (await Promise.all(tracks.map((t) => store().list<TrackLike>("track_likes", { trackId: t.id })))).reduce((a, l) => a + l.length, 0);
  const alien = p.showAlien ? await alienFor(p.userId) : null;
  const top = tracks.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))[0] ?? null;
  return {
    userId: p.userId, slug: p.slug, stageName: p.stageName, city: p.city, country: p.country, genres: p.genres, bookingStatus: p.bookingStatus,
    imageId: p.imageId, look: alien?.look ?? null, likes, trackCount: tracks.length, createdAt: p.createdAt,
    topTrack: top ? publicTrack(top) : null,
  };
}

export function publicTrack(t: AudioTrack) {
  return {
    id: t.id, ownerId: t.ownerId, title: t.title, type: t.type, genre: t.genre, bpm: t.bpm, musicalKey: t.musicalKey, durationSec: t.durationSec,
    description: t.description, coverId: t.coverId, waveform: t.waveform, visibility: t.visibility, publishedAt: t.publishedAt, releaseAt: t.releaseAt,
    recordedAt: t.recordedAt, rightsStatus: t.rightsStatus, downloadable: t.downloadable && t.rights.allowDownload,
  };
}
export type PublicTrack = ReturnType<typeof publicTrack>;

async function trackCounts(trackIds: string[], viewerId: string | null) {
  const out: Record<string, { likes: number; saves: number; liked: boolean; saved: boolean }> = {};
  await Promise.all(
    trackIds.map(async (tid) => {
      const [likes, saves] = await Promise.all([store().list<TrackLike>("track_likes", { trackId: tid }), store().list<SavedTrack>("saved_tracks", { trackId: tid })]);
      out[tid] = { likes: likes.length, saves: saves.length, liked: !!viewerId && likes.some((l) => l.userId === viewerId), saved: !!viewerId && saves.some((s) => s.userId === viewerId) };
    }),
  );
  return out;
}

async function ownerNames(ids: string[]) {
  const out: Record<string, { stageName: string; slug: string | null }> = {};
  await Promise.all(
    [...new Set(ids)].map(async (uid) => {
      const p = await store().get<DjProfile>("dj_profiles", uid);
      out[uid] = p && p.visibility === "public" ? { stageName: p.stageName, slug: p.slug } : { stageName: await ops.displayNameOf(uid), slug: null };
    }),
  );
  return out;
}

/** Track list for the client: public fields + owner name + counts for this viewer. */
async function present(tracks: AudioTrack[], viewerId: string | null) {
  const [counts, names] = await Promise.all([trackCounts(tracks.map((t) => t.id), viewerId), ownerNames(tracks.map((t) => t.ownerId))]);
  return tracks.map((t) => ({ ...publicTrack(t), owner: names[t.ownerId], ...counts[t.id] }));
}

export async function publicDjProfile(slug: string, viewerId: string | null) {
  const [p] = await store().list<DjProfile>("dj_profiles", { slug });
  if (!p || (p.visibility !== "public" && p.userId !== viewerId)) throw notFound();
  const isOwner = viewerId === p.userId;
  const tracks = (await store().list<AudioTrack>("audio_tracks", { ownerId: p.userId })).filter((t) => (isOwner ? t.processingStatus === "ready" : isListed(t)));
  tracks.sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt));
  const playlists = (await store().list<Playlist>("playlists", { ownerId: p.userId })).filter((pl) => pl.kind === "dj" && (isOwner || pl.visibility === "public"));
  const today = nowIso().slice(0, 10);
  const days = (await store().list<DjAvailability>("dj_availability", { djId: p.userId })).filter((d) => d.day >= today).sort((a, b) => a.day.localeCompare(b.day));
  const confirmed = (await store().list<BookingRequest>("dj_booking_requests", { djId: p.userId })).filter((b) => b.status === "confirmed" && b.event.listPublicly);
  const alien = p.showAlien ? await alienFor(p.userId) : null;
  const viewer = viewerId ? await viewerRole(viewerId) : null;
  const blocked = viewerId ? !!(await store().get<Block>("blocks", `${p.userId}:${viewerId}`)) : false;
  return {
    profile: {
      userId: p.userId, slug: p.slug, stageName: p.stageName, bio: p.bio, country: p.country, city: p.city, genres: p.genres, yearsExperience: p.yearsExperience,
      equipment: p.equipment, regions: p.regions, bookingStatus: p.bookingStatus, links: p.links, pastEvents: p.pastEvents, imageId: p.imageId,
      look: alien?.look ?? null, createdAt: p.createdAt, contactPolicy: p.contactPolicy,
    },
    tracks: await present(tracks, viewerId),
    playlists: await Promise.all(playlists.map(async (pl) => ({ ...pl, count: (await store().list<PlaylistItem>("playlist_items", { playlistId: pl.id })).length }))),
    availability: days.map(publicDay).filter(Boolean).slice(0, 120),
    gigs: confirmed
      .sort((a, b) => b.terms.performanceStart.localeCompare(a.terms.performanceStart))
      .map((b) => ({ id: b.id, name: b.event.name, city: b.event.city, country: b.event.country, at: b.terms.performanceStart })),
    viewer: {
      isOwner,
      signedIn: !!viewerId,
      organizer: !!viewer?.organizer,
      canBook: !!viewerId && !isOwner && !blocked && p.bookingStatus !== "closed" && !!viewer?.organizer,
      canContact: !!viewerId && !isOwner && !blocked && (p.contactPolicy === "anyone" || (p.contactPolicy === "organizers" && !!viewer?.organizer)),
      events: viewer?.events ?? [],
    },
  };
}

/** Organizer = owns/manages a FREAKTOPIA event, or has the organizer role on the existing work profile. */
async function viewerRole(uid: string) {
  const wp = await store().get<WorkProfile>("profiles", uid);
  const members = (await store().list<EventMember>("members", { userId: uid })).filter((m) => m.role === "owner" || m.role === "manager");
  const events = (await Promise.all(members.map((m) => store().get<OpsEvent>("events", m.eventId)))).filter((e): e is OpsEvent => !!e && e.endAt > nowIso());
  return {
    organizer: events.length > 0 || !!wp?.roles.includes("organizer"),
    events: events.map((e) => ({ id: e.id, name: e.name, city: e.city, country: e.country, venue: e.venueName, startAt: e.startAt, endAt: e.endAt, genres: e.genres })),
  };
}

// ------------------------------------------------------------------ images (existing ops_blobs, small files)

const IMAGE_MAX = 2 * 1024 * 1024;
const DOC_MAX = 5 * 1024 * 1024;
function sniffImage(b: Buffer): string | null {
  if (b[0] === 0x89 && b.subarray(1, 4).toString() === "PNG") return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

/** Cover art and profile pictures. The real type comes from the bytes, not the browser's claim. */
export async function uploadImage(uid: string, input: { data: Buffer }) {
  await verifiedUser(uid);
  if (input.data.length > IMAGE_MAX) throw err(413, "FILE_TOO_LARGE");
  const mime = sniffImage(input.data);
  if (!mime) throw err(415, "FILE_TYPE");
  const imageId = id();
  await store().putBlob(`img:${imageId}`, null, mime, input.data);
  await store().insert("music_images", { id: imageId, ownerId: uid, mime, size: input.data.length, at: nowIso() });
  return { id: imageId };
}
export async function getImage(imageId: string) {
  return store().getBlob(`img:${imageId}`);
}

/** Licence documents: PDF or image, readable by the uploader and staff only. */
export async function uploadRightsDocument(uid: string, input: { name: string; data: Buffer }) {
  await verifiedUser(uid);
  if (input.data.length > DOC_MAX) throw err(413, "FILE_TOO_LARGE");
  const mime = input.data.subarray(0, 4).toString() === "%PDF" ? "application/pdf" : sniffImage(input.data);
  if (!mime) throw err(415, "FILE_TYPE");
  const docId = id();
  await store().putBlob(`doc:${docId}`, null, mime, input.data);
  await store().insert("music_images", { id: docId, ownerId: uid, mime, size: input.data.length, at: nowIso(), kind: "rights_doc", name: input.name.slice(0, 120) });
  return { id: docId };
}
export async function readRightsDocument(uid: string, docId: string) {
  const meta = await store().get<{ ownerId: string; mime: string; name?: string; kind?: string }>("music_images", docId);
  if (!meta || meta.kind !== "rights_doc") throw notFound();
  if (meta.ownerId !== uid && !(await isAdmin(uid))) throw notFound();
  const blob = await store().getBlob(`doc:${docId}`);
  if (!blob) throw notFound();
  return { meta, blob };
}

// ------------------------------------------------------------------ upload: 1 create → 2 PUT to storage → 3 complete

const EMPTY_RIGHTS: RightsInfo = { allOriginal: false, usesThirdParty: false, licensor: "", licenseRef: "", territories: "", licenseEnds: null, allowStreaming: false, allowDownload: false, documentId: null, statement: "" };

export function storageInfo() {
  const st = storageState();
  return { mode: st.mode, missing: st.mode === "off" ? st.missing : [], reason: st.mode === "off" ? st.reason ?? null : null, localMaxBytes: LOCAL_MAX_BYTES };
}

async function strikes(uid: string) {
  return (await store().list<CopyrightClaim>("copyright_claims", { ownerId: uid })).filter((c) => c.status === "upheld").length;
}

export async function createUpload(uid: string, input: { fileName: string; size: number; mime: string; title?: string }) {
  await verifiedUser(uid);
  const st = storageState();
  if (st.mode === "off") throw err(503, "STORAGE_NOT_CONFIGURED");
  const s = await settings();
  if (!/\.mp3$/i.test(input.fileName) || !["audio/mpeg", "audio/mp3"].includes(input.mime)) throw err(415, "FILE_TYPE");
  const max = Math.min(s.maxFileMb * 1024 * 1024, st.mode === "local" ? LOCAL_MAX_BYTES : Infinity);
  if (input.size > max) throw err(413, "FILE_TOO_LARGE", { maxBytes: max });
  if (input.size < 1024) throw err(400, "FILE_EMPTY");
  if ((await strikes(uid)) >= s.strikeLimit) throw err(403, "UPLOADS_SUSPENDED");
  const mine = await store().list<AudioTrack>("audio_tracks", { ownerId: uid });
  const used = mine.reduce((a, t) => a + (t.processingStatus === "failed" ? 0 : t.sizeBytes), 0);
  if (used + input.size > s.quotaMbPerUser * 1024 * 1024) throw err(413, "QUOTA_EXCEEDED", { usedBytes: used });
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  if (mine.filter((t) => t.createdAt > dayAgo).length >= s.uploadsPerDay) throw err(429, "UPLOAD_LIMIT");
  const trackId = id();
  const t: AudioTrack = {
    id: trackId, ownerId: uid, title: (input.title ?? input.fileName.replace(/\.mp3$/i, "")).trim().slice(0, 100) || "Untitled", type: "original_mix", genre: "Other",
    bpm: null, musicalKey: null, durationSec: null, description: "", recordedAt: null, releaseAt: null, coverId: null,
    storageKey: `music/${uid}/${trackId}/master.mp3`, playbackKey: null, fileName: input.fileName.slice(0, 160), sizeBytes: input.size, codec: null, waveform: [],
    processingStatus: "awaiting_upload", processingError: null, publicationStatus: "draft", visibility: "private", rightsStatus: "unverified", rights: { ...EMPTY_RIGHTS },
    downloadable: false, reviewNote: null, createdAt: nowIso(), updatedAt: nowIso(), publishedAt: null, version: 1,
  };
  await store().insert("audio_tracks", t);
  await audit(uid, "upload.created", "track", t.id, { size: input.size });
  return { track: t, upload: uploadUrl(t.storageKey, "audio/mpeg", t.sizeBytes) };
}

async function ownTrack(uid: string, trackId: string) {
  const t = await store().get<AudioTrack>("audio_tracks", trackId);
  if (!t || t.ownerId !== uid) throw notFound();
  return t;
}

/** A fresh URL for a retry (same object key, same size). */
export async function renewUpload(uid: string, trackId: string) {
  const t = await ownTrack(uid, trackId);
  if (t.processingStatus === "ready" || t.processingStatus === "processing") throw err(409, "ALREADY_UPLOADED");
  await store().put("audio_tracks", { ...t, processingStatus: "awaiting_upload", processingError: null, updatedAt: nowIso() });
  return { upload: uploadUrl(t.storageKey, "audio/mpeg", t.sizeBytes) };
}

/**
 * Step 6: the server checks the stored object itself (size, real format, codec, corruption, duration) by reading
 * its first ~512 KB and last 64 KB. The master is never modified. Anything that fails is deleted from storage.
 */
export async function completeUpload(uid: string, trackId: string) {
  const t = await ownTrack(uid, trackId);
  if (t.processingStatus === "ready") return t;
  const s = await settings();
  await store().put("audio_tracks", { ...t, processingStatus: "processing", updatedAt: nowIso() });
  const fail = async (code: string, keep = false) => {
    if (!keep) await removeObject(t.storageKey);
    const next = { ...t, processingStatus: "failed" as const, processingError: code, updatedAt: nowIso() };
    await store().put("audio_tracks", next);
    await audit(uid, "upload.rejected", "track", t.id, { code });
    return next;
  };
  let size: number | null;
  try {
    size = await objectSize(t.storageKey);
  } catch {
    await store().put("audio_tracks", { ...t, processingStatus: "awaiting_upload", updatedAt: nowIso() });
    throw err(502, "STORAGE_ERROR");
  }
  if (size == null || size === 0) {
    await store().put("audio_tracks", { ...t, processingStatus: "awaiting_upload", updatedAt: nowIso() });
    throw err(409, "UPLOAD_NOT_FOUND");
  }
  if (size !== t.sizeBytes) return fail("SIZE_MISMATCH");
  let head = await readRange(t.storageKey, 0, Math.min(size, 524_288) - 1);
  const tag = id3Size(head);
  if (tag > 0 && tag + 4096 > head.length && tag < size) {
    // Large embedded artwork: read the audio start after the tag instead.
    const after = await readRange(t.storageKey, tag, Math.min(size, tag + 262_144) - 1);
    const merged = new Uint8Array(tag + after.length);
    merged.set(head.subarray(0, Math.min(head.length, tag)));
    merged.set(after, tag);
    head = merged;
  }
  const tail = await readRange(t.storageKey, Math.max(0, size - 65_536), size - 1);
  const v = verifyMp3(head, tail, size, { maxSeconds: s.maxDurationMin * 60 });
  if (!v.ok) return fail(v.error);
  const next: AudioTrack = {
    ...t, processingStatus: "ready", processingError: null, durationSec: v.durationSec, codec: v.codec, playbackKey: t.storageKey,
    publicationStatus: t.publicationStatus === "draft" ? "draft" : t.publicationStatus, updatedAt: nowIso(), version: t.version + 1,
  };
  await store().put("audio_tracks", next);
  await audit(uid, "upload.verified", "track", t.id, { durationSec: v.durationSec, bitrate: v.codec.bitrateKbps });
  return next;
}

export interface TrackPatch {
  title?: string;
  type?: TrackType;
  genre?: string;
  bpm?: number | null;
  musicalKey?: string | null;
  description?: string;
  recordedAt?: string | null;
  releaseAt?: string | null;
  coverId?: string | null;
  waveform?: number[];
  rights?: Partial<RightsInfo>;
  downloadable?: boolean;
  visibility?: TrackVisibility;
}

/** Draft saving. Changing the rights answers sends a reviewed track back to review (it is unpublished until then). */
export async function updateTrack(uid: string, trackId: string, patch: TrackPatch) {
  const t = await ownTrack(uid, trackId);
  if (t.publicationStatus === "removed") throw err(409, "TRACK_REMOVED");
  if (patch.coverId) {
    const meta = await store().get<{ ownerId: string; kind?: string }>("music_images", patch.coverId);
    if (!meta || meta.ownerId !== uid || meta.kind) throw err(400, "UNKNOWN_IMAGE");
  }
  if (patch.rights?.documentId) {
    const meta = await store().get<{ ownerId: string; kind?: string }>("music_images", patch.rights.documentId);
    if (!meta || meta.ownerId !== uid || meta.kind !== "rights_doc") throw err(400, "UNKNOWN_DOCUMENT");
  }
  const rights = patch.rights ? { ...t.rights, ...patch.rights } : t.rights;
  const rightsChanged = !!patch.rights && JSON.stringify(rights) !== JSON.stringify(t.rights);
  const next: AudioTrack = {
    ...t,
    title: patch.title !== undefined ? patch.title.trim().slice(0, 100) || t.title : t.title,
    type: patch.type && TRACK_TYPES.includes(patch.type) ? patch.type : t.type,
    genre: patch.genre && isDjGenre(patch.genre) ? patch.genre : t.genre,
    bpm: patch.bpm !== undefined ? (patch.bpm == null ? null : Math.max(40, Math.min(220, Math.round(patch.bpm)))) : t.bpm,
    musicalKey: patch.musicalKey !== undefined ? patch.musicalKey : t.musicalKey,
    description: patch.description !== undefined ? patch.description.slice(0, 2000) : t.description,
    recordedAt: patch.recordedAt !== undefined ? patch.recordedAt : t.recordedAt,
    releaseAt: patch.releaseAt !== undefined ? patch.releaseAt : t.releaseAt,
    coverId: patch.coverId !== undefined ? patch.coverId : t.coverId,
    waveform: patch.waveform ? patch.waveform.slice(0, 200).map((x) => Math.round(Math.max(0, Math.min(1, x)) * 100) / 100) : t.waveform,
    rights,
    downloadable: patch.downloadable !== undefined ? patch.downloadable && rights.allowDownload : t.downloadable && rights.allowDownload,
    updatedAt: nowIso(),
    version: t.version + 1,
  };
  if (patch.visibility && t.publicationStatus === "published") {
    // Moving between public / unlisted / audition keeps the review; private takes it off-line at once.
    next.visibility = patch.visibility;
    if (patch.visibility === "private") next.publicationStatus = "private";
  }
  if (rightsChanged && ["published", "pending_review", "rejected"].includes(t.publicationStatus)) {
    next.rightsStatus = "unverified";
    next.publicationStatus = "draft";
    next.publishedAt = null;
    await audit(uid, "rights.changed", "track", t.id, {}, "rights answers changed; needs a new review");
  }
  await store().put("audio_tracks", next);
  return next;
}

/**
 * Step 7. Private: ready at once (owner only). Anything others can hear goes to staff review first: the
 * uploader's checkbox and statement are never treated as proof of the rights.
 */
export async function submitTrack(uid: string, trackId: string, input: { visibility: TrackVisibility }) {
  const t = await ownTrack(uid, trackId);
  if (t.processingStatus !== "ready") throw err(409, "NOT_PROCESSED");
  if (t.publicationStatus === "removed") throw err(409, "TRACK_REMOVED");
  if (input.visibility === "private") {
    const next = { ...t, visibility: "private" as const, publicationStatus: "private" as const, updatedAt: nowIso(), version: t.version + 1 };
    await store().put("audio_tracks", next);
    return next;
  }
  const problems = rightsProblems(t.type, t.rights);
  if (problems.length) throw err(400, "RIGHTS_INCOMPLETE", { fields: problems });
  if (t.rightsStatus === "staff_reviewed" && t.publicationStatus !== "rejected") {
    const next = { ...t, visibility: input.visibility, publicationStatus: "published" as const, publishedAt: t.publishedAt ?? nowIso(), updatedAt: nowIso(), version: t.version + 1 };
    await store().put("audio_tracks", next);
    return next;
  }
  const next = { ...t, visibility: input.visibility, publicationStatus: "pending_review" as const, rightsStatus: "pending_review" as const, updatedAt: nowIso(), version: t.version + 1 };
  await store().put("audio_tracks", next);
  await audit(uid, "review.requested", "track", t.id, { visibility: input.visibility, type: t.type });
  return next;
}

/** Deletes the track, its stored file and every reference to it (playlists, likes, saves). Plays are kept anonymised. */
export async function deleteTrack(uid: string, trackId: string, opts: { admin?: boolean } = {}) {
  const t = await store().get<AudioTrack>("audio_tracks", trackId);
  if (!t || (t.ownerId !== uid && !opts.admin)) throw notFound();
  await removeObject(t.storageKey);
  for (const it of await store().list<PlaylistItem>("playlist_items", { trackId })) await store().remove("playlist_items", it.id);
  for (const l of await store().list<TrackLike>("track_likes", { trackId })) await store().remove("track_likes", `${trackId}:${l.userId}`);
  for (const s of await store().list<SavedTrack>("saved_tracks", { trackId })) await store().remove("saved_tracks", `${trackId}:${s.userId}`);
  await store().remove("audio_tracks", trackId);
  await audit(uid, "track.deleted", "track", trackId, { by: opts.admin ? "staff" : "owner" });
}

export async function myTracks(uid: string) {
  const tracks = (await store().list<AudioTrack>("audio_tracks", { ownerId: uid })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const counts = await trackCounts(tracks.map((t) => t.id), uid);
  const s = await settings();
  const used = tracks.reduce((a, t) => a + (t.processingStatus === "failed" ? 0 : t.sizeBytes), 0);
  return {
    tracks: tracks.map((t) => ({ ...t, ...counts[t.id], storageKey: undefined, playbackKey: undefined })),
    quota: { usedBytes: used, limitBytes: s.quotaMbPerUser * 1024 * 1024, maxFileBytes: s.maxFileMb * 1024 * 1024, maxDurationMin: s.maxDurationMin },
    storage: storageInfo(),
    strikes: await strikes(uid),
    strikeLimit: s.strikeLimit,
  };
}

async function auditionAccess(viewerId: string, t: AudioTrack) {
  const apps = (await store().list<Application & { trackIds?: string[] }>("applications", { applicantId: t.ownerId })).filter((a) => a.trackIds?.includes(t.id) && !["withdrawn"].includes(a.status));
  for (const a of apps) {
    const m = await store().get<EventMember>("members", `${a.eventId}:${viewerId}`);
    if (can(m, "decide_applications")) return true;
  }
  return false;
}

export async function viewerFor(trackOrNull: AudioTrack | null, viewerId: string | null): Promise<Viewer> {
  const admin = await isAdmin(viewerId);
  const audition = !!trackOrNull && !!viewerId && trackOrNull.visibility === "audition" ? await auditionAccess(viewerId, trackOrNull) : false;
  return { id: viewerId, admin, auditionForTrack: audition };
}

export async function trackView(trackId: string, viewerId: string | null) {
  const t = await store().get<AudioTrack>("audio_tracks", trackId);
  if (!t) throw notFound();
  const v = await viewerFor(t, viewerId);
  if (!canPlay(t, v)) throw notFound(); // private and unpublished tracks look like they don't exist
  const [item] = await present([t], viewerId);
  const owner = await store().get<DjProfile>("dj_profiles", t.ownerId);
  return { track: { ...item, isOwner: viewerId === t.ownerId, publicationStatus: viewerId === t.ownerId ? t.publicationStatus : undefined }, dj: owner && owner.visibility === "public" ? await djCard(owner) : null, canDownload: canDownload(t, v) };
}

/** Short-lived URL to the playback file, only after the access check. */
export async function streamUrl(trackId: string, viewerId: string | null, opts: { download?: boolean } = {}) {
  const t = await store().get<AudioTrack>("audio_tracks", trackId);
  if (!t || !t.playbackKey) throw notFound();
  const v = await viewerFor(t, viewerId);
  if (!canPlay(t, v)) throw notFound();
  if (opts.download && !canDownload(t, v)) throw err(403, "DOWNLOAD_OFF");
  const url = readUrl(opts.download ? t.storageKey : t.playbackKey, opts.download ? { download: `${t.title}.mp3` } : {});
  if (!url) throw err(503, "STORAGE_NOT_CONFIGURED");
  return url;
}

// ------------------------------------------------------------------ likes & saves (one per account and track)

async function playableOrThrow(trackId: string, uid: string) {
  const t = await store().get<AudioTrack>("audio_tracks", trackId);
  if (!t || !canPlay(t, await viewerFor(t, uid))) throw notFound();
  return t;
}

export async function setLike(uid: string, trackId: string, on: boolean) {
  await verifiedUser(uid);
  const t = await playableOrThrow(trackId, uid);
  const key = `${trackId}:${uid}`;
  const cur = await store().get<TrackLike>("track_likes", key);
  if (on && !cur) {
    try {
      await store().insert<TrackLike>("track_likes", { trackId, userId: uid, ownerId: t.ownerId, at: nowIso() });
    } catch (e) {
      if (!(e instanceof OpsError && e.code === "DUPLICATE")) throw e; // a double tap: still one like
    }
  }
  if (!on && cur) await store().remove("track_likes", key);
  const likes = (await store().list<TrackLike>("track_likes", { trackId })).length;
  return { liked: on, likes };
}

export async function setSave(uid: string, trackId: string, on: boolean) {
  await verifiedUser(uid);
  const t = await playableOrThrow(trackId, uid);
  const key = `${trackId}:${uid}`;
  const cur = await store().get<SavedTrack>("saved_tracks", key);
  if (on && !cur) {
    try {
      await store().insert<SavedTrack>("saved_tracks", { trackId, userId: uid, ownerId: t.ownerId, at: nowIso() });
    } catch (e) {
      if (!(e instanceof OpsError && e.code === "DUPLICATE")) throw e;
    }
  }
  if (!on && cur) await store().remove("saved_tracks", key);
  return { saved: on, saves: (await store().list<SavedTrack>("saved_tracks", { trackId })).length };
}

// ------------------------------------------------------------------ playlists (one model for DJs and listeners)

async function ownPlaylist(uid: string, playlistId: string) {
  const p = await store().get<Playlist>("playlists", playlistId);
  if (!p || p.ownerId !== uid) throw notFound();
  return p;
}

export async function createPlaylist(uid: string, input: { title: string; description?: string; visibility?: Playlist["visibility"]; coverId?: string | null }) {
  await verifiedUser(uid);
  const mine = await store().list<Playlist>("playlists", { ownerId: uid });
  if (mine.length >= 100) throw err(429, "PLAYLIST_LIMIT");
  const isDj = !!(await myDjProfile(uid));
  const p: Playlist = {
    id: id(), ownerId: uid, title: input.title.trim().slice(0, 80) || "Playlist", description: (input.description ?? "").slice(0, 500), visibility: input.visibility ?? "private",
    coverId: input.coverId ?? null, kind: isDj ? "dj" : "library", createdAt: nowIso(), updatedAt: nowIso(), version: 1,
  };
  await store().insert("playlists", p);
  return p;
}

export async function updatePlaylist(uid: string, playlistId: string, patch: { title?: string; description?: string; visibility?: Playlist["visibility"]; coverId?: string | null }) {
  const p = await ownPlaylist(uid, playlistId);
  if (patch.coverId) {
    const meta = await store().get<{ ownerId: string; kind?: string }>("music_images", patch.coverId);
    if (!meta || meta.ownerId !== uid || meta.kind) throw err(400, "UNKNOWN_IMAGE");
  }
  const next: Playlist = {
    ...p, title: patch.title !== undefined ? patch.title.trim().slice(0, 80) || p.title : p.title, description: patch.description !== undefined ? patch.description.slice(0, 500) : p.description,
    visibility: patch.visibility ?? p.visibility, coverId: patch.coverId !== undefined ? patch.coverId : p.coverId, updatedAt: nowIso(), version: p.version + 1,
  };
  await store().put("playlists", next);
  return next;
}

export async function deletePlaylist(uid: string, playlistId: string) {
  await ownPlaylist(uid, playlistId);
  for (const it of await store().list<PlaylistItem>("playlist_items", { playlistId })) await store().remove("playlist_items", it.id);
  await store().remove("playlists", playlistId);
}

export async function addToPlaylist(uid: string, playlistId: string, trackId: string) {
  const p = await ownPlaylist(uid, playlistId);
  await playableOrThrow(trackId, uid); // you can only add what you can hear yourself
  const items = await store().list<PlaylistItem>("playlist_items", { playlistId });
  if (items.some((i) => i.trackId === trackId)) throw err(409, "ALREADY_IN_PLAYLIST");
  if (items.length >= 500) throw err(429, "PLAYLIST_FULL");
  const it: PlaylistItem = { id: id(), playlistId, trackId, position: items.length ? Math.max(...items.map((i) => i.position)) + 1 : 0, addedAt: nowIso() };
  await store().insert("playlist_items", it);
  await store().put("playlists", { ...p, updatedAt: nowIso(), version: p.version + 1 });
  return it;
}

export async function removeFromPlaylist(uid: string, playlistId: string, itemId: string) {
  await ownPlaylist(uid, playlistId);
  const it = await store().get<PlaylistItem>("playlist_items", itemId);
  if (!it || it.playlistId !== playlistId) throw notFound();
  await store().remove("playlist_items", itemId);
}

/** Saves a new order: `itemIds` must be exactly the playlist's items. */
export async function reorderPlaylist(uid: string, playlistId: string, itemIds: string[]) {
  const p = await ownPlaylist(uid, playlistId);
  const items = await store().list<PlaylistItem>("playlist_items", { playlistId });
  if (itemIds.length !== items.length || new Set(itemIds).size !== items.length || !items.every((i) => itemIds.includes(i.id))) throw err(409, "STALE_ORDER");
  for (const it of items) {
    const position = itemIds.indexOf(it.id);
    if (position !== it.position) await store().put("playlist_items", { ...it, position });
  }
  await store().put("playlists", { ...p, updatedAt: nowIso(), version: p.version + 1 });
  return playlistView(playlistId, uid);
}

/**
 * A playlist as this viewer may see it. Tracks the viewer can't play (private, unpublished, taken down, other
 * people's audition tracks) are left out for others, even inside a public playlist; the owner sees them marked.
 */
export async function playlistView(playlistId: string, viewerId: string | null) {
  const p = await store().get<Playlist>("playlists", playlistId);
  if (!p || (p.visibility === "private" && p.ownerId !== viewerId)) throw notFound();
  const items = (await store().list<PlaylistItem>("playlist_items", { playlistId })).sort((a, b) => a.position - b.position);
  const tracks = await Promise.all(items.map((i) => store().get<AudioTrack>("audio_tracks", i.trackId)));
  const visible: { item: PlaylistItem; track: AudioTrack }[] = [];
  let hidden = 0;
  for (let i = 0; i < items.length; i++) {
    const t = tracks[i];
    if (t && canPlay(t, await viewerFor(t, viewerId))) visible.push({ item: items[i], track: t });
    else hidden++;
  }
  const shown = await present(visible.map((v) => v.track), viewerId);
  const [owner] = Object.values(await ownerNames([p.ownerId]));
  return {
    playlist: { ...p, owner },
    items: visible.map((v, i) => ({ itemId: v.item.id, position: v.item.position, track: shown[i] })),
    hiddenCount: p.ownerId === viewerId ? hidden : 0,
    isOwner: p.ownerId === viewerId,
  };
}

export async function library(uid: string) {
  const [likes, saves, playlists] = await Promise.all([store().list<TrackLike>("track_likes", { userId: uid }), store().list<SavedTrack>("saved_tracks", { userId: uid }), store().list<Playlist>("playlists", { ownerId: uid })]);
  const load = async (ids: string[]) => {
    const ts = (await Promise.all(ids.map((x) => store().get<AudioTrack>("audio_tracks", x)))).filter((t): t is AudioTrack => !!t);
    const ok: AudioTrack[] = [];
    for (const t of ts) if (canPlay(t, await viewerFor(t, uid))) ok.push(t);
    return present(ok, uid);
  };
  return {
    saved: await load(saves.sort((a, b) => b.at.localeCompare(a.at)).map((s) => s.trackId)),
    liked: await load(likes.sort((a, b) => b.at.localeCompare(a.at)).map((l) => l.trackId)),
    playlists: await Promise.all(playlists.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(async (pl) => ({ ...pl, count: (await store().list<PlaylistItem>("playlist_items", { playlistId: pl.id })).length }))),
  };
}

// ------------------------------------------------------------------ plays (counted only after real listening)

export const listenerKeyFor = (userId: string | null, ip: string, ua: string | null) =>
  userId ?? `anon:${createHash("sha256").update(`${ip}|${ua ?? ""}|${nowIso().slice(0, 10)}|fk-music`).digest("hex").slice(0, 32)}`;

/** Called when playback really starts (not on page view). Nothing is counted yet. */
export async function startPlay(trackId: string, viewerId: string | null, listenerKey: string) {
  const t = await store().get<AudioTrack>("audio_tracks", trackId);
  if (!t || !canPlay(t, await viewerFor(t, viewerId))) throw notFound();
  const p: TrackPlay = {
    id: id(), trackId, ownerId: t.ownerId, listenerId: viewerId, listenerKey, sessionId: id(), startedAt: nowIso(), finishedAt: null, playedSeconds: 0, qualified: false, reason: "short",
  };
  await store().insert("track_plays", p);
  return { playId: p.id, sessionId: p.sessionId };
}

/** Called with the seconds actually listened (seeking forward does not add time). The server decides if it counts. */
export async function finishPlay(playId: string, sessionId: string, listenerKey: string, playedSeconds: number, userAgent: string | null) {
  const p = await store().get<TrackPlay>("track_plays", playId);
  if (!p || p.sessionId !== sessionId || p.listenerKey !== listenerKey || p.finishedAt) throw notFound();
  const t = await store().get<AudioTrack>("audio_tracks", p.trackId);
  const mine = await store().list<TrackPlay>("track_plays", { listenerKey });
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const windowStart = new Date(Date.now() - 30 * 60_000).toISOString();
  const verdict = judgePlay({
    durationSec: t?.durationSec ?? null,
    playedSeconds,
    elapsedSeconds: (Date.now() - Date.parse(p.startedAt)) / 1000,
    isOwner: !!p.listenerId && p.listenerId === p.ownerId,
    userAgent,
    recentQualified: mine.some((x) => x.trackId === p.trackId && x.qualified && x.id !== p.id && (x.finishedAt ?? x.startedAt) > windowStart),
    startsLastHour: mine.filter((x) => x.startedAt > hourAgo).length,
  });
  const next: TrackPlay = { ...p, finishedAt: nowIso(), playedSeconds: Math.max(0, Math.round(playedSeconds)), qualified: verdict.qualified, reason: verdict.reason };
  await store().put("track_plays", next);
  return { qualified: next.qualified, reason: next.reason };
}

// ------------------------------------------------------------------ discovery

export interface SearchInput {
  q?: string;
  genre?: string;
  city?: string;
  available?: boolean;
  bpmMin?: number;
  bpmMax?: number;
  key?: string;
  sort?: "relevance" | "recent" | "liked" | "trending";
  newDjs?: boolean;
}

export async function search(input: SearchInput, viewerId: string | null) {
  const q = (input.q ?? "").trim().toLowerCase();
  const city = (input.city ?? "").trim().toLowerCase();
  const djs = (await store().list<DjProfile>("dj_profiles")).filter((p) => p.visibility === "public");
  const allTracks = (await store().list<AudioTrack>("audio_tracks")).filter(isListed);
  const playlists = (await store().list<Playlist>("playlists")).filter((p) => p.visibility === "public" && p.kind === "dj");
  const byOwner = new Map<string, AudioTrack[]>();
  for (const t of allTracks) byOwner.set(t.ownerId, [...(byOwner.get(t.ownerId) ?? []), t]);
  const bpmOk = (t: AudioTrack) => (input.bpmMin == null || (t.bpm != null && t.bpm >= input.bpmMin)) && (input.bpmMax == null || (t.bpm != null && t.bpm <= input.bpmMax));
  const keyOk = (t: AudioTrack) => !input.key || t.musicalKey === input.key;
  const trackOk = (t: AudioTrack) => bpmOk(t) && keyOk(t) && (!input.genre || t.genre === input.genre);
  const djText = (p: DjProfile) => [p.stageName, p.city, p.country, ...p.regions, ...p.genres, p.bookingStatus].join(" ").toLowerCase();
  const ninetyDays = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const djMatches = djs.filter((p) => {
    const ts = byOwner.get(p.userId) ?? [];
    if (q && !djText(p).includes(q) && !ts.some((t) => t.title.toLowerCase().includes(q))) return false;
    if (input.genre && !p.genres.includes(input.genre as DjGenre) && !ts.some((t) => t.genre === input.genre)) return false;
    if (city && ![p.city, p.country, ...p.regions].some((x) => x.toLowerCase().includes(city))) return false;
    if (input.available && p.bookingStatus === "closed") return false;
    if ((input.bpmMin != null || input.bpmMax != null || input.key) && !ts.some((t) => bpmOk(t) && keyOk(t))) return false;
    if (input.newDjs && p.createdAt < ninetyDays) return false;
    return true;
  });
  const trackMatches = allTracks.filter((t) => {
    const owner = djs.find((p) => p.userId === t.ownerId);
    if (!trackOk(t)) return false;
    if (q && ![t.title, t.genre, t.musicalKey ?? "", String(t.bpm ?? ""), owner?.stageName ?? ""].join(" ").toLowerCase().includes(q)) return false;
    if (city && !owner) return false;
    if (city && owner && ![owner.city, owner.country, ...owner.regions].some((x) => x.toLowerCase().includes(city))) return false;
    if (input.available && owner?.bookingStatus === "closed") return false;
    if (input.newDjs && owner && owner.createdAt < ninetyDays) return false;
    return true;
  });
  const signals = await djSignals();
  const sig = (uid: string) => signals.find((s) => s.djId === uid);
  const likesOf = async (ts: AudioTrack[]) => (await trackCounts(ts.map((t) => t.id), null));
  const tc = await likesOf(trackMatches);
  if (input.sort === "recent") trackMatches.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  else if (input.sort === "liked") trackMatches.sort((a, b) => (tc[b.id]?.likes ?? 0) - (tc[a.id]?.likes ?? 0));
  else if (input.sort === "trending") trackMatches.sort((a, b) => (sig(b.ownerId)?.listeners30 ?? 0) - (sig(a.ownerId)?.listeners30 ?? 0));
  const cards = await Promise.all(djMatches.map(djCard));
  if (input.sort === "recent") cards.sort((a, b) => (b.topTrack?.publishedAt ?? b.createdAt).localeCompare(a.topTrack?.publishedAt ?? a.createdAt));
  else if (input.sort === "liked") cards.sort((a, b) => b.likes - a.likes);
  else if (input.sort === "trending") cards.sort((a, b) => (rankValue(signals, b.userId) - rankValue(signals, a.userId)));
  const pls = playlists.filter((p) => !q || p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  return {
    djs: cards.slice(0, 60),
    tracks: (await present(trackMatches.slice(0, 60), viewerId)),
    playlists: q ? await Promise.all(pls.slice(0, 20).map(async (pl) => ({ ...pl, owner: (await ownerNames([pl.ownerId]))[pl.ownerId] }))) : [],
  };
}
const rankValue = (signals: DjSignals[], uid: string) => rankDjs(signals, "trending").find((s) => s.djId === uid)?.value ?? 0;

/** Signals per DJ for rankings, from stored likes, saves, counted plays and confirmed bookings (30-day window). */
async function djSignals(): Promise<DjSignals[]> {
  const djs = (await store().list<DjProfile>("dj_profiles")).filter((p) => p.visibility === "public");
  const now = Date.now();
  const from = new Date(now - RANK_WINDOW_DAYS * 86_400_000).toISOString();
  const prev = new Date(now - 2 * RANK_WINDOW_DAYS * 86_400_000).toISOString();
  const [likes, saves, plays, bookings, tracks] = await Promise.all([
    store().list<TrackLike>("track_likes"), store().list<SavedTrack>("saved_tracks"), store().list<TrackPlay>("track_plays", { qualified: true }),
    store().list<BookingRequest>("dj_booking_requests", { status: "confirmed" }), store().list<AudioTrack>("audio_tracks"),
  ]);
  const listed = new Set(tracks.filter(isListed).map((t) => t.id));
  return djs.map((p) => {
    const mine = (x: { ownerId: string; trackId: string }) => x.ownerId === p.userId && listed.has(x.trackId);
    const p30 = plays.filter((x) => mine(x) && x.startedAt >= from);
    const pPrev = plays.filter((x) => mine(x) && x.startedAt >= prev && x.startedAt < from);
    const firsts = tracks.filter((t) => t.ownerId === p.userId && t.publishedAt && listed.has(t.id)).map((t) => t.publishedAt!).sort();
    return {
      djId: p.userId,
      plays30: p30.length,
      listeners30: new Set(p30.map((x) => x.listenerKey)).size,
      listenersPrev30: new Set(pPrev.map((x) => x.listenerKey)).size,
      likes30: likes.filter((x) => mine(x) && x.at >= from).length,
      saves30: saves.filter((x) => mine(x) && x.at >= from).length,
      bookings30: bookings.filter((b) => b.djId === p.userId && b.updatedAt >= from).length,
      firstPublishedAt: firsts[0] ?? null,
    };
  });
}

export async function djRankings(board: RankBoard) {
  const ranked = rankDjs(await djSignals(), board).slice(0, 20);
  const profiles = await Promise.all(ranked.map((r) => store().get<DjProfile>("dj_profiles", r.djId)));
  return Promise.all(
    ranked.map(async (r, i) => ({
      rank: i + 1, value: r.value, plays30: r.plays30, listeners30: r.listeners30, likes30: r.likes30, saves30: r.saves30, bookings30: r.bookings30,
      dj: await djCard(profiles[i]!),
    })),
  );
}

/** DJ ARENA landing: top (trending), middle (featured, new mixes, popular playlists, open DJ calls), bottom (all DJs by genre). */
export async function arena(viewerId: string | null) {
  const [trending, all] = await Promise.all([djRankings("trending"), store().list<DjProfile>("dj_profiles")]);
  const djs = await Promise.all(all.filter((p) => p.visibility === "public").map(djCard));
  const newest = (await store().list<AudioTrack>("audio_tracks")).filter(isListed).sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")).slice(0, 12);
  const pls = (await store().list<Playlist>("playlists")).filter((p) => p.visibility === "public" && p.kind === "dj");
  const plScored = await Promise.all(
    pls.map(async (pl) => {
      const items = await store().list<PlaylistItem>("playlist_items", { playlistId: pl.id });
      const ts = (await Promise.all(items.map((i) => store().get<AudioTrack>("audio_tracks", i.trackId)))).filter((t): t is AudioTrack => !!t && isListed(t));
      const likes = (await Promise.all(ts.map((t) => store().list<TrackLike>("track_likes", { trackId: t.id })))).reduce((a, l) => a + l.length, 0);
      return { ...pl, count: ts.length, likes, owner: (await ownerNames([pl.ownerId]))[pl.ownerId] };
    }),
  );
  // Open DJ calls from the existing event recruiting (ops openings for the DJ performer requirement).
  const openings = (await store().list<Opening>("openings", { status: "open", kind: "open" })).slice(-50);
  const calls = (
    await Promise.all(
      openings.map(async (o) => {
        const reqs = (await Promise.all(o.requirementIds.map((r) => store().get<Requirement>("requirements", r)))).filter(Boolean) as Requirement[];
        if (!reqs.some((r) => r.key === "dj_performer")) return null;
        const e = await store().get<OpsEvent>("events", o.eventId);
        if (!e || e.endAt < nowIso()) return null;
        return { openingId: o.id, event: e.name, city: e.city, startAt: e.startAt, genres: e.genres, budgetUsd: o.budgetUsd, demo: !!(e as OpsEvent & { demo?: boolean }).demo };
      }),
    )
  ).filter(Boolean);
  return {
    trending: trending.slice(0, 5),
    featured: trending[0]?.dj ?? djs.sort((a, b) => b.likes - a.likes)[0] ?? null,
    newMixes: await present(newest, viewerId),
    playlists: plScored.filter((p) => p.count > 0).sort((a, b) => b.likes - a.likes || b.count - a.count).slice(0, 8),
    calls: calls.slice(0, 6),
    djs,
    genres: DJ_GENRES,
  };
}

// ------------------------------------------------------------------ availability calendar

export async function setDays(uid: string, days: { day: string; status: DayStatus | "clear"; note?: string }[]) {
  const p = await myDjProfile(uid);
  if (!p) throw err(400, "DJ_PROFILE_REQUIRED");
  for (const d of days.slice(0, 62)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.day)) continue;
    const key = `${uid}:${d.day}`;
    const cur = await store().get<DjAvailability>("dj_availability", key);
    if (cur?.bookingId && d.status !== "booked") {
      const b = await store().get<BookingRequest>("dj_booking_requests", cur.bookingId);
      if (b?.status === "confirmed") throw err(409, "DAY_HAS_CONFIRMED_BOOKING", { day: d.day });
    }
    if (d.status === "clear") await store().remove("dj_availability", key);
    else await store().put<DjAvailability>("dj_availability", { djId: uid, day: d.day, status: d.status, note: (d.note ?? cur?.note ?? "").slice(0, 200), bookingId: cur?.bookingId ?? null, updatedAt: nowIso() });
  }
  return myDays(uid);
}

export async function myDays(uid: string) {
  return (await store().list<DjAvailability>("dj_availability", { djId: uid })).sort((a, b) => a.day.localeCompare(b.day));
}

/** Conflict warning for a proposed set time (used while filling in a request and when the DJ answers). */
export async function checkConflicts(djId: string, start: string, end: string, selfId?: string) {
  const p = await store().get<DjProfile>("dj_profiles", djId);
  if (!p) throw notFound();
  const [days, bookings] = await Promise.all([store().list<DjAvailability>("dj_availability", { djId }), store().list<BookingRequest>("dj_booking_requests", { djId })]);
  return conflictsFor(start, end, p.bufferHours, days, bookings, selfId).map((c) => ({ kind: c.kind === "booked" ? "booking" : c.kind, day: c.day }));
}

// ------------------------------------------------------------------ booking requests (organizers) and CONTACT DJ

const REQUESTS_PER_DAY = 10;
const OPEN_PER_PAIR = 2;

export interface BookingInput {
  kind: "booking" | "inquiry";
  djSlug: string;
  eventId?: string | null;
  event?: Partial<BookingEventInfo>;
  terms?: Partial<BookingTerms>;
  message: string;
  send: boolean;
}

function cleanTerms(t: Partial<BookingTerms>, base?: BookingTerms): BookingTerms {
  const start = t.performanceStart ?? base?.performanceStart ?? nowIso();
  const end = t.performanceEnd ?? base?.performanceEnd ?? new Date(Date.parse(start) + 2 * 3_600_000).toISOString();
  if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || Date.parse(end) <= Date.parse(start)) throw err(400, "INVALID_INPUT", { field: "performanceEnd" });
  return {
    feeAmount: Math.max(0, Math.min(10_000_000, Math.round(t.feeAmount ?? base?.feeAmount ?? 0))),
    currency: (t.currency ?? base?.currency ?? "USD").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "USD",
    performanceStart: new Date(start).toISOString(),
    performanceEnd: new Date(end).toISOString(),
    setMinutes: Math.max(15, Math.min(720, Math.round(t.setMinutes ?? base?.setMinutes ?? Math.round((Date.parse(end) - Date.parse(start)) / 60_000)))),
    travel: (t.travel ?? base?.travel ?? "").slice(0, 500),
    accommodation: (t.accommodation ?? base?.accommodation ?? "").slice(0, 500),
    equipment: (t.equipment ?? base?.equipment ?? "").slice(0, 500),
    notes: (t.notes ?? base?.notes ?? "").slice(0, 1000),
  };
}

export async function createBooking(uid: string, input: BookingInput) {
  const u = await verifiedUser(uid);
  const [dj] = await store().list<DjProfile>("dj_profiles", { slug: input.djSlug });
  if (!dj || dj.visibility !== "public" || dj.userId === uid) throw notFound();
  if (await store().get<Block>("blocks", `${dj.userId}:${uid}`)) throw err(403, "NOT_ACCEPTING");
  const role = await viewerRole(uid);
  if (input.kind === "booking") {
    if (!role.organizer) throw err(403, "ORGANIZERS_ONLY");
    if (dj.bookingStatus === "closed") throw err(403, "NOT_ACCEPTING");
  } else if (!(dj.contactPolicy === "anyone" || (dj.contactPolicy === "organizers" && role.organizer))) throw err(403, "NOT_ACCEPTING");
  const mineAll = await store().list<BookingRequest>("dj_booking_requests", { requesterId: uid });
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  if (mineAll.filter((b) => b.createdAt > dayAgo).length >= REQUESTS_PER_DAY) throw err(429, "REQUEST_LIMIT");
  if (mineAll.filter((b) => b.djId === dj.userId && ["draft", "sent", "viewed", "negotiating", "accepted"].includes(b.status) && !isExpired(b)).length >= OPEN_PER_PAIR) throw err(429, "TOO_MANY_OPEN");
  // Autofill from an existing event the requester manages (server-side, so it can't be faked).
  let event: BookingEventInfo = { name: "", country: "", city: "", venue: "", genres: [], listPublicly: false, ...input.event } as BookingEventInfo;
  let terms = input.terms ?? {};
  let eventId: string | null = null;
  if (input.eventId) {
    const ev = role.events.find((e) => e.id === input.eventId);
    if (!ev) throw notFound();
    eventId = ev.id;
    event = { name: ev.name, country: ev.country, city: ev.city, venue: ev.venue, genres: ev.genres, listPublicly: !!input.event?.listPublicly };
    terms = { performanceStart: ev.startAt, performanceEnd: ev.endAt, ...terms };
  }
  event = { name: event.name.trim().slice(0, 100), country: (event.country ?? "").slice(0, 60), city: (event.city ?? "").slice(0, 60), venue: (event.venue ?? "").slice(0, 100), genres: (event.genres ?? []).slice(0, 8).map((g) => g.slice(0, 32)), listPublicly: !!event.listPublicly };
  if (input.kind === "booking" && !event.name) throw err(400, "INVALID_INPUT", { field: "eventName" });
  const message = input.message.trim().slice(0, 2000);
  if (!message) throw err(400, "INVALID_INPUT", { field: "message" });
  const name = (await ops.displayNameOf(uid)) || u.email.split("@")[0];
  const b: BookingRequest = {
    id: id(), kind: input.kind, djId: dj.userId, requesterId: uid, requesterName: name, eventId, event, terms: cleanTerms(terms),
    status: "draft", termsVersion: 1, djAcceptedVersion: null, awaiting: null, detailsRequested: null,
    respondBy: new Date(Date.now() + 14 * 86_400_000).toISOString(), viewedAt: null,
    history: [{ at: nowIso(), by: uid, action: "created", status: "draft" }], createdAt: nowIso(), updatedAt: nowIso(), version: 1,
  };
  await store().insert("dj_booking_requests", b);
  if (input.kind === "booking") await store().insert<BookingOffer>("booking_offers", { id: id(), bookingId: b.id, terms: b.terms, termsVersion: 1, proposedBy: uid, status: "proposed", createdAt: nowIso() });
  await postBookingMessage(uid, b, message);
  if (input.send) return act(uid, b.id, "send", {});
  return bookingView(uid, b.id);
}

async function postBookingMessage(uid: string, b: BookingRequest, body: string, attachment?: { id: string; name: string; mime: string; size: number }) {
  // Same message record and table as event threads (ops_messages); the thread is the booking instead of an event.
  const m: Message & { bookingId: string; attachment?: typeof attachment } = {
    id: id(), eventId: null, bookingId: b.id, thread: "dj", authorId: uid, authorName: uid === b.requesterId ? b.requesterName : (await store().get<DjProfile>("dj_profiles", b.djId))?.stageName ?? "DJ",
    body: body.slice(0, 2000), at: nowIso(), ...(attachment ? { attachment } : {}),
  };
  await store().insert("messages", m);
  return m;
}

function sideOf(uid: string, b: BookingRequest): "dj" | "requester" | null {
  return uid === b.djId ? "dj" : uid === b.requesterId ? "requester" : null;
}

async function loadBooking(uid: string, bookingId: string) {
  const b = await store().get<BookingRequest>("dj_booking_requests", bookingId);
  if (!b) throw notFound();
  const side = sideOf(uid, b);
  if (!side) throw notFound();
  if (isExpired(b)) {
    const next = { ...b, status: "expired" as const, awaiting: null, history: [...b.history, { at: nowIso(), by: "system", action: "expire", status: "expired" as const }], version: b.version + 1 };
    await store().put("dj_booking_requests", next);
    return { b: next, side };
  }
  return { b, side };
}

export async function bookingView(uid: string, bookingId: string) {
  let { b, side } = await loadBooking(uid, bookingId);
  if (side === "dj" && b.status === "sent") {
    b = await apply(b, uid, "view", "viewed");
    await notify(b.requesterId, "notif.bookingViewed", { dj: (await myDjProfile(b.djId))?.stageName ?? "DJ", link: `/profile/dj?tab=bookings&b=${b.id}` }, `booking-viewed:${b.id}`);
  }
  const [msgs, offers, dj] = await Promise.all([
    store().list<Message & { bookingId?: string; attachment?: { id: string; name: string; mime: string; size: number } }>("messages", { bookingId: b.id }),
    store().list<BookingOffer>("booking_offers", { bookingId: b.id }),
    store().get<DjProfile>("dj_profiles", b.djId),
  ]);
  const conflicts = b.kind === "booking" ? await checkConflicts(b.djId, b.terms.performanceStart, b.terms.performanceEnd, b.id) : [];
  return {
    booking: b,
    side,
    dj: dj ? { stageName: dj.stageName, slug: dj.slug } : null,
    messages: msgs.sort((a, c) => a.at.localeCompare(c.at)).slice(-300),
    offers: offers.sort((a, c) => a.termsVersion - c.termsVersion),
    conflicts,
    blocked: side === "dj" ? !!(await store().get<Block>("blocks", `${b.djId}:${b.requesterId}`)) : false,
  };
}

async function apply(b: BookingRequest, uid: string, action: string, status: BookingRequest["status"], patch: Partial<BookingRequest> = {}) {
  const next: BookingRequest = { ...b, ...patch, status, updatedAt: nowIso(), history: [...b.history, { at: nowIso(), by: uid, action, status }], version: b.version + 1 };
  await store().put("dj_booking_requests", next, b.version);
  return next;
}

export async function myBookings(uid: string) {
  const [asDj, asReq] = await Promise.all([store().list<BookingRequest>("dj_booking_requests", { djId: uid }), store().list<BookingRequest>("dj_booking_requests", { requesterId: uid })]);
  const fix = (b: BookingRequest) => (isExpired(b) ? { ...b, status: "expired" as const } : b);
  const names = await ownerNames(asReq.map((b) => b.djId));
  return {
    received: asDj.filter((b) => b.status !== "draft").map(fix).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    sent: asReq.map(fix).map((b) => ({ ...b, djName: names[b.djId]?.stageName ?? "DJ" })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  };
}

export async function act(uid: string, bookingId: string, action: BookingAction | "message", payload: { terms?: Partial<BookingTerms>; message?: string; confirm?: boolean; reason?: string; termsVersion?: number }) {
  const { b, side } = await loadBooking(uid, bookingId);
  if (action === "message") {
    const text = (payload.message ?? "").trim();
    if (!text) throw err(400, "EMPTY");
    if (["declined", "cancelled", "expired"].includes(b.status)) throw err(409, "BOOKING_CLOSED");
    if (side === "requester" && (await store().get<Block>("blocks", `${b.djId}:${uid}`))) throw err(403, "NOT_ACCEPTING");
    const recent = (await store().list<Message & { bookingId?: string }>("messages", { bookingId: b.id })).filter((m) => m.authorId === uid && m.at > new Date(Date.now() - 60_000).toISOString());
    if (recent.length >= 8) throw err(429, "RATE_LIMITED");
    await postBookingMessage(uid, b, text);
    const other = side === "dj" ? b.requesterId : b.djId;
    await notify(other, "notif.bookingMessage", { link: side === "dj" ? `/profile/dj?tab=bookings&b=${b.id}` : `/profile/dj?tab=bookings&b=${b.id}` }, `booking-msg:${b.id}:${Math.floor(Date.now() / 600_000)}`);
    return bookingView(uid, bookingId);
  }
  const to = nextStatus(b, action, side);
  if (!to) throw err(409, "INVALID_TRANSITION", { status: b.status });
  // Acceptance and confirmation are always for one exact version of the terms (no accepting stale terms).
  if ((action === "accept" || action === "confirm") && payload.termsVersion !== b.termsVersion) throw err(409, "TERMS_CHANGED");
  if ((action === "confirm" || action === "cancel") && !payload.confirm) throw err(400, "CONFIRMATION_REQUIRED");
  const djName = (await myDjProfile(b.djId))?.stageName ?? "DJ";
  let next: BookingRequest;
  const link = `/profile/dj?tab=bookings&b=${b.id}`;
  switch (action) {
    case "send":
      next = await apply(b, uid, action, to, { awaiting: "dj" });
      await notify(b.djId, b.kind === "booking" ? "notif.bookingReceived" : "notif.contactReceived", { from: b.requesterName, event: b.event.name || "—", link }, `booking-sent:${b.id}`);
      break;
    case "view":
      next = await apply(b, uid, action, to);
      break;
    case "accept": {
      const conflicts = await checkConflicts(b.djId, b.terms.performanceStart, b.terms.performanceEnd, b.id);
      if (conflicts.some((c) => c.kind === "booking") && !payload.confirm) throw err(409, "DATE_CONFLICT", { conflicts });
      next = await apply(b, uid, action, to, { djAcceptedVersion: b.termsVersion, awaiting: "requester" });
      await store().put("booking_offers", { ...(await latestOffer(b.id)), status: "accepted" });
      await notify(b.requesterId, "notif.bookingAccepted", { dj: djName, link }, `booking-accepted:${b.id}:${b.termsVersion}`);
      break;
    }
    case "decline":
      next = await apply(b, uid, action, to, { awaiting: null });
      await notify(b.requesterId, "notif.bookingDeclined", { dj: djName, link }, `booking-declined:${b.id}`);
      break;
    case "counter": {
      if (!payload.terms) throw err(400, "INVALID_INPUT", { field: "terms" });
      const terms = cleanTerms(payload.terms, b.terms);
      const prev = await latestOffer(b.id);
      if (prev) await store().put("booking_offers", { ...prev, status: "superseded" });
      await store().insert<BookingOffer>("booking_offers", { id: id(), bookingId: b.id, terms, termsVersion: b.termsVersion + 1, proposedBy: uid, status: "proposed", createdAt: nowIso() });
      next = await apply(b, uid, action, to, { terms, termsVersion: b.termsVersion + 1, djAcceptedVersion: null, awaiting: side === "dj" ? "requester" : "dj" });
      if (payload.message?.trim()) await postBookingMessage(uid, next, payload.message.trim());
      await notify(side === "dj" ? b.requesterId : b.djId, "notif.bookingCounter", { link }, `booking-counter:${b.id}:${next.termsVersion}`);
      break;
    }
    case "request_details": {
      const q = (payload.message ?? "").trim().slice(0, 1000);
      if (!q) throw err(400, "INVALID_INPUT", { field: "message" });
      next = await apply(b, uid, action, to, { detailsRequested: q, awaiting: "requester" });
      await postBookingMessage(uid, next, q);
      await notify(b.requesterId, "notif.bookingDetails", { dj: djName, link }, `booking-details:${b.id}:${next.version}`);
      break;
    }
    case "confirm": {
      const conflicts = await checkConflicts(b.djId, b.terms.performanceStart, b.terms.performanceEnd, b.id);
      if (conflicts.some((c) => c.kind === "booking")) throw err(409, "DATE_CONFLICT", { conflicts });
      next = await apply(b, uid, action, to, { awaiting: null });
      // The DJ's calendar shows the day as booked (details stay private).
      const day = b.terms.performanceStart.slice(0, 10);
      const cur = await store().get<DjAvailability>("dj_availability", `${b.djId}:${day}`);
      await store().put<DjAvailability>("dj_availability", { djId: b.djId, day, status: "booked", note: cur?.note ?? "", bookingId: b.id, updatedAt: nowIso() });
      await notify(b.djId, "notif.bookingConfirmed", { event: b.event.name, link }, `booking-confirmed:${b.id}`);
      await audit(uid, "booking.confirmed", "booking", b.id, { djId: b.djId, termsVersion: b.termsVersion });
      break;
    }
    case "cancel": {
      next = await apply(b, uid, action, to, { awaiting: null });
      const day = b.terms.performanceStart.slice(0, 10);
      const cur = await store().get<DjAvailability>("dj_availability", `${b.djId}:${day}`);
      if (cur?.bookingId === b.id) await store().remove("dj_availability", `${b.djId}:${day}`);
      if (payload.reason?.trim()) await postBookingMessage(uid, next, payload.reason.trim());
      await notify(side === "dj" ? b.requesterId : b.djId, "notif.bookingCancelled", { link }, `booking-cancelled:${b.id}`);
      if (b.status === "confirmed") await audit(uid, "booking.cancelled_after_confirm", "booking", b.id, {}, payload.reason ?? "");
      break;
    }
    default:
      throw err(409, "INVALID_TRANSITION");
  }
  return bookingView(uid, next.id);
}

async function latestOffer(bookingId: string) {
  return (await store().list<BookingOffer>("booking_offers", { bookingId })).sort((a, b) => b.termsVersion - a.termsVersion)[0];
}

/** Attachments in a booking thread: same file rules as event documents (PDF/PNG/JPEG/WebP, 5 MB), sniffed. */
export async function attachToBooking(uid: string, bookingId: string, input: { name: string; data: Buffer }) {
  const { b } = await loadBooking(uid, bookingId);
  if (["declined", "cancelled", "expired"].includes(b.status)) throw err(409, "BOOKING_CLOSED");
  if (input.data.length > DOC_MAX) throw err(413, "FILE_TOO_LARGE");
  const mime = input.data.subarray(0, 4).toString() === "%PDF" ? "application/pdf" : sniffImage(input.data);
  if (!mime) throw err(415, "FILE_TYPE");
  const fid = id();
  await store().putBlob(`bk:${fid}`, null, mime, input.data);
  await store().insert("music_images", { id: fid, ownerId: uid, mime, size: input.data.length, at: nowIso(), kind: "booking_file", bookingId: b.id, name: input.name.slice(0, 120) });
  await postBookingMessage(uid, b, input.name.slice(0, 120), { id: fid, name: input.name.slice(0, 120), mime, size: input.data.length });
  return bookingView(uid, bookingId);
}
export async function readBookingFile(uid: string, fileId: string) {
  const meta = await store().get<{ kind?: string; bookingId?: string; mime: string; name?: string }>("music_images", fileId);
  if (!meta || meta.kind !== "booking_file" || !meta.bookingId) throw notFound();
  await loadBooking(uid, meta.bookingId);
  const blob = await store().getBlob(`bk:${fileId}`);
  if (!blob) throw notFound();
  return { meta, blob };
}

/** DJ blocks a requester (existing party blocks table: the blocker is userId). */
export async function setBlock(uid: string, targetId: string, on: boolean) {
  if (uid === targetId) throw err(400, "INVALID_INPUT");
  const key = `${uid}:${targetId}`;
  if (on) await store().put<Block>("blocks", { userId: uid, organizerId: targetId, at: nowIso() });
  else await store().remove("blocks", key);
  await audit(uid, on ? "user.blocked" : "user.unblocked", "user", targetId);
  return { blocked: on };
}

export async function report(uid: string, input: { targetType: MusicReport["targetType"]; targetId: string; reason: MusicReport["reason"]; details: string }) {
  await verifiedUser(uid);
  const mine = await store().list<MusicReport>("music_reports", { reporterId: uid });
  if (mine.filter((r) => r.createdAt > new Date(Date.now() - 86_400_000).toISOString()).length >= 20) throw err(429, "RATE_LIMITED");
  const r: MusicReport = { id: id(), reporterId: uid, targetType: input.targetType, targetId: input.targetId, reason: input.reason, details: input.details.slice(0, 1000), status: "open", createdAt: nowIso() };
  await store().insert("music_reports", r);
  return r;
}

// ------------------------------------------------------------------ applications with audio (existing ops recruiting)

/** Tracks a DJ may attach to an application: their own, playable by reviewers (public, unlisted or audition). */
export async function attachableTracks(uid: string) {
  return (await store().list<AudioTrack>("audio_tracks", { ownerId: uid }))
    .filter((t) => t.processingStatus === "ready" && t.publicationStatus === "published" && t.rightsStatus === "staff_reviewed" && t.visibility !== "private")
    .map(publicTrack);
}

export async function assertAttachable(uid: string, trackIds: string[]) {
  const ok = new Set((await attachableTracks(uid)).map((t) => t.id));
  if (!trackIds.every((x) => ok.has(x))) throw err(400, "TRACK_NOT_ATTACHABLE");
}

/** Attached tracks of applications for an event, as its reviewers may play them. */
export async function applicationTracks(uid: string, eventId: string) {
  const m = await store().get<EventMember>("members", `${eventId}:${uid}`);
  if (!can(m, "decide_applications")) return {};
  const apps = (await store().list<Application & { trackIds?: string[] }>("applications", { eventId })).filter((a) => a.trackIds?.length);
  const out: Record<string, Awaited<ReturnType<typeof present>>> = {};
  for (const a of apps) {
    const ts = (await Promise.all(a.trackIds!.map((x) => store().get<AudioTrack>("audio_tracks", x)))).filter((t): t is AudioTrack => !!t);
    const ok: AudioTrack[] = [];
    for (const t of ts) if (canPlay(t, await viewerFor(t, uid))) ok.push(t);
    out[a.id] = await present(ok, uid);
  }
  const profiles: Record<string, { stageName: string; slug: string; city: string; genres: string[] }> = {};
  for (const a of apps) {
    const p = await store().get<DjProfile>("dj_profiles", a.applicantId);
    if (p) profiles[a.id] = { stageName: p.stageName, slug: p.slug, city: p.city, genres: p.genres };
  }
  return { tracks: out, profiles };
}

/** Genre fit of DJs for an event (shown as a hint, never acts on its own). */
export async function suggestDjs(eventGenres: string[]) {
  const djs = (await store().list<DjProfile>("dj_profiles")).filter((p) => p.visibility === "public" && p.bookingStatus !== "closed");
  return (await Promise.all(djs.map(async (p) => ({ fit: genreFit(eventGenres, p.genres), dj: await djCard(p) }))))
    .filter((x) => x.fit > 0 && x.dj.trackCount > 0)
    .sort((a, b) => b.fit - a.fit || b.dj.likes - a.dj.likes)
    .slice(0, 6);
}

// ------------------------------------------------------------------ analytics (only what is measured)

export async function analytics(uid: string) {
  const tracks = await store().list<AudioTrack>("audio_tracks", { ownerId: uid });
  const [plays, likes, saves, received, items] = await Promise.all([
    store().list<TrackPlay>("track_plays", { ownerId: uid }), store().list<TrackLike>("track_likes", { ownerId: uid }), store().list<SavedTrack>("saved_tracks", { ownerId: uid }),
    store().list<BookingRequest>("dj_booking_requests", { djId: uid }), store().list<PlaylistItem>("playlist_items"),
  ]);
  const myIds = new Set(tracks.map((t) => t.id));
  const playlists = await store().list<Playlist>("playlists");
  const otherPlaylistAdds = items.filter((i) => myIds.has(i.trackId) && playlists.find((p) => p.id === i.playlistId)?.ownerId !== uid);
  const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const counted = plays.filter((p) => p.qualified);
  const excluded: Record<string, number> = {};
  for (const p of plays.filter((x) => !x.qualified && x.finishedAt)) excluded[p.reason ?? "short"] = (excluded[p.reason ?? "short"] ?? 0) + 1;
  return {
    totals: {
      plays: counted.length,
      plays30: counted.filter((p) => p.startedAt >= from).length,
      listeners: new Set(counted.map((p) => p.listenerKey)).size,
      listeners30: new Set(counted.filter((p) => p.startedAt >= from).map((p) => p.listenerKey)).size,
      likes: likes.length,
      saves: saves.length,
      playlistAdds: otherPlaylistAdds.length,
      bookingRequests: received.filter((b) => b.status !== "draft" && b.kind === "booking").length,
      inquiries: received.filter((b) => b.status !== "draft" && b.kind === "inquiry").length,
      confirmed: received.filter((b) => b.status === "confirmed").length,
    },
    excluded,
    tracks: tracks.map((t) => ({
      id: t.id, title: t.title,
      plays: counted.filter((p) => p.trackId === t.id).length,
      listeners: new Set(counted.filter((p) => p.trackId === t.id).map((p) => p.listenerKey)).size,
      likes: likes.filter((l) => l.trackId === t.id).length,
      saves: saves.filter((s) => s.trackId === t.id).length,
      playlistAdds: otherPlaylistAdds.filter((i) => i.trackId === t.id).length,
    })),
  };
}

// ------------------------------------------------------------------ copyright claims and takedown

export async function fileClaim(uid: string | null, input: { trackId: string; claimantName: string; claimantEmail: string; work: string; details: string; goodFaith: boolean }) {
  if (!input.goodFaith) throw err(400, "CONFIRMATION_REQUIRED");
  const t = await store().get<AudioTrack>("audio_tracks", input.trackId);
  if (!t || !(canPlay(t, { id: null }) || (uid && canPlay(t, await viewerFor(t, uid))))) throw notFound();
  const c: CopyrightClaim = {
    id: id(), trackId: t.id, ownerId: t.ownerId, claimantId: uid, claimantName: input.claimantName.slice(0, 120), claimantEmail: input.claimantEmail.slice(0, 200),
    work: input.work.slice(0, 300), details: input.details.slice(0, 3000), status: "open", counter: null, resolution: "", history: [{ at: nowIso(), by: uid ?? "anonymous", action: "filed" }], createdAt: nowIso(),
  };
  await store().insert("copyright_claims", c);
  // A claim may come from someone without an account: the audit row then has no actor (actor_id is nullable).
  await audit(uid ?? (null as unknown as string), "claim.filed", "track", t.id, { claimId: c.id });
  return { id: c.id, status: c.status };
}

/** Staff: uphold (take the track down, counts as a strike) or dismiss. */
export async function decideClaim(adminUid: string, claimId: string, input: { decision: "uphold" | "dismiss" | "restore"; resolution: string }) {
  await assertAdmin(adminUid);
  const c = await store().get<CopyrightClaim>("copyright_claims", claimId);
  if (!c) throw notFound();
  const t = await store().get<AudioTrack>("audio_tracks", c.trackId);
  const res = input.resolution.trim().slice(0, 1000);
  if (!res) throw err(400, "INVALID_INPUT", { field: "resolution" });
  let status: CopyrightClaim["status"];
  if (input.decision === "uphold") {
    if (!["open", "countered"].includes(c.status)) throw err(409, "INVALID_TRANSITION");
    status = "upheld";
    if (t) await store().put("audio_tracks", { ...t, publicationStatus: "removed", updatedAt: nowIso(), version: t.version + 1 });
    await notify(c.ownerId, "notif.trackRemoved", { title: t?.title ?? "—", link: "/profile/dj?tab=tracks" }, `claim-upheld:${c.id}`);
  } else if (input.decision === "dismiss") {
    if (c.status !== "open") throw err(409, "INVALID_TRANSITION");
    status = "dismissed";
  } else {
    if (!["countered", "upheld"].includes(c.status)) throw err(409, "INVALID_TRANSITION");
    status = "restored";
    if (t && t.publicationStatus === "removed") await store().put("audio_tracks", { ...t, publicationStatus: t.rightsStatus === "staff_reviewed" ? "published" : "draft", updatedAt: nowIso(), version: t.version + 1 });
    await notify(c.ownerId, "notif.trackRestored", { title: t?.title ?? "—", link: "/profile/dj?tab=tracks" }, `claim-restored:${c.id}`);
  }
  const next = { ...c, status, resolution: res, history: [...c.history, { at: nowIso(), by: adminUid, action: input.decision }] };
  await store().put("copyright_claims", next);
  await audit(adminUid, `claim.${input.decision}`, "track", c.trackId, { claimId: c.id }, res);
  return next;
}

/** The uploader's counter-notice on a taken-down track. Staff decide; nothing is restored automatically. */
export async function counterClaim(uid: string, claimId: string, statement: string) {
  const c = await store().get<CopyrightClaim>("copyright_claims", claimId);
  if (!c || c.ownerId !== uid) throw notFound();
  if (c.status !== "upheld") throw err(409, "INVALID_TRANSITION");
  const s = statement.trim().slice(0, 3000);
  if (s.length < 20) throw err(400, "INVALID_INPUT", { field: "statement" });
  const next = { ...c, status: "countered" as const, counter: { statement: s, at: nowIso() }, history: [...c.history, { at: nowIso(), by: uid, action: "counter" }] };
  await store().put("copyright_claims", next);
  await audit(uid, "claim.counter", "track", c.trackId, { claimId: c.id });
  return next;
}

export async function myClaims(uid: string) {
  return (await store().list<CopyrightClaim>("copyright_claims", { ownerId: uid })).map((c) => ({ ...c, claimantEmail: undefined }));
}

// ------------------------------------------------------------------ admin

export async function adminOverview(adminUid: string) {
  await assertAdmin(adminUid);
  const [tracks, claims, reports, auditRows] = await Promise.all([
    store().list<AudioTrack>("audio_tracks"), store().list<CopyrightClaim>("copyright_claims"), store().list<MusicReport>("music_reports"), store().list<PartyAudit>("party_audit"),
  ]);
  const names = await ownerNames(tracks.filter((t) => t.publicationStatus === "pending_review").map((t) => t.ownerId));
  return {
    settings: await settings(),
    storage: storageInfo(),
    pending: tracks.filter((t) => t.publicationStatus === "pending_review").map((t) => ({ ...publicTrack(t), rights: t.rights, owner: names[t.ownerId], fileName: t.fileName, codec: t.codec, sizeBytes: t.sizeBytes })),
    claims: claims.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100),
    reports: reports.filter((r) => r.status === "open").slice(-100),
    audit: auditRows.filter((a) => a.action.startsWith("music.")).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 100),
    counts: { tracks: tracks.length, published: tracks.filter((t) => t.publicationStatus === "published").length, failed: tracks.filter((t) => t.processingStatus === "failed").length },
  };
}

/** Staff decision on a track's rights. "approve" = staff read the statement and documents, nothing more. */
export async function reviewTrack(adminUid: string, trackId: string, input: { decision: "approve" | "reject"; note: string }) {
  await assertAdmin(adminUid);
  const t = await store().get<AudioTrack>("audio_tracks", trackId);
  if (!t || t.publicationStatus !== "pending_review") throw notFound();
  const note = input.note.trim().slice(0, 1000);
  if (input.decision === "reject" && !note) throw err(400, "INVALID_INPUT", { field: "note" });
  const next: AudioTrack =
    input.decision === "approve"
      ? { ...t, rightsStatus: "staff_reviewed", publicationStatus: "published", publishedAt: t.publishedAt ?? nowIso(), reviewNote: note || null, updatedAt: nowIso(), version: t.version + 1 }
      : { ...t, rightsStatus: "rejected", publicationStatus: "rejected", reviewNote: note, updatedAt: nowIso(), version: t.version + 1 };
  await store().put("audio_tracks", next);
  await audit(adminUid, `review.${input.decision}`, "track", t.id, {}, note);
  await notify(t.ownerId, input.decision === "approve" ? "notif.trackApproved" : "notif.trackRejected", { title: t.title, link: "/profile/dj?tab=tracks" }, `review:${t.id}:${t.version}`);
  return next;
}

export async function saveSettings(adminUid: string, input: Partial<Omit<MusicSettings, "id" | "updatedAt" | "updatedBy">>) {
  await assertAdmin(adminUid);
  const cur = await settings();
  const clamp = (v: number | undefined, lo: number, hi: number, d: number) => (v == null ? d : Math.max(lo, Math.min(hi, Math.round(v))));
  const next: MusicSettings = {
    id: "global",
    maxFileMb: clamp(input.maxFileMb, 1, 2000, cur.maxFileMb),
    maxDurationMin: clamp(input.maxDurationMin, 1, 600, cur.maxDurationMin),
    quotaMbPerUser: clamp(input.quotaMbPerUser, 10, 100_000, cur.quotaMbPerUser),
    uploadsPerDay: clamp(input.uploadsPerDay, 1, 500, cur.uploadsPerDay),
    strikeLimit: clamp(input.strikeLimit, 1, 10, cur.strikeLimit),
    updatedAt: nowIso(),
    updatedBy: adminUid,
  };
  await store().put("music_settings", next);
  await audit(adminUid, "settings.saved", "settings", "global", { maxFileMb: next.maxFileMb, maxDurationMin: next.maxDurationMin, quotaMbPerUser: next.quotaMbPerUser });
  return next;
}

export async function closeReport(adminUid: string, reportId: string) {
  await assertAdmin(adminUid);
  const r = await store().get<MusicReport>("music_reports", reportId);
  if (!r) throw notFound();
  await store().put("music_reports", { ...r, status: "closed" });
  await audit(adminUid, "report.closed", r.targetType, r.targetId, { reportId });
}
