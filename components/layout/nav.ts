import {
  Home, Globe2, CalendarDays, Radio, UserRound, Compass, Trophy, Vote, Disc3, MapPin, MoonStar, Sparkles, PlusCircle, Headphones, Building2,
  PartyPopper, Wand2, Gamepad2, Gem, Orbit, Ticket, LayoutDashboard, Bell, Info, BookOpen, CircleHelp, Mail, type LucideIcon,
} from "lucide-react";

/** Labels are message keys under "nav" (messages/<locale>.json). */
export const MAIN_NAV = [
  { href: "/", key: "home", icon: Home },
  { href: "/world", key: "world", icon: Globe2 },
  { href: "/events", key: "events", icon: CalendarDays },
  { href: "/live", key: "live", icon: Radio },
  { href: "/profile", key: "profile", icon: UserRound },
] as const;

/**
 * The menu ("Cosmic control panel"): every page the site has, grouped by what people want to do.
 * Each page appears once here; the quick-access tiles are shortcuts to the most used ones.
 * Labels are message keys under "nav.pages", group names under "nav.groups".
 */
export type MenuAccent = "lime" | "pink" | "cyan" | "purple" | "orange";
export interface MenuItem {
  href: string;
  key: string;
  icon: LucideIcon;
  /** Shown as a small label: the page runs on demo data or is a preview. */
  badge?: "demo" | "preview";
  /** Needs the signed-in person's alien ID (their own party world). */
  mine?: boolean;
}
export interface MenuGroup {
  group: "explore" | "create" | "play" | "myWorld" | "info";
  accent: MenuAccent;
  icon: LucideIcon;
  items: MenuItem[];
}

export const MENU_GROUPS: MenuGroup[] = [
  { group: "explore", accent: "lime", icon: Compass, items: [
    { href: "/world", key: "worldMap", icon: Globe2 },
    { href: "/rankings", key: "worldRanking", icon: Trophy },
    { href: "/dao", key: "festivalDao", icon: Vote },
    { href: "/events", key: "events", icon: CalendarDays },
    { href: "/djs", key: "djArena", icon: Disc3 },
    { href: "/venues", key: "venueMarket", icon: MapPin },
    { href: "/live", key: "liveFestival", icon: Radio },
    { href: "/after-party", key: "afterParty", icon: MoonStar },
  ]},
  { group: "create", accent: "pink", icon: Sparkles, items: [
    { href: "/events/create", key: "createEvent", icon: PlusCircle },
    { href: "/djs/apply", key: "applyDj", icon: Headphones },
    { href: "/venues/new", key: "listVenue", icon: Building2 },
    { href: "/after-party/new", key: "createAfterParty", icon: PartyPopper },
    { href: "/venues/planner", key: "plannerName", icon: Wand2, badge: "demo" },
  ]},
  { group: "play", accent: "cyan", icon: Gamepad2, items: [
    { href: "/avatar", key: "alienAvatar", icon: UserRound },
    { href: "/quests", key: "quests", icon: Gamepad2, badge: "preview" },
    { href: "/nft", key: "nftName", icon: Gem, badge: "preview" },
  ]},
  { group: "myWorld", accent: "purple", icon: Orbit, items: [
    { href: "/profile/parties", key: "myWorld", icon: Orbit, mine: true },
    { href: "/tickets", key: "tickets", icon: Ticket },
    { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
    { href: "/alerts", key: "alerts", icon: Bell },
  ]},
  { group: "info", accent: "orange", icon: Info, items: [
    { href: "/about", key: "about", icon: Info },
    { href: "/how-it-works", key: "howItWorks", icon: BookOpen },
    { href: "/help", key: "help", icon: CircleHelp },
    { href: "/contact", key: "contact", icon: Mail },
  ]},
];

/** Small links at the bottom of the menu. */
export const MENU_LEGAL = [
  { href: "/terms", key: "terms" },
  { href: "/privacy", key: "privacy" },
] as const;

export const isTopLevel = (path: string) => MAIN_NAV.some((n) => n.href === path);

export function parentOf(path: string) {
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 1) return "/";
  return "/" + parts.slice(0, -1).join("/");
}
