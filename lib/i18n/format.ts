import { LOCALE_META, type Locale } from "@/i18n/config";

/**
 * Locale-aware formatting with Intl. Event times always use the venue's own time zone,
 * so a Tokyo party shows 23:00 everywhere, labelled with its zone.
 */
export const intlLocale = (l: Locale) => LOCALE_META[l].intl;

export function formatMoney(l: Locale, amount: number, currency = "USD", maxFraction = 0) {
  return new Intl.NumberFormat(intlLocale(l), { style: "currency", currency, maximumFractionDigits: maxFraction }).format(amount);
}

export function formatNumber(l: Locale, n: number) {
  return new Intl.NumberFormat(intlLocale(l)).format(n);
}

export function formatCompact(l: Locale, n: number) {
  return new Intl.NumberFormat(intlLocale(l), { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatEventDate(l: Locale, iso: string, timeZone = "UTC", opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  return new Intl.DateTimeFormat(intlLocale(l), { ...opts, timeZone }).format(new Date(iso));
}

export function formatEventTime(l: Locale, iso: string, timeZone = "UTC") {
  const d = new Date(iso);
  const time = new Intl.DateTimeFormat(intlLocale(l), { hour: "2-digit", minute: "2-digit", timeZone }).format(d);
  const zone = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? timeZone;
  return `${time} ${zone}`;
}

export function formatRelative(l: Locale, iso: string, now = Date.now()) {
  const diff = (new Date(iso).getTime() - now) / 1000;
  const rtf = new Intl.RelativeTimeFormat(intlLocale(l), { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}
