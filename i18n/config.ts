/**
 * Locales of FREAKTOPIA WORLD. English is the fallback for every missing key.
 * To add a locale (e.g. zh-TW): add it here, add messages/<code>.json with the same keys as en.json,
 * and the key-parity test (tests/unit/i18n.test.ts) will tell you what is missing.
 */
export const LOCALES = ["en", "ja", "ko", "zh-CN", "ru", "th", "es", "pt", "fr", "de", "vi", "id"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_HEADER = "x-fk-locale";
export const PREFIX_HEADER = "x-fk-prefixed";
export const PATH_HEADER = "x-fk-path";

export const LOCALE_META: Record<Locale, { native: string; english: string; intl: string; hreflang: string; dir: "ltr" | "rtl" }> = {
  en: { native: "English", english: "English", intl: "en-US", hreflang: "en", dir: "ltr" },
  ja: { native: "日本語", english: "Japanese", intl: "ja-JP", hreflang: "ja", dir: "ltr" },
  ko: { native: "한국어", english: "Korean", intl: "ko-KR", hreflang: "ko", dir: "ltr" },
  "zh-CN": { native: "简体中文", english: "Chinese (Simplified)", intl: "zh-CN", hreflang: "zh-CN", dir: "ltr" },
  ru: { native: "Русский", english: "Russian", intl: "ru-RU", hreflang: "ru", dir: "ltr" },
  th: { native: "ไทย", english: "Thai", intl: "th-TH", hreflang: "th", dir: "ltr" },
  es: { native: "Español", english: "Spanish", intl: "es-ES", hreflang: "es", dir: "ltr" },
  pt: { native: "Português (Brasil)", english: "Portuguese (Brazil)", intl: "pt-BR", hreflang: "pt-BR", dir: "ltr" },
  fr: { native: "Français", english: "French", intl: "fr-FR", hreflang: "fr", dir: "ltr" },
  de: { native: "Deutsch", english: "German", intl: "de-DE", hreflang: "de", dir: "ltr" },
  vi: { native: "Tiếng Việt", english: "Vietnamese", intl: "vi-VN", hreflang: "vi", dir: "ltr" },
  id: { native: "Bahasa Indonesia", english: "Indonesian", intl: "id-ID", hreflang: "id", dir: "ltr" },
};

/** URL segment for a locale: lowercase (/zh-cn/world). */
export const urlCode = (l: Locale) => l.toLowerCase();

/** Parses a URL segment or any casing ("zh-cn", "ZH-CN", "pt") into a supported locale. */
export function toLocale(v: string | null | undefined): Locale | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  return LOCALES.find((l) => l.toLowerCase() === s) ?? null;
}

/**
 * Picks the best supported locale from an Accept-Language header.
 * "zh-TW" and "zh-HK" are not mapped to Simplified Chinese (different script): they fall back to en until zh-TW exists.
 * "pt-PT" maps to pt (Brazilian Portuguese is the only Portuguese we have).
 */
export function fromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const tags = header
    .split(",")
    .map((p) => {
      const [tag, ...params] = p.trim().split(";");
      const q = params.map((x) => x.trim()).find((x) => x.startsWith("q="));
      return { tag: tag.toLowerCase(), q: q ? Number(q.slice(2)) || 0 : 1 };
    })
    .filter((t) => t.tag && t.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of tags) {
    if (tag === "*") continue;
    if (tag.startsWith("zh")) {
      if (tag === "zh" || tag.includes("cn") || tag.includes("hans") || tag.includes("sg")) return "zh-CN";
      continue;
    }
    const exact = toLocale(tag);
    if (exact) return exact;
    const base = toLocale(tag.split("-")[0]);
    if (base) return base;
    if (tag.startsWith("in")) return "id"; // legacy code for Indonesian
  }
  return null;
}

/** Splits "/ja/world" into { locale: "ja", rest: "/world" }. */
export function splitLocalePath(pathname: string): { locale: Locale | null; rest: string } {
  const m = pathname.match(/^\/([^/]+)(\/.*)?$/);
  const locale = m ? toLocale(m[1]) : null;
  if (!locale) return { locale: null, rest: pathname };
  return { locale, rest: m?.[2] || "/" };
}

export function localizedPath(locale: Locale, path: string) {
  const { rest } = splitLocalePath(path);
  return `/${urlCode(locale)}${rest === "/" ? "" : rest}`;
}
