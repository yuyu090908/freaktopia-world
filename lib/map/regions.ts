/**
 * Display regions of the neon globe. A design grouping for colour and camera focus: the Middle East has its own
 * colour although it is geographically part of Asia, so `geo` keeps the real continent apart from the colour region.
 */
import { COUNTRY_REGION } from "./country-regions";

export const REGION_KEYS = ["na", "sa", "eu", "as", "me", "af", "oc"] as const;
export type RegionKey = (typeof REGION_KEYS)[number] | "an";

export const REGION_COLOR: Record<RegionKey, string> = {
  na: "#00DFFF", // Electric Cyan
  sa: "#FF35AD", // Neon Pink
  eu: "#A347FF", // Cosmic Purple
  as: "#FFD23F", // Solar Yellow
  me: "#FF8A24", // Neon Orange
  af: "#39FF70", // Alien Green
  oc: "#358BFF", // Electric Blue
  an: "#A6F6FF", // Ice Blue
};

/** Geographic continent of each display region (the Middle East belongs to Asia). */
export const REGION_GEO: Record<RegionKey, string> = { na: "North America", sa: "South America", eu: "Europe", as: "Asia", me: "Asia", af: "Africa", oc: "Oceania", an: "Antarctica" };

/** Where the camera looks when a region is picked: [lng, lat], and a zoom for a ~390 px wide globe (wider screens add more). */
export const REGION_VIEW: Record<Exclude<RegionKey, "an">, { center: [number, number]; zoom: number }> = {
  na: { center: [-98, 40], zoom: 1.9 },
  sa: { center: [-60, -18], zoom: 1.9 },
  eu: { center: [14, 50], zoom: 2.4 },
  as: { center: [105, 28], zoom: 1.8 },
  me: { center: [45, 27], zoom: 2.5 },
  af: { center: [20, 3], zoom: 1.9 },
  oc: { center: [140, -25], zoom: 2.0 },
};

export const OCEAN = { deep: "#071329", glow: "#102D58", atmosphere: "#38C8FF" } as const;

export function regionOfCountry(country: string): RegionKey | null {
  return COUNTRY_REGION[country.toLowerCase().trim().replace(/\.$/, "")] ?? null;
}

export const isRegionKey = (s: string | null | undefined): s is Exclude<RegionKey, "an"> => !!s && (REGION_KEYS as readonly string[]).includes(s);

/** Mix a hex colour with another (0 = a, 1 = b). Used to darken region fills toward the ocean. */
export function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}
