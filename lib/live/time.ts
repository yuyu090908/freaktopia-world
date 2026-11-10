/**
 * Time zones for live sets. Timetables are stored in venue-local wall-clock time;
 * absolute instants are derived with the venue's IANA time zone (DST-safe via Intl).
 */
import type { FreakEvent } from "@/lib/types";
import type { StageSet } from "./types";

export const CITY_TZ: Record<string, string> = {
  Tokyo: "Asia/Tokyo",
  Osaka: "Asia/Tokyo",
  Berlin: "Europe/Berlin",
  London: "Europe/London",
  Ibiza: "Europe/Madrid",
  Seoul: "Asia/Seoul",
  "Mexico City": "America/Mexico_City",
  Lagos: "Africa/Lagos",
  "São Paulo": "America/Sao_Paulo",
  Melbourne: "Australia/Melbourne",
  Bangkok: "Asia/Bangkok",
  Detroit: "America/Detroit",
  Amsterdam: "Europe/Amsterdam",
  Johannesburg: "Africa/Johannesburg",
  "New York": "America/New_York",
  "Reykjavík": "Atlantic/Reykjavik",
  Tbilisi: "Asia/Tbilisi",
  "Los Angeles": "America/Los_Angeles",
};

export const tzFor = (city: string) => CITY_TZ[city] ?? "UTC";

/** Offset (ms) of a time zone at a given instant: local = utc + offset. */
export function tzOffset(at: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(at));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at / 1000) * 1000;
}

/** Venue-local calendar date (yyyy-mm-dd) of an instant. */
export function localDate(at: number, tz: string) {
  const d = new Date(at + tzOffset(at, tz));
  return d.toISOString().slice(0, 10);
}

/** Convert venue-local "yyyy-mm-dd" + "HH:MM" to an absolute instant. */
export function zonedToUtc(ymd: string, hm: string, tz: string) {
  const [y, mo, d] = ymd.split("-").map(Number);
  const [h, mi] = hm.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes handle DST transitions.
  let t = guess - tzOffset(guess, tz);
  t = guess - tzOffset(t, tz);
  return t;
}

const toMin = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
};

/** Timetable → absolute sets. Slots that wrap past midnight roll to the next local day. */
export function buildSets(e: Pick<FreakEvent, "id" | "city" | "startsAt" | "timetable">): StageSet[] {
  const tz = tzFor(e.city);
  const day0 = localDate(Date.parse(e.startsAt), tz);
  const firstMin = toMin(e.timetable[0]?.time ?? "00:00");
  const addDays = (ymd: string, n: number) => new Date(Date.parse(ymd + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
  return e.timetable.map((s, i) => {
    const startDay = toMin(s.time) < firstMin ? addDays(day0, 1) : day0;
    const startAt = zonedToUtc(startDay, s.time, tz);
    let endAt = zonedToUtc(startDay, s.end, tz);
    if (endAt <= startAt) endAt = zonedToUtc(addDays(startDay, 1), s.end, tz);
    return { id: `${e.id}-set-${i}`, stageId: s.stage === "Second Stage" ? "second" : "main", djId: s.djId, localStart: s.time, localEnd: s.end, startAt, endAt };
  });
}

export function currentAndNext<T extends StageSet>(sets: T[], stageId: string, now: number): { current: T | null; next: T | null } {
  const list = sets.filter((s) => s.stageId === stageId).sort((a, b) => a.startAt - b.startAt);
  const current = list.find((s) => s.startAt <= now && now < s.endAt) ?? null;
  const next = list.find((s) => s.startAt > now) ?? null;
  return { current, next };
}

export function fmtInTz(at: number, tz: string, opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, ...opts }).format(new Date(at));
}

export function tzLabel(at: number, tz: string) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date(at)).find((x) => x.type === "timeZoneName");
  return p?.value ?? tz;
}

export const durationMin = (s: StageSet) => Math.round((s.endAt - s.startAt) / 60_000);
