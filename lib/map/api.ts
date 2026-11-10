/**
 * GET /api/map — everything the world map needs in one response.
 *
 * Composes existing sources (events, WORLD RANKING, FESTIVAL DAO, LIVE) so the map never invents
 * numbers. MAP_DATA_MODE=production → 503 DATA_SOURCE_NOT_CONFIGURED (demo data is never served
 * as production data).
 */
import { ARCHIVE_EVENTS, EVENTS, getAfterParty, getDJ, getVenue } from "@/lib/data";
import { allDaoSummaries, approvedStageDesign } from "@/lib/dao/api";
import { discoveryEvents } from "@/lib/live/api";
import { getRankings } from "@/lib/ranking/service";
import type { FreakEvent } from "@/lib/types";
import { DEFAULT_GROWTH_CONFIG, computeFestivalLevel, type GrowthInputs } from "./growth";
import { landmarkTypeFor, type MapStatus } from "./landmarks";
import type { MapEventDto, RankBadge, WorldMapResponse } from "./types";

export const mapMode = () => (process.env.MAP_DATA_MODE === "production" ? "production" : "demo");

/** Demo rule: a funding event that hasn't reached the first support threshold is still PLANNING. */
export function mapStatusOf(e: FreakEvent): MapStatus {
  if (e.status === "ended") return "completed";
  if (e.status === "live") return "live";
  if (e.status === "confirmed") return "confirmed";
  return e.supporters < DEFAULT_GROWTH_CONFIG.levels[1].supporters ? "planning" : "funding";
}

export const daoTier = (members: number): 0 | 1 | 2 | 3 => (members >= 40 ? 3 : members >= 15 ? 2 : members >= 1 ? 1 : 0);

export async function buildWorldMap(now = Date.now()): Promise<WorldMapResponse> {
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
      organizer: { name: e.organizer, handle: null, demo: true },
    };
  });

  return {
    mode: "demo",
    asOf: new Date(now).toISOString(),
    growthConfig: DEFAULT_GROWTH_CONFIG,
    events,
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
