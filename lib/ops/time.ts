/** Wall-clock time in an IANA zone ↔ UTC, without a date library. Events are entered in the venue's local time. */
function offsetMs(utc: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(utc));
  const v = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second")) - utc;
}

/** "2026-12-31" + "22:00" in Asia/Bangkok → ISO in UTC. */
export function zonedToIso(date: string, time: string, tz: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let t = guess - offsetMs(guess, tz);
  t = guess - offsetMs(t, tz); // second pass handles DST edges
  return new Date(t).toISOString();
}

/** ISO → { date: "YYYY-MM-DD", time: "HH:mm" } in the zone (for edit forms). */
export function isoToZoned(iso: string, tz: string) {
  const local = new Date(Date.parse(iso) + offsetMs(Date.parse(iso), tz));
  return { date: local.toISOString().slice(0, 10), time: local.toISOString().slice(11, 16) };
}
