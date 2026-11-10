import type { MetadataRoute } from "next";
import { DJS, EVENTS, VENUES, AFTER_PARTIES } from "@/lib/data";
import { SITE_URL } from "@/lib/utils";
import { DEFAULT_LOCALE, LOCALES, LOCALE_META, urlCode } from "@/i18n/config";

/** One entry per page and language (/en/world, /ja/world…), each listing every language version (hreflang). */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/world", "/events", "/djs", "/venues", "/live", "/rankings", "/dao", "/after-party", "/avatar", "/quests", "/nft", "/about", "/how-it-works", "/help", "/contact", "/terms", "/privacy", "/auth/signup"];
  const paths = [
    ...pages,
    ...EVENTS.map((e) => `/events/${e.id}`),
    ...DJS.map((d) => `/djs/${d.id}`),
    ...VENUES.map((v) => `/venues/${v.id}`),
    ...AFTER_PARTIES.map((a) => `/after-party/${a.id}`),
  ];
  const url = (l: (typeof LOCALES)[number], p: string) => `${SITE_URL}/${urlCode(l)}${p}`;
  return paths.flatMap((p) =>
    LOCALES.map((l) => ({
      url: url(l, p),
      alternates: { languages: { ...Object.fromEntries(LOCALES.map((x) => [LOCALE_META[x].hreflang, url(x, p)])), "x-default": url(DEFAULT_LOCALE, p) } },
    })),
  );
}
