/**
 * DJ ARENA 2.0 data model (db/migrations/0012_dj_music.sql). Only what did not exist before is new:
 * accounts, work profiles, listings, applications, agreements, messages, notifications, blocks, audit and
 * file blobs are the existing ops / party records.
 */
import type { DjGenre } from "./genres";

type ISODate = string;

export type BookingAvailability = "open" | "limited" | "closed";
/** Who may use CONTACT DJ: nobody, signed-in organizers only, or any verified account. */
export type ContactPolicy = "none" | "organizers" | "anyone";

export interface DjProfile {
  userId: string;
  /** URL handle: /djs/u/<slug>. */
  slug: string;
  stageName: string;
  bio: string;
  country: string;
  city: string;
  genres: DjGenre[];
  yearsExperience: number;
  equipment: string;
  regions: string[];
  bookingStatus: BookingAvailability;
  contactPolicy: ContactPolicy;
  /** Hours kept free before/after a confirmed set (travel and set-up). Used by the conflict check. */
  bufferHours: number;
  links: { label: string; url: string }[];
  /** Self-declared past events (shown as such); confirmed FREAKTOPIA bookings are listed separately. */
  pastEvents: string[];
  imageId: string | null;
  /** Show the FREAKTOPIA alien on the DJ profile. */
  showAlien: boolean;
  visibility: "public" | "hidden";
  /** The existing ops person listing that receives event-dashboard offers (lib/ops). */
  listingId: string | null;
  createdAt: ISODate;
  updatedAt: ISODate;
  version: number;
}

export const TRACK_TYPES = ["original_track", "original_mix", "dj_set", "remix", "mashup", "live_recording", "demo"] as const;
export type TrackType = (typeof TRACK_TYPES)[number];
/** Types that by nature contain other people's recordings or compositions. */
export const THIRD_PARTY_TYPES: TrackType[] = ["dj_set", "remix", "mashup", "live_recording"];

export type TrackVisibility = "public" | "unlisted" | "private" | "audition";
export type ProcessingStatus = "awaiting_upload" | "processing" | "ready" | "failed";
/**
 * draft: being prepared. private: ready, owner only. pending_review: waiting for staff to look at the rights
 * information. published: visible per `visibility`. rejected: staff could not confirm the rights.
 * removed: taken down after a copyright claim.
 */
export type PublicationStatus = "draft" | "private" | "pending_review" | "published" | "rejected" | "removed";
/**
 * unverified: only the uploader's statement. staff_reviewed: staff read the uploader's statement and licence
 * documents. This is NOT an audio-recognition copyright check (none is connected) and is never shown as one.
 */
export type RightsStatus = "unverified" | "pending_review" | "staff_reviewed" | "rejected";

export interface RightsInfo {
  /** The uploader wrote/produced everything in the recording. */
  allOriginal: boolean;
  /** Recordings or compositions by others are included. */
  usesThirdParty: boolean;
  /** Who granted permission (label, publisher, collecting society licence…). */
  licensor: string;
  /** Licence reference or description. */
  licenseRef: string;
  /** Where the permission applies, e.g. "Worldwide" or "JP, KR". */
  territories: string;
  /** Last day of the permission, or null when it does not expire. */
  licenseEnds: string | null;
  allowStreaming: boolean;
  allowDownload: boolean;
  /** Licence document (existing ops blob, PDF/image), seen by staff only. */
  documentId: string | null;
  statement: string;
}

export interface CodecInfo {
  mpegVersion: "1" | "2" | "2.5";
  layer: 3;
  bitrateKbps: number;
  sampleRate: number;
  channels: 1 | 2;
  vbr: boolean;
}

export interface AudioTrack {
  id: string;
  ownerId: string;
  title: string;
  type: TrackType;
  genre: DjGenre;
  bpm: number | null;
  musicalKey: string | null;
  /** Read from the file on the server; never from the uploader. */
  durationSec: number | null;
  description: string;
  recordedAt: string | null;
  releaseAt: string | null;
  coverId: string | null;
  /** Object key of the untouched master. Never shown to the browser. */
  storageKey: string;
  /** Object key used for playback. No transcoder is connected, so this is the master itself (read-only). */
  playbackKey: string | null;
  fileName: string;
  sizeBytes: number;
  codec: CodecInfo | null;
  /** 0–1 peaks computed from the file in the uploader's browser; cosmetic only. */
  waveform: number[];
  processingStatus: ProcessingStatus;
  processingError: string | null;
  publicationStatus: PublicationStatus;
  visibility: TrackVisibility;
  rightsStatus: RightsStatus;
  rights: RightsInfo;
  /** Off by default; only allowed when the rights allow downloads and staff reviewed them. */
  downloadable: boolean;
  reviewNote: string | null;
  createdAt: ISODate;
  updatedAt: ISODate;
  publishedAt: ISODate | null;
  version: number;
}

export interface Playlist {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  visibility: "public" | "unlisted" | "private";
  coverId: string | null;
  /** dj: shown on the DJ profile. library: a listener's own list. Same model. */
  kind: "dj" | "library";
  createdAt: ISODate;
  updatedAt: ISODate;
  version: number;
}

export interface PlaylistItem {
  id: string;
  playlistId: string;
  trackId: string;
  position: number;
  addedAt: ISODate;
}

export interface TrackLike { trackId: string; userId: string; ownerId: string; at: ISODate }
export interface SavedTrack { trackId: string; userId: string; ownerId: string; at: ISODate }

export type PlayRejectReason = "short" | "owner" | "repeat" | "bot" | "rate" | "clock";
export interface TrackPlay {
  id: string;
  trackId: string;
  ownerId: string;
  /** Account id, or null for signed-out listeners. */
  listenerId: string | null;
  /** Account id, or a hash of client address + browser for signed-out listeners (never the raw address). */
  listenerKey: string;
  sessionId: string;
  startedAt: ISODate;
  finishedAt: ISODate | null;
  playedSeconds: number;
  qualified: boolean;
  reason: PlayRejectReason | null;
}

export type DayStatus = "available" | "tentative" | "booked" | "unavailable" | "private";
export interface DjAvailability {
  djId: string;
  /** YYYY-MM-DD in the DJ's own calendar. */
  day: string;
  status: DayStatus;
  /** Never shown to anyone but the DJ. */
  note: string;
  bookingId: string | null;
  updatedAt: ISODate;
}

export const BOOKING_STATUSES = ["draft", "sent", "viewed", "negotiating", "accepted", "declined", "expired", "cancelled", "confirmed"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export interface BookingTerms {
  feeAmount: number;
  currency: string;
  performanceStart: ISODate;
  performanceEnd: ISODate;
  setMinutes: number;
  travel: string;
  accommodation: string;
  equipment: string;
  notes: string;
}

export interface BookingEventInfo {
  name: string;
  country: string;
  city: string;
  venue: string;
  genres: string[];
  /** The organizer allows the confirmed booking to be listed on the DJ's public profile. */
  listPublicly: boolean;
}

export interface BookingRequest {
  id: string;
  /** booking: an organizer asks for a set. inquiry: CONTACT DJ, a plain question (only if the DJ allows it). */
  kind: "booking" | "inquiry";
  djId: string;
  requesterId: string;
  requesterName: string;
  /** Existing FREAKTOPIA event the request was made from (ops event), if any. */
  eventId: string | null;
  event: BookingEventInfo;
  terms: BookingTerms;
  status: BookingStatus;
  /** Bumped by every change of terms; acceptance is always for one version. */
  termsVersion: number;
  djAcceptedVersion: number | null;
  /** Who must answer next. */
  awaiting: "dj" | "requester" | null;
  detailsRequested: string | null;
  respondBy: ISODate;
  viewedAt: ISODate | null;
  history: { at: ISODate; by: string; action: string; status: BookingStatus }[];
  createdAt: ISODate;
  updatedAt: ISODate;
  version: number;
}

export interface BookingOffer {
  id: string;
  bookingId: string;
  terms: BookingTerms;
  termsVersion: number;
  proposedBy: string;
  status: "proposed" | "superseded" | "accepted" | "declined";
  createdAt: ISODate;
}

export type ClaimStatus = "open" | "upheld" | "dismissed" | "countered" | "restored";
export interface CopyrightClaim {
  id: string;
  trackId: string;
  ownerId: string;
  claimantId: string | null;
  claimantName: string;
  /** Staff only. */
  claimantEmail: string;
  work: string;
  details: string;
  status: ClaimStatus;
  counter: { statement: string; at: ISODate } | null;
  resolution: string;
  history: { at: ISODate; by: string; action: string }[];
  createdAt: ISODate;
}

export interface MusicReport {
  id: string;
  reporterId: string;
  targetType: "track" | "booking" | "user";
  targetId: string;
  reason: "spam" | "abuse" | "fraud" | "other";
  details: string;
  status: "open" | "closed";
  createdAt: ISODate;
}

export interface MusicSettings {
  id: "global";
  maxFileMb: number;
  maxDurationMin: number;
  quotaMbPerUser: number;
  uploadsPerDay: number;
  /** Upheld claims after which uploads are refused (repeat infringer). */
  strikeLimit: number;
  updatedAt: ISODate;
  updatedBy: string | null;
}

export const DEFAULT_SETTINGS: MusicSettings = {
  id: "global", maxFileMb: 300, maxDurationMin: 180, quotaMbPerUser: 3000, uploadsPerDay: 20, strikeLimit: 3, updatedAt: new Date(0).toISOString(), updatedBy: null,
};
