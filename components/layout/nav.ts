import { Home, Globe2, CalendarDays, Radio, UserRound } from "lucide-react";

/** Labels are message keys under "nav" (messages/<locale>.json). */
export const MAIN_NAV = [
  { href: "/", key: "home", icon: Home },
  { href: "/world", key: "world", icon: Globe2 },
  { href: "/events", key: "events", icon: CalendarDays },
  { href: "/live", key: "live", icon: Radio },
  { href: "/profile", key: "profile", icon: UserRound },
] as const;

export const ALL_PAGES = [
  { group: "explore", items: [
    { href: "/world", key: "worldMap" },
    { href: "/rankings", key: "worldRanking" },
    { href: "/dao", key: "festivalDao" },
    { href: "/events", key: "events" },
    { href: "/djs", key: "djArena" },
    { href: "/venues", key: "venueMarket" },
    { href: "/live", key: "liveFestival" },
    { href: "/after-party", key: "afterParty" },
  ]},
  { group: "play", items: [
    { href: "/avatar", key: "alienAvatar" },
    { href: "/quests", key: "quests" },
    { href: "/nft", key: "nft" },
    { href: "/tickets", key: "tickets" },
    { href: "/alerts", key: "alerts" },
  ]},
  { group: "create", items: [
    { href: "/events/create", key: "createEvent" },
    { href: "/djs/apply", key: "applyDj" },
    { href: "/venues/new", key: "listVenue" },
    { href: "/after-party/new", key: "createAfterParty" },
    { href: "/venues/planner", key: "planner" },
    { href: "/dashboard", key: "dashboard" },
  ]},
  { group: "info", items: [
    { href: "/about", key: "about" },
    { href: "/how-it-works", key: "howItWorks" },
    { href: "/help", key: "help" },
    { href: "/contact", key: "contact" },
    { href: "/terms", key: "terms" },
    { href: "/privacy", key: "privacy" },
  ]},
] as const;

export const isTopLevel = (path: string) => MAIN_NAV.some((n) => n.href === path);

export function parentOf(path: string) {
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 1) return "/";
  return "/" + parts.slice(0, -1).join("/");
}
