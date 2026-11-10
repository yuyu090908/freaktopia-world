/**
 * PERSONAL PARTY UNIVERSE service (9.0). The only place that changes party data.
 *
 * Rules that hold everywhere:
 *  - "Going" never counts. Only a door scan (QR / pass code) or an organizer confirmation with a reason counts,
 *    and only for an event verified as held (ended, not cancelled, ≥ MIN_QR_CHECKINS scans by people outside the team).
 *  - One attendance per (event, account): a second scan is logged as a duplicate and changes nothing.
 *  - Nobody is shown by name or alien unless they opted in (world privacy) and their alien is public; everyone else
 *    is an anonymous member of the crowd. Organizers see attendee names only for their own event operations.
 *  - No messaging to past attendees: organizers reach people only through follows with notifications switched on,
 *    one notification per new event, never to people who blocked them.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { toLook, traitsFromSeed } from "@/lib/alien/catalog";
import { getStore as getAuthStore } from "@/lib/auth/store";
import type { AlienLook } from "@/lib/types";
import { getOpsStore } from "@/lib/ops/store";
import { OpsError, effectiveLevel, type Agreement, type Booking, type EventMember, type Listing, type Notification, type OpsEvent } from "@/lib/ops/types";
import { ensurePartyDemo, DEMO_ORGANIZER_ID, DEMO_WORLD_HANDLE, isDemoUser } from "./seed";
import {
  ENTRY_EARLY_MS, ENTRY_LATE_MS, MIN_QR_CHECKINS, detectAnomalies, engagedPeople, eventFigures, growth, isCounted, isVerifiedEvent, partyImpact,
  themeFor, worldStats, type EventInput,
} from "./stats";
import {
  tierFor,
  type Attendance, type AttendeeView, type Block, type CheckinLog, type EventFacts, type EventReview, type Follow, type GuestCount, type Media,
  type MediaVisibility, type PartyAudit, type WorldPrivacy, type WorldSettings,
} from "./types";

const store = () => getOpsStore();
const auth = () => getAuthStore();
const id = () => randomUUID();
const nowIso = () => new Date().toISOString();
const err = (status: number, code: string) => new OpsError(status, code);

async function ready() {
  if (store().kind === "memory") await ensurePartyDemo(store());
}

async function verifiedUser(uid: string) {
  const u = await auth().findUserById(uid);
  if (!u) throw err(401, "SIGN_IN_REQUIRED");
  if (!u.emailVerified) throw err(403, "EMAIL_NOT_VERIFIED");
  return u;
}

async function audit(actorId: string, eventId: string | null, action: string, reason = "", meta: PartyAudit["meta"] = {}) {
  await store().insert<PartyAudit>("party_audit", { id: id(), eventId, actorId, action, reason, meta, at: nowIso() });
}

// ------------------------------------------------------------------ identity helpers

/** Deterministic look for DEMO attendees (no account). Same family of SVG parts as real aliens. */
const demoLook = (seed: string): AlienLook => toLook(traitsFromSeed(seed, (s) => new Uint8Array(createHash("sha256").update(`demo:${s}`).digest())));

async function identity(uid: string) {
  if (uid === DEMO_ORGANIZER_ID) return { publicId: null, name: "SLIME SYSTEM (DEMO)", look: demoLook(uid), avatarPublic: true, profilePublic: false };
  if (isDemoUser(uid)) return { publicId: null, name: `DEMO ${uid.slice(-4)}`, look: demoLook(uid), avatarPublic: true, profilePublic: false };
  const [alien, profile, privacy] = await Promise.all([auth().getAlien(uid), auth().getProfile(uid), auth().getPrivacy(uid)]);
  return {
    publicId: alien?.publicId ?? null,
    name: profile?.displayName || alien?.name || null,
    look: alien ? toLook(alien) : null,
    avatarPublic: privacy.avatar === "public",
    profilePublic: privacy.profile === "public",
  };
}

export async function getWorldPrivacy(uid: string): Promise<WorldPrivacy> {
  return (await store().get<WorldPrivacy>("world_privacy", uid)) ?? { userId: uid, showInWorlds: false, showHistory: false, updatedAt: nowIso() };
}

export async function setWorldPrivacy(uid: string, patch: Partial<Pick<WorldPrivacy, "showInWorlds" | "showHistory">>) {
  await ready();
  await verifiedUser(uid);
  const cur = await getWorldPrivacy(uid);
  const next: WorldPrivacy = { ...cur, ...patch, userId: uid, updatedAt: nowIso() };
  await store().put("world_privacy", next);
  return next;
}

// ------------------------------------------------------------------ events and teams

async function eventOf(eventId: string) {
  const e = await store().get<OpsEvent>("events", eventId);
  if (!e) throw err(404, "NOT_FOUND");
  return e;
}

async function teamOf(eventId: string) {
  return store().list<EventMember>("members", { eventId });
}

async function settingsOf(ownerId: string): Promise<WorldSettings> {
  return (await store().get<WorldSettings>("world_settings", ownerId)) ?? { ownerId, publishedEventIds: [], tagline: "", updatedAt: nowIso() };
}

async function isPublished(e: OpsEvent) {
  return (await settingsOf(e.ownerId)).publishedEventIds.includes(e.id);
}

const facts = (e: OpsEvent): EventFacts => ({
  id: e.id, name: e.name, city: e.city, country: e.country, venueName: e.venueName, startAt: e.startAt, endAt: e.endAt, timezone: e.timezone,
  genres: e.genres, level: effectiveLevel(e), status: e.status, plannedAttendance: e.attendance,
});

async function managerOf(eventId: string, uid: string) {
  const m = await store().get<EventMember>("members", `${eventId}:${uid}`);
  if (!m) throw err(404, "NOT_FOUND"); // private events stay invisible
  if (m.role !== "owner" && m.role !== "manager") throw err(403, "FORBIDDEN");
  return m;
}

async function doorStaffOf(eventId: string, uid: string) {
  const m = await store().get<EventMember>("members", `${eventId}:${uid}`);
  if (!m) throw err(404, "NOT_FOUND");
  return m;
}

/** Organizer chooses which events appear in their world. Publishing an upcoming event notifies followers who asked for it. */
export async function publishEvent(uid: string, eventId: string, published: boolean) {
  await ready();
  const e = await eventOf(eventId);
  await managerOf(eventId, uid);
  const s = await settingsOf(e.ownerId);
  const ids = new Set(s.publishedEventIds);
  if (published) ids.add(eventId);
  else ids.delete(eventId);
  await store().put("world_settings", { ...s, publishedEventIds: [...ids], updatedAt: nowIso() });
  await audit(uid, eventId, published ? "publish" : "unpublish");
  let notified = 0;
  if (published && e.status !== "cancelled" && Date.parse(e.startAt) > Date.now()) notified = await notifyFollowers(e);
  return { published, notified };
}

async function notifyFollowers(e: OpsEvent) {
  const owner = await identity(e.ownerId);
  const followers = (await store().list<Follow>("follows", { organizerId: e.ownerId })).filter((f) => f.notify);
  let n = 0;
  for (const f of followers) {
    if (await store().get<Block>("blocks", `${f.userId}:${e.ownerId}`)) continue;
    const link = owner.publicId ? `/u/${owner.publicId}/world/${e.id}` : "/profile/parties";
    const note: Notification = { id: id(), userId: f.userId, eventId: e.id, key: "notif.partyNew", values: { organizer: owner.name ?? "—", event: e.name, link }, dedupeKey: `party-new:${e.id}`, read: false, at: nowIso() };
    if (await store().notifyOnce(note)) n++;
  }
  return n;
}

export async function setTagline(uid: string, tagline: string) {
  await ready();
  await verifiedUser(uid);
  const s = await settingsOf(uid);
  const next = { ...s, tagline: tagline.trim().slice(0, 140), updatedAt: nowIso() };
  await store().put("world_settings", next);
  return next;
}

// ------------------------------------------------------------------ RSVP and pass

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const newPassCode = () => [...randomBytes(10)].map((b) => ALPHABET[b % ALPHABET.length]).join("");
export const normalizeCode = (raw: string) => {
  const t = raw.trim().toUpperCase();
  const m = /^FKP1:([0-9a-f-]{36}):([A-Z0-9]{10})$/i.exec(raw.trim());
  if (m) return { eventId: m[1].toLowerCase(), code: m[2].toUpperCase() };
  return { eventId: null, code: t.replace(/[^A-Z0-9]/g, "") };
};
export const passPayload = (eventId: string, code: string) => `FKP1:${eventId}:${code}`;

export async function rsvp(uid: string, eventId: string) {
  await ready();
  await verifiedUser(uid);
  const e = await eventOf(eventId);
  if (!(await isPublished(e))) throw err(404, "NOT_FOUND");
  if (e.status === "cancelled") throw err(400, "EVENT_CANCELLED");
  if (Date.parse(e.endAt) < Date.now()) throw err(400, "EVENT_ENDED");
  if ((e as OpsEvent & { demo?: boolean }).demo) throw err(400, "DEMO_EVENT"); // fictional: nobody can register
  if (await store().get<EventMember>("members", `${eventId}:${uid}`)) throw err(400, "TEAM_MEMBER");
  if (await store().get<Block>("blocks", `${uid}:${e.ownerId}`)) throw err(400, "BLOCKED_ORGANIZER");
  const cur = await store().get<Attendance>("attendance", `${eventId}:${uid}`);
  const t = nowIso();
  if (cur) {
    if (cur.status === "going") return cur;
    if (cur.checkedInAt) throw err(400, "ALREADY_CHECKED_IN");
    const next: Attendance = { ...cur, status: "going", updatedAt: t, version: cur.version + 1, history: [...cur.history, { at: t, by: uid, action: "rsvp" }] };
    await store().put("attendance", next, cur.version);
    return next;
  }
  const a: Attendance = { eventId, userId: uid, status: "going", passCode: newPassCode(), checkedInAt: null, method: null, by: null, createdAt: t, updatedAt: t, version: 0, history: [{ at: t, by: uid, action: "rsvp" }] };
  try {
    await store().insert("attendance", a);
  } catch (e) {
    if (e instanceof OpsError && e.code === "DUPLICATE") return (await store().get<Attendance>("attendance", `${eventId}:${uid}`))!;
    throw e;
  }
  return a;
}

export async function cancelRsvp(uid: string, eventId: string) {
  await ready();
  const cur = await store().get<Attendance>("attendance", `${eventId}:${uid}`);
  if (!cur || cur.status === "cancelled") throw err(404, "NOT_FOUND");
  if (cur.checkedInAt) throw err(400, "ALREADY_CHECKED_IN");
  const t = nowIso();
  const next: Attendance = { ...cur, status: "cancelled", updatedAt: t, version: cur.version + 1, history: [...cur.history, { at: t, by: uid, action: "cancel" }] };
  await store().put("attendance", next, cur.version);
  return next;
}

export async function myPass(uid: string, eventId: string) {
  await ready();
  const a = await store().get<Attendance>("attendance", `${eventId}:${uid}`);
  if (!a || a.status === "cancelled") throw err(404, "NOT_FOUND");
  const e = await eventOf(eventId);
  return { eventId, eventName: e.name, startAt: e.startAt, endAt: e.endAt, timezone: e.timezone, code: a.passCode, payload: passPayload(eventId, a.passCode), checkedInAt: a.checkedInAt };
}

// ------------------------------------------------------------------ door check-in, manual confirmation, guests

export async function checkIn(staffUid: string, eventId: string, raw: string, ipHash: string | null) {
  await ready();
  const e = await eventOf(eventId);
  await doorStaffOf(eventId, staffUid);
  const { eventId: inCode, code } = normalizeCode(raw);
  const log = async (result: CheckinLog["result"], userId: string | null) => {
    await store().insert<CheckinLog>("checkins", { id: id(), eventId, userId, by: staffUid, at: nowIso(), result, ipHash });
    return result;
  };
  if (inCode && inCode !== eventId) return { result: await log("not_found", null), attendee: null };
  const now = Date.now();
  if (now < Date.parse(e.startAt) - ENTRY_EARLY_MS || now > Date.parse(e.endAt) + ENTRY_LATE_MS || e.status === "cancelled") {
    return { result: await log("not_entry_time", null), attendee: null };
  }
  const rows = await store().list<Attendance>("attendance", { eventId, passCode: code });
  const a = rows[0];
  if (!a) return { result: await log("not_found", null), attendee: null };
  const who = await identity(a.userId);
  const attendee = { name: who.name, look: who.look };
  if (a.status === "cancelled") return { result: await log("cancelled", a.userId), attendee };
  if (a.checkedInAt) return { result: await log("duplicate", a.userId), attendee }; // re-entry / re-scan: never counted twice
  const t = nowIso();
  const next: Attendance = { ...a, checkedInAt: t, method: "qr", by: staffUid, updatedAt: t, version: a.version + 1, history: [...a.history, { at: t, by: staffUid, action: "checkin" }] };
  try {
    await store().put("attendance", next, a.version);
  } catch (x) {
    if (x instanceof OpsError && x.code === "STALE_VERSION") return { result: await log("duplicate", a.userId), attendee }; // two scanners at once
    throw x;
  }
  return { result: await log("ok", a.userId), attendee };
}

/** For people whose pass couldn't be scanned. Only after the start, only for registered people, always with a reason. */
export async function confirmManually(uid: string, eventId: string, userId: string, reason: string, confirm: boolean) {
  await ready();
  if (!confirm) throw err(400, "CONFIRMATION_REQUIRED");
  if (reason.trim().length < 5) throw err(400, "REASON_REQUIRED");
  const e = await eventOf(eventId);
  await managerOf(eventId, uid);
  if (Date.now() < Date.parse(e.startAt)) throw err(400, "EVENT_NOT_STARTED");
  if (e.status === "cancelled") throw err(400, "EVENT_CANCELLED");
  const a = await store().get<Attendance>("attendance", `${eventId}:${userId}`);
  if (!a) throw err(404, "NOT_REGISTERED");
  if (a.checkedInAt && a.status !== "cancelled") return a;
  const t = nowIso();
  const next: Attendance = { ...a, status: "going", checkedInAt: t, method: "manual", by: uid, updatedAt: t, version: a.version + 1, history: [...a.history, { at: t, by: uid, action: "manual_confirm", reason: reason.trim().slice(0, 300) }] };
  await store().put("attendance", next, a.version);
  await audit(uid, eventId, "manual_confirm", reason.trim().slice(0, 300), { userId });
  return next;
}

export async function revokeAttendance(uid: string, eventId: string, userId: string, reason: string, confirm: boolean) {
  await ready();
  if (!confirm) throw err(400, "CONFIRMATION_REQUIRED");
  if (reason.trim().length < 5) throw err(400, "REASON_REQUIRED");
  await managerOf(eventId, uid);
  const a = await store().get<Attendance>("attendance", `${eventId}:${userId}`);
  if (!a) throw err(404, "NOT_FOUND");
  const t = nowIso();
  const next: Attendance = { ...a, status: "cancelled", updatedAt: t, version: a.version + 1, history: [...a.history, { at: t, by: uid, action: "revoke", reason: reason.trim().slice(0, 300) }] };
  await store().put("attendance", next, a.version);
  await audit(uid, eventId, "revoke", reason.trim().slice(0, 300), { userId });
  return next;
}

export async function setGuests(uid: string, eventId: string, count: number, reason: string) {
  await ready();
  await managerOf(eventId, uid);
  if (!Number.isInteger(count) || count < 0 || count > 1_000_000) throw err(400, "INVALID_INPUT");
  if (reason.trim().length < 5) throw err(400, "REASON_REQUIRED");
  const cur = (await store().get<GuestCount>("guests", eventId)) ?? { eventId, count: 0, note: "", history: [] };
  const next: GuestCount = { ...cur, count, note: reason.trim().slice(0, 300), history: [...cur.history, { at: nowIso(), by: uid, count, reason: reason.trim().slice(0, 300) }] };
  await store().put("guests", next);
  await audit(uid, eventId, "guests", reason.trim().slice(0, 300), { count });
  return next;
}

/** The event team's door view: names are visible here because running the event needs them; never shown publicly. */
export async function doorView(uid: string, eventId: string) {
  await ready();
  const e = await eventOf(eventId);
  const m = await doorStaffOf(eventId, uid);
  const manage = m.role === "owner" || m.role === "manager";
  const team = new Set((await teamOf(eventId)).map((x) => x.userId));
  const rows = await store().list<Attendance>("attendance", { eventId });
  const logs = (await store().list<CheckinLog>("checkins", { eventId })).sort((a, b) => b.at.localeCompare(a.at));
  const people = manage || m.role === "lead"
    ? await Promise.all(rows.map(async (a) => ({ userId: a.userId, name: (await identity(a.userId)).name, status: a.status, checkedInAt: a.checkedInAt, method: a.method, history: manage ? a.history : [] })))
    : [];
  const guests = await store().get<GuestCount>("guests", eventId);
  const ev: EventInput = { facts: facts(e), team, published: await isPublished(e) };
  return {
    published: ev.published,
    canManage: manage,
    entryOpensAt: new Date(Date.parse(e.startAt) - ENTRY_EARLY_MS).toISOString(),
    entryClosesAt: new Date(Date.parse(e.endAt) + ENTRY_LATE_MS).toISOString(),
    going: rows.filter((a) => a.status === "going" && !a.checkedInAt).length,
    checkedIn: rows.filter((a) => isCounted(a, team)).length,
    qr: rows.filter((a) => isCounted(a, team) && a.method === "qr").length,
    manual: rows.filter((a) => isCounted(a, team) && a.method === "manual").length,
    verified: isVerifiedEvent(ev, rows, Date.now()),
    minQr: MIN_QR_CHECKINS,
    guests: guests?.count ?? 0,
    guestHistory: manage ? guests?.history ?? [] : [],
    people,
    recentScans: logs.slice(0, 20).map((l) => ({ at: l.at, result: l.result })),
  };
}

// ------------------------------------------------------------------ reviews

async function countedAttendee(eventId: string, uid: string) {
  const e = await eventOf(eventId);
  const team = new Set((await teamOf(eventId)).map((x) => x.userId));
  const a = await store().get<Attendance>("attendance", `${eventId}:${uid}`);
  return { e, ok: !!a && isCounted(a, team), team };
}

export async function review(uid: string, eventId: string, input: { rating: number; text: string }) {
  await ready();
  await verifiedUser(uid);
  const { e, ok, team } = await countedAttendee(eventId, uid);
  if (team.has(uid)) throw err(403, "TEAM_CANNOT_REVIEW");
  if (!ok) throw err(403, "ATTENDEES_ONLY");
  if (Date.parse(e.startAt) > Date.now()) throw err(400, "EVENT_NOT_STARTED");
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw err(400, "INVALID_SCORE");
  const r: EventReview = { eventId, userId: uid, rating: input.rating as EventReview["rating"], text: input.text.trim().slice(0, 1000), at: nowIso() };
  await store().put("event_reviews", r); // one per attendee and event (primary key); editing replaces it
  return r;
}

export async function deleteReview(uid: string, eventId: string) {
  await ready();
  await store().remove("event_reviews", `${eventId}:${uid}`);
}

// ------------------------------------------------------------------ media

const IMAGE = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const VIDEO = new Set(["video/mp4", "video/webm"]);
export const MAX_IMAGE = 5 * 1024 * 1024;
export const MAX_VIDEO = 8 * 1024 * 1024;

function sniff(mime: string, b: Buffer) {
  const h = b.subarray(0, 12);
  if (mime === "image/png") return h[0] === 0x89 && h[1] === 0x50;
  if (mime === "image/jpeg") return h[0] === 0xff && h[1] === 0xd8;
  if (mime === "image/gif") return h.toString("ascii", 0, 3) === "GIF";
  if (mime === "image/webp") return h.toString("ascii", 0, 4) === "RIFF" && h.toString("ascii", 8, 12) === "WEBP";
  if (mime === "video/mp4") return h.toString("ascii", 4, 8) === "ftyp";
  if (mime === "video/webm") return h[0] === 0x1a && h[1] === 0x45 && h[2] === 0xdf && h[3] === 0xa3;
  return false;
}

export async function uploadMedia(uid: string, eventId: string, input: { mime: string; data: string; caption?: string; visibility?: MediaVisibility }) {
  await ready();
  await verifiedUser(uid);
  const e = await eventOf(eventId);
  const m = await store().get<EventMember>("members", `${eventId}:${uid}`);
  const official = !!m && (m.role === "owner" || m.role === "manager");
  if (!official) {
    const { ok } = await countedAttendee(eventId, uid);
    if (!ok) throw err(403, "ATTENDEES_ONLY");
    if (Date.parse(e.startAt) > Date.now()) throw err(400, "EVENT_NOT_STARTED");
  }
  const isImage = IMAGE.has(input.mime);
  if (!isImage && !VIDEO.has(input.mime)) throw err(400, "FILE_TYPE");
  const data = Buffer.from(input.data, "base64");
  if (data.length > (isImage ? MAX_IMAGE : MAX_VIDEO)) throw err(400, "FILE_TOO_LARGE");
  if (!sniff(input.mime, data)) throw err(400, "FILE_TYPE");
  const blobId = id();
  await store().putBlob(blobId, eventId, input.mime, data);
  const media: Media = {
    id: id(), eventId, uploaderId: uid, kind: official ? "official" : "attendee", type: isImage ? "image" : "video", mime: input.mime, blobId,
    caption: (input.caption ?? "").trim().slice(0, 200), visibility: input.visibility ?? "public", hiddenByOrganizer: false, at: nowIso(),
  };
  await store().insert("media", media);
  return media;
}

export async function updateMedia(uid: string, mediaId: string, patch: { visibility?: MediaVisibility; hiddenByOrganizer?: boolean }) {
  await ready();
  const m = await store().get<Media>("media", mediaId);
  if (!m) throw err(404, "NOT_FOUND");
  const member = await store().get<EventMember>("members", `${m.eventId}:${uid}`);
  const manager = !!member && (member.role === "owner" || member.role === "manager");
  const next = { ...m };
  if (patch.visibility) {
    if (m.uploaderId !== uid) throw err(403, "FORBIDDEN");
    next.visibility = patch.visibility;
  }
  if (patch.hiddenByOrganizer != null) {
    if (!manager || m.kind !== "attendee") throw err(403, "FORBIDDEN");
    next.hiddenByOrganizer = patch.hiddenByOrganizer;
    await audit(uid, m.eventId, patch.hiddenByOrganizer ? "hide_media" : "unhide_media", "", { mediaId });
  }
  await store().put("media", next);
  return next;
}

export async function deleteMedia(uid: string, mediaId: string) {
  await ready();
  const m = await store().get<Media>("media", mediaId);
  if (!m) throw err(404, "NOT_FOUND");
  const member = await store().get<EventMember>("members", `${m.eventId}:${uid}`);
  const officialManager = m.kind === "official" && !!member && (member.role === "owner" || member.role === "manager");
  if (m.uploaderId !== uid && !officialManager) throw err(403, "FORBIDDEN"); // attendee posts: only the author deletes
  await store().remove("media", mediaId);
}

async function canSeeMedia(viewer: string | null, m: Media) {
  if (viewer && m.uploaderId === viewer) return true;
  const member = viewer ? await store().get<EventMember>("members", `${m.eventId}:${viewer}`) : null;
  const manager = !!member && (member.role === "owner" || member.role === "manager");
  if (m.visibility === "hidden") return false; // the author's private copy: nobody else, not even the organizer
  if (m.hiddenByOrganizer) return manager;
  if (!(await isPublished(await eventOf(m.eventId))) && !member) return false;
  if (m.visibility === "public") return true;
  if (member) return true;
  if (!viewer) return false;
  return (await countedAttendee(m.eventId, viewer)).ok;
}

export async function mediaBlob(viewer: string | null, mediaId: string) {
  await ready();
  const m = await store().get<Media>("media", mediaId);
  if (!m || !(await canSeeMedia(viewer, m))) throw err(404, "NOT_FOUND");
  const b = await store().getBlob(m.blobId);
  if (!b) throw err(404, "NOT_FOUND");
  return b;
}

// ------------------------------------------------------------------ follows and blocks (no direct messages exist)

export async function follow(uid: string, organizerId: string, notify: boolean) {
  await ready();
  await verifiedUser(uid);
  if (uid === organizerId) throw err(400, "SELF");
  if (isDemoUser(organizerId)) throw err(400, "DEMO_EVENT");
  if (await store().get<Block>("blocks", `${uid}:${organizerId}`)) await store().remove("blocks", `${uid}:${organizerId}`);
  const f: Follow = { organizerId, userId: uid, notify, at: nowIso() };
  await store().put("follows", f);
  return f;
}

export async function unfollow(uid: string, organizerId: string) {
  await ready();
  await store().remove("follows", `${organizerId}:${uid}`);
}

/** Blocking stops every notification from this organizer and removes the follow. */
export async function block(uid: string, organizerId: string) {
  await ready();
  await verifiedUser(uid);
  if (uid === organizerId) throw err(400, "SELF");
  await store().remove("follows", `${organizerId}:${uid}`);
  await store().put<Block>("blocks", { userId: uid, organizerId, at: nowIso() });
}

export async function unblock(uid: string, organizerId: string) {
  await ready();
  await store().remove("blocks", `${uid}:${organizerId}`);
}

// ------------------------------------------------------------------ the world

export async function resolveHandle(handle: string) {
  await ready();
  if (handle === DEMO_WORLD_HANDLE && store().kind === "memory") return { userId: DEMO_ORGANIZER_ID, demo: true };
  const a = await auth().findAlienByPublicId(handle.toUpperCase());
  if (!a) throw err(404, "NOT_FOUND");
  return { userId: a.userId, demo: false };
}

interface Loaded {
  events: OpsEvent[];
  inputs: EventInput[];
  rows: Attendance[];
  reviews: EventReview[];
  media: Media[];
  guests: Map<string, number>;
}

async function loadWorld(ownerId: string): Promise<Loaded> {
  const s = await settingsOf(ownerId);
  const events = (await Promise.all(s.publishedEventIds.map((x) => store().get<OpsEvent>("events", x)))).filter((e): e is OpsEvent => !!e && e.ownerId === ownerId);
  const per = await Promise.all(events.map(async (e) => ({
    team: new Set((await teamOf(e.id)).map((m) => m.userId)),
    rows: await store().list<Attendance>("attendance", { eventId: e.id }),
    reviews: await store().list<EventReview>("event_reviews", { eventId: e.id }),
    media: await store().list<Media>("media", { eventId: e.id }),
    guests: (await store().get<GuestCount>("guests", e.id))?.count ?? 0,
  })));
  return {
    events,
    inputs: events.map((e, i) => ({ facts: facts(e), team: per[i].team, published: true, demo: !!(e as OpsEvent & { demo?: boolean }).demo })),
    rows: per.flatMap((p) => p.rows),
    reviews: per.flatMap((p) => p.reviews),
    media: per.flatMap((p) => p.media),
    guests: new Map(events.map((e, i) => [e.id, per[i].guests])),
  };
}

/** Individual aliens drawn at most this many (by visits); everyone else is the anonymous crowd. */
export const MAX_SHOWN = 300;

export async function world(viewer: string | null, handle: string) {
  const { userId: ownerId, demo } = await resolveHandle(handle);
  const now = Date.now();
  const L = await loadWorld(ownerId);
  const stats = worldStats(L.inputs, L.rows, L.reviews, L.guests, now);
  const counted = new Set(stats.visits.keys());
  const impact = partyImpact(stats, engagedPeople(L.reviews, L.media, counted));
  const planets = L.inputs.map((e) => {
    const f = eventFigures(e, L.rows, L.reviews, now);
    const upcoming = !f.ended && e.facts.status !== "cancelled";
    const cover = L.media.find((m) => m.eventId === e.facts.id && m.kind === "official" && m.type === "image" && m.visibility === "public");
    return {
      ...e.facts,
      theme: themeFor(e.facts.genres, e.facts.level),
      state: e.facts.status === "cancelled" ? "cancelled" : upcoming ? "upcoming" : f.verified ? "verified" : "unverified",
      attendance: f.verified ? f.counted : null,
      rating: f.reviewCount >= 3 ? f.rating : null,
      reviewCount: f.reviewCount,
      coverId: cover?.id ?? null,
      demo: !!e.demo,
    };
  }).sort((a, b) => a.startAt.localeCompare(b.startAt));
  const g = growth(stats, planets.filter((p) => p.state === "verified").map((p) => p.theme));

  // Community: only people who opted in AND whose alien is public are shown individually.
  const ranked = [...stats.visits.entries()].sort((a, b) => b[1] - a[1]);
  const shown: AttendeeView[] = [];
  let anonymous = 0;
  const tiers = { first: 0, aura: 0, glow: 0, regular: 0 };
  for (const [uid, visits] of ranked) {
    tiers[tierFor(visits)]++;
    if (shown.length >= MAX_SHOWN) {
      anonymous++;
      continue;
    }
    const p = isDemoUser(uid) ? { showInWorlds: true } : await getWorldPrivacy(uid);
    const who = await identity(uid);
    if (p.showInWorlds && who.avatarPublic && who.look) shown.push({ key: who.publicId ?? uid.slice(-8), publicId: who.publicId, name: who.name, look: who.look, visits, tier: tierFor(visits) });
    else anonymous++;
  }

  const owner = await identity(ownerId);
  const isOwner = viewer === ownerId;
  const fol = viewer && !isOwner ? await store().get<Follow>("follows", `${ownerId}:${viewer}`) : null;
  const blk = viewer && !isOwner ? await store().get<Block>("blocks", `${viewer}:${ownerId}`) : null;
  const settings = await settingsOf(ownerId);
  const next = planets.filter((p) => p.state === "upcoming").sort((a, b) => a.startAt.localeCompare(b.startAt))[0] ?? null;
  const myVisits = viewer ? stats.visits.get(viewer) ?? 0 : 0;
  const myGoing = viewer && next ? await store().get<Attendance>("attendance", `${next.id}:${viewer}`) : null;
  return {
    demo,
    owner: {
      userId: isOwner ? ownerId : null,
      publicId: owner.publicId,
      name: owner.name,
      look: owner.avatarPublic || isOwner ? owner.look : null,
      tagline: settings.tagline,
    },
    isOwner,
    stats: { ...stats, visits: undefined, manualShare: stats.manualShare },
    impact,
    growth: g,
    planets,
    next: next ? { ...next, myStatus: myGoing && myGoing.status === "going" ? "going" : null } : null,
    community: { shown, anonymous, tiers, total: stats.uniqueVisitors },
    follow: viewer && !isOwner ? { following: !!fol, notify: !!fol?.notify, blocked: !!blk } : null,
    followers: (await store().list<Follow>("follows", { organizerId: ownerId })).length,
    me: viewer ? { visits: myVisits, tier: myVisits ? tierFor(myVisits) : null, privacy: await getWorldPrivacy(viewer) } : null,
  };
}

async function djNames(eventId: string) {
  const ags = (await store().list<Agreement>("agreements", { eventId })).filter((a) => a.status === "agreed" || a.status === "completed");
  const out: string[] = [];
  for (const a of ags) {
    const b = await store().get<Booking>("bookings", a.bookingId);
    const l = b ? await store().get<Listing>("listings", b.listingId) : null;
    if (l?.items.some((i) => i.key === "dj_performer")) out.push(l.title);
  }
  return out;
}

export async function partyEvent(viewer: string | null, eventId: string) {
  await ready();
  const e = await eventOf(eventId);
  const member = viewer ? await store().get<EventMember>("members", `${eventId}:${viewer}`) : null;
  if (!(await isPublished(e)) && !member) throw err(404, "NOT_FOUND");
  const now = Date.now();
  const team = new Set((await teamOf(eventId)).map((m) => m.userId));
  const rows = await store().list<Attendance>("attendance", { eventId });
  const reviews = await store().list<EventReview>("event_reviews", { eventId });
  const input: EventInput = { facts: facts(e), team, published: true };
  const f = eventFigures(input, rows, reviews, now);
  const countedSet = new Set(rows.filter((a) => isCounted(a, team)).map((a) => a.userId));
  const visibleReviews = await Promise.all(
    reviews.filter((r) => countedSet.has(r.userId)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 50).map(async (r) => {
      const p = isDemoUser(r.userId) ? { showInWorlds: true } : await getWorldPrivacy(r.userId);
      const who = await identity(r.userId);
      const named = p.showInWorlds && who.avatarPublic;
      return { rating: r.rating, text: r.text, at: r.at, mine: r.userId === viewer, author: named ? { publicId: who.publicId, name: who.name, look: who.look } : null };
    }),
  );
  const all = await store().list<Media>("media", { eventId });
  const visible = [];
  for (const m of all) if (await canSeeMedia(viewer, m)) visible.push({ id: m.id, kind: m.kind, type: m.type, caption: m.caption, visibility: m.visibility, hiddenByOrganizer: m.hiddenByOrganizer, mine: m.uploaderId === viewer, at: m.at });
  const my = viewer ? await store().get<Attendance>("attendance", `${eventId}:${viewer}`) : null;
  const counted = !!my && isCounted(my, team);
  const owner = await identity(e.ownerId);
  const manage = !!member && (member.role === "owner" || member.role === "manager");
  return {
    event: { ...facts(e), theme: themeFor(e.genres, effectiveLevel(e)), demo: !!(e as OpsEvent & { demo?: boolean }).demo },
    owner: { publicId: owner.publicId, name: owner.name },
    state: e.status === "cancelled" ? "cancelled" : !f.ended ? "upcoming" : f.verified ? "verified" : "unverified",
    figures: { attendance: f.verified ? f.counted : null, guests: f.verified ? (await store().get<GuestCount>("guests", eventId))?.count ?? 0 : null, rating: f.reviewCount >= 3 ? f.rating : null, reviewCount: f.reviewCount, minQr: MIN_QR_CHECKINS },
    djs: await djNames(eventId),
    reviews: visibleReviews,
    media: { official: visible.filter((m) => m.kind === "official"), attendee: visible.filter((m) => m.kind === "attendee") },
    my: {
      status: !my ? null : my.status === "cancelled" ? "cancelled" : my.checkedInAt ? "checked_in" : "going",
      counted,
      isTeam: !!member,
      canManage: manage,
      canReview: counted && !member && Date.parse(e.startAt) <= now,
      canUpload: (counted && Date.parse(e.startAt) <= now) || manage,
      canRsvp: !member && f.ended === false && e.status !== "cancelled",
      myReview: viewer ? reviews.find((r) => r.userId === viewer) ?? null : null,
    },
  };
}

/** The attendee's own history: what they went to, how often, whom they follow, their privacy switches. */
export async function myParties(uid: string) {
  await ready();
  const rows = await store().list<Attendance>("attendance", { userId: uid });
  const items = [];
  for (const a of rows) {
    const e = await store().get<OpsEvent>("events", a.eventId);
    if (!e) continue;
    const team = new Set((await teamOf(e.id)).map((m) => m.userId));
    const owner = await identity(e.ownerId);
    items.push({
      eventId: e.id, name: e.name, city: e.city, startAt: e.startAt, endAt: e.endAt, timezone: e.timezone,
      status: a.status === "cancelled" ? "cancelled" : a.checkedInAt ? (isCounted(a, team) ? "checked_in" : "team") : "going",
      ended: Date.parse(e.endAt) < Date.now(),
      organizer: { publicId: owner.publicId, name: owner.name, userId: e.ownerId },
    });
  }
  items.sort((a, b) => b.startAt.localeCompare(a.startAt));
  const perOrganizer = new Map<string, number>();
  for (const i of items) if (i.status === "checked_in") perOrganizer.set(i.organizer.userId, (perOrganizer.get(i.organizer.userId) ?? 0) + 1);
  const follows = await Promise.all((await store().list<Follow>("follows", { userId: uid })).map(async (f) => ({ ...f, organizer: await identity(f.organizerId) })));
  const blocks = await Promise.all((await store().list<Block>("blocks", { userId: uid })).map(async (b) => ({ organizerId: b.organizerId, name: (await identity(b.organizerId)).name })));
  const me = await identity(uid);
  return {
    items: items.map((i) => ({ ...i, organizer: { publicId: i.organizer.publicId, name: i.organizer.name, visits: perOrganizer.get(i.organizer.userId) ?? 0, userId: i.organizer.userId } })),
    follows: follows.map((f) => ({ organizerId: f.organizerId, notify: f.notify, name: f.organizer.name, publicId: f.organizer.publicId })),
    blocks,
    privacy: await getWorldPrivacy(uid),
    myPublicId: me.publicId,
    avatarPublic: me.avatarPublic,
  };
}

/** Removes the person's attendance, reviews, posts, follows and settings. Figures are recomputed from what remains. */
export async function deleteMyPartyData(uid: string, confirm: boolean) {
  await ready();
  if (!confirm) throw err(400, "CONFIRMATION_REQUIRED");
  for (const a of await store().list<Attendance>("attendance", { userId: uid })) await store().remove("attendance", `${a.eventId}:${uid}`);
  for (const r of await store().list<EventReview>("event_reviews", { userId: uid })) await store().remove("event_reviews", `${r.eventId}:${uid}`);
  for (const m of await store().list<Media>("media", { uploaderId: uid })) if (m.kind === "attendee") await store().remove("media", m.id);
  for (const f of await store().list<Follow>("follows", { userId: uid })) await store().remove("follows", `${f.organizerId}:${uid}`);
  for (const b of await store().list<Block>("blocks", { userId: uid })) await store().remove("blocks", `${uid}:${b.organizerId}`);
  await store().remove("world_privacy", uid);
}

/** Public profile: shows only what the person allowed. */
export async function publicProfile(viewer: string | null, handle: string) {
  const { userId, demo } = await resolveHandle(handle);
  const who = await identity(userId);
  const isMe = viewer === userId;
  const p = await getWorldPrivacy(userId);
  const settings = await settingsOf(userId);
  const hasWorld = settings.publishedEventIds.length > 0;
  let history: { eventId: string; name: string; startAt: string; organizer: string | null; organizerPublicId: string | null }[] | null = null;
  if (isMe || (p.showHistory && who.profilePublic)) {
    history = [];
    for (const a of await store().list<Attendance>("attendance", { userId })) {
      if (!a.checkedInAt || a.status === "cancelled") continue;
      const e = await store().get<OpsEvent>("events", a.eventId);
      if (!e || !(await isPublished(e))) continue;
      const o = await identity(e.ownerId);
      history.push({ eventId: e.id, name: e.name, startAt: e.startAt, organizer: o.name, organizerPublicId: o.publicId });
    }
    history.sort((a, b) => b.startAt.localeCompare(a.startAt));
  }
  const visible = isMe || who.profilePublic || hasWorld;
  return {
    demo,
    isMe,
    publicId: who.publicId,
    name: visible ? who.name : null,
    look: isMe || who.avatarPublic ? who.look : null,
    private: !visible,
    hasWorld,
    history,
  };
}

/** Organizers with at least one verified party in their world, for the WORLD page. Public data only. */
export async function directory(limit = 12) {
  await ready();
  const all = await store().list<WorldSettings>("world_settings");
  const out = [];
  for (const s of all) {
    if (!s.publishedEventIds.length) continue;
    const L = await loadWorld(s.ownerId);
    const st = worldStats(L.inputs, L.rows, L.reviews, L.guests, Date.now());
    const upcoming = L.inputs.filter((e) => Date.parse(e.facts.endAt) > Date.now() && e.facts.status !== "cancelled").length;
    if (!st.totalEvents && !upcoming) continue;
    const who = await identity(s.ownerId);
    const demo = isDemoUser(s.ownerId);
    out.push({ handle: demo ? DEMO_WORLD_HANDLE : who.publicId, name: who.name, look: who.avatarPublic ? who.look : null, totalEvents: st.totalEvents, uniqueVisitors: st.uniqueVisitors, upcoming, stage: growth(st, []).stage, demo });
  }
  return out.filter((x) => x.handle).sort((a, b) => Number(a.demo) - Number(b.demo) || b.totalEvents - a.totalEvents).slice(0, limit);
}

/** Published upcoming parties for /events (real data only). */
export async function upcomingParties(limit = 12) {
  await ready();
  const out = [];
  for (const s of await store().list<WorldSettings>("world_settings")) {
    for (const eid of s.publishedEventIds) {
      const e = await store().get<OpsEvent>("events", eid);
      if (!e || e.status === "cancelled" || Date.parse(e.endAt) < Date.now()) continue;
      const who = await identity(e.ownerId);
      const demo = isDemoUser(e.ownerId);
      out.push({ id: e.id, name: e.name, city: e.city, startAt: e.startAt, timezone: e.timezone, genres: e.genres, organizer: who.name, handle: demo ? DEMO_WORLD_HANDLE : who.publicId, demo });
    }
  }
  return out.sort((a, b) => a.startAt.localeCompare(b.startAt)).slice(0, limit);
}

// ------------------------------------------------------------------ admin audit and anomaly detection

export async function adminReview(uid: string) {
  await ready();
  const u = await auth().findUserById(uid);
  const admins = (process.env.OPS_ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!u || !u.emailVerified || !admins.includes(u.email)) throw err(403, "FORBIDDEN");
  const settings = await store().list<WorldSettings>("world_settings");
  const flags = [];
  for (const s of settings) {
    const L = await loadWorld(s.ownerId);
    for (const e of L.inputs) {
      const logs = await store().list<CheckinLog>("checkins", { eventId: e.facts.id });
      const created = new Map<string, string>();
      for (const a of L.rows.filter((r) => r.eventId === e.facts.id)) {
        const usr = isDemoUser(a.userId) ? null : await auth().findUserById(a.userId);
        if (usr) created.set(a.userId, usr.createdAt);
      }
      const overlapping = L.rows.filter((r) => {
        const other = L.inputs.find((x) => x.facts.id === r.eventId);
        return other && other.facts.id !== e.facts.id && Date.parse(other.facts.startAt) < Date.parse(e.facts.endAt) && Date.parse(other.facts.endAt) > Date.parse(e.facts.startAt);
      });
      for (const a of detectAnomalies(e, L.rows, logs, L.reviews, created, overlapping)) flags.push({ ...a, eventName: e.facts.name });
    }
  }
  const log = (await store().list<PartyAudit>("party_audit")).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 100);
  return { flags, log };
}
