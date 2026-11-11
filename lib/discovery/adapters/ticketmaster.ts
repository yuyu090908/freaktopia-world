/**
 * Ticketmaster Discovery API v2 — https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
 *
 * Switched on only with BOTH server env vars:
 *   TICKETMASTER_API_KEY            the consumer key from developer.ticketmaster.com
 *   TICKETMASTER_TERMS_ACCEPTED=1   set after the project owner has checked the API terms
 *                                   (commercial use, caching, images, attribution, regions)
 * Optional: TICKETMASTER_COUNTRIES=US,GB,DE (ISO codes; default: all markets the key allows).
 *
 * Only Music → Dance/Electronic events are requested. Purchases always go to Ticketmaster's own page.
 */
import { z } from "zod";
import { classify, normalizeGenres } from "../classify";
import { resolveLocation } from "../geo";
import { plainText, safeUrl } from "../safe";
import type { ExternalStatus, UnifiedEvent } from "../types";
import { fetchJson, type SourceAdapter } from "./types";
import { zonedToUtc } from "@/lib/live/time";

const BASE = "https://app.ticketmaster.com/discovery/v2";
/** Ticketmaster's id for the Dance/Electronic genre (Music segment). */
const DANCE_ELECTRONIC = "KnvZfZ7vAvF";
const PAGE_SIZE = 100;
/** The API pages up to 1,000 results per query; we stop well before that to respect rate limits. */
const MAX_PAGES = 5;

const TICKET_HOSTS = ["ticketmaster.com", "ticketmaster.co.uk", "ticketmaster.de", "ticketmaster.es", "ticketmaster.fr", "ticketmaster.nl", "ticketmaster.com.au", "ticketmaster.com.mx", "ticketmaster.ca", "ticketmaster.ie", "ticketmaster.be", "ticketmaster.se", "ticketmaster.no", "ticketmaster.dk", "ticketmaster.fi", "ticketmaster.at", "ticketmaster.ch", "ticketmaster.pl", "ticketmaster.it", "ticketmaster.nz", "ticketmaster.ae", "ticketmaster.co.za", "livenation.com", "ticketweb.com", "universe.com", "frontgatetickets.com"];
const IMAGE_HOSTS = ["ticketm.net", "ticketmaster.com", "livenation.com"];

const zClass = z.object({ name: z.string().optional() }).passthrough().optional();
const zEvent = z
  .object({
    id: z.string().min(1).max(64),
    name: z.string().min(1).max(300),
    url: z.string().optional(),
    info: z.string().optional(),
    pleaseNote: z.string().optional(),
    images: z.array(z.object({ url: z.string(), width: z.number().optional(), ratio: z.string().optional() }).passthrough()).optional(),
    dates: z
      .object({
        start: z.object({ localDate: z.string().optional(), localTime: z.string().optional(), dateTime: z.string().optional(), dateTBD: z.boolean().optional(), timeTBA: z.boolean().optional(), noSpecificTime: z.boolean().optional() }).passthrough(),
        end: z.object({ dateTime: z.string().optional() }).passthrough().optional(),
        timezone: z.string().optional(),
        status: z.object({ code: z.string().optional() }).passthrough().optional(),
      })
      .passthrough(),
    classifications: z.array(z.object({ segment: zClass, genre: zClass, subGenre: zClass, type: zClass, subType: zClass }).passthrough()).optional(),
    priceRanges: z.array(z.object({ min: z.number().optional(), max: z.number().optional(), currency: z.string().optional() }).passthrough()).optional(),
    _embedded: z
      .object({
        venues: z.array(z.object({ id: z.string().optional(), name: z.string().optional(), city: z.object({ name: z.string().optional() }).passthrough().optional(), country: z.object({ countryCode: z.string().optional() }).passthrough().optional(), location: z.object({ latitude: z.string().optional(), longitude: z.string().optional() }).passthrough().optional(), timezone: z.string().optional() }).passthrough()).optional(),
        attractions: z.array(z.object({ id: z.string(), name: z.string(), url: z.string().optional(), classifications: z.array(z.object({ genre: zClass, subGenre: zClass }).passthrough()).optional() }).passthrough()).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const STATUS: Record<string, ExternalStatus> = { onsale: "scheduled", offsale: "scheduled", canceled: "cancelled", cancelled: "cancelled", postponed: "postponed", rescheduled: "rescheduled" };

const validTz = (tz: string | undefined | null) => {
  if (!tz) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
};

export const ticketmaster: SourceAdapter = {
  id: "ticketmaster",
  name: "Ticketmaster",
  sourceType: "external",
  termsUrl: "https://developer.ticketmaster.com/support/terms-of-use/",
  needs: ["TICKETMASTER_API_KEY", "TICKETMASTER_TERMS_ACCEPTED=1"],
  regions: () => (process.env.TICKETMASTER_COUNTRIES ?? "").split(",").map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z]{2}$/.test(s)),
  state: () => (!process.env.TICKETMASTER_API_KEY ? "not_configured" : process.env.TICKETMASTER_TERMS_ACCEPTED === "1" ? "connected" : "unapproved"),

  async fetchEvents(w, fetcher) {
    const key = process.env.TICKETMASTER_API_KEY;
    if (!key) return [];
    const countries = this.regions();
    const out: unknown[] = [];
    for (const country of countries.length ? countries : [null]) {
      for (let page = 0; page < MAX_PAGES; page++) {
        const p = new URLSearchParams({ apikey: key, genreId: DANCE_ELECTRONIC, startDateTime: w.from.replace(/\.\d{3}Z$/, "Z"), endDateTime: w.to.replace(/\.\d{3}Z$/, "Z"), size: String(PAGE_SIZE), page: String(page), sort: "date,asc" });
        if (country) p.set("countryCode", country);
        const j = (await fetchJson(fetcher, `${BASE}/events.json?${p}`)) as { _embedded?: { events?: unknown[] }; page?: { totalPages?: number } };
        out.push(...(j._embedded?.events ?? []));
        if (page + 1 >= (j.page?.totalPages ?? 0)) break;
        await new Promise((r) => setTimeout(r, 250)); // stay under 5 requests per second
      }
    }
    return out;
  },

  normalize(raw, syncedAt) {
    const r = zEvent.safeParse(raw);
    if (!r.success) return null;
    const e = r.data;
    const venue = e._embedded?.venues?.[0];
    const city = plainText(venue?.city?.name, 120);
    const loc = resolveLocation(venue?.location?.latitude, venue?.location?.longitude, city);
    const tz = validTz(venue?.timezone ?? e.dates.timezone) ?? loc.tz;
    const start = e.dates.start;
    // A start instant is required. Date-only listings use venue-local midnight (UTC when the zone is unknown) and are marked "time TBD".
    let startsAtUtc: string | null = null;
    let timeTbd = false;
    if (start.dateTime && !Number.isNaN(Date.parse(start.dateTime))) startsAtUtc = new Date(start.dateTime).toISOString();
    else if (start.localDate && /^\d{4}-\d{2}-\d{2}$/.test(start.localDate) && !start.dateTBD) {
      const local = start.localTime && /^\d{2}:\d{2}/.test(start.localTime) ? start.localTime.slice(0, 5) : "00:00";
      startsAtUtc = tz ? new Date(zonedToUtc(start.localDate, local, tz)).toISOString() : `${start.localDate}T${local}:00.000Z`;
      timeTbd = local === "00:00" && !start.localTime;
    }
    if (!startsAtUtc) return null;
    if (start.timeTBA || start.noSpecificTime) timeTbd = true;
    const endRaw = e.dates.end?.dateTime;
    const endsAtUtc = endRaw && !Number.isNaN(Date.parse(endRaw)) ? new Date(endRaw).toISOString() : null;

    const classNames = (e.classifications ?? []).flatMap((c) => [c.segment?.name, c.genre?.name, c.subGenre?.name, c.type?.name, c.subType?.name]).filter((x): x is string => !!x && x !== "Undefined");
    const lineup = (e._embedded?.attractions ?? []).slice(0, 30).map((a) => ({
      id: `ticketmaster:${a.id}`,
      name: plainText(a.name, 120) ?? a.id,
      genre: a.classifications?.[0]?.subGenre?.name ?? a.classifications?.[0]?.genre?.name ?? null,
      url: safeUrl(a.url, TICKET_HOSTS),
    }));
    const img = [...(e.images ?? [])].filter((i) => i.ratio === "16_9" || !i.ratio).sort((a, b) => (b.width ?? 0) - (a.width ?? 0)).find((i) => (i.width ?? 0) <= 1200) ?? e.images?.[0];
    const price = e.priceRanges?.find((p) => typeof p.min === "number" && p.currency);
    const status = STATUS[(e.dates.status?.code ?? "").toLowerCase()] ?? "unknown";
    const ticketUrl = safeUrl(e.url, TICKET_HOSTS);
    return {
      id: `ticketmaster:${e.id}`,
      title: plainText(e.name, 200) ?? e.id,
      description: plainText([e.info, e.pleaseNote].filter(Boolean).join(" "), 1000),
      category: classify({ sourceSaysFestival: classNames.some((n) => /^festivals?$/i.test(n)), sourceGenres: classNames, artistCount: lineup.length }),
      genres: normalizeGenres(classNames),
      startsAtUtc,
      endsAtUtc,
      venueTimezone: tz,
      timeTbd,
      countryCode: venue?.country?.countryCode && /^[A-Z]{2}$/.test(venue.country.countryCode) ? venue.country.countryCode : null,
      city,
      venueName: plainText(venue?.name, 160),
      latitude: loc.latitude,
      longitude: loc.longitude,
      locationPrecision: loc.precision,
      lineup,
      artistIds: lineup.map((a) => a.id),
      imageUrl: safeUrl(img?.url, IMAGE_HOSTS),
      ticketUrl,
      officialUrl: ticketUrl,
      priceRange: price ? { min: price.min!, max: price.max ?? price.min!, currency: price.currency! } : null,
      sourceType: "external",
      sourceName: "Ticketmaster",
      sourceEventId: e.id,
      sourceUrl: ticketUrl,
      externalStatus: status,
      verificationStatus: "source_verified",
      lastVerifiedAt: syncedAt,
      lastSyncedAt: syncedAt,
    };
  },
};
