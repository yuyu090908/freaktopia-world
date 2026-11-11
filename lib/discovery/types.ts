/**
 * FREAKTOPIA WORLD 11.0 — Global festival & DJ discovery.
 *
 * One model for every event source. Adapters turn each source's raw data into UnifiedEvent;
 * the UI only ever sees UnifiedEvent, so adding a source needs no UI change.
 */

/** Who the information comes from. */
export type SourceType = "freaktopia" | "external" | "partner";

/** How confident we are about the listing. Unverified events are never shown publicly. */
export type VerificationStatus = "source_verified" | "partner_verified" | "unverified";

/** What the event is. "major_festival" needs explicit source data (never guessed from popularity). */
export type EventCategory = "major_festival" | "dj_show" | "club_event" | "local_party" | "freaktopia_event" | "general_music";

/** Status as reported by the source (cancelled/postponed events are never listed as upcoming). */
export type ExternalStatus = "scheduled" | "rescheduled" | "postponed" | "cancelled" | "unknown";

/** How exact the coordinates are. "city" = a city centre only: never drawn as a venue pin. */
export type LocationPrecision = "venue" | "city";

export interface UnifiedArtist {
  /** Source-scoped id, e.g. "ticketmaster:K8vZ9171ob7". Two artists with the same name keep different ids. */
  id: string;
  name: string;
  genre: string | null;
  url: string | null;
}

export interface UnifiedEvent {
  /** "<source>:<source_event_id>" */
  id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  genres: string[];
  startsAtUtc: string;
  endsAtUtc: string | null;
  /** IANA zone of the venue, used for "today" / "this weekend". Null when the source gives none. */
  venueTimezone: string | null;
  /** True when the source gives a date but no time. */
  timeTbd: boolean;
  countryCode: string | null;
  city: string | null;
  venueName: string | null;
  latitude: number | null;
  longitude: number | null;
  locationPrecision: LocationPrecision | null;
  lineup: UnifiedArtist[];
  artistIds: string[];
  imageUrl: string | null;
  ticketUrl: string | null;
  officialUrl: string | null;
  priceRange: { min: number; max: number; currency: string } | null;
  sourceType: SourceType;
  sourceName: string;
  sourceEventId: string;
  sourceUrl: string | null;
  externalStatus: ExternalStatus;
  verificationStatus: VerificationStatus;
  lastVerifiedAt: string;
  lastSyncedAt: string;
  /** Fictional sample data (FREAKTOPIA demo events, test fixtures). Always labelled DEMO. */
  demo?: boolean;
  /** Admin moderation: hidden events are never served publicly. */
  hidden?: boolean;
  /** Ids of other listings that were merged into this one (cross-source duplicates). */
  mergedFrom?: string[];
}

/** One source's connection state, shown on the admin page. */
export interface SourceStatus {
  id: string;
  name: string;
  sourceType: SourceType;
  /** connected = key set and approved; not_configured = key missing; unapproved = terms/approval not in place. */
  state: "connected" | "not_configured" | "unapproved" | "paused" | "error";
  /** What to set to turn the source on (env var names, never values). */
  needs: string[];
  termsUrl: string;
  regions: string[];
  paused: boolean;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  errorCount: number;
  eventCount: number;
  /** Refresh intervals in hours, by how soon the event starts. */
  intervals: { within48h: number; within30d: number; later: number };
}

export interface ChangeRecord {
  id: string;
  eventId: string;
  at: string;
  fields: ("date" | "venue" | "lineup" | "status" | "tickets")[];
  before: Partial<UnifiedEvent>;
  after: Partial<UnifiedEvent>;
}

export const EVENT_CATEGORIES: EventCategory[] = ["major_festival", "dj_show", "club_event", "local_party", "freaktopia_event", "general_music"];
