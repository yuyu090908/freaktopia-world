/**
 * FREAKTOPIA WORLD 9.0 · PERSONAL PARTY UNIVERSE: domain types.
 *
 * The organizer's events are the event-operations events (lib/ops, ops_events): no second event table.
 * Attendance is one normalized row per (event, account); every figure in a world is computed from it.
 * Stored through the ops store (lib/ops/store.ts) in the tables of db/migrations/0008_party_universe.sql.
 */
import type { AlienLook } from "@/lib/types";

type ISODate = string;

/**
 * Attendance states, never mixed:
 *  going      – registered to come (RSVP). Never counted.
 *  cancelled  – the person cancelled, or the organizer revoked the record (reason logged). Never counted.
 * A row is counted only when `checkedInAt` is set (door QR scan or an organizer confirmation with a reason)
 * AND the event is verified as held (see `isVerifiedEvent`).
 */
/** going = holds a (free) ticket and a pass; waitlist = the party is full, no pass until a place opens. */
export type AttendanceStatus = "going" | "waitlist" | "cancelled";
export type CheckinMethod = "qr" | "manual";

export interface Attendance {
  eventId: string;
  userId: string;
  status: AttendanceStatus;
  /** Random per-event pass code shown as text + QR. Unique within the event. */
  passCode: string;
  checkedInAt: ISODate | null;
  method: CheckinMethod | null;
  /** Who scanned or confirmed. */
  by: string | null;
  createdAt: ISODate;
  updatedAt: ISODate;
  version: number;
  /** Every change with who and why. */
  history: { at: ISODate; by: string; action: "rsvp" | "waitlist" | "promote" | "cancel" | "checkin" | "manual_confirm" | "revoke" | "restore"; reason?: string }[];
  demo?: boolean;
}

/** Every scan attempt, including repeats and rejections (for audits and anomaly checks). */
export interface CheckinLog {
  id: string;
  eventId: string;
  userId: string | null;
  by: string;
  at: ISODate;
  result: "ok" | "duplicate" | "not_found" | "cancelled" | "not_entry_time" | "waitlist";
  /** Truncated hash of the scanner's IP (never the IP itself). */
  ipHash: string | null;
}

/** People without an account or without a confirmable check-in: kept apart, never mixed into account figures. */
export interface GuestCount {
  eventId: string;
  count: number;
  note: string;
  history: { at: ISODate; by: string; count: number; reason: string }[];
}

export interface EventReview {
  eventId: string;
  userId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  at: ISODate;
  demo?: boolean;
}

export type MediaKind = "official" | "attendee";
export type MediaVisibility = "public" | "attendees" | "hidden";
export interface Media {
  id: string;
  eventId: string;
  uploaderId: string;
  kind: MediaKind;
  type: "image" | "video";
  mime: string;
  blobId: string;
  caption: string;
  visibility: MediaVisibility;
  /** The organizer may hide an attendee post from their world; only the author can delete it. */
  hiddenByOrganizer: boolean;
  at: ISODate;
}

export interface Follow {
  organizerId: string;
  userId: string;
  /** New-event notifications; off by default until the follower turns them on. */
  notify: boolean;
  /** Also send new-party notes by email (opt-in, off by default). */
  email?: boolean;
  at: ISODate;
}

export interface Block {
  userId: string;
  organizerId: string;
  at: ISODate;
}

/** The attendee's choice. Off by default: nobody is shown by name or alien until they opt in. */
export interface WorldPrivacy {
  userId: string;
  /** Show my alien and name in the worlds of organizers whose events I attended. */
  showInWorlds: boolean;
  /** Show the list of parties I attended on my public profile. */
  showHistory: boolean;
  updatedAt: ISODate;
}

export interface WorldSettings {
  ownerId: string;
  /** Events the organizer chose to show in their world (public: name, date, city, genres, size). */
  publishedEventIds: string[];
  tagline: string;
  updatedAt: ISODate;
}

export interface PartyAudit {
  id: string;
  eventId: string | null;
  actorId: string;
  action: string;
  reason: string;
  meta: Record<string, string | number | boolean | null>;
  at: ISODate;
}

// ------------------------------------------------------------------ derived, public-safe views

export type PartyTheme = "tech_house" | "afro_house" | "melodic_techno" | "festival" | "default";

export interface EventFacts {
  id: string;
  name: string;
  city: string;
  country: string;
  venueName: string;
  startAt: ISODate;
  endAt: ISODate;
  timezone: string;
  genres: string[];
  level: number;
  status: string;
  /** Expected attendance the organizer planned for (not a count of anyone). */
  plannedAttendance: number;
}

export interface AttendeeView {
  key: string; // stable per world, not the user id for anonymous people
  publicId: string | null; // only for people who opted in
  name: string | null;
  look: AlienLook | null;
  visits: number;
  tier: VisitTier;
}

export type VisitTier = "first" | "aura" | "glow" | "regular";
export const tierFor = (visits: number): VisitTier => (visits >= 10 ? "regular" : visits >= 5 ? "glow" : visits >= 2 ? "aura" : "first");

/** Per-party settings chosen by the owner or a manager. */
export interface PartySettings {
  eventId: string;
  /** Free tickets: at most this many people hold a pass; the rest wait. null = no limit. */
  capacity: number | null;
  /** Links to recordings of this party (stream archive, DJ mix). Links only; nothing is embedded or generated. */
  archives: { url: string; label: string; host: string }[];
  /** Media the organizer picked to show first (chosen by a person, not generated). */
  highlights: string[];
  updatedAt: ISODate;
  by: string;
}
