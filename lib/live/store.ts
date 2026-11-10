/**
 * Demo live store (server memory, per instance; may reset). Production replaces it with
 * the tables in db/migrations/0003_live_festival.sql and a pub/sub (e.g. Redis, LiveKit data).
 * Demo and production data never mix: every demo row carries demo=true.
 */
import { DJS, EVENTS } from "@/lib/data";
import type { AlienLook, FreakEvent } from "@/lib/types";
import { ReactionLimiter } from "./energy";
import type { TicketRow } from "./checkin";
import { buildSets } from "./time";
import type { ChatMessage, CheckinRecord, LiveStream, Participant, ReactionKind, RealtimeEvent, StageSet, ZoneId } from "./types";
import { DEMO_RIGHTS } from "./streaming";
import { ZONES } from "./zones";

export interface RoomState {
  eventId: string;
  energy: number;
  energyAt: number;
  chat: ChatMessage[];
  participants: Map<string, Participant>;
  reactions: { kind: ReactionKind; zone: ZoneId; at: number; counted: boolean }[];
  limiter: ReactionLimiter;
  questCompletions: Map<string, Set<string>>; // questId -> user ids
  events: (RealtimeEvent & { seq: number })[];
  seq: number;
  blocked: Map<string, Set<string>>; // user -> blocked user ids
  viewersBase: number;
  demoTickAt: number;
}

export interface LiveDb {
  rooms: Map<string, RoomState>;
  tickets: Map<string, TicketRow>;
  checkins: CheckinRecord[];
  exits: { ticketId: string; at: number }[];
  moderation: { id: string; eventId: string; target: string; action: string; reason: string; by: string; at: number }[];
  bootAt: number;
}

const g = globalThis as unknown as { __fkLiveDb?: LiveDb };

/** Events that run as a DEMO live simulation (never shown as real LIVE). */
export const DEMO_LIVE_EVENT_IDS = EVENTS.filter((e) => e.status === "live").map((e) => e.id);

export function streamsFor(e: FreakEvent): LiveStream[] {
  const stages = [...new Set(e.timetable.map((s) => (s.stage === "Second Stage" ? "second" : "main")))];
  return stages.map((stageId) => ({ stageId, provider: e.status === "live" ? "demo" : "none", playbackId: null, rights: DEMO_RIGHTS, qualities: ["auto", "1080p", "720p", "480p", "audio"] }));
}

/**
 * The demo clock: a fixed point inside the demo event's timetable so the simulation always
 * shows a set in progress, plus real elapsed time. It is labelled DEMO CLOCK in the UI.
 */
export function demoAnchor(e: FreakEvent) {
  const sets = buildSets(e);
  const s = sets[1] ?? sets[0];
  return s ? s.startAt + 20 * 60_000 : Date.parse(e.startsAt);
}

const BOT_LINES = [
  "this bassline is melting my antennae 👽",
  "first time joining from the virtual floor, hi everyone!",
  "who else is on the dancefloor zone?",
  "the lights on main just went purple 🔥",
  "can't wait for the afterglow party",
  "greetings from the alien lounge",
  "that transition was unreal",
  "hands up for the next drop 🙌",
  "is anyone actually at the venue tonight?",
  "the lineup tonight is stacked",
];

function demoLook(i: number): AlienLook {
  const d = DJS[i % DJS.length];
  return { ...d.look };
}

function seedRoom(e: FreakEvent, now: number): RoomState {
  const room: RoomState = {
    eventId: e.id,
    energy: 58,
    energyAt: now,
    chat: [],
    participants: new Map(),
    reactions: [],
    limiter: new ReactionLimiter(),
    questCompletions: new Map(),
    events: [],
    seq: 0,
    blocked: new Map(),
    viewersBase: 1180,
    demoTickAt: now,
  };
  const names = ["gloop_fan", "neon_moth", "bass_beetle", "ufo_ufo", "jelly_jam", "kaiju_kid", "spore_sis", "orbit_owl", "slime_sam", "fuzzbox", "tokyo_tentacle", "dub_drone", "moon_mochi", "raver_ray", "lazer_leaf", "beam_bun", "void_vee", "pixel_pod", "sub_sushi", "glow_goo", "acid_aki", "crt_cat", "warp_wren", "zine_zed"];
  const zones: ZoneId[] = ["main", "main", "main", "dancefloor", "dancefloor", "dancefloor", "dancefloor", "second", "second", "lounge", "lounge", "bar", "food", "community", "vip", "entrance", "portal", "dancefloor", "main", "lounge", "community", "second", "dancefloor", "bar"];
  names.forEach((name, i) => {
    const id = `demo_p_${i}`;
    room.participants.set(id, { id, eventId: e.id, name, look: demoLook(i), zone: zones[i % zones.length], visibility: i % 7 === 6 ? "friends" : "public", dance: (["bounce", "wiggle", "spin"] as const)[i % 3], emote: "none", friends: [], lastSeen: Number.POSITIVE_INFINITY, presence: i % 4 === 0 ? "onsite_verified" : "online", demo: true });
  });
  const dj = DJS.find((d) => d.id === e.lineup[0]);
  const lines: [string, string, ChatMessage["badge"]][] = [
    ["Ooze Collective", "Welcome to the BASSMUTANT demo room! Be kind, no spam. Reports go to our moderators.", "organizer"],
    [dj?.name ?? "DJ", "Thanks for tuning in — next set goes deeper 🔊", "dj"],
    ...BOT_LINES.slice(0, 6).map((l, i) => [names[i], l, null] as [string, string, null]),
  ];
  lines.forEach(([name, body, badge], i) => {
    room.chat.push({ id: `demo_m_${i}`, eventId: e.id, authorId: badge ? `staff_${badge}` : `demo_p_${i}`, name, look: demoLook(i + 3), badge, body, replyTo: null, at: now - (lines.length - i) * 45_000, hidden: false, reports: [], demo: true });
  });
  return room;
}

function seedTickets(db: LiveDb) {
  // A few fixed demo tickets for tests and the door-scan demo.
  const e = EVENTS.find((x) => x.status === "live");
  if (!e) return;
  db.tickets.set("demo-cancelled-1", { id: "demo-cancelled-1", eventId: e.id, holder: "refund_ray", kind: "main", status: "cancelled", demo: true });
  for (let i = 0; i < 6; i++) db.tickets.set(`demo-door-${i}`, { id: `demo-door-${i}`, eventId: e.id, holder: `guest_${i}`, kind: i % 3 ? "main" : "vip", status: "valid", demo: true });
}

export function getLiveDb(now = Date.now()): LiveDb {
  if (!g.__fkLiveDb) {
    const db: LiveDb = { rooms: new Map(), tickets: new Map(), checkins: [], exits: [], moderation: [], bootAt: now };
    for (const id of DEMO_LIVE_EVENT_IDS) db.rooms.set(id, seedRoom(EVENTS.find((e) => e.id === id)!, now));
    seedTickets(db);
    g.__fkLiveDb = db;
  }
  return g.__fkLiveDb;
}

export function _resetLiveDb() {
  g.__fkLiveDb = undefined;
}

export function emit(room: RoomState, ev: RealtimeEvent) {
  room.seq += 1;
  room.events.push({ ...ev, seq: room.seq });
  if (room.events.length > 400) room.events.splice(0, room.events.length - 400);
}

/** Demo crowd drift: a couple of demo avatars change zone and the bot chat continues. */
export function tickDemo(room: RoomState, now: number) {
  const step = Math.floor(now / 20_000);
  const last = Math.floor(room.demoTickAt / 20_000);
  if (step === last) return;
  room.demoTickAt = now;
  const ids = [...room.participants.values()].filter((p) => p.demo);
  if (ids.length) {
    const p = ids[step % ids.length];
    const to = ZONES[(step * 7) % ZONES.length].id;
    if (p.zone !== to) {
      emit(room, { type: "avatar_zone_changed", eventId: room.eventId, from: p.zone, to, participantId: p.id, at: now });
      p.zone = to;
    }
    if (step % 2 === 0) {
      const name = ids[(step * 3) % ids.length].name;
      const m: ChatMessage = { id: `demo_m_t${step}`, eventId: room.eventId, authorId: ids[(step * 3) % ids.length].id, name, look: ids[(step * 3) % ids.length].look, badge: null, body: BOT_LINES[step % BOT_LINES.length], replyTo: null, at: now, hidden: false, reports: [], demo: true };
      if (!room.chat.some((c) => c.id === m.id)) {
        room.chat.push(m);
        emit(room, { type: "chat_message_created", eventId: room.eventId, messageId: m.id, at: now });
      }
    }
  }
}

export type { StageSet };
