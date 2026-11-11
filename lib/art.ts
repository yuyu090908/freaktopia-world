/**
 * Raster artwork supplied by the FREAKTOPIA team (assets/art).
 * Imported statically so next/image can size, convert and blur-load them.
 */
import type { StaticImageData } from "next/image";
import logo from "@/assets/art/logo.webp";
import heroPoster from "@/assets/art/hero-poster.webp";
import heroWide from "@/assets/art/hero-wide.webp";
import heroVideoWide from "@/assets/art/hero-video-wide.webp";
import heroVideoTall from "@/assets/art/hero-video-tall.webp";
import posterCity from "@/assets/art/poster-city.webp";
import worldMap from "@/assets/art/world-map.webp";
import panelUniverse from "@/assets/art/panel-universe.webp";
import panelMap from "@/assets/art/panel-map.webp";
import panelStage from "@/assets/art/panel-stage.webp";
import panelMarket from "@/assets/art/panel-market.webp";
import panelAfterparty from "@/assets/art/panel-afterparty.webp";
import mapCities from "@/assets/art/map-cities.webp";
import mapIsland from "@/assets/art/map-island.webp";
import mapNeon from "@/assets/art/map-neon.webp";
import mapBangkok from "@/assets/art/map-bangkok.webp";
import mapValley from "@/assets/art/map-valley.webp";
import berlin from "@/assets/art/cities/berlin.webp";
import berlinScene from "@/assets/art/cities/berlin-scene.webp";
import ibiza from "@/assets/art/cities/ibiza.webp";
import ibizaScene from "@/assets/art/cities/ibiza-scene.webp";
import bangkok from "@/assets/art/cities/bangkok.webp";
import bangkokScene from "@/assets/art/cities/bangkok-scene.webp";
import tokyo from "@/assets/art/cities/tokyo.webp";
import tokyoScene from "@/assets/art/cities/tokyo-scene.webp";
import amsterdam from "@/assets/art/cities/amsterdam.webp";
import amsterdamScene from "@/assets/art/cities/amsterdam-scene.webp";
import miami from "@/assets/art/cities/miami.webp";
import miamiScene from "@/assets/art/cities/miami-scene.webp";
import rio from "@/assets/art/cities/rio.webp";
import rioScene from "@/assets/art/cities/rio-scene.webp";
import dubai from "@/assets/art/cities/dubai.webp";
import dubaiScene from "@/assets/art/cities/dubai-scene.webp";
import capeTown from "@/assets/art/cities/cape-town.webp";
import capeTownScene from "@/assets/art/cities/cape-town-scene.webp";
import sydney from "@/assets/art/cities/sydney.webp";
import sydneyScene from "@/assets/art/cities/sydney-scene.webp";
import ticketBasic from "@/assets/art/tickets/holo-basic.webp";
import ticketSilver from "@/assets/art/tickets/holo-silver.webp";
import ticketGold from "@/assets/art/tickets/holo-gold.webp";
import ticketVip from "@/assets/art/tickets/holo-vip.webp";
import ticketLegend from "@/assets/art/tickets/holo-legend.webp";
import type { Genre } from "@/lib/types";

export const ART = {
  logo,
  heroPoster,
  heroWide,
  heroVideoWide,
  heroVideoTall,
  posterCity,
  worldMap,
  panelUniverse,
  panelMap,
  panelStage,
  panelMarket,
  panelAfterparty,
  mapCities,
  mapIsland,
  mapNeon,
  mapBangkok,
  mapValley,
} as const;

export type ArtKey = keyof typeof ART;

export interface ArtPick {
  src: StaticImageData;
  /** CSS object-position, so the interesting part stays in frame. */
  pos: string;
}

/* ------------------------------------------------------------------ city posters (official FREAKTOPIA city art) */

export interface CityArt {
  id: string;
  /** Names this poster stands for (lower case, accents removed). */
  names: string[];
  city: string;
  country: string;
  /** Full 4:5 poster (city cards). The city name is painted into the art. */
  poster: StaticImageData;
  /** Scene crop without the title and the bottom tiles (covers, previews). */
  scene: StaticImageData;
  /** Visual theme, shown as a small caption. */
  theme: string;
  accent: string;
  /** object-position for the scene crop in wide boxes. */
  focal: string;
  usagePriority: number;
}

export const CITY_ART: CityArt[] = [
  { id: "berlin", names: ["berlin"], city: "Berlin", country: "Germany", poster: berlin, scene: berlinScene, theme: "Industrial Techno", accent: "#B78BFF", focal: "50% 45%", usagePriority: 1 },
  { id: "ibiza", names: ["ibiza", "eivissa"], city: "Ibiza", country: "Spain", poster: ibiza, scene: ibizaScene, theme: "Sunset Beach", accent: "#FF79CD", focal: "50% 50%", usagePriority: 2 },
  { id: "bangkok", names: ["bangkok"], city: "Bangkok", country: "Thailand", poster: bangkok, scene: bangkokScene, theme: "Thai Neon Festival", accent: "#FFB45C", focal: "50% 45%", usagePriority: 3 },
  { id: "tokyo", names: ["tokyo"], city: "Tokyo", country: "Japan", poster: tokyo, scene: tokyoScene, theme: "Sakura & Cyber City", accent: "#FF79CD", focal: "50% 45%", usagePriority: 4 },
  { id: "miami", names: ["miami"], city: "Miami", country: "USA", poster: miami, scene: miamiScene, theme: "Neon Beach Nights", accent: "#66DFFF", focal: "50% 50%", usagePriority: 5 },
  { id: "rio", names: ["rio de janeiro", "rio"], city: "Rio de Janeiro", country: "Brazil", poster: rio, scene: rioScene, theme: "Tropical Carnival", accent: "#C1FF53", focal: "50% 50%", usagePriority: 6 },
  { id: "amsterdam", names: ["amsterdam"], city: "Amsterdam", country: "Netherlands", poster: amsterdam, scene: amsterdamScene, theme: "Canal & City Party", accent: "#FFB45C", focal: "50% 50%", usagePriority: 7 },
  { id: "dubai", names: ["dubai"], city: "Dubai", country: "United Arab Emirates", poster: dubai, scene: dubaiScene, theme: "Futuristic Luxury", accent: "#FFB45C", focal: "50% 50%", usagePriority: 8 },
  { id: "cape-town", names: ["cape town"], city: "Cape Town", country: "South Africa", poster: capeTown, scene: capeTownScene, theme: "Coastal Festival", accent: "#C1FF53", focal: "50% 50%", usagePriority: 9 },
  { id: "sydney", names: ["sydney"], city: "Sydney", country: "Australia", poster: sydney, scene: sydneyScene, theme: "Harbour Festival", accent: "#66DFFF", focal: "50% 50%", usagePriority: 10 },
];

const norm = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** The official poster for a city, or null (never a look-alike from another city). */
export const cityArt = (city: string | null | undefined): CityArt | null => (city ? CITY_ART.find((c) => c.names.includes(norm(city))) ?? null : null);

/* ------------------------------------------------------------------ ticket designs (templates, not real tickets) */

/**
 * Ticket grade art: the official holographic passes (PASS ONE–FIVE → BASIC–LEGEND, in order). The dummy date and QR code
 * printed on the originals are blurred out and the outer background is cropped: real passes and entry codes are drawn by
 * the app, never taken from the art. The design names on the art (AURORA DROP…) are design names, not event names.
 */
export const TICKET_ART = {
  basic: { src: ticketBasic, label: "BASIC PASS", tier: 1 },
  silver: { src: ticketSilver, label: "SILVER PASS", tier: 2 },
  gold: { src: ticketGold, label: "GOLD PASS", tier: 3 },
  vip: { src: ticketVip, label: "VIP PASS", tier: 4 },
  legend: { src: ticketLegend, label: "LEGEND PASS", tier: 5 },
} as const;
export type TicketTier = keyof typeof TICKET_ART;

/* ------------------------------------------------------------------ event cover rules */

const EVENT_POOL: ArtPick[] = [
  { src: panelStage, pos: "50% 40%" },
  { src: mapBangkok, pos: "50% 45%" },
  { src: mapCities, pos: "50% 50%" },
  { src: posterCity, pos: "50% 45%" },
  { src: panelUniverse, pos: "88% 75%" },
  { src: mapValley, pos: "50% 45%" },
  { src: panelMarket, pos: "50% 45%" },
  { src: mapIsland, pos: "50% 30%" },
];

/** Genre art: the general FREAKTOPIA scenes that fit each sound. */
const GENRE_ART: Partial<Record<Genre, ArtPick>> = {
  Techno: { src: panelStage, pos: "50% 40%" },
  Hardcore: { src: panelStage, pos: "50% 30%" },
  House: { src: mapCities, pos: "50% 50%" },
  Disco: { src: posterCity, pos: "50% 45%" },
  Ambient: { src: mapValley, pos: "50% 45%" },
  Psytrance: { src: mapIsland, pos: "50% 30%" },
  Amapiano: { src: mapBangkok, pos: "50% 45%" },
  "Afro House": { src: mapBangkok, pos: "40% 55%" },
  "Drum & Bass": { src: panelUniverse, pos: "88% 75%" },
  Garage: { src: panelMarket, pos: "50% 45%" },
  Footwork: { src: panelMarket, pos: "30% 55%" },
  "Hip-Hop": { src: posterCity, pos: "30% 60%" },
};

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export interface CoverHint {
  /** An image the organizer uploaded (highest priority). */
  image?: StaticImageData | string | null;
  city?: string | null;
  genres?: readonly string[];
}

export type CoverSource = "organizer" | "city" | "genre" | "fallback";

/**
 * Cover art by a fixed rule (no randomness beyond a stable hash):
 * 1. the organizer's upload, 2. an event-specific official image (none yet), 3. the city poster,
 * 4. genre art, 5. a shared FREAKTOPIA scene.
 */
export function coverFor(id: string, hint: CoverHint = {}): ArtPick & { source: CoverSource; srcUrl?: string } {
  if (hint.image) return typeof hint.image === "string" ? { src: panelStage, pos: "50% 50%", source: "organizer", srcUrl: hint.image } : { src: hint.image, pos: "50% 50%", source: "organizer" };
  const c = cityArt(hint.city);
  if (c) return { src: c.scene, pos: c.focal, source: "city" };
  for (const g of hint.genres ?? []) {
    const a = GENRE_ART[g as Genre];
    if (a) return { ...a, source: "genre" };
  }
  return { ...EVENT_POOL[hash(id) % EVENT_POOL.length], source: "fallback" };
}

/** Stable cover art for an event (kept for callers that only know the id). */
export const eventArt = (id: string): ArtPick => EVENT_POOL[hash(id) % EVENT_POOL.length];

/** Avoid the same picture twice in a row in a list: a repeat falls back to the next genre/fallback scene. */
export function distinctCovers<T extends { id: string; city?: string | null; genres?: readonly string[] }>(items: T[]): Map<string, ArtPick & { source: CoverSource }> {
  const out = new Map<string, ArtPick & { source: CoverSource }>();
  let prev: StaticImageData | null = null;
  for (const it of items) {
    let a = coverFor(it.id, it);
    if (a.src === prev) a = coverFor(it.id, { genres: it.genres });
    if (a.src === prev) a = { ...EVENT_POOL[(hash(it.id) + 1) % EVENT_POOL.length], source: "fallback" };
    out.set(it.id, a);
    prev = a.src;
  }
  return out;
}

export const afterPartyArt = (id: string): ArtPick =>
  hash(id) % 2 ? { src: panelAfterparty, pos: "50% 40%" } : { src: panelAfterparty, pos: "30% 60%" };

/**
 * Home background video (official FREAKTOPIA clips, joined and trimmed: the title card at the end of the second clip is cut
 * so it never competes with the HTML title). No audio. The poster is the first frame, so nothing jumps when playback starts.
 */
export const HERO_VIDEO = {
  wide: { src: "/video/hero-wide.mp4", poster: heroVideoWide, width: 1280, height: 720 },
  tall: { src: "/video/hero-tall.mp4", poster: heroVideoTall, width: 576, height: 720 },
} as const;
