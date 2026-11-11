/**
 * LIVE FESTIVAL API (demo). One handler behind app/api/live/[[...path]]/route.ts.
 *
 * GET  /api/live                              discovery list (status, current DJ, attendance)
 * GET  /api/live/:eventId                     festival detail (sets, stages, streams, attendance)
 * GET  /api/live/:eventId/room?zone&since     room sync: energy, zone counts, zone avatars, chat, events
 * POST /api/live/:eventId/presence            join / update avatar (zone, visibility, dance, emote)
 * POST /api/live/:eventId/leave
 * POST /api/live/:eventId/chat                { body, replyTo? }
 * POST /api/live/:eventId/chat/:id/report
 * POST /api/live/:eventId/block               { userId }
 * POST /api/live/:eventId/reactions           { kind, zone }
 * POST /api/live/:eventId/quests              { questId }
 * POST /api/live/:eventId/demo-ticket         issue a signed demo ticket QR
 * POST /api/live/:eventId/checkin             { qr, method }
 * GET  /api/live/:eventId/rankings
 *
 * LIVE_DATA_MODE=production → 503 DATA_SOURCE_NOT_CONFIGURED (never falls back to demo data).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { DJS, EVENTS, getAfterParty, getDJ, getEvent, getVenue, syncEventClock } from "@/lib/data";
import { hmac, randomId, safeEqual, sha256 } from "@/lib/dao/hash";
import { sessionSecret } from "@/lib/dao/auth";
import { allDaoSummaries } from "@/lib/dao/api";
import { getRankings } from "@/lib/ranking/service";
import { clientKey, rateLimit } from "@/lib/ranking/guard";
import type { RankedEntry } from "@/lib/ranking/types";
import type { FreakEvent } from "@/lib/types";
import { CHECKIN_ERROR_TEXT, attendance, qrFor, verifyCheckin } from "./checkin";
import { energyTarget, levelFor, stepEnergy } from "./energy";
import { LIVE_QUESTS } from "./quests";
import { DEMO_LIVE_EVENT_IDS, demoAnchor, emit, getLiveDb, streamsFor, tickDemo, type RoomState } from "./store";
import { isRealLive } from "./streaming";
import { buildSets, currentAndNext, tzFor } from "./time";
import { REACTION_KINDS, type LiveStatus, type Participant, type ZoneId } from "./types";
import { ZONES } from "./zones";

const NO_STORE = { "Cache-Control": "no-store" };
const ok = (data: unknown, status = 200, headers: Record<string, string> = NO_STORE) => NextResponse.json(data, { status, headers });
const fail = (status: number, code: string, message: string, extra?: Record<string, unknown>) => NextResponse.json({ error: { code, message, ...extra } }, { status, headers: NO_STORE });

const COOKIE = "fk_live";
const ZONE_IDS = ZONES.map((z) => z.id) as [ZoneId, ...ZoneId[]];
const PRESENCE_TTL = 90_000;
const ZONE_AVATAR_LIMIT = 30;

export const liveMode = () => (process.env.LIVE_DATA_MODE === "production" ? "production" : "demo");

/* ---------------- identity (anonymous, signed device id) ---------------- */

function readCookie(req: Request, name: string) {
  const m = (req.headers.get("cookie") ?? "").split(/;\s*/).find((c) => c.startsWith(name + "="));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}

function identity(req: Request): { id: string; set?: string } {
  const secret = sessionSecret()!;
  const raw = readCookie(req, COOKIE);
  if (raw) {
    const [id, sig] = raw.split(".");
    if (id && sig && safeEqual(hmac(secret, `live|${id}`).slice(0, 24), sig)) return { id };
  }
  const id = randomId("lv", 8);
  const value = `${id}.${hmac(secret, `live|${id}`).slice(0, 24)}`;
  return { id, set: `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${process.env.NODE_ENV === "production" ? "; Secure" : ""}` };
}

const withId = (res: NextResponse, who: { set?: string }) => {
  if (who.set) res.headers.append("Set-Cookie", who.set);
  return res;
};

async function body<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<{ ok: true; data: z.infer<T> } | { ok: false; res: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, res: fail(400, "INVALID_JSON", "Send a JSON body.") };
  }
  const r = schema.safeParse(raw);
  if (!r.success) return { ok: false, res: fail(400, "INVALID_INPUT", "Check the highlighted fields.", { issues: r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }) };
  return { ok: true, data: r.data };
}

function limit(req: Request, who: string, bucket: string, n: number, windowMs: number) {
  const wait = rateLimit(`live:${bucket}:${who}:${clientKey(req)}`, n, windowMs);
  if (!wait) return null;
  const res = fail(429, "RATE_LIMITED", "Slow down a little.");
  res.headers.set("Retry-After", String(wait));
  return res;
}

const BLOCKED = [/\bkill yourself\b/i, /\bkys\b/i, /\bn[i1]gg/i, /\bheil\b/i, /seed phrase/i, /private key/i, /send (me )?(usdt|crypto|eth)/i];
function moderate(text: string) {
  if (BLOCKED.some((r) => r.test(text))) return "CONTENT_BLOCKED";
  if ((text.match(/https?:\/\//g) ?? []).length > 1) return "TOO_MANY_LINKS";
  if (/(.)\1{11,}/.test(text)) return "SPAM";
  return null;
}

// The same look everywhere: legacy LIVE avatars and 8.0 identity aliens (mutant family + face/pattern parts).
const zLook = z.object({
  species: z.enum(["slime", "fuzz", "vinyl", "jelly", "mutant"]),
  body: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  outfit: z.enum(["none", "hoodie", "jacket", "vest", "kimono"]),
  outfitColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accessory: z.enum(["none", "headphones", "shades", "crown", "antenna", "cap", "dao_antenna", "horns", "halo", "flower"]),
  eyes: z.enum(["duo", "cyclops", "trio", "stalks", "sleepy", "star"]).optional(),
  mouth: z.enum(["grin", "fangs", "tongue", "zigzag", "o", "smirk"]).optional(),
  pattern: z.enum(["none", "spots", "stripes", "stars", "glitter", "swirl"]).optional(),
  special: z.enum(["none", "blush", "freckles", "bandage", "glow", "drip"]).optional(),
});

/* ---------------- status & attendance ---------------- */

function statusOf(e: FreakEvent): LiveStatus {
  if (e.status === "ended") return "ended";
  if (e.status === "live") return streamsFor(e).some(isRealLive) ? "live" : "demo_live";
  return "upcoming";
}

function clockFor(e: FreakEvent, now: number) {
  // The demo event replays its timetable around a fixed anchor (labelled DEMO CLOCK).
  if (DEMO_LIVE_EVENT_IDS.includes(e.id)) {
    const db = getLiveDb(now);
    return { demo: true, now: demoAnchor(e) + (now - db.bootAt) % (45 * 60_000), anchor: demoAnchor(e) };
  }
  return { demo: false, now, anchor: null };
}

async function metricsByEvent() {
  const r = await getRankings({ category: "popular", period: "all", page: 1, pageSize: 100 });
  return new Map<string, RankedEntry>(r.items.map((i) => [i.event.id, i]));
}

function onlineViewers(room: RoomState | undefined, now: number) {
  if (!room) return 0;
  const real = [...room.participants.values()].filter((p) => !p.demo && now - p.lastSeen < PRESENCE_TTL).length;
  // Demo base audience drifts slowly; labelled "demo viewers".
  return room.viewersBase + Math.round(60 * Math.sin(now / 90_000)) + real;
}

function publicAvatars(room: RoomState | undefined, now: number) {
  if (!room) return 0;
  return [...room.participants.values()].filter((p) => p.visibility === "public" && (p.demo || now - p.lastSeen < PRESENCE_TTL)).length;
}

/* ---------------- handler ---------------- */

export async function handleLive(req: Request, segs: string[]): Promise<Response> {
  const method = req.method.toUpperCase();
  if (liveMode() === "production") return fail(503, "DATA_SOURCE_NOT_CONFIGURED", "Live data source is not configured. Demo data is never served in production mode.");
  const now = Date.now();
  const [a, b, c, d] = segs;

  if (!a && method === "GET") return discovery(now);

  const e = getEvent(a ?? "");
  if (!e) return fail(404, "EVENT_NOT_FOUND", "Unknown event.");
  const db = getLiveDb(now);
  const room = db.rooms.get(e.id);
  if (room) tickDemo(room, now);

  if (!b && method === "GET") return detail(e, now);
  if (b === "rankings" && method === "GET") return rankings(e, now);

  const who = identity(req);

  if (b === "room" && method === "GET") {
    if (!room) return withId(ok({ live: false, status: statusOf(e), message: "This event is not live. Its room opens when the event starts." }), who);
    const u = new URL(req.url);
    const zone = (ZONE_IDS as string[]).includes(u.searchParams.get("zone") ?? "") ? (u.searchParams.get("zone") as ZoneId) : "entrance";
    const since = Math.max(0, Number(u.searchParams.get("since") ?? 0) || 0);
    return withId(ok(roomView(room, who.id, zone, since, now)), who);
  }

  if (method !== "POST") return fail(405, "METHOD_NOT_ALLOWED", "Unsupported method.");

  if (b === "demo-ticket") {
    const l = limit(req, who.id, "ticket", 10, 60_000);
    if (l) return l;
    if (!DEMO_LIVE_EVENT_IDS.includes(e.id)) return fail(409, "NOT_LIVE", "Demo tickets are only issued for the demo live event.");
    const u = new URL(req.url);
    if (u.searchParams.get("sample") === "cancelled") {
      // A fixed refunded/cancelled demo ticket, to show the door rejecting it.
      return withId(ok({ ticketId: "demo-cancelled-1", qr: qrFor(sessionSecret()!, e.id, "demo-cancelled-1"), demo: true, cancelled: true, note: "Cancelled demo ticket (for the rejection demo)." }, 201), who);
    }
    const id = `demo-${randomId("t", 5).slice(2)}`;
    db.tickets.set(id, { id, eventId: e.id, holder: who.id, kind: "main", status: "valid", demo: true });
    return withId(ok({ ticketId: id, qr: qrFor(sessionSecret()!, e.id, id), demo: true, note: "Demo ticket. Not valid for real entry." }, 201), who);
  }

  if (b === "checkin") {
    const l = limit(req, who.id, "checkin", 20, 60_000);
    if (l) return l;
    const r = await body(req, z.object({ qr: z.string().max(200), method: z.enum(["ticket_qr", "organizer_scan", "manual"]).default("ticket_qr") }));
    if (!r.ok) return r.res;
    // Organizer scan / manual verification need door-staff rights. The demo has no staff accounts,
    // so those methods are refused unless the request comes with a valid staff token (not issued in demo).
    if (r.data.method !== "ticket_qr" && !staffToken(req)) return fail(403, "NOT_AUTHORIZED", CHECKIN_ERROR_TEXT.NOT_AUTHORIZED);
    const clock = clockFor(e, now);
    const v = verifyCheckin({ qr: r.data.qr, eventId: e.id, now: clock.now, entryOpensAt: Date.parse(e.startsAt) - 2 * 3600_000, entryClosesAt: Date.parse(e.endsAt), method: r.data.method, by: who.id, demo: true }, sessionSecret()!, db.tickets, db.checkins);
    if (!v.ok) return fail(409, v.code, CHECKIN_ERROR_TEXT[v.code]);
    db.checkins.push(v.record);
    if (room) emit(room, { type: "checkin_confirmed", eventId: e.id, at: now });
    return withId(ok({ ok: true, demo: true, ticketId: v.ticket.id, kind: v.ticket.kind, note: "Demo check-in. Not recorded as real attendance." }), who);
  }

  if (!room) return fail(409, "NOT_LIVE", "This event's live room is not open.");

  if (b === "presence") {
    const l = limit(req, who.id, "presence", 40, 60_000);
    if (l) return l;
    const r = await body(req, z.object({ name: z.string().trim().min(2).max(24), look: zLook, zone: z.enum(ZONE_IDS), visibility: z.enum(["public", "friends", "hidden"]), dance: z.enum(["bounce", "wiggle", "spin"]).default("bounce"), emote: z.enum(["wave", "heart", "fire", "alien", "none"]).default("none"), friends: z.array(z.string().max(40)).max(50).default([]) }));
    if (!r.ok) return r.res;
    if (moderate(r.data.name)) return fail(422, "NAME_BLOCKED", "Pick another display name.");
    const prev = room.participants.get(who.id);
    const p: Participant = { id: who.id, eventId: e.id, ...r.data, lastSeen: now, presence: "online", demo: false };
    room.participants.set(who.id, p);
    if (!prev) emit(room, { type: "participant_joined", eventId: e.id, zone: p.zone, participantId: pubId(who.id), at: now });
    else if (prev.zone !== p.zone) emit(room, { type: "avatar_zone_changed", eventId: e.id, from: prev.zone, to: p.zone, participantId: pubId(who.id), at: now });
    return withId(ok({ ok: true, you: pubId(who.id) }), who);
  }

  if (b === "leave") {
    const p = room.participants.get(who.id);
    if (p) {
      room.participants.delete(who.id);
      emit(room, { type: "participant_left", eventId: e.id, zone: p.zone, participantId: pubId(who.id), at: now });
    }
    return withId(ok({ ok: true }), who);
  }

  if (b === "chat" && !c) {
    const l = limit(req, who.id, "chat", 8, 30_000);
    if (l) return l;
    const r = await body(req, z.object({ body: z.string().trim().min(1).max(280), replyTo: z.string().max(60).nullable().default(null), name: z.string().trim().min(2).max(24), look: zLook }));
    if (!r.ok) return r.res;
    const bad = moderate(r.data.body) ?? moderate(r.data.name);
    if (bad) {
      db.moderation.push({ id: randomId("mod"), eventId: e.id, target: who.id, action: "auto_block", reason: bad, by: "system", at: now });
      return fail(422, bad, "This message breaks the community rules.");
    }
    const dup = room.chat.filter((m) => m.authorId === who.id).slice(-3).some((m) => m.body === r.data.body && now - m.at < 60_000);
    if (dup) return fail(429, "DUPLICATE_MESSAGE", "You just sent that.");
    const msg = { id: randomId("m", 6), eventId: e.id, authorId: who.id, name: r.data.name, look: r.data.look, badge: null, body: r.data.body, replyTo: r.data.replyTo && room.chat.some((m) => m.id === r.data.replyTo) ? r.data.replyTo : null, at: now, hidden: false, reports: [], demo: false };
    room.chat.push(msg);
    if (room.chat.length > 500) room.chat.splice(0, room.chat.length - 500);
    emit(room, { type: "chat_message_created", eventId: e.id, messageId: msg.id, at: now });
    return withId(ok({ message: chatView(msg, who.id) }, 201), who);
  }

  if (b === "chat" && c && d === "report") {
    const l = limit(req, who.id, "report", 10, 60_000);
    if (l) return l;
    const m = room.chat.find((x) => x.id === c);
    if (!m) return fail(404, "NOT_FOUND", "Message not found.");
    if (m.authorId === who.id) return fail(409, "OWN_MESSAGE", "You can't report your own message.");
    if (!m.reports.includes(who.id)) m.reports.push(who.id);
    if (m.reports.length >= 3 && !m.hidden) {
      m.hidden = true;
      db.moderation.push({ id: randomId("mod"), eventId: e.id, target: m.id, action: "auto_hide", reason: "3 reports", by: "system", at: now });
    }
    return withId(ok({ ok: true, hidden: m.hidden }), who);
  }

  if (b === "block") {
    const r = await body(req, z.object({ userId: z.string().max(60) }));
    if (!r.ok) return r.res;
    const target = [...room.participants.keys(), ...room.chat.map((m) => m.authorId)].find((id) => pubId(id) === r.data.userId);
    if (!target || target === who.id) return fail(404, "NOT_FOUND", "User not found.");
    const set = room.blocked.get(who.id) ?? new Set();
    set.add(target);
    room.blocked.set(who.id, set);
    return withId(ok({ ok: true }), who);
  }

  if (b === "reactions") {
    // Animation is client-side; only rate-limited reactions count toward energy.
    const l = limit(req, who.id, "react", 60, 60_000);
    if (l) return l;
    const r = await body(req, z.object({ kind: z.enum(REACTION_KINDS), zone: z.enum(ZONE_IDS) }));
    if (!r.ok) return r.res;
    const counted = room.limiter.allow(who.id, now);
    room.reactions.push({ kind: r.data.kind, zone: r.data.zone, at: now, counted });
    if (room.reactions.length > 2000) room.reactions.splice(0, room.reactions.length - 2000);
    emit(room, { type: "reaction_added", eventId: e.id, zone: r.data.zone, kind: r.data.kind, at: now });
    return withId(ok({ counted, energy: updateEnergy(room, now) }), who);
  }

  if (b === "quests") {
    const r = await body(req, z.object({ questId: z.string().max(40) }));
    if (!r.ok) return r.res;
    const q = LIVE_QUESTS.find((x) => x.id === r.data.questId);
    if (!q) return fail(404, "NOT_FOUND", "Unknown quest.");
    if (q.kind === "onsite") {
      // On-site quests need a verified, non-demo check-in for this event.
      const real = db.checkins.some((x) => x.eventId === e.id && x.by === who.id && !x.demo);
      if (!real) return fail(403, "ONSITE_REQUIRED", "This quest needs a verified on-site check-in. Demo check-ins don't count.");
    }
    const set = room.questCompletions.get(q.id) ?? new Set();
    const fresh = !set.has(who.id);
    set.add(who.id);
    room.questCompletions.set(q.id, set);
    return withId(ok({ ok: true, counted: fresh }), who);
  }

  return fail(404, "NOT_FOUND", "Unknown live endpoint.");
}

/** Door-staff token. Not issued in the demo; production would use the organizer's scanner app session. */
function staffToken(req: Request) {
  const t = req.headers.get("x-door-staff-token");
  const secret = process.env.LIVE_DOOR_STAFF_SECRET;
  return !!t && !!secret && secret.length >= 32 && safeEqual(t, secret);
}

const pubId = (id: string) => (id.startsWith("demo_") || id.startsWith("staff_") ? id : `u${sha256(id).slice(0, 10)}`);

function updateEnergy(room: RoomState, now: number) {
  const active = [...room.participants.values()].filter((p) => p.demo || now - p.lastSeen < PRESENCE_TTL).length;
  const window = 120_000;
  const valid = room.reactions.filter((r) => r.counted && now - r.at < window).length;
  const quests = [...room.questCompletions.values()].reduce((s, x) => s + x.size, 0);
  // Demo audience contributes a steady base of set participation and reactions (labelled demo).
  const demoBoost = Math.round(18 + 10 * Math.sin(now / 120_000));
  const target = energyTarget({ activeParticipants: active + 40, validReactions: valid + demoBoost, questCompletions: quests, setParticipants: Math.round((active + 40) * 0.7) });
  const steps = Math.max(1, Math.min(5, Math.floor((now - room.energyAt) / 3000)));
  let en = room.energy;
  for (let i = 0; i < steps; i++) en = stepEnergy(en, target);
  if (en !== room.energy) emit(room, { type: "energy_updated", eventId: room.eventId, energy: en, at: now });
  room.energy = en;
  room.energyAt = now;
  return en;
}

function chatView(m: RoomState["chat"][number], me: string) {
  return { id: m.id, authorId: pubId(m.authorId), name: m.name, look: m.look, badge: m.badge, body: m.hidden ? "" : m.body, hidden: m.hidden, replyTo: m.replyTo, at: m.at, mine: m.authorId === me, demo: m.demo };
}

function roomView(room: RoomState, me: string, zone: ZoneId, since: number, now: number) {
  const energy = updateEnergy(room, now);
  const blocked = room.blocked.get(me) ?? new Set<string>();
  const live = [...room.participants.values()].filter((p) => p.demo || now - p.lastSeen < PRESENCE_TTL);
  for (const p of [...room.participants.values()]) if (!p.demo && now - p.lastSeen >= PRESENCE_TTL) {
    room.participants.delete(p.id);
    emit(room, { type: "participant_left", eventId: room.eventId, zone: p.zone, participantId: pubId(p.id), at: now });
  }
  const meP = room.participants.get(me);
  const visibleTo = (p: Participant) => p.id !== me && !blocked.has(p.id) && (p.visibility === "public" || (p.visibility === "friends" && !!meP && p.friends.includes(pubId(me)) && meP.friends.includes(pubId(p.id))));
  // Per-zone counts (public avatars only) + full avatars for the viewer's zone and its neighbours, capped.
  const zoneCounts = Object.fromEntries(ZONES.map((z) => [z.id, live.filter((p) => p.zone === z.id && p.visibility === "public").length]));
  const avatars = live
    .filter(visibleTo)
    .sort((x, y) => Number(y.zone === zone) - Number(x.zone === zone))
    .slice(0, ZONE_AVATAR_LIMIT * 2)
    .map((p) => ({ id: pubId(p.id), name: p.name, look: p.look, zone: p.zone, dance: p.dance, emote: p.emote, friend: p.visibility === "friends", demo: p.demo, presence: p.presence }));
  const chat = room.chat.filter((m) => !blocked.has(m.authorId)).slice(-60).map((m) => chatView(m, me));
  const recent = room.reactions.filter((r) => now - r.at < 8000);
  const reactions = Object.fromEntries(REACTION_KINDS.map((k) => [k, Math.min(12, recent.filter((r) => r.kind === k).length)]));
  const events = room.events.filter((x) => x.seq > since).slice(-50).filter((x) => !("zone" in x) || x.type === "reaction_added" || x.zone === zone);
  return {
    live: true,
    seq: room.seq,
    serverTime: now,
    energy,
    level: levelFor(energy).key,
    zoneCounts,
    avatars,
    chat,
    reactions,
    events,
    onlineViewers: onlineViewers(room, now),
    publicAvatars: publicAvatars(room, now),
    you: meP ? { id: pubId(me), zone: meP.zone, visibility: meP.visibility } : null,
    demo: true,
  };
}

async function discovery(now: number) {
  const events = await discoveryEvents(now);
  const order = (s: LiveStatus) => ({ live: 0, demo_live: 1, upcoming: 2, ended: 3 })[s];
  events.sort((x, y) => order(x.status) - order(y.status) || Date.parse(x.startsAt) - Date.parse(y.startsAt));
  const realLive = events.filter((x) => x.status === "live");
  const nextUp = events.filter((x) => x.status === "upcoming").slice(0, 3).map((x) => x.id);
  return ok(
    { mode: liveMode(), asOf: now, realLiveCount: realLive.length, featured: realLive[0]?.id ?? null, demoLive: events.filter((x) => x.status === "demo_live").map((x) => x.id), nextUp, events },
    200,
    { "Cache-Control": "public, s-maxage=15" },
  );
}

/** Per-event live status, current DJ and the separate attendance numbers. Also used by the world map API. */
export async function discoveryEvents(now: number) {
  syncEventClock(now);
  const metrics = await metricsByEvent();
  const db = getLiveDb(now);
  const daos = new Map(allDaoSummaries(now).map((d) => [d.eventId, d]));
  const events = EVENTS.map((e) => {
    const status = statusOf(e);
    const room = db.rooms.get(e.id);
    const sets = buildSets(e);
    const clock = clockFor(e, now);
    const cur = status === "live" || status === "demo_live" ? currentAndNext(sets, "main", clock.now).current : null;
    const m = metrics.get(e.id)?.metrics;
    const ap = e.afterPartyId ? getAfterParty(e.afterPartyId) : undefined;
    return {
      id: e.id,
      name: e.name,
      city: e.city,
      country: e.country,
      lat: e.lat,
      lng: e.lng,
      approximateLocation: e.status === "funding",
      venue: getVenue(e.venueId)?.name ?? null,
      genres: e.genres,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      tz: tzFor(e.city),
      status,
      currentDj: cur ? { id: cur.djId, name: getDJ(cur.djId)?.name ?? cur.djId } : null,
      attendance: {
        ticketsSold: m?.tickets_sold ?? 0,
        checkedIn: m?.checked_in_count ?? 0,
        publicAvatars: room ? publicAvatars(room, now) : m?.public_avatar_count ?? 0,
        onlineViewers: room ? onlineViewers(room, now) : 0,
        demo: true,
      },
      supporters: m?.supporters_count ?? e.supporters,
      afterParty: ap ? { id: ap.id, name: ap.name, startsAt: ap.startsAt, venue: ap.venueName } : null,
      djAudition: e.djRecruiting,
      dao: daos.has(e.id),
    };
  });
  return events;
}

async function detail(e: FreakEvent, now: number) {
  const db = getLiveDb(now);
  const room = db.rooms.get(e.id);
  const sets = buildSets(e).map((s) => ({ ...s, dj: djCard(s.djId) }));
  const ap = e.afterPartyId ? getAfterParty(e.afterPartyId) : undefined;
  const m = (await metricsByEvent()).get(e.id)?.metrics;
  const door = attendance([...db.tickets.values()], db.checkins, db.exits, e.id, true);
  const streams = streamsFor(e).map((s) => ({ stageId: s.stageId, provider: s.provider, live: isRealLive(s), rights: s.rights, qualities: s.qualities, recordingAllowed: s.rights.recordingAllowed }));
  return ok({
    event: { id: e.id, name: e.name, city: e.city, country: e.country, genres: e.genres, startsAt: e.startsAt, endsAt: e.endsAt, venueId: e.venueId, venue: getVenue(e.venueId)?.name ?? null, capacity: e.capacity, organizer: e.organizer, palette: e.palette, isDemo: e.isDemo, lat: e.lat, lng: e.lng },
    status: statusOf(e),
    tz: tzFor(e.city),
    clock: clockFor(e, now),
    stages: [...new Set(sets.map((s) => s.stageId))].map((id) => ({ id, name: id === "second" ? "Second Stage" : "Main Stage", zone: id })),
    sets,
    streams,
    afterParty: ap ? { ...ap, dj: ap.djIds.map(djCard), confirmed: true, online: false } : null,
    attendance: {
      ticketsSold: m?.tickets_sold ?? 0,
      checkedIn: m?.checked_in_count ?? 0,
      currentlyPresent: m?.currently_present_count ?? null,
      onlineViewers: onlineViewers(room, now),
      publicAvatars: publicAvatars(room, now),
      doorDemo: door,
      demo: true,
      note: "Demo figures. Tickets sold, unique check-ins, verified present guests, online viewers and public avatars are separate numbers.",
    },
    quests: LIVE_QUESTS,
    mode: liveMode(),
  });
}

function djCard(id: string) {
  const d = getDJ(id) ?? DJS[0];
  return { id: d.id, name: d.name, genres: d.genres, look: d.look, city: d.city };
}

async function rankings(e: FreakEvent, now: number) {
  const pos = async (category: "popular" | "attended" | "trending") => {
    const r = await getRankings({ category, period: category === "trending" ? "7d" : "all", page: 1, pageSize: 100 });
    const i = r.items.find((x) => x.event.id === e.id);
    return { rank: i?.rank ?? null, of: r.total, period: r.period, asOf: r.asOf, calculationVersion: r.calculationVersion };
  };
  const [event, checkedIn, trending] = await Promise.all([pos("popular"), pos("attended"), pos("trending")]);
  const daos = allDaoSummaries(now).sort((a, b) => b.members - a.members);
  const ci = daos.findIndex((d) => d.eventId === e.id);
  const db = getLiveDb(now);
  const liveRooms = [...db.rooms.values()].map((r) => ({ id: r.eventId, v: onlineViewers(r, now) })).sort((a, b) => b.v - a.v);
  const li = liveRooms.findIndex((r) => r.id === e.id);
  return ok({
    event: { ...event, label: "Event rank (unique supporters)" },
    checkedIn: { ...checkedIn, label: "Checked-in rank (unique verified check-ins)" },
    trending: { ...trending, label: "Trending rank (7-day growth)" },
    community: { rank: ci >= 0 ? ci + 1 : null, of: daos.length, period: "now", asOf: new Date(now).toISOString(), label: "Community rank (DAO members)" },
    liveViewers: { rank: li >= 0 ? li + 1 : null, of: liveRooms.length, period: "now", asOf: new Date(now).toISOString(), label: "Live viewer rank (online viewers, separate from on-site attendance)" },
    demo: true,
  });
}
