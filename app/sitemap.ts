import type { MetadataRoute } from "next";
import { DJS, EVENTS, VENUES, AFTER_PARTIES } from "@/lib/data";
import { SITE_URL } from "@/lib/utils";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/world", "/events", "/djs", "/venues", "/live", "/after-party", "/avatar", "/quests", "/nft", "/about", "/how-it-works", "/help", "/contact", "/terms", "/privacy"];
  return [
    ...pages.map((p) => ({ url: `${SITE_URL}${p}` })),
    ...EVENTS.map((e) => ({ url: `${SITE_URL}/events/${e.id}` })),
    ...DJS.map((d) => ({ url: `${SITE_URL}/djs/${d.id}` })),
    ...VENUES.map((v) => ({ url: `${SITE_URL}/venues/${v.id}` })),
    ...AFTER_PARTIES.map((a) => ({ url: `${SITE_URL}/after-party/${a.id}` })),
  ];
}
