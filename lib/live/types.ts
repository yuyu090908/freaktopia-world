/**
 * FREAKTOPIA WORLD 6.0 · LIVE FESTIVAL EXPERIENCE: domain types.
 * Shared by the API (lib/live/api.ts), the client and db/migrations/0003_live_festival.sql.
 */
import type { AlienLook } from "@/lib/types";

/** Where a live status comes from. Only "stream" (a connected, licensed stream) may be shown as LIVE NOW. */
export type LiveStatus = "live" | "demo_live" | "upcoming" | "ended";

export type ZoneId =
  | "main"
  | "second"
  | "dancefloor"
  | "lounge"
  | "bar"
  | "food"
  | "entrance"
  | "portal"
  | "vip"
  | "community";

export type AvatarVisibility = "public" | "friends" | "hidden";
export type DanceMove = "bounce" | "wiggle" | "spin";
export type Emote = "wave" | "heart" | "fire" | "alien" | "none";

export const REACTION_KINDS = ["fire", "love", "bass", "alien", "hands"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

export type StreamProviderKind = "none" | "demo" | "mux" | "livekit";

/** Rights a stream needs before it may be shown or recorded. */
export interface StreamRights {
  /** Performer and organizer agreed to broadcast. */
  broadcastConsent: boolean;
  /** Music rights cleared for streaming in the viewer's territory (collecting society / label licence). */
  musicLicensed: boolean;
  recordingAllowed: boolean;
  territories: string[] | "worldwide";
}

export interface LiveStream {
  stageId: string;
  provider: StreamProviderKind;
  /** Playback id / room name from the provider. Never an ingest key. */
  playbackId: string | null;
  rights: StreamRights;
  qualities: ("auto" | "1080p" | "720p" | "480p" | "audio")[];
}

export interface LiveStage {
  id: string; // "main" | "second"
  name: string;
  zone: ZoneId;
}

export interface StageSet {
  id: string;
  stageId: string;
  djId: string;
  /** Venue-local wall-clock time "HH:MM" (as stored in the timetable). */
  localStart: string;
  localEnd: string;
  /** Absolute instants (ms) computed from the venue time zone. */
  startAt: number;
  endAt: number;
}

export interface ChatMessage {
  id: string;
  eventId: string;
  authorId: string; // live device/session id, hashed for display
  name: string;
  look: AlienLook;
  badge: "dj" | "organizer" | "moderator" | null;
  body: string;
  replyTo: string | null;
  at: number;
  hidden: boolean;
  reports: string[];
  demo: boolean;
}

export interface Participant {
  id: string;
  eventId: string;
  name: string;
  look: AlienLook;
  zone: ZoneId;
  visibility: AvatarVisibility;
  dance: DanceMove;
  emote: Emote;
  friends: string[];
  lastSeen: number;
  /** Online viewer vs verified on-site guest. Never inferred from watching a stream. */
  presence: "online" | "onsite_verified";
  demo: boolean;
}

export interface EnergyInput {
  activeParticipants: number;
  /** Reactions counted after per-user rate limiting. */
  validReactions: number;
  questCompletions: number;
  /** Participants who stayed through ≥ 10 minutes of the current set. */
  setParticipants: number;
}

export type EnergyLevelKey = "WARM_UP" | "GROOVE" | "BUILD_UP" | "PEAK_TIME" | "ALIEN_INVASION";

export interface Quest {
  id: string;
  title: string;
  desc: string;
  xp: number;
  badge?: string;
  reward?: string;
  /** online quests can be done from anywhere; onsite ones need a verified check-in. */
  kind: "online" | "onsite";
  target: number;
}

export interface CheckinRecord {
  ticketId: string;
  eventId: string;
  at: number;
  method: "ticket_qr" | "organizer_scan" | "manual";
  by: string;
  /** Demo check-ins never count toward production attendance. */
  demo: boolean;
}

export type CheckinError =
  | "QR_MALFORMED"
  | "QR_SIGNATURE_INVALID"
  | "WRONG_EVENT"
  | "TICKET_NOT_FOUND"
  | "TICKET_CANCELLED"
  | "TICKET_ALREADY_USED"
  | "NOT_ENTRY_TIME"
  | "NOT_AUTHORIZED";

/** Real-time events. Rooms are per event; avatar state is synced per zone, never all positions every second. */
export type RealtimeEvent =
  | { type: "participant_joined"; eventId: string; zone: ZoneId; participantId: string; at: number }
  | { type: "participant_left"; eventId: string; zone: ZoneId; participantId: string; at: number }
  | { type: "avatar_zone_changed"; eventId: string; from: ZoneId; to: ZoneId; participantId: string; at: number }
  | { type: "reaction_added"; eventId: string; zone: ZoneId; kind: ReactionKind; at: number }
  | { type: "chat_message_created"; eventId: string; messageId: string; at: number }
  | { type: "dj_set_started"; eventId: string; stageId: string; setId: string; at: number }
  | { type: "dj_set_ended"; eventId: string; stageId: string; setId: string; at: number }
  | { type: "energy_updated"; eventId: string; energy: number; at: number }
  | { type: "event_status_changed"; eventId: string; status: LiveStatus; at: number }
  | { type: "checkin_confirmed"; eventId: string; at: number };

export type RealtimeEventType = RealtimeEvent["type"];
