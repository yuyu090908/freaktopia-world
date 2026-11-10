/**
 * Party cities on the neon globe: events grouped by city, with a signature stage for the big party capitals
 * and a regional stage for every other city. Pure functions + SVG strings (same style as the festival landmarks),
 * so the map markers, the city preview and the tests share one source.
 *
 * A city appears only where at least one event is shown. Its position is the average of its events' real
 * coordinates, and the activity ring grows with the number of shown events (never with popularity or quality).
 */
import { DEMO_NOW } from "@/lib/filters";
import { REGION_COLOR, regionOfCountry, type RegionKey } from "./regions";
import type { WorldEvent } from "./view";

export type CitySignature = "berlin" | "ibiza" | "bangkok" | "new_york" | "dubai" | "rio" | "sydney" | "tokyo" | "london";

const SIGNATURE_BY_NAME: Record<string, CitySignature> = {
  berlin: "berlin",
  ibiza: "ibiza",
  "eivissa": "ibiza",
  bangkok: "bangkok",
  "new york": "new_york",
  "new york city": "new_york",
  dubai: "dubai",
  "rio de janeiro": "rio",
  rio: "rio",
  sydney: "sydney",
  tokyo: "tokyo",
  london: "london",
};

export const signatureOf = (city: string): CitySignature | null => SIGNATURE_BY_NAME[city.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()] ?? null;

export interface CityCounts {
  total: number;
  live: number;
  upcoming: number;
  djWanted: number;
  funding: number;
  dao: number;
  afterParty: number;
  completed: number;
}

export interface PartyCity {
  key: string;
  city: string;
  country: string;
  region: RegionKey | null;
  lat: number;
  lng: number;
  signature: CitySignature | null;
  events: WorldEvent[];
  counts: CityCounts;
  /** 1 live · 2 soonest upcoming · 3 featured · 4 the rest (a higher number sorts first). */
  priority: number;
}

export const cityKeyOf = (e: { city: string; country: string }) => `${e.city}|${e.country}`;

const DAY = 86_400_000;

export function countsOf(events: WorldEvent[], now = DEMO_NOW.getTime()): CityCounts {
  const c: CityCounts = { total: events.length, live: 0, upcoming: 0, djWanted: 0, funding: 0, dao: 0, afterParty: 0, completed: 0 };
  for (const e of events) {
    if (e.live) c.live++;
    if (e.status !== "completed" && e.status !== "cancelled" && !e.live && Date.parse(e.startsAt) > now) c.upcoming++;
    if (e.djRecruiting) c.djWanted++;
    if (e.status === "funding" || e.status === "planning") c.funding++;
    if (e.dao) c.dao++;
    if (e.afterParty) c.afterParty++;
    if (e.status === "completed") c.completed++;
  }
  return c;
}

/** Same order as the spec: live, then the soonest upcoming, then featured (ranked), then everything else. */
export function eventPriority(e: WorldEvent, now = DEMO_NOW.getTime()) {
  if (e.live) return 4000;
  const start = Date.parse(e.startsAt);
  if (e.status !== "completed" && e.status !== "cancelled" && start > now) return 2000 + Math.max(0, 900 - Math.round((start - now) / DAY)) + (e.ranking.badge ? 50 : 0);
  if (e.ranking.badge) return 1000 - (e.ranking.rank ?? 0);
  return e.status === "completed" ? 0 : 100;
}

export function buildCities(events: WorldEvent[], now = DEMO_NOW.getTime()): PartyCity[] {
  const by = new Map<string, WorldEvent[]>();
  for (const e of events) {
    const k = cityKeyOf(e);
    const list = by.get(k);
    if (list) list.push(e);
    else by.set(k, [e]);
  }
  const out: PartyCity[] = [];
  for (const [key, evs] of by) {
    const first = evs[0];
    const sorted = [...evs].sort((a, b) => eventPriority(b, now) - eventPriority(a, now));
    out.push({
      key,
      city: first.city,
      country: first.country,
      region: regionOfCountry(first.country),
      lat: evs.reduce((a, e) => a + e.location.lat, 0) / evs.length,
      lng: evs.reduce((a, e) => a + e.location.lng, 0) / evs.length,
      signature: signatureOf(first.city),
      events: sorted,
      counts: countsOf(evs, now),
      priority: eventPriority(sorted[0], now),
    });
  }
  return out.sort((a, b) => b.priority - a.priority || b.counts.total - a.counts.total || a.city.localeCompare(b.city));
}

/** Icon scale from the number of shown events: 1 event → 1, grows slowly, capped. */
export const cityScale = (n: number) => Math.min(1.45, 0.92 + Math.log2(Math.max(1, n)) * 0.2);

/* ------------------------------------------------------------------ art (viewBox 0 0 120 120, anchored bottom centre) */

const INK = "#080A10";
const SW = 2.4;

function base(c: string) {
  return `<ellipse cx="60" cy="104" rx="44" ry="12" fill="#120E26" stroke="${INK}" stroke-width="${SW}"/>
<ellipse cx="60" cy="101" rx="44" ry="12" fill="#1E1840" stroke="${INK}" stroke-width="${SW}"/>
<ellipse cx="60" cy="101" rx="37" ry="8.5" fill="none" stroke="${c}" stroke-opacity=".75" stroke-width="1.6" stroke-dasharray="4 4"/>`;
}

function stage(x: number, y: number, w: number, c1: string, c2: string) {
  return `<path d="M${x - w / 2} ${y} V${y - 16} Q${x} ${y - 30} ${x + w / 2} ${y - 16} V${y} Z" fill="#241C4A" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>
<path d="M${x - w / 2 + 5} ${y} V${y - 13} Q${x} ${y - 24} ${x + w / 2 - 5} ${y - 13} V${y}" fill="#0E0B1E" stroke="${c1}" stroke-width="2"/>
<rect x="${x - 7}" y="${y - 7}" width="14" height="6" rx="1.5" fill="${c2}" stroke="${INK}" stroke-width="1.4"/>`;
}

function laser(x: number, y: number, tx: number, ty: number, c: string, i: number) {
  return `<path class="lm-beam" style="animation-delay:${i * 0.4}s" d="M${x} ${y} L${tx - 3} ${ty} L${tx + 3} ${ty} Z" fill="${c}" opacity=".5"/>`;
}

function palm(x: number, y: number, h: number) {
  return `<path d="M${x} ${y} Q${x + 3} ${y - h / 2} ${x - 1} ${y - h}" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/>
<path d="M${x} ${y} Q${x + 3} ${y - h / 2} ${x - 1} ${y - h}" fill="none" stroke="#8A5A2B" stroke-width="2.2" stroke-linecap="round"/>
<path d="M${x - 1} ${y - h} q-12 -2 -16 6 M${x - 1} ${y - h} q12 -3 16 5 M${x - 1} ${y - h} q-6 -10 -14 -9 M${x - 1} ${y - h} q6 -10 14 -8" fill="none" stroke="${INK}" stroke-width="4.6" stroke-linecap="round"/>
<path d="M${x - 1} ${y - h} q-12 -2 -16 6 M${x - 1} ${y - h} q12 -3 16 5 M${x - 1} ${y - h} q-6 -10 -14 -9 M${x - 1} ${y - h} q6 -10 14 -8" fill="none" stroke="#39FF70" stroke-width="2.4" stroke-linecap="round"/>`;
}

function tower(x: number, w: number, h: number, body: string, glow: string) {
  let win = "";
  for (let yy = 98 - h + 6; yy < 94; yy += 7) win += `<path d="M${x + 3} ${yy} h${w - 6}" stroke="${glow}" stroke-width="1.6" stroke-dasharray="2 2.5" opacity=".9"/>`;
  return `<rect x="${x}" y="${98 - h}" width="${w}" height="${h}" rx="1.5" fill="${body}" stroke="${INK}" stroke-width="${SW}"/>${win}`;
}

const SIGNATURE_ART: Record<CitySignature, () => string> = {
  // Concrete techno bunker with purple lasers and the TV-tower ball.
  berlin: () =>
    base("#A347FF") +
    [laser(46, 66, 18, 8, "#A347FF", 0), laser(60, 62, 60, 2, "#FF35AD", 1), laser(74, 66, 102, 8, "#A347FF", 2)].join("") +
    `<path d="M84 98 V40" stroke="${INK}" stroke-width="4.4"/><path d="M84 98 V40" stroke="#B9B2C4" stroke-width="2"/><circle cx="84" cy="44" r="6" fill="#B9B2C4" stroke="${INK}" stroke-width="${SW}"/><path d="M84 38 V28" stroke="${INK}" stroke-width="2"/>
<path d="M28 98 V66 H76 V98 Z" fill="#2B2838" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>
<path d="M32 74 H72 M32 82 H72 M32 90 H72" stroke="#3E3A52" stroke-width="2"/>
<rect x="42" y="78" width="20" height="20" fill="#0E0B1E" stroke="#A347FF" stroke-width="2"/><rect x="48" y="86" width="8" height="4" fill="#FF35AD"/>`,
  // Beach club: sand, sea, two palms and a pink-purple stage arch.
  ibiza: () =>
    base("#FF35AD") +
    `<path d="M18 100 Q60 84 102 100 Z" fill="#F2C879" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>
<path d="M22 102 q8 -4 16 0 t16 0 t16 0 t16 0 t14 0" fill="none" stroke="#66DFFF" stroke-width="2.2"/>` +
    palm(28, 96, 36) +
    palm(94, 96, 30) +
    stage(60, 92, 44, "#FF35AD", "#A347FF") +
    [laser(48, 66, 34, 20, "#FF35AD", 0), laser(72, 66, 86, 20, "#C3A1FF", 1)].join(""),
  // Gold temple spire beside glass towers, with a DJ stage in front.
  bangkok: () =>
    base("#FFD23F") +
    tower(70, 14, 50, "#1E3B5C", "#66DFFF") +
    tower(86, 12, 38, "#3B1E5C", "#FF79CD") +
    `<path d="M32 98 L32 74 L28 74 L36 58 L33 58 L40 40 L37 40 L42 22 L47 40 L44 40 L51 58 L48 58 L56 74 L52 74 L52 98 Z" fill="#FFD23F" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>
<path d="M36 74 H48 M38 58 H46" stroke="#C48A00" stroke-width="2"/><circle cx="42" cy="86" r="4" fill="#FF35AD" stroke="${INK}" stroke-width="1.4"/>` +
    stage(62, 100, 30, "#FFD23F", "#FF35AD"),
  // Neon skyscrapers with a spire and a street stage.
  new_york: () =>
    base("#00DFFF") +
    tower(26, 14, 44, "#14304A", "#00DFFF") +
    tower(42, 16, 66, "#102438", "#00DFFF") +
    `<path d="M50 32 V18 M47 32 h6" stroke="${INK}" stroke-width="3"/><path d="M50 32 V18" stroke="#00DFFF" stroke-width="1.4"/>` +
    tower(60, 14, 52, "#16334F", "#66DFFF") +
    tower(76, 16, 38, "#10263B", "#00DFFF") +
    stage(60, 102, 40, "#00DFFF", "#FF79CD"),
  // Futuristic needle tower, dunes and a gold open-air stage.
  dubai: () =>
    base("#FF8A24") +
    `<path d="M14 100 Q34 86 54 96 Q74 84 106 100 Z" fill="#E8B36A" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>
<path d="M76 98 L80 52 L82 20 L84 52 L88 98 Z" fill="#C9D6E8" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>
<path d="M80 60 h4 M79.5 72 h6 M79 84 h8" stroke="#FFD23F" stroke-width="2"/>
<path d="M18 96 Q46 58 74 96" fill="none" stroke="${INK}" stroke-width="5"/><path d="M18 96 Q46 58 74 96" fill="none" stroke="#FFD23F" stroke-width="2.6"/>` +
    stage(46, 98, 34, "#FFD23F", "#FF8A24") +
    [laser(36, 76, 22, 30, "#FFD23F", 0), laser(56, 76, 66, 28, "#FFB45C", 1)].join(""),
  // Tropical stage under a sugarloaf peak, pink and orange lights.
  rio: () =>
    base("#FF35AD") +
    `<path d="M66 98 C66 60 74 34 86 34 C98 34 104 66 104 98 Z" fill="#2C6E4A" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>
<path d="M74 60 Q86 50 98 62" fill="none" stroke="#39FF70" stroke-width="2" opacity=".7"/>` +
    palm(24, 98, 30) +
    stage(50, 98, 42, "#FF35AD", "#FF8A24") +
    [laser(40, 72, 26, 24, "#FF8A24", 0), laser(60, 72, 70, 20, "#FF35AD", 1)].join(""),
  // Harbour stage with shell-shaped sails and blue lights over the water.
  sydney: () =>
    base("#358BFF") +
    `<path d="M14 102 q8 -4 16 0 t16 0 t16 0 t16 0 t16 0 t14 0" fill="none" stroke="#66DFFF" stroke-width="2.2"/>
<path d="M30 96 Q34 64 52 54 Q48 76 50 96 Z" fill="#F4F1EA" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>
<path d="M48 96 Q54 58 76 48 Q68 74 70 96 Z" fill="#F4F1EA" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>
<path d="M68 96 Q74 70 92 62 Q86 80 88 96 Z" fill="#E4E8F2" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>
<path d="M26 96 H94" stroke="${INK}" stroke-width="4"/><path d="M26 96 H94" stroke="#358BFF" stroke-width="2"/>` +
    [laser(44, 70, 30, 18, "#358BFF", 0), laser(66, 64, 80, 12, "#66DFFF", 1)].join(""),
  // Lattice tower and neon signs.
  tokyo: () =>
    base("#FFD23F") +
    `<path d="M40 98 L54 30 L56 18 L58 30 L72 98" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
<path d="M40 98 L54 30 L56 18 L58 30 L72 98" fill="none" stroke="#FF5A3C" stroke-width="2.6" stroke-linejoin="round"/>
<path d="M46 70 H66 M50 50 H62" stroke="#F4F1EA" stroke-width="3"/>` +
    tower(76, 16, 44, "#2A1E4A", "#FF79CD") +
    `<rect x="20" y="62" width="14" height="22" rx="2" fill="#0E0B1E" stroke="#C1FF53" stroke-width="2"/><path d="M24 68 h6 M24 74 h6" stroke="#C1FF53" stroke-width="2"/>` +
    stage(58, 102, 30, "#FFD23F", "#C1FF53"),
  // Clock tower and a big wheel.
  london: () =>
    base("#A347FF") +
    `<circle cx="80" cy="62" r="24" fill="none" stroke="${INK}" stroke-width="5"/><circle cx="80" cy="62" r="24" fill="none" stroke="#C3A1FF" stroke-width="2.4"/>
<path d="M80 38 V86 M56 62 H104 M63 45 L97 79 M97 45 L63 79" stroke="#C3A1FF" stroke-width="1.2" opacity=".8"/><path d="M72 98 L80 62 L88 98" fill="none" stroke="${INK}" stroke-width="3"/>
<rect x="28" y="40" width="16" height="58" fill="#B08A4A" stroke="${INK}" stroke-width="${SW}"/><path d="M28 40 L36 22 L44 40 Z" fill="#7A5C2E" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>
<circle cx="36" cy="50" r="5" fill="#F4F1EA" stroke="${INK}" stroke-width="1.6"/>` +
    stage(54, 102, 30, "#A347FF", "#C1FF53"),
};

function genericArt(c: string) {
  return base(c) + tower(30, 12, 34, "#1E1840", c) + tower(78, 12, 28, "#1E1840", c) + stage(60, 96, 40, c, "#F4F1EA") + [laser(50, 70, 36, 26, c, 0), laser(70, 70, 84, 26, c, 1)].join("");
}

export interface CityArtSpec {
  signature: CitySignature | null;
  region: RegionKey | null;
  live: boolean;
  /** Number of shown events: draws the activity ring. */
  count: number;
  animate: boolean;
}

/** One city stage. The activity ring is a fixed-step size from the shown event count, and live cities get a slow red pulse. */
export function citySvg(spec: CityArtSpec): string {
  const c = spec.region ? REGION_COLOR[spec.region] : "#C1FF53";
  const body = spec.signature ? SIGNATURE_ART[spec.signature]() : genericArt(c);
  const ring = Math.min(3, spec.count);
  let rings = "";
  for (let i = 0; i < ring; i++) rings += `<ellipse cx="60" cy="102" rx="${48 + i * 6}" ry="${14 + i * 2}" fill="none" stroke="${c}" stroke-opacity="${0.5 - i * 0.12}" stroke-width="1.6"/>`;
  const live = spec.live ? `<ellipse class="wm-city-live" cx="60" cy="102" rx="54" ry="16" fill="none" stroke="#FF625C" stroke-width="3"/>` : "";
  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" class="lm lm-city${spec.live ? " lm-live" : ""}${spec.animate ? "" : " lm-still"}" aria-hidden="true">${rings}${live}${body}</svg>`;
}

/** Whether the city has its own designed stage (used by the legend and tests). */
export const SIGNATURE_CITIES = Object.keys(SIGNATURE_ART) as CitySignature[];
