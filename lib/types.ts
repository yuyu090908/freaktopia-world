/**
 * Shared domain types for FREAKTOPIA WORLD.
 * Phase 1 uses demo data (lib/data.ts) with these exact shapes so a backend
 * can later return the same structures from an API.
 */

export type Genre =
  | "Techno"
  | "House"
  | "Drum & Bass"
  | "Psytrance"
  | "Hip-Hop"
  | "Amapiano"
  | "Disco"
  | "Ambient"
  | "Hardcore"
  | "Afro House"
  | "Garage"
  | "Footwork";

export type EventLevel = 1 | 2 | 3 | 4 | 5;

export type Species = "slime" | "fuzz" | "vinyl" | "jelly";
export type Outfit = "none" | "hoodie" | "jacket" | "vest" | "kimono";
export type Accessory = "none" | "headphones" | "shades" | "crown" | "antenna" | "cap";

export interface AlienLook {
  species: Species;
  body: string; // hex color
  accent: string; // hex color
  outfit: Outfit;
  outfitColor: string;
  accessory: Accessory;
}

export type EventStatus = "funding" | "confirmed" | "live" | "ended";

export interface TimetableSlot {
  time: string; // "22:00"
  end: string;
  djId: string;
  stage: string;
}

export interface EventUpdate {
  date: string;
  title: string;
  body: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

export type TicketKind = "main" | "afterparty" | "allnight" | "vip";

export interface TicketType {
  kind: TicketKind;
  name: string;
  price: number; // USD
  remaining: number;
  perks: string[];
}

export interface FreakEvent {
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  startsAt: string; // ISO
  endsAt: string; // ISO
  genres: Genre[];
  supporters: number;
  raised: number; // USD
  goal: number; // USD
  status: EventStatus;
  djRecruiting: boolean;
  afterPartyId?: string;
  venueId: string;
  lineup: string[]; // DJ ids
  auditionDjIds: string[];
  palette: [string, string, string];
  tagline: string;
  description: string;
  timetable: TimetableSlot[];
  updates: EventUpdate[];
  faq: FaqItem[];
  tickets: TicketType[];
  capacity: number;
  organizer: string;
  isDemo: true;
}

export interface MixSample {
  title: string;
  length: string; // "58:21"
  plays: number;
}

export interface DJ {
  id: string;
  name: string;
  genres: Genre[];
  bpm: [number, number];
  city: string;
  country: string;
  look: AlienLook;
  mixes: MixSample[];
  gigs: string[];
  rank: number;
  followers: number;
  votes: number;
  bio: string;
  bookingFrom: number; // USD
  isDemo: true;
}

export type Amenity =
  | "Funktion-One"
  | "Void Acoustics"
  | "CDJ-3000"
  | "Technics 1200"
  | "Lasers"
  | "LED Wall"
  | "Bar"
  | "Kitchen"
  | "Outdoor Area"
  | "Green Room"
  | "Step-free Access"
  | "Coat Check";

export interface Venue {
  id: string;
  name: string;
  city: string;
  country: string;
  capacity: number;
  hourlyRate: number;
  amenities: Amenity[];
  availableDates: string[]; // ISO dates (yyyy-mm-dd)
  address: string;
  palette: [string, string, string];
  description: string;
  rating: number;
  photos?: string[]; // user-uploaded data URLs (demo)
  isDemo: boolean;
  ownerIsUser?: boolean;
}

export interface AfterParty {
  id: string;
  eventId: string;
  name: string;
  venueName: string;
  city: string;
  startsAt: string;
  endsAt: string;
  djIds: string[];
  price: number;
  seatsLeft: number;
  capacity: number;
  description: string;
  palette: [string, string, string];
  isDemo: boolean;
  createdByUser?: boolean;
}

export interface CartLine {
  kind: TicketKind;
  qty: number;
}

export interface DemoOrder {
  id: string;
  eventId: string;
  lines: { kind: TicketKind; name: string; qty: number; price: number }[];
  total: number;
  createdAt: string;
  holder: string;
  /** Always true in Phase 1: no payment was taken. */
  demo: true;
}

export interface UserProfile {
  username: string;
  bio: string;
  city: string;
  favoriteGenres: Genre[];
  xp: number;
  avatarName: string;
  look: AlienLook;
  avatarSaved: boolean;
}

export interface EventDraft {
  name: string;
  genres: Genre[];
  city: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  budget: number;
  venueMode: "select" | "recruit";
  venueId?: string;
  venueWish?: string;
  djSlots: number;
  djGenres: Genre[];
  djMinBpm: number;
  djMaxBpm: number;
  djFee: number;
  djNotes?: string;
  tickets: { kind: TicketKind; enabled: boolean; price: number; quantity: number }[];
  afterParty: boolean;
  afterPartyName?: string;
  afterPartyVenue?: string;
  afterPartyStart?: string;
  afterPartyPrice?: number;
}

export interface CreatedEvent extends EventDraft {
  id: string;
  createdAt: string;
  published: boolean;
}

export interface DJApplication {
  id: string;
  eventId: string;
  djName: string;
  genres: Genre[];
  bpm: number;
  city: string;
  mixUrl: string;
  message: string;
  createdAt: string;
  status: "pending" | "shortlisted" | "accepted" | "declined";
}

export interface ToastMsg {
  id: string;
  title: string;
  body?: string;
  tone?: "default" | "success" | "error" | "level";
}
