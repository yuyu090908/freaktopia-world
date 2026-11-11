/**
 * The app clock.
 *
 * Production uses real time, so a sample event whose date has passed is shown as completed and nothing is
 * shown as LIVE outside its real time window. NEXT_PUBLIC_DEMO_CLOCK (an ISO time, inlined at build) pins the
 * clock for deterministic tests and screenshots only; it is never set on the deployed site.
 */
import type { FreakEvent } from "./types";

const PINNED = process.env.NEXT_PUBLIC_DEMO_CLOCK ? Date.parse(process.env.NEXT_PUBLIC_DEMO_CLOCK) : NaN;
export const clockPinned = Number.isFinite(PINNED);
export const appNow = () => (clockPinned ? PINNED : Date.now());

/**
 * The status an event has at `now`, from its dates (the stored status is what the organizer set):
 * - after its end → "ended" (shown as Completed, never as upcoming or live)
 * - "live" outside its time window → "confirmed" before it starts, "ended" after
 */
export function effectiveStatus(e: Pick<FreakEvent, "status" | "startsAt" | "endsAt">, now = appNow()): FreakEvent["status"] {
  const start = Date.parse(e.startsAt);
  const end = Date.parse(e.endsAt);
  if (e.status === "ended" || now >= end) return "ended";
  if (e.status === "live" && now < start) return "confirmed";
  return e.status;
}
