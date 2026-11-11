/**
 * Bandsintown — https://help.artists.bandsintown.com/en/articles/7053475-what-is-the-bandsintown-api
 *
 * A platform listing many artists needs Bandsintown's written approval. Until then this source stays OFF,
 * even if an app id is set. Switched on only with:
 *   BANDSINTOWN_APP_ID          the app id Bandsintown issues
 *   BANDSINTOWN_APPROVED=1      set only after Bandsintown has approved multi-artist use
 *   BANDSINTOWN_ARTISTS         comma-separated artist names or ids to follow (e.g. "Peggy Gou,FISHER")
 */
import { z } from "zod";
import { classify, normalizeGenres } from "../classify";
import { resolveLocation } from "../geo";
import { plainText, safeUrl } from "../safe";
import type { UnifiedEvent } from "../types";
import { fetchJson, type SourceAdapter } from "./types";
import { zonedToUtc } from "@/lib/live/time";

const HOSTS = ["bandsintown.com", "bnds.us"];

const zEvent = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    artist_id: z.union([z.string(), z.number()]).transform(String).optional(),
    url: z.string().optional(),
    datetime: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    lineup: z.array(z.string()).optional(),
    offers: z.array(z.object({ type: z.string().optional(), url: z.string().optional(), status: z.string().optional() }).passthrough()).optional(),
    venue: z.object({ name: z.string().optional(), city: z.string().optional(), country: z.string().optional(), latitude: z.union([z.string(), z.number()]).optional(), longitude: z.union([z.string(), z.number()]).optional(), type: z.string().optional() }).passthrough(),
    artist: z.object({ id: z.union([z.string(), z.number()]).transform(String).optional(), name: z.string().optional(), url: z.string().optional() }).passthrough().optional(),
  })
  .passthrough();

export const bandsintown: SourceAdapter = {
  id: "bandsintown",
  name: "Bandsintown",
  sourceType: "external",
  termsUrl: "https://help.artists.bandsintown.com/en/articles/7053475-what-is-the-bandsintown-api",
  needs: ["BANDSINTOWN_APP_ID", "BANDSINTOWN_APPROVED=1 (after written approval)", "BANDSINTOWN_ARTISTS"],
  regions: () => [],
  state: () => (!process.env.BANDSINTOWN_APP_ID ? "not_configured" : process.env.BANDSINTOWN_APPROVED === "1" ? "connected" : "unapproved"),

  async fetchEvents(_w, fetcher) {
    const app = process.env.BANDSINTOWN_APP_ID;
    if (!app || process.env.BANDSINTOWN_APPROVED !== "1") return [];
    const artists = (process.env.BANDSINTOWN_ARTISTS ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50);
    const out: unknown[] = [];
    for (const a of artists) {
      const j = await fetchJson(fetcher, `https://rest.bandsintown.com/artists/${encodeURIComponent(a)}/events?app_id=${encodeURIComponent(app)}&date=upcoming`);
      if (Array.isArray(j)) out.push(...j);
    }
    return out;
  },

  normalize(raw, syncedAt): UnifiedEvent | null {
    const r = zEvent.safeParse(raw);
    if (!r.success) return null;
    const e = r.data;
    // Bandsintown gives venue-local time without a zone: resolve the zone from a known city, otherwise keep it as UTC and say so.
    const city = plainText(e.venue.city, 120);
    const loc = resolveLocation(e.venue.latitude, e.venue.longitude, city);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(e.datetime)) return null;
    let startsAtUtc: string;
    if (loc.tz) {
      const [d, t] = e.datetime.split("T");
      startsAtUtc = new Date(zonedToUtc(d, t.slice(0, 5), loc.tz)).toISOString();
    } else startsAtUtc = new Date(`${e.datetime.slice(0, 19)}Z`).toISOString();
    const artistName = e.artist?.name ?? e.lineup?.[0] ?? null;
    const lineup = artistName ? [{ id: `bandsintown:${e.artist?.id ?? e.artist_id ?? artistName}`, name: plainText(artistName, 120) ?? artistName, genre: null, url: safeUrl(e.artist?.url, HOSTS) }] : [];
    const ticket = e.offers?.find((o) => (o.type ?? "").toLowerCase() === "tickets");
    return {
      id: `bandsintown:${e.id}`,
      title: plainText(e.title, 200) ?? `${artistName ?? "Live"} @ ${plainText(e.venue.name, 120) ?? city ?? ""}`.trim(),
      description: plainText(e.description, 1000),
      category: classify({ sourceSaysFestival: false, sourceGenres: [], artistCount: lineup.length, venueType: e.venue.type ?? null }),
      genres: normalizeGenres([]),
      startsAtUtc,
      endsAtUtc: null,
      venueTimezone: loc.tz,
      timeTbd: false,
      countryCode: null,
      city,
      venueName: plainText(e.venue.name, 160),
      latitude: loc.latitude,
      longitude: loc.longitude,
      locationPrecision: loc.precision,
      lineup,
      artistIds: lineup.map((a) => a.id),
      imageUrl: null,
      ticketUrl: safeUrl(ticket?.url, HOSTS),
      officialUrl: safeUrl(e.url, HOSTS),
      priceRange: null,
      sourceType: "external",
      sourceName: "Bandsintown",
      sourceEventId: e.id,
      sourceUrl: safeUrl(e.url, HOSTS),
      externalStatus: "scheduled",
      verificationStatus: "source_verified",
      lastVerifiedAt: syncedAt,
      lastSyncedAt: syncedAt,
    };
  },
};
