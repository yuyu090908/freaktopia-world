/**
 * Date filters in the venue's own time zone: "today" in Tokyo is not "today" in New York.
 */
export type WhenFilter = "any" | "today" | "weekend" | "7d" | "30d";
export const WHEN_FILTERS: WhenFilter[] = ["any", "today", "weekend", "7d", "30d"];

/** yyyy-mm-dd and weekday (0 = Sunday) of an instant in a zone. */
export function localDay(at: number, tz: string): { ymd: string; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(new Date(at));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { ymd: `${get("year")}-${get("month")}-${get("day")}`, weekday: wd };
}

const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Does an event fall in the window, judged in the venue's zone (UTC when the zone is unknown)?
 * Weekend = Friday to Sunday of the current week; on Monday–Thursday the coming one.
 */
export function inWhen(startsAtUtc: string, endsAtUtc: string | null, tz: string | null, when: WhenFilter, now: number): boolean {
  if (when === "any") return true;
  const zone = tz ?? "UTC";
  const start = Date.parse(startsAtUtc);
  const end = endsAtUtc ? Date.parse(endsAtUtc) : start;
  if (end < now) return false;
  const today = localDay(now, zone);
  const day = localDay(start, zone).ymd;
  if (when === "today") return day <= today.ymd && localDay(end, zone).ymd >= today.ymd;
  if (when === "7d") return day <= addDays(today.ymd, 6);
  if (when === "30d") return day <= addDays(today.ymd, 29);
  // weekend
  const wd = today.weekday;
  const fri = wd === 0 ? addDays(today.ymd, -2) : wd === 6 ? addDays(today.ymd, -1) : addDays(today.ymd, 5 - wd);
  const sun = addDays(fri, 2);
  const endDay = localDay(end, zone).ymd;
  return day <= sun && endDay >= fri;
}
