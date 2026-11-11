/**
 * GET /api/map — everything the world map needs in one response.
 *
 * Composes existing sources (events, WORLD RANKING, FESTIVAL DAO, LIVE) so the map never invents
 * numbers. MAP_DATA_MODE=production → 503 DATA_SOURCE_NOT_CONFIGURED (demo data is never served
 * as production data).
 */
import { ARCHIVE_EVENTS, EVENTS, GENRES, getAfterParty, getDJ, getVenue, syncEventClock } from "@/lib/data";
import { allDaoSummaries, approvedStageDesign } from "@/lib/dao/api";
import { discoveryEvents } from "@/lib/live/api";
import { getRankings } from "@/lib/ranking/service";
import type { FreakEvent } from "@/lib/types";
import { DEFAULT_GROWTH_CONFIG, computeFestivalLevel, type GrowthInputs } from "./growth";
import { landmarkTypeFor, type MapStatus } from "./landmarks";
import type { MapEventDto, RankBadge, WorldMapResponse } from "./types";
import { upcomingParties } from "@/lib/party/service";
import { appNow } from "@/lib/clock";
import { publicEvents } from "@/lib/discovery/service";
import type { UnifiedEvent } from "@/lib/discovery/types";
import type { Genre } from "@/lib/types";

type Community = Awaited<ReturnType<typeof upcomingParties>>[number];
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const COMMUNITY_PALETTE: [string, string, string] = ["#C1FF53", "#B78BFF", "#66DFFF"];

/** A published community party as a map entry. Nothing is invented: no level growth, ranking, DAO, live or ticket figures. */
export function communityDto(p: Community, asOf: string): MapEventDto {
  const genres = p.genres.filter((g): g is Genre => (GENRES as string[]).includes(g));
  return {
    id: `party-${p.id}`,
    name: p.name,
    city: p.city,
    country: regionNames.of(p.country) ?? p.country,
    venue: p.venueName || null,
    location: { lat: p.lat as number, lng: p.lng as number, precision: "city" },
    startsAt: p.startAt,
    endsAt: p.endAt,
    genres,
    lineup: [],
    palette: COMMUNITY_PALETTE,
    status: "confirmed",
    growth: { supporters: 0, stakers: 0, fundingUsd: 0, venueContract: false, approvals: 0 },
    goalUsd: 0,
    level: 1,
    landmark: { type: landmarkTypeFor(genres), theme: "event", approvedDesign: null },
    ranking: { rank: null, badge: null, category: "popular", period: "all", trendingRank: null, trendingGrowth: null, trendingPeriod: "7d", asOf },
    dao: null,
    live: null,
    tickets: { onSale: false, remaining: 0, fromUsd: null, demo: true },
    djRecruiting: false,
    afterParty: null,
    updatedAt: asOf,
    isDemo: p.demo,
    source: "community",
    href: `/u/${p.handle ?? ""}/world/${p.id}`,
    organizer: { name: p.organizer ?? "", handle: p.handle, demo: p.demo },
  };
}

const EXTERNAL_PALETTE: [string, string, string] = ["#66DFFF", "#F2EBDD", "#3A4A5E"];
const genreOf = (g: string): Genre | null => (GENRES as string[]).find((x) => x.toLowerCase() === g.toLowerCase()) as Genre | undefined ?? null;

/**
 * An external event as a map entry. Only what the source said: no level growth, ranking, DAO, live,
 * FREAKTOPIA tickets or DJ calls. Events without coordinates are not drawn (they stay in the EVENTS list).
 */
export function externalDto(e: UnifiedEvent): MapEventDto | null {
  if (e.latitude == null || e.longitude == null || !e.city) return null;
  const genres = e.genres.map(genreOf).filter((g): g is Genre => !!g);
  return {
    id: e.id,
    name: e.title,
    city: e.city,
    country: e.countryCode ? regionNames.of(e.countryCode) ?? e.countryCode : "",
    venue: e.venueName,
    location: { lat: e.latitude, lng: e.longitude, precision: e.locationPrecision === "venue" ? "exact" : "city" },
    startsAt: e.startsAtUtc,
    endsAt: e.endsAtUtc ?? e.startsAtUtc,
    genres,
    lineup: e.lineup.map((a) => ({ id: a.id, name: a.name })),
    palette: EXTERNAL_PALETTE,
    status: "confirmed",
    growth: { supporters: 0, stakers: 0, fundingUsd: 0, venueContract: false, approvals: 0 },
    goalUsd: 0,
    level: 1,
    landmark: { type: landmarkTypeFor(genres), theme: "event", approvedDesign: null },
    ranking: { rank: null, badge: null, category: "popular", period: "all", trendingRank: null, trendingGrowth: null, trendingPeriod: "7d", asOf: e.lastSyncedAt },
    dao: null,
    live: null,
    tickets: { onSale: false, remaining: 0, fromUsd: null, demo: true },
    djRecruiting: false,
    afterParty: null,
    updatedAt: e.lastSyncedAt,
    isDemo: !!e.demo,
    source: "external",
    external: {
      sourceType: e.sourceType,
      sourceName: e.sourceName,
      sourceEventId: e.sourceEventId,
      sourceUrl: e.sourceUrl,
      officialUrl: e.officialUrl,
      ticketUrl: e.ticketUrl,
      category: e.category,
      verificationStatus: e.verificationStatus,
      externalStatus: e.externalStatus,
      lastVerifiedAt: e.lastVerifiedAt,
      lastSyncedAt: e.lastSyncedAt,
      venueTimezone: e.venueTimezone,
      timeTbd: e.timeTbd,
      imageUrl: e.imageUrl,
      genres: e.genres,
      priceRange: e.priceRange,
    },
  };
}

/** External events for the map. A source failure never breaks the map: FREAKTOPIA's own events still load. */
async function externalForMap(now: number): Promise<MapEventDto[]> {
  try {
    const { events } = await publicEvents({ limit: 1000 }, now);
    return events.map(externalDto).filter((x): x is MapEventDto => !!x);
  } catch (err) {
    console.error("[map] external events unavailable", (err as Error).message);
    return [];
  }
}

export const mapMode = () => (process.env.MAP_DATA_MODE === "production" ? "production" : "demo");

/** Demo rule: a funding event that hasn't reached the first support threshold is still PLANNING. */
export function mapStatusOf(e: FreakEvent): MapStatus {
  if (e.status === "ended") return "completed";
  if (e.status === "live") return "live";
  if (e.status === "confirmed") return "confirmed";
  return e.supporters < DEFAULT_GROWTH_CONFIG.levels[1].supporters ? "planning" : "funding";
}

export const daoTier = (members: number): 0 | 1 | 2 | 3 => (members >= 40 ? 3 : members >= 15 ? 2 : members >= 1 ? 1 : 0);

export async function buildWorldMap(now = appNow()): Promise<WorldMapResponse> {
  syncEventClock(now);
  const [popular, trending, live] = await Promise.all([
    getRankings({ category: "popular", period: "all", page: 1, pageSize: 100 }),
    getRankings({ category: "trending", period: "7d", page: 1, pageSize: 100 }),
    discoveryEvents(now),
  ]);
  const pop = new Map(popular.items.map((i) => [i.event.id, i]));
  const tr = new Map(trending.items.map((i) => [i.event.id, i]));
  const liveById = new Map(live.map((l) => [l.id, l]));
  const daos = new Map(allDaoSummaries(now).map((d) => [d.eventId, d]));

  const events: MapEventDto[] = [...EVENTS, ...ARCHIVE_EVENTS].map((e) => {
    const dao = daos.get(e.id);
    const daoActive = dao && dao.status !== "archived";
    const status = mapStatusOf(e);
    const venueContract = e.status === "confirmed" || e.status === "live" || e.status === "ended";
    const growth: GrowthInputs = {
      supporters: e.supporters,
      stakers: daoActive ? dao.stakers : 0,
      fundingUsd: e.raised,
      venueContract,
      approvals: (daoActive ? dao.confirmed.length : 0) + (venueContract && e.timetable.length ? 1 : 0),
    };
    const p = pop.get(e.id);
    const t = tr.get(e.id);
    const rank = p?.rank ?? null;
    const badge: RankBadge | null = rank === 1 ? "champion" : rank === 2 ? "runner_up" : rank === 3 ? "featured" : null;
    const design = daoActive ? approvedStageDesign(e.id) : null;
    const l = liveById.get(e.id);
    const ap = e.afterPartyId ? getAfterParty(e.afterPartyId) : undefined;
    const onSale = (e.status === "confirmed" || e.status === "live") && e.tickets.some((x) => x.remaining > 0);
    return {
      id: e.id,
      name: e.name,
      city: e.city,
      country: e.country,
      venue: e.status === "funding" ? null : getVenue(e.venueId)?.name ?? null,
      location: { lat: e.lat, lng: e.lng, precision: e.status === "funding" ? "city" : "exact" },
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      genres: e.genres,
      lineup: e.lineup.map((id) => ({ id, name: getDJ(id)?.name ?? id })),
      palette: design?.palette ?? e.palette,
      status,
      growth,
      goalUsd: e.goal,
      level: computeFestivalLevel(growth).level,
      landmark: { type: landmarkTypeFor(e.genres), theme: design ? "dao_approved" : "event", approvedDesign: design ? { conceptId: design.conceptId, name: design.name } : null },
      ranking: {
        rank,
        badge,
        category: "popular",
        period: "all",
        trendingRank: t && t.rank <= 3 && t.metrics.new_supporters > 0 ? t.rank : null,
        trendingGrowth: t ? t.metrics.growth_rate : null,
        trendingPeriod: "7d",
        asOf: popular.asOf,
      },
      dao: daoActive
        ? {
            status: dao.status,
            members: dao.members,
            stakers: dao.stakers,
            staked: dao.staked,
            tokenSymbol: dao.tokenSymbol,
            activeProposals: dao.activeProposals,
            openVotes: dao.openVotes,
            activeVote: dao.activeVote?.title ?? null,
            participationRate: dao.participationRate,
            tier: daoTier(dao.members),
          }
        : null,
      live:
        l && (l.status === "demo_live" || l.status === "live")
          ? { status: l.status, currentDj: l.currentDj, onlineViewers: l.attendance.onlineViewers, checkedIn: l.attendance.checkedIn, publicAvatars: l.attendance.publicAvatars, ticketsSold: l.attendance.ticketsSold, demo: l.status === "demo_live" }
          : null,
      tickets: { onSale, remaining: e.tickets.reduce((a, x) => a + x.remaining, 0), fromUsd: e.tickets.length ? Math.min(...e.tickets.map((x) => x.price)) : null, demo: true },
      djRecruiting: e.djRecruiting && e.status !== "ended",
      afterParty: ap ? { id: ap.id, name: ap.name, startsAt: ap.startsAt, venue: ap.venueName } : null,
      updatedAt: popular.asOf,
      isDemo: true,
      source: "sample",
      organizer: { name: e.organizer, handle: null, demo: true },
    };
  });

  // Community parties (published by organizers) share the map with the samples, so WORLD and EVENTS count the same list.
  const community: MapEventDto[] = (await upcomingParties(500))
    .filter((p) => p.handle && p.lat != null && p.lng != null)
    .map((p) => communityDto(p, popular.asOf));

  const external = await externalForMap(now);

  return {
    mode: "demo",
    asOf: new Date(now).toISOString(),
    growthConfig: DEFAULT_GROWTH_CONFIG,
    events: [...events, ...community, ...external],
    notes: [
      "Sample events. Festival level is a visual game level, not venue capacity.",
      "Staking is escrowed separately and never counted as event budget.",
      "Online viewers and checked-in guests are separate numbers.",
      "Funding-stage events use approximate city coordinates.",
    ],
  };
}

export async function handleMap(): Promise<Response> {
  const headers = { "Content-Type": "application/json", "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" };
  if (mapMode() === "production") {
    return new Response(JSON.stringify({ error: { code: "DATA_SOURCE_NOT_CONFIGURED", message: "Map data source is not configured. Demo data is never served in production mode." } }), { status: 503, headers: { "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify(await buildWorldMap()), { status: 200, headers });
}
