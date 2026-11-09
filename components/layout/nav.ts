import { Home, Globe2, CalendarDays, Radio, UserRound } from "lucide-react";

export const MAIN_NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/world", label: "World", icon: Globe2 },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/profile", label: "Profile", icon: UserRound },
] as const;

export const ALL_PAGES = [
  { group: "Explore", items: [
    { href: "/world", label: "World Map" },
    { href: "/rankings", label: "World Ranking" },
    { href: "/dao", label: "Festival DAO" },
    { href: "/events", label: "Events" },
    { href: "/djs", label: "DJ Arena" },
    { href: "/venues", label: "Venue Market" },
    { href: "/live", label: "Live Festival" },
    { href: "/after-party", label: "After Party" },
  ]},
  { group: "Play", items: [
    { href: "/avatar", label: "Alien Avatar" },
    { href: "/quests", label: "Quests & Rankings" },
    { href: "/nft", label: "NFT Market (preview)" },
    { href: "/tickets", label: "My Tickets" },
    { href: "/alerts", label: "Alerts" },
  ]},
  { group: "Create", items: [
    { href: "/events/create", label: "Create Event" },
    { href: "/djs/apply", label: "Apply as DJ" },
    { href: "/venues/new", label: "List Your Venue" },
    { href: "/after-party/new", label: "Create After Party" },
    { href: "/venues/planner", label: "AI Event Planner (demo)" },
    { href: "/dashboard", label: "Dashboard" },
  ]},
  { group: "Info", items: [
    { href: "/about", label: "About" },
    { href: "/how-it-works", label: "How It Works" },
    { href: "/help", label: "Help" },
    { href: "/contact", label: "Contact" },
    { href: "/terms", label: "Terms" },
    { href: "/privacy", label: "Privacy" },
  ]},
];

export const isTopLevel = (path: string) => MAIN_NAV.some((n) => n.href === path);

export function parentOf(path: string) {
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 1) return "/";
  return "/" + parts.slice(0, -1).join("/");
}
