/**
 * LIVE QUESTS. Online quests (watching, exploring the virtual venue) never grant
 * on-site attendance. On-site quests require a verified check-in.
 */
import type { Quest, ZoneId } from "./types";

export const LIVE_QUESTS: Quest[] = [
  { id: "watch-set", title: "Watch a DJ set", desc: "Keep a stage stream open for 3 minutes.", xp: 30, kind: "online", target: 180, badge: "Set Watcher" },
  { id: "visit-main", title: "Visit Main Stage", desc: "Move your avatar to the Main Stage.", xp: 10, kind: "online", target: 1 },
  { id: "explore-lounge", title: "Explore the Alien Lounge", desc: "Move your avatar to the Alien Lounge.", xp: 10, kind: "online", target: 1 },
  { id: "react-set", title: "React to a set", desc: "Send 5 reactions during a set.", xp: 15, kind: "online", target: 5 },
  { id: "discover-ap", title: "Discover the After Party", desc: "Open the After Party Portal.", xp: 15, kind: "online", target: 1, reward: "Portal glow (avatar trail)" },
  { id: "festival-tour", title: "Complete the festival tour", desc: "Visit 6 different zones.", xp: 50, kind: "online", target: 6, badge: "Festival Tourist", reward: "Tour cap (avatar)" },
  { id: "onsite-checkin", title: "Be there for real", desc: "Check in at the venue with your ticket.", xp: 80, kind: "onsite", target: 1, badge: "Was There" },
];

export interface QuestProgress {
  /** quest id -> progress count */
  progress: Record<string, number>;
  visitedZones: ZoneId[];
  completed: string[];
}

export const emptyProgress = (): QuestProgress => ({ progress: {}, visitedZones: [], completed: [] });

export type QuestSignal =
  | { kind: "watch_seconds"; seconds: number }
  | { kind: "zone"; zone: ZoneId }
  | { kind: "reaction" }
  | { kind: "portal_opened" }
  | { kind: "checkin_verified"; demo: boolean };

/**
 * Apply a signal. Returns the new progress and newly completed quests.
 * A demo check-in completes nothing on-site (it is labelled demo and never counts as attendance).
 */
export function applySignal(p: QuestProgress, s: QuestSignal): { next: QuestProgress; completed: Quest[] } {
  const next: QuestProgress = { progress: { ...p.progress }, visitedZones: [...p.visitedZones], completed: [...p.completed] };
  const bump = (id: string, by = 1, abs?: number) => {
    if (next.completed.includes(id)) return;
    next.progress[id] = abs ?? (next.progress[id] ?? 0) + by;
  };
  if (s.kind === "watch_seconds") bump("watch-set", s.seconds);
  if (s.kind === "zone") {
    if (s.zone === "main") bump("visit-main");
    if (s.zone === "lounge") bump("explore-lounge");
    if (!next.visitedZones.includes(s.zone)) next.visitedZones.push(s.zone);
    bump("festival-tour", 0, next.visitedZones.length);
  }
  if (s.kind === "reaction") bump("react-set");
  if (s.kind === "portal_opened") bump("discover-ap");
  if (s.kind === "checkin_verified" && !s.demo) bump("onsite-checkin");
  const completed = LIVE_QUESTS.filter((q) => !next.completed.includes(q.id) && (next.progress[q.id] ?? 0) >= q.target);
  next.completed.push(...completed.map((q) => q.id));
  return { next, completed };
}
