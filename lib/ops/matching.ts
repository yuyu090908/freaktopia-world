/**
 * Smart resource matching. Candidates are compared on fit, reliability, cost, distance and logistics,
 * never just "cheapest first". Hard rules come first: a candidate that is unavailable, fully booked or
 * lacks a verified credential required for a safety-critical role is excluded (listed with the reason),
 * not merely ranked lower.
 */
import { distanceKm } from "./geo";
import type { Booking, Listing, OpsEvent, Requirement, Review, WorkProfile } from "./types";

export type ExclusionReason = "inactive" | "not_available" | "fully_booked" | "credential_unverified";

export interface MatchContext {
  bookings: Booking[]; // all bookings (any event) for the candidate listings
  profiles: Map<string, WorkProfile>;
  reviews: Review[];
  /** Budget available for this requirement's category, if known. */
  budgetUsd: number | null;
}

export interface Match {
  listing: Listing;
  score: number; // 0–100
  parts: { fit: number; reliability: number; cost: number; distance: number; logistics: number };
  freeQuantity: number;
  distanceKm: number | null;
  rating: { average: number | null; count: number };
  excluded: ExclusionReason[];
}

const overlap = (a0: string, a1: string, b0: string, b1: string) => Date.parse(a0) < Date.parse(b1) && Date.parse(b0) < Date.parse(a1);

/** Quantity of `key` this listing still has free during [start, end), excluding one event's own bookings. */
export function freeQuantity(listing: Listing, key: string, start: string, end: string, bookings: Booking[], ignoreEventId?: string) {
  const total = listing.items.filter((i) => i.key === key).reduce((a, i) => a + i.quantity, 0);
  const used = bookings
    .filter((b) => b.listingId === listing.id && (b.status === "held" || b.status === "confirmed") && b.eventId !== ignoreEventId && overlap(b.startAt, b.endAt, start, end))
    .reduce((a, b) => a + (b.items.find((i) => i.key === key)?.quantity ?? 0), 0);
  return Math.max(0, total - used);
}

export function ratingOf(userId: string, reviews: Review[]) {
  const mine = reviews.filter((r) => r.rateeId === userId);
  if (!mine.length) return { average: null, count: 0 };
  return { average: mine.reduce((a, r) => a + r.scores.overall, 0) / mine.length, count: mine.length };
}

export function availableDuring(listing: Listing, start: string, end: string) {
  if (!listing.availability.length) return true; // "ask": availability is confirmed in the proposal
  return listing.availability.some((w) => Date.parse(w.from) <= Date.parse(start) && Date.parse(w.to) >= Date.parse(end));
}

export function matchListing(event: OpsEvent, req: Requirement, listing: Listing, ctx: MatchContext): Match | null {
  if (!listing.items.some((i) => i.key === req.key)) return null;
  const excluded: ExclusionReason[] = [];
  if (!listing.active) excluded.push("inactive");
  if (!availableDuring(listing, event.startAt, event.endAt)) excluded.push("not_available");
  const free = freeQuantity(listing, req.key, event.startAt, event.endAt, ctx.bookings, event.id);
  if (free <= 0) excluded.push("fully_booked");
  const owner = ctx.profiles.get(listing.ownerId);
  if (req.credential && !owner?.credentials.some((c) => c.key === req.credential && c.status === "verified")) excluded.push("credential_unverified");

  const rating = ratingOf(listing.ownerId, ctx.reviews);
  const fit = Math.min(1, free / Math.max(1, req.quantity));
  // Bayesian average around 3.5 / 5 so one 5-star review doesn't beat a long good track record.
  const ratingScore = ((rating.average ?? 0) * rating.count + 3.5 * 3) / (rating.count + 3) / 5;
  const experience = Math.min(1, listing.maxAudience / Math.max(1, event.attendance));
  const reliability = 0.6 * ratingScore + 0.4 * experience;
  const cost = ctx.budgetUsd && ctx.budgetUsd > 0 ? Math.max(0, Math.min(1, 1 - listing.priceUsd / (ctx.budgetUsd * 1.5))) : 0.5;
  const d = event.lat != null && event.lng != null ? distanceKm({ lat: event.lat, lng: event.lng }, listing) : null;
  const distance = d == null ? 0.5 : d <= 50 ? 1 : d >= 3000 ? 0 : 1 - Math.log10(d / 50) / Math.log10(3000 / 50);
  const logistics = req.kind === "equipment" ? (Number(listing.delivery) + Number(listing.setup) + Number(listing.operatorIncluded)) / 3 : 1;
  const parts = { fit, reliability, cost, distance, logistics };
  const score = Math.round(100 * (0.3 * fit + 0.25 * reliability + 0.2 * cost + 0.15 * distance + 0.1 * logistics));
  return { listing, score, parts, freeQuantity: free, distanceKm: d == null ? null : Math.round(d), rating, excluded };
}

/** Eligible candidates best first, then the excluded ones (with reasons) so the organizer sees why. */
export function rankCandidates(event: OpsEvent, req: Requirement, listings: Listing[], ctx: MatchContext) {
  const all = listings.map((l) => matchListing(event, req, l, ctx)).filter((m): m is Match => !!m);
  const eligible = all.filter((m) => !m.excluded.length).sort((a, b) => b.score - a.score || a.listing.priceUsd - b.listing.priceUsd);
  const excluded = all.filter((m) => m.excluded.length);
  return { eligible, excluded };
}
