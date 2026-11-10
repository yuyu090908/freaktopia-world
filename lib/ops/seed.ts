/**
 * DEMO providers for the in-memory store only (no DATABASE_URL). They are fictional, marked `demo: true`
 * and shown with a DEMO label; they cannot sign in, so they never answer offers. Nothing here is written
 * to PostgreSQL. Credentials marked "verified" are part of the fiction and labelled DEMO in the UI.
 */
import { DJS } from "@/lib/data";
import { findCity } from "./geo";
import type { OpsStore } from "./store";
import type { Listing, ListingItem, ListingType, VerificationStatus, WorkProfile } from "./types";

const did = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SEEDED_AT = "2026-01-01T00:00:00.000Z";

interface SeedProvider {
  n: number;
  name: string;
  roles: WorkProfile["roles"];
  city: string;
  bio: string;
  maxEventSize: number;
  pastWork: string[];
  credentials?: { key: string; status: VerificationStatus }[];
  business?: VerificationStatus;
  listings: { type: ListingType; title: string; items: ListingItem[]; priceUsd: number; deposit?: number; delivery?: boolean; setup?: boolean; operatorIncluded?: boolean; maxAudience: number; insurance?: string; damageTerms?: string }[];
}

const it = (key: string, quantity: number, model = ""): ListingItem => ({ key, quantity, model });

const PROVIDERS: SeedProvider[] = [
  { n: 1, name: "BASSQUAKE SOUND CO.", roles: ["company"], city: "Bangkok", bio: "Line-array PA rental with crew, clubs to festivals.", maxEventSize: 8000, pastWork: ["Tuk Tuk Trance 2025", "Riverside Bass Weekend"], business: "verified",
    listings: [
      { type: "company", title: "Festival line array + crew", items: [it("main_pa", 2, "Line array 12+12"), it("subwoofers", 16), it("monitor_speakers", 8), it("digital_mixer", 2), it("mics_di", 2), it("audio_cabling", 2), it("sound_engineer", 2), it("system_engineer", 1)], priceUsd: 9500, deposit: 2000, delivery: true, setup: true, operatorIncluded: true, maxAudience: 8000, insurance: "Equipment insured by provider", damageTerms: "Repair cost, max deposit" },
      { type: "package", title: "FESTIVAL SOUND PACKAGE", items: [it("main_pa", 1, "Line array 8+8"), it("subwoofers", 8), it("monitor_speakers", 4), it("digital_mixer", 1), it("mics_di", 1), it("audio_cabling", 1), it("sound_engineer", 1), it("system_engineer", 1)], priceUsd: 5200, deposit: 1000, delivery: true, setup: true, operatorIncluded: true, maxAudience: 3000 },
    ] },
  { n: 2, name: "PRISM BEAM LIGHTING", roles: ["company"], city: "Bangkok", bio: "Moving heads, LED walls and operators.", maxEventSize: 5000, pastWork: ["Neon Slime Summit"], business: "verified",
    listings: [{ type: "company", title: "Lighting + LED wall with operator", items: [it("stage_lighting", 2), it("moving_lights", 24), it("led_screen", 2), it("lighting_controller", 2), it("lighting_operator", 2)], priceUsd: 6400, deposit: 1500, delivery: true, setup: true, operatorIncluded: true, maxAudience: 5000 }] },
  { n: 3, name: "SKYFRAME STAGING", roles: ["company"], city: "Bangkok", bio: "Stages and truss with certified riggers.", maxEventSize: 10000, pastWork: ["Riverside Bass Weekend"], business: "verified", credentials: [{ key: "rigging_cert", status: "verified" }],
    listings: [{ type: "company", title: "Stage + truss (certified rigging)", items: [it("stage", 2), it("truss", 4), it("barricades", 60), it("load_crew", 8)], priceUsd: 7200, deposit: 2000, delivery: true, setup: true, operatorIncluded: true, maxAudience: 10000 }] },
  { n: 4, name: "QUICKSTAGE RENTALS", roles: ["company"], city: "Pattaya", bio: "Budget stages. Rigging certificate not yet verified.", maxEventSize: 2000, pastWork: [], credentials: [{ key: "rigging_cert", status: "pending" }],
    listings: [{ type: "company", title: "Budget stage + truss", items: [it("stage", 1), it("truss", 2)], priceUsd: 1800, delivery: true, setup: true, operatorIncluded: false, maxAudience: 2000 }] },
  { n: 5, name: "VOLTCAMEL POWER", roles: ["company"], city: "Bangkok", bio: "Generators and distribution with licensed electricians.", maxEventSize: 10000, pastWork: ["Solar Sprout"], business: "verified", credentials: [{ key: "electrician_license", status: "verified" }],
    listings: [{ type: "company", title: "Generators + licensed electrician", items: [it("power_generator", 4, "100 kVA silent")], priceUsd: 2600, deposit: 800, delivery: true, setup: true, operatorIncluded: true, maxAudience: 10000 }] },
  { n: 6, name: "GUARDIAN GECKO SECURITY", roles: ["company"], city: "Bangkok", bio: "Licensed event security teams.", maxEventSize: 15000, pastWork: ["Tuk Tuk Trance 2025"], business: "verified", credentials: [{ key: "security_license", status: "verified" }],
    listings: [{ type: "company", title: "Licensed security team (up to 40)", items: [it("security_staff", 40)], priceUsd: 4800, operatorIncluded: true, maxAudience: 15000 }] },
  { n: 7, name: "NIGHTWATCH CREW", roles: ["company"], city: "Bangkok", bio: "Door and crowd staff. Licence not verified.", maxEventSize: 3000, pastWork: [], credentials: [],
    listings: [{ type: "company", title: "Door staff (unlicensed)", items: [it("security_staff", 20)], priceUsd: 1600, operatorIncluded: true, maxAudience: 3000 }] },
  { n: 8, name: "PULSE MEDICS", roles: ["company"], city: "Bangkok", bio: "Event first-aid teams.", maxEventSize: 20000, pastWork: ["Riverside Bass Weekend"], credentials: [{ key: "first_aid", status: "verified" }],
    listings: [{ type: "company", title: "First-aid team", items: [it("medic", 8)], priceUsd: 1900, operatorIncluded: true, maxAudience: 20000 }] },
  { n: 9, name: "SHIBUYA DECK RENTAL", roles: ["company"], city: "Tokyo", bio: "DJ equipment rental with delivery in Tokyo.", maxEventSize: 1500, pastWork: ["BASSMUTANT TOKYO 2025"], business: "verified",
    listings: [{ type: "company", title: "Club DJ setup rental", items: [it("cdj", 6, "Pioneer DJ CDJ-3000"), it("dj_mixer", 3, "Pioneer DJ DJM-A9"), it("dj_monitors", 4), it("backup_dj_gear", 1)], priceUsd: 780, deposit: 500, delivery: true, setup: true, operatorIncluded: false, maxAudience: 1500 }] },
  { n: 10, name: "KAITO (gear owner)", roles: ["equipment_owner"], city: "Tokyo", bio: "Individual owner renting out my own DJ gear and small PA.", maxEventSize: 200, pastWork: ["Rooftop birthday party"],
    listings: [{ type: "equipment", title: "CDJ-3000 ×2, DJM-A9, speakers, lights", items: [it("cdj", 2, "Pioneer DJ CDJ-3000"), it("dj_mixer", 1, "Pioneer DJ DJM-A9"), it("main_pa", 1, "4 powered speakers"), it("stage_lighting", 1, "6 LED par lights")], priceUsd: 260, deposit: 600, delivery: false, setup: false, operatorIncluded: false, maxAudience: 150, damageTerms: "Renter pays repair at cost" }] },
  { n: 11, name: "BOOTH BUDDIES", roles: ["company"], city: "Tokyo", bio: "DJ booth packages: decks, mixer, monitors and a tech.", maxEventSize: 600, pastWork: [],
    listings: [{ type: "package", title: "DJ BOOTH PACKAGE", items: [it("dj_booth", 1), it("cdj", 3, "Pioneer DJ CDJ-3000"), it("dj_mixer", 1, "Pioneer DJ DJM-A9"), it("dj_monitors", 2), it("sound_engineer", 1)], priceUsd: 950, deposit: 400, delivery: true, setup: true, operatorIncluded: true, maxAudience: 600 }] },
  { n: 12, name: "FLASHFROG PHOTO", roles: ["staff"], city: "Bangkok", bio: "Event photographer.", maxEventSize: 5000, pastWork: ["Tuk Tuk Trance 2025"],
    listings: [{ type: "person", title: "Event photographer (night shoot)", items: [it("photographer", 1)], priceUsd: 350, operatorIncluded: true, maxAudience: 5000 }] },
  { n: 13, name: "VJ PIXELMOTH", roles: ["staff"], city: "Bangkok", bio: "Live visuals and stream direction.", maxEventSize: 3000, pastWork: ["Neon Slime Summit"],
    listings: [{ type: "person", title: "VJ + stream operator", items: [it("vj_video", 1), it("streaming_crew", 1)], priceUsd: 520, operatorIncluded: true, maxAudience: 3000 }] },
  { n: 14, name: "HANDSHAKE CREW AGENCY", roles: ["company"], city: "Bangkok", bio: "Reception, cleaning and load-in crews.", maxEventSize: 10000, pastWork: [],
    listings: [{ type: "company", title: "Event crew by the shift", items: [it("reception_staff", 20), it("cleaning_staff", 20), it("load_crew", 20), it("stage_manager", 2)], priceUsd: 2100, operatorIncluded: true, maxAudience: 10000 }] },
  { n: 15, name: "MARA OKONKWO (event director)", roles: ["staff", "organizer"], city: "Bangkok", bio: "Production and event direction for festivals.", maxEventSize: 12000, pastWork: ["Solar Sprout", "Riverside Bass Weekend"],
    listings: [{ type: "person", title: "Event director", items: [it("event_director", 1), it("stage_manager", 1)], priceUsd: 1200, operatorIncluded: true, maxAudience: 12000 }] },
];

export const DEMO_DJ_LISTING_ID = (djId: string) => did(1000 + DJS.findIndex((d) => d.id === djId));

let seeded: Promise<void> | null = null;

export function ensureDemoSeed(store: OpsStore) {
  if (store.kind !== "memory") return Promise.resolve();
  // Re-seed after a memory reset (tests): check a marker record instead of trusting the module flag.
  seeded ??= Promise.resolve();
  seeded = seeded.then(async () => {
    if (await store.get("profiles", did(1))) return;
    for (const p of PROVIDERS) {
      const c = findCity(p.city)!;
      const uid = did(p.n);
      const profile: WorkProfile = {
        userId: uid, roles: p.roles, displayName: p.name, regions: [p.city], services: [...new Set(p.listings.flatMap((l) => l.items.map((i) => i.key)))],
        bio: p.bio, maxEventSize: p.maxEventSize, pastWork: p.pastWork, identity: "verified", business: p.business ?? "unverified",
        credentials: p.credentials ?? [], organizationId: null, demo: true, updatedAt: SEEDED_AT,
      };
      await store.put("profiles", profile);
      for (const [i, l] of p.listings.entries()) {
        const listing: Listing = {
          id: did(p.n * 10 + i + 100), ownerId: uid, organizationId: null, type: l.type, title: l.title, items: l.items,
          city: c.name, country: c.country, lat: c.lat, lng: c.lng, priceUsd: l.priceUsd, deposit: l.deposit ?? 0,
          insurance: l.insurance ?? "", damageTerms: l.damageTerms ?? "", delivery: l.delivery ?? false, setup: l.setup ?? false,
          operatorIncluded: l.operatorIncluded ?? false, maxAudience: l.maxAudience, photoIds: [], availability: [], active: true, demo: true, createdAt: SEEDED_AT,
        };
        await store.put("listings", listing);
      }
    }
    // The fictional DJs from /djs get a performer listing so "Offer a gig" has something to point at.
    for (const [i, d] of DJS.entries()) {
      const c = findCity(d.city)!;
      const uid = did(2000 + i);
      await store.put("profiles", {
        userId: uid, roles: ["dj"], displayName: d.name, regions: [d.city], services: ["dj_performer"], bio: d.bio, maxEventSize: 5000,
        pastWork: d.gigs, identity: "verified", business: "unverified", credentials: [], organizationId: null, demo: true, updatedAt: SEEDED_AT,
      } satisfies WorkProfile);
      await store.put("listings", {
        id: did(1000 + i), ownerId: uid, organizationId: null, type: "person", title: d.name, items: [it("dj_performer", 1, d.genres.join(" / "))],
        city: c.name, country: c.country, lat: c.lat, lng: c.lng, priceUsd: d.bookingFrom, deposit: 0, insurance: "", damageTerms: "",
        delivery: false, setup: false, operatorIncluded: true, maxAudience: 5000, photoIds: [], availability: [], active: true, demo: true, createdAt: SEEDED_AT,
      } satisfies Listing);
    }
  });
  return seeded;
}
