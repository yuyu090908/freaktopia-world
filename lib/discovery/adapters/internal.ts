/**
 * FREAKTOPIA's own events as UnifiedEvent, so external listings can be checked against them
 * (duplicates) and searched with the same rules. Sample events stay marked DEMO.
 */
import { EVENTS } from "@/lib/data";
import type { FreakEvent } from "@/lib/types";
import { findCity } from "@/lib/ops/geo";
import type { UnifiedEvent } from "../types";

export function fromFreakEvent(e: FreakEvent, syncedAt: string): UnifiedEvent {
  const c = findCity(e.city);
  return {
    id: `freaktopia:${e.id}`,
    title: e.name,
    description: null,
    category: "freaktopia_event",
    genres: [...e.genres],
    startsAtUtc: new Date(e.startsAt).toISOString(),
    endsAtUtc: new Date(e.endsAt).toISOString(),
    venueTimezone: c?.tz ?? null,
    timeTbd: false,
    countryCode: c?.country ?? null,
    city: e.city,
    venueName: null,
    latitude: e.lat,
    longitude: e.lng,
    locationPrecision: e.status === "funding" ? "city" : "venue",
    lineup: [],
    artistIds: [],
    imageUrl: null,
    ticketUrl: null,
    officialUrl: `/events/${e.id}`,
    priceRange: null,
    sourceType: "freaktopia",
    sourceName: "FREAKTOPIA",
    sourceEventId: e.id,
    sourceUrl: `/events/${e.id}`,
    externalStatus: "scheduled",
    verificationStatus: "source_verified",
    lastVerifiedAt: syncedAt,
    lastSyncedAt: syncedAt,
    demo: !!e.isDemo,
  };
}

export const internalEvents = (syncedAt: string) => EVENTS.map((e) => fromFreakEvent(e, syncedAt));
