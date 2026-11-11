import { findCity } from "@/lib/ops/geo";
import { isFiniteCoord } from "./safe";
import type { LocationPrecision } from "./types";

/**
 * Coordinates, in order of trust:
 *  1. the venue's own coordinates from the source  → "venue"
 *  2. a known city centre (lib/ops/geo CITIES)     → "city" (shown as approximate, never as a venue pin)
 *  3. nothing                                      → list only, never on the globe
 * Coordinates are never guessed (no AI, no free-text geocoding).
 */
export function resolveLocation(venueLat: unknown, venueLng: unknown, city: string | null): { latitude: number | null; longitude: number | null; precision: LocationPrecision | null; tz: string | null } {
  const c = city ? findCity(city) : null;
  if (isFiniteCoord(venueLat, venueLng)) return { latitude: Number(venueLat), longitude: Number(venueLng), precision: "venue", tz: c?.tz ?? null };
  if (c) return { latitude: c.lat, longitude: c.lng, precision: "city", tz: c.tz };
  return { latitude: null, longitude: null, precision: null, tz: null };
}
