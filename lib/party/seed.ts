/**
 * One DEMO world for the in-memory store only (no DATABASE_URL), so the PERSONAL PARTY UNIVERSE can be explored
 * before anyone has hosted a real party. Everything here is fictional, marked demo and labelled DEMO in the UI.
 * It has no photos or videos: no footage is invented. Nothing here is ever written to PostgreSQL.
 */
import type { OpsStore } from "@/lib/ops/store";
import type { EventMember, OpsEvent } from "@/lib/ops/types";
import type { Attendance, EventReview, WorldSettings } from "./types";

const did = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const DEMO_PREFIX = "00000000-0000-4000-8000-";
export const isDemoUser = (uid: string) => uid.startsWith(DEMO_PREFIX);
export const DEMO_ORGANIZER_ID = did(900);
export const DEMO_WORLD_HANDLE = "demo";

const DAY = 86_400_000;

interface DemoParty {
  n: number;
  name: string;
  city: string;
  country: string;
  genres: string[];
  daysAgo: number; // negative = upcoming
  planned: number;
  crowd: number; // demo attendees checked in
  templateId: OpsEvent["templateId"];
}

const PARTIES: DemoParty[] = [
  { n: 1, name: "SLIME SYSTEM VOL.1", city: "Bangkok", country: "TH", genres: ["Tech House"], daysAgo: 400, planned: 120, crowd: 46, templateId: "club_night" },
  { n: 2, name: "SUNSET GOO (AFRO)", city: "Bangkok", country: "TH", genres: ["Afro House"], daysAgo: 300, planned: 200, crowd: 64, templateId: "beach_party" },
  { n: 3, name: "CRYSTAL DRIFT", city: "Chiang Mai", country: "TH", genres: ["Melodic Techno"], daysAgo: 210, planned: 150, crowd: 58, templateId: "rooftop_party" },
  { n: 4, name: "SLIME SYSTEM VOL.2", city: "Bangkok", country: "TH", genres: ["Tech House"], daysAgo: 120, planned: 300, crowd: 92, templateId: "warehouse_rave" },
  { n: 5, name: "GOO GALAXY OPEN AIR", city: "Bangkok", country: "TH", genres: ["Techno", "Melodic Techno"], daysAgo: 40, planned: 2000, crowd: 140, templateId: "outdoor_festival" },
  { n: 6, name: "SLIME SYSTEM VOL.3", city: "Bangkok", country: "TH", genres: ["Tech House"], daysAgo: -21, planned: 300, crowd: 0, templateId: "club_night" },
];

/** Deterministic pseudo-random so the demo world looks the same after every restart. */
function rand(seed: number) {
  let x = seed * 2654435761 % 4294967296;
  return () => (x = (x * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

let seeding: Promise<void> | null = null;

export async function ensurePartyDemo(store: OpsStore) {
  if (store.kind !== "memory") return;
  if (await store.get<WorldSettings>("world_settings", DEMO_ORGANIZER_ID)) return;
  seeding ??= seed(store).finally(() => {
    seeding = null;
  });
  await seeding;
}

async function seed(store: OpsStore) {
  if (await store.get<WorldSettings>("world_settings", DEMO_ORGANIZER_ID)) return;
  const now = Date.now();
  const r = rand(42);
  const pool = Array.from({ length: 260 }, (_, i) => did(10_000 + i));
  const ids: string[] = [];
  for (const p of PARTIES) {
    const id = did(950 + p.n);
    ids.push(id);
    const start = new Date(Math.floor((now - p.daysAgo * DAY) / DAY) * DAY + 13 * 3_600_000).toISOString();
    const end = new Date(Date.parse(start) + 7 * 3_600_000).toISOString();
    const level = p.planned > 1000 ? 5 : p.planned > 100 ? 3 : 2;
    const e: OpsEvent & { demo: boolean } = {
      id, ownerId: DEMO_ORGANIZER_ID, name: p.name, country: p.country, city: p.city, lat: null, lng: null, venueName: "DEMO VENUE", setting: "indoor",
      startAt: start, endAt: end, timezone: "Asia/Bangkok", genres: p.genres, attendance: p.planned, autoLevel: level as OpsEvent["autoLevel"], levelOverride: null,
      budgetUsd: 0, ticketing: false, djs: true, streaming: false, templateId: p.templateId, ownedEquipment: [], venueFacilities: [], services: [],
      status: p.daysAgo > 0 ? "completed" : "preparing", publicEventId: null, createdAt: start, updatedAt: start, version: 0, demo: true,
    };
    await store.put("events", e);
    await store.put<EventMember>("members", { eventId: id, userId: DEMO_ORGANIZER_ID, role: "owner", area: "general", displayName: "DEMO", addedAt: start });
    // A core of regulars comes back; the rest are mostly first-timers.
    const chosen = new Set<string>();
    for (const u of pool.slice(0, 30)) if (chosen.size < p.crowd && r() < 0.75) chosen.add(u);
    while (chosen.size < p.crowd) chosen.add(pool[30 + Math.floor(r() * (pool.length - 30))]);
    let k = 0;
    for (const u of chosen) {
      const at = new Date(Date.parse(start) + (1 + (k++ % 40)) * 300_000).toISOString();
      const a: Attendance = { eventId: id, userId: u, status: "going", passCode: `DEMO${String(p.n)}${String(k).padStart(5, "0")}`.slice(0, 10), checkedInAt: at, method: "qr", by: DEMO_ORGANIZER_ID, createdAt: start, updatedAt: at, version: 1, history: [{ at, by: DEMO_ORGANIZER_ID, action: "checkin" }], demo: true };
      await store.put("attendance", a);
      if (r() < 0.22) {
        const rating = (r() < 0.65 ? 5 : r() < 0.8 ? 4 : 3) as EventReview["rating"];
        await store.put<EventReview>("event_reviews", { eventId: id, userId: u, rating, text: "", at: new Date(Date.parse(end) + (1 + Math.floor(r() * 72)) * 3_600_000).toISOString(), demo: true });
      }
    }
  }
  await store.put<WorldSettings>("world_settings", { ownerId: DEMO_ORGANIZER_ID, publishedEventIds: ids, tagline: "" /* the translated DEMO notice explains the demo world */, updatedAt: new Date(now).toISOString() });
}
