/**
 * Raster artwork supplied by the FREAKTOPIA team (assets/art).
 * Imported statically so next/image can size, convert and blur-load them.
 */
import type { StaticImageData } from "next/image";
import logo from "@/assets/art/logo.webp";
import heroPoster from "@/assets/art/hero-poster.webp";
import heroWide from "@/assets/art/hero-wide.webp";
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

export const ART = {
  logo,
  heroPoster,
  heroWide,
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

const EVENT_POOL: ArtPick[] = [
  { src: panelStage, pos: "50% 40%" },
  { src: mapBangkok, pos: "50% 45%" },
  { src: heroWide, pos: "88% 60%" },
  { src: posterCity, pos: "50% 45%" },
  { src: panelUniverse, pos: "88% 75%" },
  { src: mapValley, pos: "50% 45%" },
  { src: heroPoster, pos: "50% 52%" },
  { src: mapIsland, pos: "50% 30%" },
];

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Stable cover art for an event. */
export const eventArt = (id: string): ArtPick => EVENT_POOL[hash(id) % EVENT_POOL.length];

export const afterPartyArt = (id: string): ArtPick =>
  hash(id) % 2 ? { src: panelAfterparty, pos: "50% 40%" } : { src: panelAfterparty, pos: "30% 60%" };
