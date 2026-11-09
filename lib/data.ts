/**
 * DEMO DATA — every record here is fictional sample content for Phase 1.
 * Nothing in this file represents a real event, DJ, venue or ticket.
 */
import type {
  AfterParty,
  AlienLook,
  DJ,
  FreakEvent,
  Genre,
  TicketType,
  TimetableSlot,
  Venue,
} from "./types";

export const GENRES: Genre[] = [
  "Techno",
  "House",
  "Drum & Bass",
  "Psytrance",
  "Hip-Hop",
  "Amapiano",
  "Disco",
  "Ambient",
  "Hardcore",
  "Afro House",
  "Garage",
  "Footwork",
];

const look = (
  species: AlienLook["species"],
  body: string,
  accent: string,
  accessory: AlienLook["accessory"] = "headphones",
  outfit: AlienLook["outfit"] = "none",
  outfitColor = "#171717",
): AlienLook => ({ species, body, accent, accessory, outfit, outfitColor });

export const DJS: DJ[] = [
  { id: "gloopzilla", name: "DJ GLOOPZILLA", genres: ["Techno", "Hardcore"], bpm: [132, 145], city: "Tokyo", country: "Japan", look: look("slime", "#B6F05C", "#FF625C", "headphones", "hoodie", "#A276E9"), mixes: [{ title: "Slime Pressure Vol.3", length: "61:08", plays: 48210 }, { title: "Shibuya Ooze Tape", length: "44:51", plays: 22904 }], gigs: ["BASSMUTANT TOKYO 2025", "Neon Slime Summit", "Kaiju Basement Sessions"], rank: 1, followers: 128400, votes: 9812, bio: "Melted out of a Shibuya basement in 2019 and never solidified again. Relentless techno with a sticky groove.", bookingFrom: 2400, isDemo: true },
  { id: "mika", name: "MOTHERBOARD MIKA", genres: ["Techno", "Hardcore"], bpm: [138, 155], city: "Berlin", country: "Germany", look: look("vinyl", "#55BCEB", "#FFAD5B", "shades", "jacket", "#FF625C"), mixes: [{ title: "Circuit Bent Sunday", length: "72:30", plays: 39102 }, { title: "Kreuzberg Static", length: "58:02", plays: 18077 }], gigs: ["Neon Slime Summit", "Void Jelly Rave"], rank: 2, followers: 98100, votes: 8421, bio: "Solders her own drum machines. Plays them louder than they were designed for.", bookingFrom: 2100, isDemo: true },
  { id: "kombu", name: "KOMBU KOSMOS", genres: ["Ambient", "House"], bpm: [100, 124], city: "Osaka", country: "Japan", look: look("jelly", "#A276E9", "#B6F05C", "antenna", "kimono", "#55BCEB"), mixes: [{ title: "Seaweed Satellites", length: "88:14", plays: 15220 }], gigs: ["Kawa Kaiju", "Deep Reef Disco"], rank: 7, followers: 41200, votes: 3120, bio: "Slow-floating ambient into warm deep house. Best heard at sunrise on a riverbank.", bookingFrom: 900, isDemo: true },
  { id: "subtoad", name: "SUB TOAD", genres: ["Drum & Bass", "Garage"], bpm: [170, 176], city: "London", country: "UK", look: look("slime", "#FFAD5B", "#55BCEB", "cap", "vest", "#B6F05C"), mixes: [{ title: "Lily Pad Pressure", length: "47:40", plays: 33410 }, { title: "2-Step Swamp", length: "39:12", plays: 12007 }], gigs: ["Void Jelly Rave", "Glass Noodle NYC"], rank: 3, followers: 87300, votes: 7655, bio: "Bass so low it rearranges the furniture. Croaks on the mic between rewinds.", bookingFrom: 1800, isDemo: true },
  { id: "lazernana", name: "LAZER NANA", genres: ["House", "Disco"], bpm: [118, 126], city: "Seoul", country: "South Korea", look: look("fuzz", "#FF625C", "#B6F05C", "shades", "jacket", "#55BCEB"), mixes: [{ title: "Hongdae Hairball Disco", length: "64:00", plays: 29044 }], gigs: ["Kimchi Cosmos", "Neon Slime Summit"], rank: 4, followers: 76500, votes: 6420, bio: "Fluffy, feverish disco edits. Her fur glows under blacklight.", bookingFrom: 1600, isDemo: true },
  { id: "vulture", name: "VINYL VULTURE", genres: ["Techno", "House"], bpm: [124, 134], city: "Detroit", country: "USA", look: look("vinyl", "#FFAD5B", "#A276E9", "cap", "jacket", "#171717"), mixes: [{ title: "Crate Scavenger", length: "75:33", plays: 21891 }], gigs: ["Motor City Mutation", "Glass Noodle NYC"], rank: 6, followers: 52800, votes: 4210, bio: "Only plays records found in places records should not be. Pure Detroit soul in the machine.", bookingFrom: 1500, isDemo: true },
  { id: "okra", name: "OKRA ORBIT", genres: ["Afro House", "Amapiano"], bpm: [112, 122], city: "Lagos", country: "Nigeria", look: look("fuzz", "#B6F05C", "#FFAD5B", "crown", "kimono", "#FF625C"), mixes: [{ title: "Lagos Lift-Off", length: "69:40", plays: 41120 }], gigs: ["Lagos Low-End Lighthouse", "Amapiano Asteroid"], rank: 5, followers: 70100, votes: 5980, bio: "Percussive, joyful and impossible to stand still to. Orbits the dancefloor twice per track.", bookingFrom: 1400, isDemo: true },
  { id: "bpmbaba", name: "BPM BABA", genres: ["Psytrance"], bpm: [140, 148], city: "Mexico City", country: "Mexico", look: look("jelly", "#55BCEB", "#FF625C", "headphones", "vest", "#FFAD5B"), mixes: [{ title: "Volcano Jelly", length: "92:00", plays: 18330 }], gigs: ["Solar Sprout"], rank: 9, followers: 33900, votes: 2410, bio: "Grandmaster of the 145 BPM wobble. Tentacles on every fader.", bookingFrom: 1100, isDemo: true },
  { id: "hyperfungi", name: "HYPERFUNGI", genres: ["Psytrance", "Techno"], bpm: [136, 146], city: "Amsterdam", country: "Netherlands", look: look("fuzz", "#A276E9", "#55BCEB", "antenna", "hoodie", "#B6F05C"), mixes: [{ title: "Spore Cloud", length: "81:20", plays: 24050 }], gigs: ["Canal Critters"], rank: 8, followers: 39700, votes: 2890, bio: "Grows new tracks overnight in a damp studio. Do not touch the spores.", bookingFrom: 1200, isDemo: true },
  { id: "tentacle", name: "SOFT TENTACLE", genres: ["Ambient", "Disco"], bpm: [96, 120], city: "Melbourne", country: "Australia", look: look("jelly", "#FF625C", "#55BCEB", "crown", "none"), mixes: [{ title: "Reef Lullabies", length: "55:55", plays: 12040 }], gigs: ["Deep Reef Disco"], rank: 11, followers: 22100, votes: 1640, bio: "Gentle, glittering and occasionally stingy. Sunset disco specialist.", bookingFrom: 800, isDemo: true },
  { id: "mochi", name: "MIDNIGHT MOCHI", genres: ["Footwork", "Hip-Hop"], bpm: [80, 160], city: "Bangkok", country: "Thailand", look: look("slime", "#F5F2EA", "#A276E9", "cap", "hoodie", "#FF625C"), mixes: [{ title: "Sticky Rice Juke", length: "41:09", plays: 15800 }], gigs: ["Tuk Tuk Trance"], rank: 10, followers: 26900, votes: 1980, bio: "Chopped vocals, double-time drums, soft and chewy in the middle.", bookingFrom: 700, isDemo: true },
  { id: "zolazap", name: "ZOLA ZAP", genres: ["Amapiano", "Afro House"], bpm: [110, 116], city: "Johannesburg", country: "South Africa", look: look("vinyl", "#B6F05C", "#FF625C", "shades", "vest", "#A276E9"), mixes: [{ title: "Log Drum Lightning", length: "63:12", plays: 30770 }], gigs: ["Amapiano Asteroid", "Lagos Low-End Lighthouse"], rank: 12, followers: 19800, votes: 1505, bio: "Log drums that crackle like static electricity. Zaps every crowd awake.", bookingFrom: 900, isDemo: true },
];

/** Next 45 days of ISO dates, filtered by a deterministic pattern. */
function availability(seed: number): string[] {
  const out: string[] = [];
  const base = new Date("2026-11-10T00:00:00Z");
  for (let i = 0; i < 45; i++) {
    if ((i * 7 + seed * 3) % 5 < 2) continue;
    const d = new Date(base.getTime() + i * 86400000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export const VENUES: Venue[] = [
  { id: "v-kaiju", name: "KAIJU BASEMENT", city: "Tokyo", country: "Japan", capacity: 650, hourlyRate: 420, amenities: ["Funktion-One", "CDJ-3000", "Technics 1200", "Bar", "Coat Check"], availableDates: availability(1), address: "B2F, 3-14 Udagawa, Shibuya (demo address)", palette: ["#B6F05C", "#A276E9", "#080808"], description: "A former parking garage with a low ceiling and an enormous system.", rating: 4.8, isDemo: true },
  { id: "v-kraftwerk", name: "POWER PLANT 9", city: "Berlin", country: "Germany", capacity: 3500, hourlyRate: 1900, amenities: ["Void Acoustics", "CDJ-3000", "Lasers", "LED Wall", "Bar", "Green Room", "Step-free Access"], availableDates: availability(2), address: "Industriestraße 9 (demo address)", palette: ["#55BCEB", "#FFAD5B", "#080808"], description: "Concrete cathedral with three rooms and a rooftop garden.", rating: 4.9, isDemo: true },
  { id: "v-swamp", name: "THE SWAMP ROOM", city: "London", country: "UK", capacity: 900, hourlyRate: 600, amenities: ["Funktion-One", "CDJ-3000", "Bar", "Kitchen", "Coat Check"], availableDates: availability(3), address: "Arch 42, Hackney (demo address)", palette: ["#FFAD5B", "#55BCEB", "#080808"], description: "Railway arch with a famously sweaty dancefloor.", rating: 4.6, isDemo: true },
  { id: "v-hongdae", name: "FUZZ HALL", city: "Seoul", country: "South Korea", capacity: 1200, hourlyRate: 750, amenities: ["Void Acoustics", "LED Wall", "Lasers", "Bar", "Green Room"], availableDates: availability(4), address: "Hongdae-ro 22 (demo address)", palette: ["#FF625C", "#B6F05C", "#080808"], description: "Neon-wrapped hall in the heart of Hongdae.", rating: 4.7, isDemo: true },
  { id: "v-lagos", name: "LIGHTHOUSE YARD", city: "Lagos", country: "Nigeria", capacity: 2400, hourlyRate: 680, amenities: ["Funktion-One", "Outdoor Area", "Bar", "Kitchen", "Lasers"], availableDates: availability(5), address: "Victoria Island waterfront (demo address)", palette: ["#B6F05C", "#FFAD5B", "#080808"], description: "Open-air yard beside the water with a lighthouse-shaped booth.", rating: 4.8, isDemo: true },
  { id: "v-reef", name: "REEF PAVILION", city: "Melbourne", country: "Australia", capacity: 5000, hourlyRate: 2100, amenities: ["Void Acoustics", "LED Wall", "Lasers", "Outdoor Area", "Bar", "Kitchen", "Step-free Access"], availableDates: availability(6), address: "Docklands Pier 3 (demo address)", palette: ["#55BCEB", "#FF625C", "#080808"], description: "Harbourside pavilion with a sunset-facing main stage.", rating: 4.7, isDemo: true },
  { id: "v-canal", name: "CANAL CRYPT", city: "Amsterdam", country: "Netherlands", capacity: 800, hourlyRate: 560, amenities: ["Funktion-One", "CDJ-3000", "Bar", "Coat Check"], availableDates: availability(7), address: "Houthavens 5 (demo address)", palette: ["#A276E9", "#55BCEB", "#080808"], description: "Underground brick vaults beside the canal.", rating: 4.5, isDemo: true },
  { id: "v-volcano", name: "VOLCÁN AZUL", city: "Mexico City", country: "Mexico", capacity: 1600, hourlyRate: 520, amenities: ["Lasers", "LED Wall", "Bar", "Outdoor Area"], availableDates: availability(8), address: "Colonia Roma Norte (demo address)", palette: ["#FF625C", "#FFAD5B", "#080808"], description: "Painted courtyard with a mural-wrapped stage.", rating: 4.6, isDemo: true },
  { id: "v-river", name: "RIVERBANK SHED", city: "Osaka", country: "Japan", capacity: 300, hourlyRate: 260, amenities: ["Technics 1200", "Bar", "Outdoor Area", "Step-free Access"], availableDates: availability(9), address: "Nakanoshima riverside (demo address)", palette: ["#A276E9", "#B6F05C", "#080808"], description: "Small timber shed with doors that open onto the river.", rating: 4.9, isDemo: true },
  { id: "v-glass", name: "GLASS NOODLE FACTORY", city: "New York", country: "USA", capacity: 1400, hourlyRate: 1300, amenities: ["Funktion-One", "CDJ-3000", "LED Wall", "Bar", "Green Room", "Coat Check"], availableDates: availability(10), address: "Bushwick, Brooklyn (demo address)", palette: ["#55BCEB", "#B6F05C", "#080808"], description: "Old noodle factory with the drying racks still hanging overhead.", rating: 4.6, isDemo: true },
];

function tickets(base: number, scale = 1): TicketType[] {
  return [
    { kind: "main", name: "Main Event", price: base, remaining: Math.round(420 * scale), perks: ["Entry to all main stages", "Free alien sticker pack"] },
    { kind: "afterparty", name: "After Party", price: Math.round(base * 0.55), remaining: Math.round(120 * scale), perks: ["Entry to the official after party", "Valid from closing time"] },
    { kind: "allnight", name: "All Night Pass", price: Math.round(base * 1.35), remaining: Math.round(180 * scale), perks: ["Main event + after party", "Fast-lane entry"] },
    { kind: "vip", name: "VIP", price: Math.round(base * 2.6), remaining: Math.round(40 * scale), perks: ["Balcony & lounge access", "Meet the lineup", "Limited avatar outfit"] },
  ];
}

function timetable(lineup: string[], start = 22): TimetableSlot[] {
  return lineup.map((djId, i) => {
    const h = (start + i * 1.5) % 24;
    const e = (start + (i + 1) * 1.5) % 24;
    const fmt = (n: number) => `${String(Math.floor(n)).padStart(2, "0")}:${n % 1 ? "30" : "00"}`;
    return { time: fmt(h), end: fmt(e), djId, stage: i % 3 === 2 ? "Second Stage" : "Main Stage" };
  });
}

const FAQ = [
  { q: "Is this a real event?", a: "No. This is demo sample data for FREAKTOPIA WORLD Phase 1. Tickets, support and funding are simulated in your browser only." },
  { q: "What happens when the event levels up?", a: "When supporters and funding pass the next threshold, the stage evolves — bigger production, more stages and more lineup slots." },
  { q: "Can I get a refund?", a: "In Phase 1 no money is taken, so there is nothing to refund. Real refund policies will be shown before any real purchase." },
  { q: "Is there an age limit?", a: "Organizers set their own age policy. Demo events show 18+ as an example." },
];

type Seed = Omit<FreakEvent, "timetable" | "faq" | "tickets" | "updates" | "isDemo" | "auditionDjIds"> & {
  ticketBase: number;
  auditionDjIds?: string[];
};

function makeEvent(s: Seed): FreakEvent {
  const { ticketBase, ...rest } = s;
  return {
    ...rest,
    auditionDjIds: s.auditionDjIds ?? DJS.filter((d) => !s.lineup.includes(d.id)).slice(0, 3).map((d) => d.id),
    timetable: timetable(s.lineup),
    faq: FAQ,
    tickets: tickets(ticketBase, Math.max(0.4, s.capacity / 2000)),
    updates: [
      { date: "2026-11-02", title: "Lineup expanded", body: `${s.name} unlocked another lineup slot thanks to new supporters.` },
      { date: "2026-10-18", title: "Venue confirmed", body: "The organizer confirmed the venue and the sound system spec." },
      { date: "2026-10-01", title: "Event created", body: "The first supporters arrived within an hour. The booth is warming up." },
    ],
    isDemo: true,
  };
}

export const EVENTS: FreakEvent[] = [
  makeEvent({ id: "bassmutant-tokyo", name: "BASSMUTANT TOKYO", city: "Tokyo", country: "Japan", lat: 35.659, lng: 139.7, startsAt: "2026-11-09T13:00:00Z", endsAt: "2026-11-09T21:00:00Z", genres: ["Techno", "Hardcore"], supporters: 3240, raised: 71800, goal: 90000, status: "live", djRecruiting: false, afterPartyId: "ap-afterglow", venueId: "v-kaiju", lineup: ["gloopzilla", "mika", "lazernana", "kombu"], palette: ["#B6F05C", "#A276E9", "#FF625C"], tagline: "Shibuya melts tonight.", description: "Four floors of mutant techno beneath Shibuya. The city’s biggest basement turns into a slime-green reactor until sunrise.", capacity: 650, organizer: "Ooze Collective", ticketBase: 48 }),
  makeEvent({ id: "neon-slime-summit", name: "NEON SLIME SUMMIT", city: "Berlin", country: "Germany", lat: 52.5, lng: 13.44, startsAt: "2026-12-12T21:00:00Z", endsAt: "2026-12-14T08:00:00Z", genres: ["Techno", "House"], supporters: 9840, raised: 236500, goal: 260000, status: "confirmed", djRecruiting: false, afterPartyId: "ap-slime-afterhours", venueId: "v-kraftwerk", lineup: ["mika", "gloopzilla", "lazernana", "vulture", "hyperfungi"], palette: ["#55BCEB", "#B6F05C", "#A276E9"], tagline: "A 36-hour summit of the slimiest sounds on the planet.", description: "A weekend-long gathering inside a decommissioned power plant. Three rooms, a rooftop garden and the first ever LV.5 stage in Europe.", capacity: 3500, organizer: "Power Plant 9", ticketBase: 65 }),
  makeEvent({ id: "void-jelly-rave", name: "VOID JELLY RAVE", city: "London", country: "UK", lat: 51.545, lng: -0.055, startsAt: "2026-11-28T22:00:00Z", endsAt: "2026-11-29T06:00:00Z", genres: ["Drum & Bass", "Garage"], supporters: 820, raised: 18400, goal: 30000, status: "confirmed", djRecruiting: true, afterPartyId: "ap-jelly-wobble", venueId: "v-swamp", lineup: ["subtoad", "mika"], palette: ["#FFAD5B", "#55BCEB", "#A276E9"], tagline: "Wobbly. Translucent. Very loud.", description: "Drum & bass and garage in a railway arch. The jelly is wobbling — help it reach festival scale.", capacity: 900, organizer: "Swamp Room", ticketBase: 28 }),
  makeEvent({ id: "mothership-motel", name: "MOTHERSHIP MOTEL", city: "Ibiza", country: "Spain", lat: 38.98, lng: 1.43, startsAt: "2027-05-22T20:00:00Z", endsAt: "2027-05-23T07:00:00Z", genres: ["House", "Disco"], supporters: 310, raised: 4200, goal: 15000, status: "funding", djRecruiting: true, venueId: "v-reef", lineup: ["lazernana"], palette: ["#FF625C", "#FFAD5B", "#55BCEB"], tagline: "Check in. Never check out.", description: "A pop-up alien motel by the sea with disco in every room. Still gathering supporters — the motel only opens if we reach LV.3.", capacity: 1200, organizer: "Motel Aliens", ticketBase: 55 }),
  makeEvent({ id: "kimchi-cosmos", name: "KIMCHI COSMOS", city: "Seoul", country: "South Korea", lat: 37.556, lng: 126.92, startsAt: "2026-12-05T21:00:00Z", endsAt: "2026-12-06T05:00:00Z", genres: ["House", "Disco"], supporters: 1240, raised: 21800, goal: 45000, status: "confirmed", djRecruiting: true, afterPartyId: "ap-ferment", venueId: "v-hongdae", lineup: ["lazernana", "kombu"], palette: ["#FF625C", "#B6F05C", "#A276E9"], tagline: "Fermented grooves, served cold.", description: "Hongdae’s fuzziest disco takes over a neon hall for one night.", capacity: 1200, organizer: "Fuzz Hall", ticketBase: 32 }),
  makeEvent({ id: "solar-sprout", name: "SOLAR SPROUT", city: "Mexico City", country: "Mexico", lat: 19.42, lng: -99.16, startsAt: "2027-01-23T20:00:00Z", endsAt: "2027-01-24T06:00:00Z", genres: ["Psytrance"], supporters: 420, raised: 6100, goal: 20000, status: "funding", djRecruiting: true, venueId: "v-volcano", lineup: ["bpmbaba"], palette: ["#FFAD5B", "#FF625C", "#B6F05C"], tagline: "Grow toward the bass.", description: "Psytrance in a painted courtyard. Help the sprout grow into a full rave.", capacity: 1600, organizer: "Volcán Azul", ticketBase: 24 }),
  makeEvent({ id: "lagos-lighthouse", name: "LOW-END LIGHTHOUSE", city: "Lagos", country: "Nigeria", lat: 6.43, lng: 3.42, startsAt: "2026-12-19T18:00:00Z", endsAt: "2026-12-20T04:00:00Z", genres: ["Afro House", "Amapiano"], supporters: 1880, raised: 34100, goal: 70000, status: "confirmed", djRecruiting: false, venueId: "v-lagos", lineup: ["okra", "zolazap"], palette: ["#B6F05C", "#FFAD5B", "#55BCEB"], tagline: "Follow the bass to the shore.", description: "Open-air Afro house by the water with a lighthouse booth that beams in time with the kick.", capacity: 2400, organizer: "Lighthouse Yard", ticketBase: 30 }),
  makeEvent({ id: "samba-satellite", name: "SAMBA SATELLITE", city: "São Paulo", country: "Brazil", lat: -23.55, lng: -46.63, startsAt: "2027-02-06T19:00:00Z", endsAt: "2027-02-07T06:00:00Z", genres: ["House", "Afro House"], supporters: 4100, raised: 88000, goal: 140000, status: "confirmed", djRecruiting: false, venueId: "v-volcano", lineup: ["okra", "lazernana", "vulture"], palette: ["#B6F05C", "#55BCEB", "#FFAD5B"], tagline: "Carnival in low orbit.", description: "A pre-carnival festival where drums meet alien house.", capacity: 6000, organizer: "Satellite Bloco", ticketBase: 40 }),
  makeEvent({ id: "deep-reef-disco", name: "DEEP REEF DISCO", city: "Melbourne", country: "Australia", lat: -37.82, lng: 144.94, startsAt: "2026-12-31T08:00:00Z", endsAt: "2027-01-01T03:00:00Z", genres: ["Disco", "Ambient"], supporters: 2900, raised: 64200, goal: 120000, status: "confirmed", djRecruiting: false, afterPartyId: "ap-reef-dawn", venueId: "v-reef", lineup: ["tentacle", "kombu", "lazernana"], palette: ["#55BCEB", "#FF625C", "#A276E9"], tagline: "Ring in the new year underwater.", description: "New Year’s Eve on the harbour, from sunset ambient to midnight disco.", capacity: 5000, organizer: "Reef Pavilion", ticketBase: 70 }),
  makeEvent({ id: "tuk-tuk-trance", name: "TUK TUK TRANCE", city: "Bangkok", country: "Thailand", lat: 13.74, lng: 100.53, startsAt: "2027-01-16T20:00:00Z", endsAt: "2027-01-17T04:00:00Z", genres: ["Footwork", "Hip-Hop"], supporters: 96, raised: 1400, goal: 6000, status: "funding", djRecruiting: true, venueId: "v-river", lineup: ["mochi"], palette: ["#A276E9", "#FFAD5B", "#B6F05C"], tagline: "Three wheels. Infinite BPM.", description: "A tiny rooftop booth that wants to become a club. Every supporter counts.", capacity: 250, organizer: "Mochi Crew", ticketBase: 15 }),
  makeEvent({ id: "motor-city-mutation", name: "MOTOR CITY MUTATION", city: "Detroit", country: "USA", lat: 42.33, lng: -83.05, startsAt: "2027-05-29T20:00:00Z", endsAt: "2027-05-30T04:00:00Z", genres: ["Techno", "House"], supporters: 380, raised: 5200, goal: 25000, status: "funding", djRecruiting: true, venueId: "v-glass", lineup: ["vulture"], palette: ["#FFAD5B", "#A276E9", "#55BCEB"], tagline: "Built in Detroit. Mutated in space.", description: "A warehouse tribute to the city that built techno.", capacity: 1400, organizer: "Crate Scavengers", ticketBase: 30 }),
  makeEvent({ id: "canal-critters", name: "CANAL CRITTERS", city: "Amsterdam", country: "Netherlands", lat: 52.39, lng: 4.88, startsAt: "2027-03-13T21:00:00Z", endsAt: "2027-03-14T06:00:00Z", genres: ["Psytrance", "Techno"], supporters: 760, raised: 16900, goal: 28000, status: "confirmed", djRecruiting: false, venueId: "v-canal", lineup: ["hyperfungi", "bpmbaba"], palette: ["#A276E9", "#55BCEB", "#B6F05C"], tagline: "Something is swimming in the canal.", description: "Spore-cloud psytrance in underground vaults.", capacity: 800, organizer: "Canal Crypt", ticketBase: 26 }),
  makeEvent({ id: "kawa-kaiju", name: "KAWA KAIJU", city: "Osaka", country: "Japan", lat: 34.69, lng: 135.49, startsAt: "2026-12-20T05:00:00Z", endsAt: "2026-12-20T12:00:00Z", genres: ["Ambient", "House"], supporters: 120, raised: 2600, goal: 8000, status: "funding", djRecruiting: true, venueId: "v-river", lineup: ["kombu"], palette: ["#A276E9", "#B6F05C", "#55BCEB"], tagline: "A gentle monster rises from the river.", description: "Daytime ambient on the riverside. Small, slow and very special.", capacity: 300, organizer: "River Shed", ticketBase: 18 }),
  makeEvent({ id: "amapiano-asteroid", name: "AMAPIANO ASTEROID", city: "Johannesburg", country: "South Africa", lat: -26.2, lng: 28.04, startsAt: "2027-01-30T16:00:00Z", endsAt: "2027-01-31T02:00:00Z", genres: ["Amapiano", "Afro House"], supporters: 540, raised: 9800, goal: 22000, status: "confirmed", djRecruiting: false, venueId: "v-lagos", lineup: ["zolazap", "okra"], palette: ["#B6F05C", "#FF625C", "#FFAD5B"], tagline: "Log drums from outer space.", description: "An asteroid of amapiano lands in Jozi.", capacity: 2000, organizer: "Zap Records", ticketBase: 22 }),
  makeEvent({ id: "glass-noodle", name: "GLASS NOODLE", city: "New York", country: "USA", lat: 40.705, lng: -73.92, startsAt: "2026-11-21T23:00:00Z", endsAt: "2026-11-22T07:00:00Z", genres: ["Techno", "Drum & Bass"], supporters: 1020, raised: 19300, goal: 40000, status: "confirmed", djRecruiting: true, venueId: "v-glass", lineup: ["vulture", "subtoad"], palette: ["#55BCEB", "#B6F05C", "#FF625C"], tagline: "Slurp responsibly.", description: "Warehouse techno under hanging noodle racks in Bushwick.", capacity: 1400, organizer: "Noodle Factory", ticketBase: 35 }),
  makeEvent({ id: "aurora-ooze", name: "AURORA OOZE", city: "Reykjavík", country: "Iceland", lat: 64.14, lng: -21.94, startsAt: "2027-02-20T20:00:00Z", endsAt: "2027-02-21T04:00:00Z", genres: ["Ambient", "Techno"], supporters: 60, raised: 900, goal: 9000, status: "funding", djRecruiting: true, venueId: "v-canal", lineup: ["kombu"], palette: ["#55BCEB", "#A276E9", "#B6F05C"], tagline: "Dance under the northern slime.", description: "A booth under the aurora. Needs supporters to become a club.", capacity: 400, organizer: "Arctic Ooze", ticketBase: 20 }),
  makeEvent({ id: "concrete-comet", name: "CONCRETE COMET", city: "Tbilisi", country: "Georgia", lat: 41.72, lng: 44.79, startsAt: "2027-03-27T22:00:00Z", endsAt: "2027-03-28T08:00:00Z", genres: ["Techno", "Hardcore"], supporters: 290, raised: 3900, goal: 16000, status: "funding", djRecruiting: true, venueId: "v-kraftwerk", lineup: ["mika"], palette: ["#FF625C", "#55BCEB", "#FFAD5B"], tagline: "Brutalist bass, falling fast.", description: "Hard techno in a concrete shell.", capacity: 1000, organizer: "Comet Concrete", ticketBase: 18 }),
  makeEvent({ id: "palm-alien-beach", name: "PALM ALIEN BEACH", city: "Los Angeles", country: "USA", lat: 34.0, lng: -118.48, startsAt: "2027-04-17T18:00:00Z", endsAt: "2027-04-18T02:00:00Z", genres: ["House", "Disco"], supporters: 140, raised: 2100, goal: 12000, status: "funding", djRecruiting: true, venueId: "v-reef", lineup: ["tentacle"], palette: ["#FFAD5B", "#FF625C", "#A276E9"], tagline: "Sunset. Palms. Tentacles.", description: "A beachside booth that dreams of becoming a festival.", capacity: 900, organizer: "Palm Aliens", ticketBase: 25 }),
];

export const AFTER_PARTIES: AfterParty[] = [
  { id: "ap-afterglow", eventId: "bassmutant-tokyo", name: "BASSMUTANT AFTERGLOW", venueName: "Kaiju Basement Room 2", city: "Tokyo", startsAt: "2026-11-09T21:00:00Z", endsAt: "2026-11-10T02:00:00Z", djIds: ["kombu", "gloopzilla"], price: 22, seatsLeft: 38, capacity: 200, description: "Slow-melt techno for the survivors. Ramen at 7am.", palette: ["#A276E9", "#B6F05C", "#080808"], isDemo: true },
  { id: "ap-slime-afterhours", eventId: "neon-slime-summit", name: "SLIME AFTERHOURS", venueName: "Power Plant 9 Rooftop", city: "Berlin", startsAt: "2026-12-14T08:00:00Z", endsAt: "2026-12-14T16:00:00Z", djIds: ["hyperfungi", "vulture"], price: 30, seatsLeft: 112, capacity: 600, description: "Rooftop sunrise session after the summit.", palette: ["#55BCEB", "#B6F05C", "#080808"], isDemo: true },
  { id: "ap-jelly-wobble", eventId: "void-jelly-rave", name: "JELLY WOBBLE CLUB", venueName: "Swamp Room Basement", city: "London", startsAt: "2026-11-29T06:00:00Z", endsAt: "2026-11-29T11:00:00Z", djIds: ["subtoad"], price: 15, seatsLeft: 9, capacity: 150, description: "Garage until lunch. Bring sunglasses.", palette: ["#FFAD5B", "#55BCEB", "#080808"], isDemo: true },
  { id: "ap-ferment", eventId: "kimchi-cosmos", name: "FERMENTATION STATION", venueName: "Fuzz Hall Lounge", city: "Seoul", startsAt: "2026-12-06T05:00:00Z", endsAt: "2026-12-06T10:00:00Z", djIds: ["kombu", "lazernana"], price: 18, seatsLeft: 64, capacity: 220, description: "Fluffy disco for the morning-after crew.", palette: ["#FF625C", "#B6F05C", "#080808"], isDemo: true },
  { id: "ap-reef-dawn", eventId: "deep-reef-disco", name: "REEF DAWN", venueName: "Pier 3 Beach Deck", city: "Melbourne", startsAt: "2027-01-01T03:00:00Z", endsAt: "2027-01-01T09:00:00Z", djIds: ["tentacle"], price: 28, seatsLeft: 140, capacity: 500, description: "First sunrise of the year with ambient waves.", palette: ["#55BCEB", "#FF625C", "#080808"], isDemo: true },
];

export const CITIES = Array.from(new Set(EVENTS.map((e) => e.city))).sort();

export const PAST_EVENTS = [
  { name: "SPORE PARTY 2025", city: "Amsterdam", date: "2025-10-18" },
  { name: "KAIJU BASEMENT SESSIONS", city: "Tokyo", date: "2025-08-02" },
  { name: "WOBBLE WEEKENDER", city: "London", date: "2025-05-24" },
];

export const getEvent = (id: string) => EVENTS.find((e) => e.id === id);
export const getDJ = (id: string) => DJS.find((d) => d.id === id);
export const getVenue = (id: string) => VENUES.find((v) => v.id === id);
export const getAfterParty = (id: string) => AFTER_PARTIES.find((a) => a.id === id);
