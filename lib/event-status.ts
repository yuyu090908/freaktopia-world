/**
 * One place for what an event card says about status, price and support (docs/DESIGN_SYSTEM.md · Events).
 * Statuses already follow the app clock (lib/data → lib/clock), so a past event is "completed" here.
 */
import type { FreakEvent } from "./types";

export type DisplayStatus = "live" | "demo_live" | "confirmed" | "funding" | "completed" | "cancelled";

/** Sample events never have a real broadcast, so their live state is always "demo_live". */
export function displayStatus(e: Pick<FreakEvent, "status" | "isDemo">, realStream = false): DisplayStatus {
  if (e.status === "ended") return "completed";
  if (e.status === "live") return realStream && !e.isDemo ? "live" : "demo_live";
  return e.status;
}

/** Tickets are on sale only for a confirmed (or running) event with places left. */
export const ticketsOnSale = (e: Pick<FreakEvent, "status" | "tickets">) =>
  (e.status === "confirmed" || e.status === "live") && e.tickets.some((t) => t.remaining > 0);

/** Lowest price of a ticket kind that is still available, or null when nothing is on sale. */
export function fromPrice(e: Pick<FreakEvent, "status" | "tickets">): number | null {
  if (!ticketsOnSale(e)) return null;
  const open = e.tickets.filter((t) => t.remaining > 0).map((t) => t.price);
  return open.length ? Math.min(...open) : null;
}

/** Support progress is shown only while the event is collecting support. */
export const showsSupport = (e: Pick<FreakEvent, "status">) => e.status === "funding";
