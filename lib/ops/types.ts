/**
 * FREAKTOPIA WORLD event operations: planning, resource matching, recruiting, operations hub,
 * budget, safety and readiness. Every record belongs to one event (eventId) or one account (userId),
 * so access is always checked per event.
 *
 * Text shown to people is never stored here as English: requirements, categories, task templates
 * and checks carry keys that the UI translates (messages/*.json, "ops" namespace).
 * Free text typed by people (names, notes, messages) is user content.
 */

export type ISODate = string;

// ------------------------------------------------------------------ events and size

export type ScaleLevel = 1 | 2 | 3 | 4 | 5 | 6;
export const SCALE_LEVELS: { level: ScaleLevel; max: number; key: string }[] = [
  { level: 1, max: 30, key: "private_party" },
  { level: 2, max: 100, key: "small_party" },
  { level: 3, max: 300, key: "club_event" },
  { level: 4, max: 1000, key: "large_event" },
  { level: 5, max: 5000, key: "festival" },
  { level: 6, max: Infinity, key: "mega_festival" },
];

export type TemplateId = "private_party" | "club_night" | "rooftop_party" | "beach_party" | "warehouse_rave" | "outdoor_festival" | "mega_festival";
export type Setting = "indoor" | "outdoor" | "mixed";
export type EventOpsStatus = "planning" | "recruiting" | "preparing" | "ready" | "live" | "completed" | "cancelled";

export interface OpsEvent {
  id: string;
  ownerId: string;
  name: string;
  country: string; // ISO 3166-1 alpha-2
  city: string;
  /** City centre (from the city list) for distance matching. Never a person's location. */
  lat: number | null;
  lng: number | null;
  venueName: string;
  setting: Setting;
  startAt: ISODate;
  endAt: ISODate;
  timezone: string; // IANA
  genres: string[];
  attendance: number;
  /** Auto-detected from attendance; the organizer may override it. */
  autoLevel: ScaleLevel;
  levelOverride: ScaleLevel | null;
  budgetUsd: number;
  ticketing: boolean;
  djs: boolean;
  streaming: boolean;
  templateId: TemplateId;
  /** Requirement keys the organizer already owns / the venue already has installed. */
  ownedEquipment: string[];
  venueFacilities: string[];
  /** Extra services the organizer asked for (requirement keys). */
  services: string[];
  status: EventOpsStatus;
  /** Linked public listing in /events (demo data id), if any. */
  publicEventId: string | null;
  createdAt: ISODate;
  updatedAt: ISODate;
  version: number;
}

export const effectiveLevel = (e: Pick<OpsEvent, "autoLevel" | "levelOverride">): ScaleLevel => e.levelOverride ?? e.autoLevel;

// ------------------------------------------------------------------ requirements (planner output)

export type ReqCategory = "sound" | "lighting_video" | "dj" | "venue" | "staff" | "safety";
export type ReqKind = "equipment" | "crew" | "service" | "permit";
export type ReqSource = "planner" | "template" | "organizer";
export type ReqStatus = "needed" | "covered" | "recruiting" | "proposed" | "booked" | "not_needed";

export interface Requirement {
  id: string;
  eventId: string;
  key: string; // e.g. "main_pa", "security_staff", "fire_evacuation_plan"
  category: ReqCategory;
  kind: ReqKind;
  quantity: number;
  unit: "unit" | "person" | "set" | "item";
  /** Safety-relevant: final spec must be confirmed by a qualified professional / authority. */
  safetyCritical: boolean;
  /** Credential a provider must hold (verified) to be eligible, e.g. "security_license". */
  credential: string | null;
  source: ReqSource;
  status: ReqStatus;
  /** Covered by the organizer's own gear or the venue's installed facilities. */
  coveredBy: "owner" | "venue" | null;
  note: string;
  /** Final quantity/spec confirmed by a qualified person (name + date) for safety-critical items. */
  expertConfirmation: { by: string; at: ISODate } | null;
}

// ------------------------------------------------------------------ providers, listings, packages

export type ProviderRole = "attendee" | "dj" | "organizer" | "staff" | "equipment_owner" | "company";
export type VerificationStatus = "unverified" | "pending" | "verified";

export interface WorkProfile {
  userId: string;
  roles: ProviderRole[];
  displayName: string;
  regions: string[]; // cities or countries
  services: string[]; // requirement keys this person/company can provide
  bio: string;
  /** Biggest event (attendance) they have worked on, self-declared, with past work list. */
  maxEventSize: number;
  pastWork: string[];
  identity: VerificationStatus;
  business: VerificationStatus;
  /** Credentials such as security_license, electrician_license, rigging_cert, first_aid. */
  credentials: { key: string; status: VerificationStatus }[];
  organizationId: string | null;
  /** Demo seed: fictional provider shown with a DEMO label. */
  demo: boolean;
  updatedAt: ISODate;
}

export interface Organization {
  id: string;
  ownerId: string;
  name: string;
  kind: string; // e.g. "sound_rental", "security_company"
  verification: VerificationStatus;
  demo: boolean;
}

export type ListingType = "person" | "company" | "equipment" | "package";

export interface ListingItem {
  key: string; // requirement key
  quantity: number;
  /** Free text model, e.g. "Pioneer DJ CDJ-3000". */
  model: string;
}

export interface Listing {
  id: string;
  ownerId: string;
  organizationId: string | null;
  type: ListingType;
  title: string;
  /** What this listing provides (requirement keys and quantities). Packages bundle gear + crew. */
  items: ListingItem[];
  city: string;
  country: string;
  lat: number;
  lng: number;
  /** Price per event day (USD). */
  priceUsd: number;
  deposit: number;
  insurance: string;
  damageTerms: string;
  delivery: boolean;
  setup: boolean;
  operatorIncluded: boolean;
  /** Largest event this listing is suitable for (self-declared). */
  maxAudience: number;
  photoIds: string[];
  /** Available windows; empty means "ask". Bookings are subtracted from these. */
  availability: { from: ISODate; to: ISODate }[];
  active: boolean;
  demo: boolean;
  createdAt: ISODate;
}

// ------------------------------------------------------------------ recruiting

export type OpeningKind = "open" | "direct" | "quote";
export type OpeningStatus = "open" | "filled" | "closed";

export interface Opening {
  id: string;
  eventId: string;
  kind: OpeningKind;
  requirementIds: string[];
  /** Direct offer / quote request to one listing. */
  targetListingId: string | null;
  slots: number;
  budgetUsd: number | null;
  message: string;
  status: OpeningStatus;
  createdBy: string;
  createdAt: ISODate;
}

export type ApplicationStatus = "submitted" | "shortlisted" | "accepted" | "rejected" | "withdrawn" | "declined";

export interface Application {
  id: string;
  eventId: string;
  openingId: string;
  applicantId: string;
  listingId: string | null;
  /** Which requirements this proposal covers (a package can cover several). */
  requirementIds: string[];
  priceUsd: number;
  items: ListingItem[];
  portfolio: string;
  availableFrom: ISODate | null;
  availableTo: ISODate | null;
  message: string;
  quoteDocumentId: string | null;
  status: ApplicationStatus;
  createdAt: ISODate;
}

export type BookingStatus = "held" | "confirmed" | "cancelled" | "completed";

export interface Booking {
  id: string;
  eventId: string;
  listingId: string;
  applicationId: string | null;
  providerId: string;
  requirementIds: string[];
  /** Capacity held per requirement key (a package can hold several kinds of gear and crew). */
  items: { key: string; quantity: number }[];
  quantity: number;
  startAt: ISODate;
  endAt: ISODate;
  status: BookingStatus;
  createdAt: ISODate;
}

export type AgreementStatus = "proposed" | "agreed" | "changed" | "cancelled" | "completed";

export interface AgreementTerms {
  scope: string;
  amountUsd: number;
  dueAt: ISODate | null;
  cancellation: string;
  liability: string;
}

export interface Agreement {
  id: string;
  eventId: string;
  bookingId: string;
  organizerId: string;
  providerId: string;
  terms: AgreementTerms;
  status: AgreementStatus;
  organizerAcceptedAt: ISODate | null;
  providerAcceptedAt: ISODate | null;
  /** Every change: who, when, previous terms. Append-only. */
  history: { at: ISODate; by: string; action: "proposed" | "accepted" | "changed" | "cancelled" | "completed"; terms: AgreementTerms }[];
  version: number;
}

// ------------------------------------------------------------------ team and operations

export type MemberRole = "owner" | "manager" | "lead" | "staff" | "vendor";
export type Area = "general" | "sound" | "lighting" | "operations" | "dj" | "safety";

export interface EventMember {
  eventId: string;
  userId: string;
  role: MemberRole;
  area: Area;
  displayName: string;
  addedAt: ISODate;
}

export type TaskStatus = "todo" | "doing" | "done";
export interface Task {
  id: string;
  eventId: string;
  title: string;
  /** Template key when created from a template (translated), else null and title is user text. */
  templateKey: string | null;
  area: Area;
  assigneeId: string | null;
  dueAt: ISODate | null;
  status: TaskStatus;
  requirementId: string | null;
  createdBy: string;
  updatedAt: ISODate;
}

export interface Message {
  id: string;
  eventId: string;
  thread: Area;
  authorId: string;
  authorName: string;
  body: string;
  at: ISODate;
}

export type DocKind = "floor_plan" | "stage_design" | "equipment_list" | "timetable" | "contract" | "emergency_manual" | "quote" | "photo" | "other";
/** Who may open a document: everyone in the team, leads and up, or managers and up. */
export type DocAudience = "team" | "leads" | "managers";

export interface DocumentMeta {
  id: string;
  eventId: string;
  name: string;
  kind: DocKind;
  mime: string;
  size: number;
  audience: DocAudience;
  uploadedBy: string;
  at: ISODate;
}

export type ScheduleKind = "load_in" | "setup" | "soundcheck" | "rehearsal" | "doors" | "show_start" | "set" | "show_end" | "load_out";
export interface ScheduleItem {
  id: string;
  eventId: string;
  kind: ScheduleKind;
  startAt: ISODate;
  endAt: ISODate;
  /** For DJ sets: the booked listing performing. */
  listingId: string | null;
  note: string;
}

// ------------------------------------------------------------------ budget

export type BudgetCategory = "venue" | "sound" | "lighting_video" | "artists" | "staff_security" | "decor_facilities" | "marketing" | "safety_permits" | "contingency";
export interface BudgetLine {
  eventId: string;
  category: BudgetCategory;
  /** Planner's first allocation (rule-based estimate, not a quote). */
  estimateUsd: number;
}
export interface Payment {
  id: string;
  eventId: string;
  agreementId: string;
  amountUsd: number;
  /** Recorded by the organizer. No money moves through FREAKTOPIA (no payment provider is connected). */
  note: string;
  recordedBy: string;
  at: ISODate;
}

// ------------------------------------------------------------------ safety

export type SafetyKey = "contracts_complete" | "equipment_secured" | "staffing_confirmed" | "venue_conditions" | "permits_insurance" | "safety_evacuation_plan" | "emergency_contacts";
export type SafetyStatus = "open" | "approved";
export interface SafetyCheck {
  eventId: string;
  key: SafetyKey;
  /** Auto checks are computed from data; manual ones need an explicit approval by owner/manager. */
  auto: boolean;
  status: SafetyStatus;
  approvedBy: string | null;
  approvedAt: ISODate | null;
  /** For permits and plans: who outside the platform confirmed it (authority, engineer, insurer). */
  reference: string;
  dueAt: ISODate | null;
}

export type IncidentType = "equipment_failure" | "staff_shortage" | "load_in_delay" | "power" | "weather" | "venue_facility" | "cancellation" | "other";
export type Severity = "low" | "medium" | "high" | "critical";
export interface Incident {
  id: string;
  eventId: string;
  type: IncidentType;
  severity: Severity;
  description: string;
  reportedBy: string;
  assigneeId: string | null;
  status: "open" | "in_progress" | "resolved";
  /** Requirement / booking affected, to look for replacements. */
  requirementId: string | null;
  bookingId: string | null;
  at: ISODate;
  updatedAt: ISODate;
}

export interface Handover {
  id: string;
  eventId: string;
  bookingId: string;
  direction: "out" | "return";
  quantity: number;
  condition: "ok" | "minor_damage" | "damaged" | "missing";
  photoIds: string[];
  handledBy: string;
  note: string;
  at: ISODate;
}

// ------------------------------------------------------------------ reviews and notifications

export interface Review {
  id: string;
  eventId: string;
  agreementId: string;
  raterId: string;
  rateeId: string;
  scores: { punctuality: number; communication: number; delivery: number; quality: number; overall: number };
  comment: string;
  at: ISODate;
}

export interface Notification {
  id: string;
  userId: string;
  eventId: string | null;
  /** Translation key + values. */
  key: string;
  values: Record<string, string | number>;
  /** Same dedupeKey for the same user is stored once. */
  dedupeKey: string;
  read: boolean;
  at: ISODate;
}

export class OpsError extends Error {
  constructor(public status: number, public code: string, public extra: Record<string, unknown> = {}) {
    super(code);
  }
}
