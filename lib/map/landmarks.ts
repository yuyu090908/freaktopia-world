/**
 * Miniature festival landmarks for the world map (original FREAKTOPIA art, drawn as SVG strings).
 *
 * One function builds every variant from data: genre → landmark type, level → how much is built,
 * status → overlay (scaffold, funding ring, live beams, monument, cancelled tape), DAO → community
 * banners, approved DAO stage design → palette. Strings (not React) so the same art renders in
 * map markers (plain DOM, pooled) and in React pages (gallery) without duplication.
 *
 * viewBox 0 0 120 120, anchored at the bottom centre (60, 112).
 */
import type { EventLevel, Genre } from "@/lib/types";

export type LandmarkType = "monster_stage" | "psychedelic_tent" | "cosmic_portal" | "speaker_towers" | "alien_sculpture" | "neon_gate";
export type MapStatus = "planning" | "funding" | "confirmed" | "live" | "completed" | "cancelled";

export const LANDMARK_LABEL: Record<LandmarkType, string> = {
  monster_stage: "Monster Stage",
  psychedelic_tent: "Psychedelic Tent",
  cosmic_portal: "Cosmic Portal",
  speaker_towers: "Giant Speaker Towers",
  alien_sculpture: "Alien Sculpture Garden",
  neon_gate: "Neon Festival Gate",
};

/** Status text + glyph: status is never shown by colour alone. */
export const STATUS_META: Record<MapStatus, { label: string; glyph: string; color: string; hint: string }> = {
  planning: { label: "PLANNING", glyph: "✎", color: "#9AA3B2", hint: "Under construction: lineup and venue not set" },
  funding: { label: "FUNDING", glyph: "◎", color: "#B6F05C", hint: "Collecting support" },
  confirmed: { label: "CONFIRMED", glyph: "✓", color: "#55BCEB", hint: "Venue and date confirmed" },
  live: { label: "DEMO LIVE", glyph: "●", color: "#FF625C", hint: "Demo simulation, not a real broadcast" },
  completed: { label: "COMPLETED", glyph: "★", color: "#E8C66A", hint: "Event finished: commemorative landmark" },
  cancelled: { label: "CANCELLED", glyph: "✕", color: "#FF625C", hint: "Event cancelled" },
};

export function landmarkTypeFor(genres: Genre[]): LandmarkType {
  const g = genres[0];
  if (g === "Techno" || g === "Hardcore") return "monster_stage";
  if (g === "House" || g === "Disco") return "psychedelic_tent";
  if (g === "Afro House" || g === "Amapiano") return "cosmic_portal";
  if (g === "Drum & Bass" || g === "Garage" || g === "Footwork" || g === "Hip-Hop") return "speaker_towers";
  if (g === "Psytrance" || g === "Ambient") return "alien_sculpture";
  return "neon_gate";
}

export interface LandmarkSpec {
  type: LandmarkType;
  level: EventLevel;
  status: MapStatus;
  palette: [string, string, string];
  /** Funding progress 0–1, drawn as the gauge for FUNDING. */
  fundingPct?: number;
  /** DAO members tier 0–3: community banners (decoration only, not progress). */
  daoTier?: 0 | 1 | 2 | 3;
  /** Ranking crown: 1, 2, 3 or null. */
  rank?: 1 | 2 | 3 | null;
  /** Animate (beams, idle bob). Off for low-power and reduced motion. */
  animate?: boolean;
}

const INK = "#080A10";
const SW = 2.4; // thick outline

const f = (n: number) => Math.round(n * 10) / 10;

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * (1 + amt))));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

/* ---------- parts ---------- */

function platform(c: string, wide: number) {
  const rx = 30 + wide * 5;
  return `<ellipse cx="60" cy="100" rx="${rx}" ry="${f(rx * 0.32)}" fill="${shade(c, -0.55)}" stroke="${INK}" stroke-width="${SW}"/>
<ellipse cx="60" cy="96" rx="${rx}" ry="${f(rx * 0.32)}" fill="#1E2632" stroke="${INK}" stroke-width="${SW}"/>
<ellipse cx="60" cy="96" rx="${f(rx - 6)}" ry="${f(rx * 0.32 - 3)}" fill="none" stroke="${c}" stroke-opacity=".55" stroke-width="1.4" stroke-dasharray="3 4"/>`;
}

function speaker(x: number, y: number, h: number, body = "#232A36") {
  const w = h * 0.55;
  return `<rect x="${f(x - w / 2)}" y="${f(y - h)}" width="${f(w)}" height="${f(h)}" rx="2" fill="${body}" stroke="${INK}" stroke-width="${SW}"/>
<circle cx="${f(x)}" cy="${f(y - h * 0.68)}" r="${f(w * 0.26)}" fill="#11151D" stroke="${INK}" stroke-width="1.4"/>
<circle cx="${f(x)}" cy="${f(y - h * 0.28)}" r="${f(w * 0.34)}" fill="#11151D" stroke="${INK}" stroke-width="1.4"/>
<circle cx="${f(x)}" cy="${f(y - h * 0.28)}" r="${f(w * 0.12)}" fill="#3A4454"/>`;
}

function booth(x: number, y: number, c: string) {
  return `<path d="M${x - 13} ${y - 11} L${x + 13} ${y - 11} L${x + 10} ${y} L${x - 10} ${y} Z" fill="#2A3240" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>
<path d="M${x - 11} ${y - 6} H${x + 11}" stroke="${c}" stroke-width="2.2"/>
<rect x="${x - 15}" y="${y - 15}" width="30" height="4" rx="2" fill="#2A3240" stroke="${INK}" stroke-width="1.6"/>
<circle cx="${x - 7}" cy="${y - 13}" r="2.2" fill="#F5F2EA"/><circle cx="${x + 7}" cy="${y - 13}" r="2.2" fill="#F5F2EA"/>`;
}

/** Original FREAKTOPIA alien: a blob with stalk eyes, drawn thick-lined. */
function alien(x: number, y: number, s: number, body: string, accent: string, cls = "") {
  const k = (n: number) => f(n * s);
  return `<g class="${cls}" transform="translate(${f(x)} ${f(y)})">
<path d="M${k(-9)} 0 C${k(-11)} ${k(-10)} ${k(-8)} ${k(-19)} 0 ${k(-19)} C${k(8)} ${k(-19)} ${k(11)} ${k(-10)} ${k(9)} 0 Z" fill="${body}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>
<path d="M${k(-4)} ${k(-18)} L${k(-7)} ${k(-26)} M${k(4)} ${k(-18)} L${k(7)} ${k(-26)}" stroke="${INK}" stroke-width="${SW}" stroke-linecap="round"/>
<circle cx="${k(-7)}" cy="${k(-27)}" r="${k(3.2)}" fill="#F5F2EA" stroke="${INK}" stroke-width="1.6"/><circle cx="${k(7)}" cy="${k(-27)}" r="${k(3.2)}" fill="#F5F2EA" stroke="${INK}" stroke-width="1.6"/>
<circle cx="${k(-6.4)}" cy="${k(-27)}" r="${k(1.3)}" fill="${INK}"/><circle cx="${k(7.6)}" cy="${k(-27)}" r="${k(1.3)}" fill="${INK}"/>
<circle cx="0" cy="${k(-11)}" r="${k(3.4)}" fill="#F5F2EA" stroke="${INK}" stroke-width="1.4"/><circle cx="${k(0.6)}" cy="${k(-11)}" r="${k(1.6)}" fill="${INK}"/>
<path d="M${k(-4)} ${k(-5)} Q0 ${k(-2)} ${k(4)} ${k(-5)}" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>
<circle cx="${k(-5)}" cy="${k(-15)}" r="${k(1.4)}" fill="${accent}"/><circle cx="${k(5.5)}" cy="${k(-6)}" r="${k(1.2)}" fill="${accent}"/>
</g>`;
}

function crowd(n: number, pal: string[]) {
  let s = "";
  for (let i = 0; i < n; i++) {
    const x = 34 + ((i * 53) % 52);
    const y = 96 + ((i * 7) % 7) - 1;
    s += `<g class="lm-bob" style="animation-delay:${(i % 5) * 0.18}s"><circle cx="${x}" cy="${y - 4}" r="3" fill="${pal[i % pal.length]}" stroke="${INK}" stroke-width="1.4"/></g>`;
  }
  return s;
}

function flags(n: number, pal: string[]) {
  let s = `<path d="M24 74 Q60 62 96 74" fill="none" stroke="${INK}" stroke-width="1.6"/>`;
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / (n + 1);
    const x = 24 + 72 * t;
    const y = 74 - 12 * 4 * t * (1 - t) * 0.83;
    s += `<path d="M${f(x - 3)} ${f(y)} L${f(x + 3)} ${f(y)} L${f(x)} ${f(y + 6)} Z" fill="${pal[i % pal.length]}" stroke="${INK}" stroke-width="1.2"/>`;
  }
  return s;
}

function beams(c1: string, c2: string, count: number) {
  let s = "";
  for (let i = 0; i < count; i++) {
    const x = 40 + (40 / Math.max(1, count - 1)) * i;
    const tip = x + (i % 2 ? 18 : -18);
    s += `<path class="lm-beam" style="animation-delay:${i * 0.35}s" d="M${f(x)} 58 L${f(tip - 5)} 4 L${f(tip + 5)} 4 Z" fill="${i % 2 ? c2 : c1}" opacity=".22"/>`;
  }
  return s;
}

/* ---------- landmark bodies (per type, scaled by level) ---------- */

function monsterStage(lv: number, p: string[]) {
  const w = 30 + lv * 5;
  const h = 26 + lv * 6;
  const top = 92 - h;
  let teeth = "";
  for (let i = 0; i < 5; i++) {
    const tx = 60 - w / 2 + 6 + ((w - 12) / 4) * i;
    teeth += `<path d="M${f(tx - 3)} ${f(top + 7)} L${f(tx)} ${f(top + 14)} L${f(tx + 3)} ${f(top + 7)} Z" fill="#F5F2EA" stroke="${INK}" stroke-width="1.2"/>`;
  }
  return `<path d="M${f(60 - w / 2)} 92 L${f(60 - w / 2)} ${f(top + 10)} Q60 ${f(top - 10)} ${f(60 + w / 2)} ${f(top + 10)} L${f(60 + w / 2)} 92 Z" fill="${shade(p[0], -0.25)}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>
<path d="M${f(60 - w / 2 + 6)} 92 L${f(60 - w / 2 + 6)} ${f(top + 14)} Q60 ${f(top)} ${f(60 + w / 2 - 6)} ${f(top + 14)} L${f(60 + w / 2 - 6)} 92 Z" fill="#141924" stroke="${INK}" stroke-width="1.6"/>
${teeth}
<circle cx="${f(60 - w / 4)}" cy="${f(top + 2)}" r="4" fill="${p[1]}" stroke="${INK}" stroke-width="1.6"/><circle cx="${f(60 + w / 4)}" cy="${f(top + 2)}" r="4" fill="${p[1]}" stroke="${INK}" stroke-width="1.6"/>
<circle cx="${f(60 - w / 4)}" cy="${f(top + 2)}" r="1.6" fill="${INK}"/><circle cx="${f(60 + w / 4)}" cy="${f(top + 2)}" r="1.6" fill="${INK}"/>`;
}

function tent(lv: number, p: string[]) {
  const w = 34 + lv * 6;
  const h = 30 + lv * 6;
  const top = 92 - h;
  let stripes = "";
  for (let i = 1; i < 4; i++) {
    const bx = 60 - w / 2 + (w / 4) * i;
    stripes += `<path d="M60 ${f(top)} L${f(bx - 3)} 92 L${f(bx + 3)} 92 Z" fill="${i % 2 ? p[1] : p[2]}" opacity=".9"/>`;
  }
  return `<path d="M60 ${f(top)} L${f(60 + w / 2)} 92 L${f(60 - w / 2)} 92 Z" fill="${p[0]}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>
${stripes}
<path d="M60 ${f(top)} L${f(60 + w / 2)} 92 L${f(60 - w / 2)} 92 Z" fill="none" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>
<path d="M52 92 Q60 ${f(92 - h * 0.45)} 68 92 Z" fill="#141924" stroke="${INK}" stroke-width="1.6"/>
<path d="M60 ${f(top)} L60 ${f(top - 9)}" stroke="${INK}" stroke-width="1.8"/><path d="M60 ${f(top - 9)} L69 ${f(top - 6)} L60 ${f(top - 3)} Z" fill="${p[1]}" stroke="${INK}" stroke-width="1.2"/>
<circle cx="60" cy="${f(top + h * 0.35)}" r="${f(3 + lv * 0.6)}" fill="#F5F2EA" stroke="${INK}" stroke-width="1.4"/>`;
}

function portal(lv: number, p: string[]) {
  const r = 14 + lv * 3.4;
  const cy = 92 - r - 2;
  return `<ellipse cx="60" cy="${f(cy)}" rx="${f(r)}" ry="${f(r)}" fill="${shade(p[2], -0.6)}" stroke="${INK}" stroke-width="${SW}"/>
<ellipse cx="60" cy="${f(cy)}" rx="${f(r - 5)}" ry="${f(r - 5)}" fill="none" stroke="${p[0]}" stroke-width="5"/>
<ellipse class="lm-spin" cx="60" cy="${f(cy)}" rx="${f(r - 11)}" ry="${f(r - 11)}" fill="none" stroke="${p[1]}" stroke-width="2.4" stroke-dasharray="5 4"/>
<circle cx="60" cy="${f(cy)}" r="${f(Math.max(2, r - 17))}" fill="${p[2]}" opacity=".85"/>
<ellipse cx="60" cy="${f(cy)}" rx="${f(r)}" ry="${f(r)}" fill="none" stroke="${INK}" stroke-width="${SW}"/>
<path d="M${f(60 - r * 0.8)} 92 L${f(60 - r * 0.55)} ${f(cy + r * 0.6)} M${f(60 + r * 0.8)} 92 L${f(60 + r * 0.55)} ${f(cy + r * 0.6)}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
}

function towers(lv: number, p: string[]) {
  const h = 22 + lv * 7;
  let s = speaker(38, 94, h, shade(p[0], -0.55)) + speaker(82, 94, h, shade(p[0], -0.55));
  if (lv >= 2) s += speaker(38, 94 - h, h * 0.55, shade(p[1], -0.55)) + speaker(82, 94 - h, h * 0.55, shade(p[1], -0.55));
  s += `<rect x="50" y="${f(92 - h * 0.55)}" width="20" height="${f(h * 0.55)}" rx="3" fill="${p[1]}" stroke="${INK}" stroke-width="${SW}"/>
<path d="M53 ${f(92 - h * 0.4)} h14 M53 ${f(92 - h * 0.28)} h14" stroke="${INK}" stroke-width="1.6"/>`;
  return s;
}

function sculpture(lv: number, p: string[]) {
  const h = 30 + lv * 8;
  const top = 92 - h;
  return `<path d="M54 92 C52 ${f(top + h * 0.6)} 50 ${f(top + h * 0.4)} 50 ${f(top + 14)} L70 ${f(top + 14)} C70 ${f(top + h * 0.4)} 68 ${f(top + h * 0.6)} 66 92 Z" fill="${shade(p[2], -0.3)}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>
<path d="M${f(60 - 14 - lv * 2)} ${f(top + 16)} Q60 ${f(top - 10 - lv * 2)} ${f(60 + 14 + lv * 2)} ${f(top + 16)} Z" fill="${p[0]}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>
<circle cx="${f(52)}" cy="${f(top + 6)}" r="2.6" fill="#F5F2EA"/><circle cx="${f(66)}" cy="${f(top + 3)}" r="3.4" fill="#F5F2EA"/><circle cx="${f(60)}" cy="${f(top + 10)}" r="1.8" fill="#F5F2EA"/>
<circle cx="60" cy="${f(top + h * 0.5)}" r="4" fill="#F5F2EA" stroke="${INK}" stroke-width="1.4"/><circle cx="60.8" cy="${f(top + h * 0.5)}" r="1.8" fill="${INK}"/>`;
}

function gate(lv: number, p: string[]) {
  const w = 36 + lv * 6;
  const h = 26 + lv * 6;
  const top = 92 - h;
  return `<rect x="${f(60 - w / 2)}" y="${f(top)}" width="8" height="${f(h)}" rx="2" fill="${shade(p[0], -0.4)}" stroke="${INK}" stroke-width="${SW}"/>
<rect x="${f(60 + w / 2 - 8)}" y="${f(top)}" width="8" height="${f(h)}" rx="2" fill="${shade(p[0], -0.4)}" stroke="${INK}" stroke-width="${SW}"/>
<path d="M${f(60 - w / 2 - 4)} ${f(top + 2)} Q60 ${f(top - 14)} ${f(60 + w / 2 + 4)} ${f(top + 2)} L${f(60 + w / 2 + 4)} ${f(top + 9)} Q60 ${f(top - 6)} ${f(60 - w / 2 - 4)} ${f(top + 9)} Z" fill="${p[1]}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>
<path d="M${f(60 - w / 2 + 4)} ${f(top + 12)} Q60 ${f(top)} ${f(60 + w / 2 - 4)} ${f(top + 12)}" fill="none" stroke="${p[0]}" stroke-width="2" stroke-dasharray="2 3"/>`;
}

const BODY: Record<LandmarkType, (lv: number, p: string[]) => string> = {
  monster_stage: monsterStage,
  psychedelic_tent: tent,
  cosmic_portal: portal,
  speaker_towers: towers,
  alien_sculpture: sculpture,
  neon_gate: gate,
};

/* ---------- overlays ---------- */

function scaffold() {
  let s = `<g stroke="#9AA3B2" stroke-width="1.6" fill="none" opacity=".9">`;
  for (const x of [40, 52, 68, 80]) s += `<path d="M${x} 92 V52"/>`;
  for (const y of [60, 72, 84]) s += `<path d="M40 ${y} H80"/>`;
  s += `<path d="M40 84 L52 72 M68 72 L80 60 M52 84 L68 72"/></g>
<path d="M88 92 V30 H64" stroke="#E8C66A" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M70 30 V40" stroke="${INK}" stroke-width="1.4"/><rect x="66" y="40" width="8" height="5" fill="#E8C66A" stroke="${INK}" stroke-width="1.2"/>
<rect x="44" y="86" width="12" height="8" fill="#E8C66A" stroke="${INK}" stroke-width="1.4"/><path d="M44 86 l12 8 M56 86 l-12 8" stroke="${INK}" stroke-width="1"/>`;
  return s;
}

function fundingRing(pct: number, c: string) {
  const r = 48;
  const len = Math.PI * r; // half-ellipse arc approximation for the gauge
  const p = Math.max(0.04, Math.min(1, pct));
  return `<ellipse class="lm-ring" cx="60" cy="97" rx="50" ry="17" fill="none" stroke="${c}" stroke-width="3" stroke-opacity=".7"/>
<path d="M12 104 A48 15 0 0 0 108 104" fill="none" stroke="#0E131C" stroke-width="5" stroke-linecap="round"/>
<path d="M12 104 A48 15 0 0 0 108 104" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${f(len * p)} ${f(len)}"/>`;
}

function monument() {
  return `<path d="M54 92 L57 62 L63 62 L66 92 Z" fill="#E8C66A" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>
<path d="M57 62 L60 54 L63 62 Z" fill="#F5F2EA" stroke="${INK}" stroke-width="1.6"/>
<rect x="48" y="90" width="24" height="6" rx="1.5" fill="#B99A45" stroke="${INK}" stroke-width="1.8"/>
<path d="M60 72 l1.8 3.6 4 .6 -2.9 2.8 .7 4 -3.6-1.9 -3.6 1.9 .7-4 -2.9-2.8 4-.6 Z" fill="${INK}"/>`;
}

function tape() {
  return `<path d="M14 40 L106 86" stroke="#FF625C" stroke-width="9" stroke-linecap="round"/><path d="M14 40 L106 86" stroke="${INK}" stroke-width="9" stroke-dasharray="6 6" stroke-opacity=".55"/>
<path d="M106 40 L14 86" stroke="#FF625C" stroke-width="9" stroke-linecap="round"/><path d="M106 40 L14 86" stroke="${INK}" stroke-width="9" stroke-dasharray="6 6" stroke-opacity=".55"/>`;
}

function daoBanners(tier: number, c: string) {
  let s = "";
  const xs = [18, 102, 26, 94].slice(0, tier + 1);
  xs.forEach((x, i) => {
    s += `<path d="M${x} 98 V${62 - i * 2}" stroke="${INK}" stroke-width="2"/><path d="M${x} ${62 - i * 2} h${x < 60 ? 10 : -10} l${x < 60 ? -3 : 3} 5 l${x < 60 ? 3 : -3} 5 h${x < 60 ? -10 : 10} Z" fill="${c}" stroke="${INK}" stroke-width="1.4"/>`;
  });
  return `<g class="fk-dao-deco">${s}</g>`;
}

function crown(rank: 1 | 2 | 3) {
  const c = rank === 1 ? "#E8C66A" : rank === 2 ? "#C9D2DE" : "#D08A55";
  return `<g transform="translate(60 6)"><path d="M-11 8 L-11 -2 L-5.5 3 L0 -5 L5.5 3 L11 -2 L11 8 Z" fill="${c}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><text x="0" y="7" text-anchor="middle" font-size="8" font-weight="900" fill="${INK}" font-family="system-ui,sans-serif">${rank}</text></g>`;
}

/* ---------- compose ---------- */

export function landmarkSvg(spec: LandmarkSpec): string {
  const { type, status } = spec;
  const lv = spec.level;
  const p = [...spec.palette];
  const parts: string[] = [];
  const shownLevel = status === "planning" ? 1 : lv;

  if (status === "live" && spec.animate !== false) parts.push(beams(p[0], p[1], Math.min(5, 2 + lv)));
  else if (status === "live") parts.push(beams(p[0], p[1], 2));
  if (lv >= 5 && status !== "planning" && status !== "cancelled") {
    // LEGEND: halo arch behind everything.
    parts.push(`<path class="lm-halo" d="M10 92 Q60 -14 110 92" fill="none" stroke="${p[2]}" stroke-width="4" stroke-opacity=".75"/><path d="M10 92 Q60 -14 110 92" fill="none" stroke="${INK}" stroke-width="1.2" stroke-opacity=".6"/>`);
  }
  parts.push(platform(p[0], shownLevel));
  if (status === "funding") parts.push(fundingRing(spec.fundingPct ?? 0, "#B6F05C"));
  if (spec.daoTier) parts.push(daoBanners(spec.daoTier, p[2]));
  if (status === "planning") {
    parts.push(`<g opacity=".55">${BODY[type](1, p)}</g>`);
    parts.push(scaffold());
  } else {
    // Level 4+: a giant alien standing behind the stage.
    if (shownLevel >= 4) parts.push(alien(shownLevel >= 5 ? 92 : 88, 84, shownLevel >= 5 ? 1.25 : 1.0, p[1], p[2], "lm-idle"));
    if (shownLevel >= 4) parts.push(`<path d="M18 92 L28 74 L38 92 Z" fill="${p[2]}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>`); // second area tent
    const k = 1.08 + shownLevel * 0.05;
    parts.push(`<g transform="translate(60 92) scale(${f(k)}) translate(-60 -92)">${BODY[type](shownLevel, p)}</g>`);
    if (shownLevel >= 2) parts.push(speaker(28, 96, 12 + shownLevel * 2) + speaker(92, 96, 12 + shownLevel * 2));
    if (shownLevel >= 2 && shownLevel < 4) parts.push(flags(3 + shownLevel, p));
    parts.push(booth(60, 96, p[2]));
    parts.push(alien(60, 84, 0.42, p[1], p[0], "lm-idle"));
    if (shownLevel >= 3) parts.push(crowd(shownLevel * 3, p));
  }
  if (status === "completed") parts.push(monument());
  if (status === "cancelled") parts.push(tape());
  if (spec.rank) parts.push(crown(spec.rank));

  const cls = ["lm", `lm-${status}`, `lm-lv${lv}`, spec.animate === false ? "lm-still" : ""].filter(Boolean).join(" ");
  return `<svg class="${cls}" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${parts.join("")}</svg>`;
}

/** Far-zoom token: a small glowing orb with the level number and status glyph. */
export function orbSvg(level: EventLevel, status: MapStatus, color: string): string {
  const m = STATUS_META[status];
  const dim = status === "cancelled" || status === "completed";
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
<circle cx="20" cy="20" r="17" fill="${color}" opacity="${dim ? 0.12 : 0.22}"/>
<circle cx="20" cy="20" r="12" fill="#151B26" stroke="${dim ? "#6B7380" : color}" stroke-width="3"/>
<text x="20" y="24.5" text-anchor="middle" font-size="12" font-weight="900" fill="#F5F2EA" font-family="system-ui,sans-serif">${level}</text>
<circle cx="31" cy="9" r="6.5" fill="${m.color}" stroke="${INK}" stroke-width="1.6"/><text x="31" y="12" text-anchor="middle" font-size="8" font-weight="900" fill="${INK}" font-family="system-ui,sans-serif">${m.glyph}</text>
</svg>`;
}

/**
 * External events (lib/discovery) are not FREAKTOPIA festivals, so they get no landmark or level:
 * a map pin whose head SHAPE says the kind (never colour alone):
 * major festival = star, DJ show = disc, club = square, other music = triangle.
 */
export type ExternalMarkerKind = "major_festival" | "dj_show" | "club_event" | "other";
export const EXTERNAL_MARKER_LABEL: Record<ExternalMarkerKind, string> = { major_festival: "Major festival", dj_show: "DJ show", club_event: "Club event", other: "Music event" };
export const externalMarkerKind = (category: string): ExternalMarkerKind => (category === "major_festival" || category === "dj_show" || category === "club_event" ? category : "other");

export function externalMarkerSvg(kind: ExternalMarkerKind, approximate: boolean): string {
  const c = { major_festival: "#E8C66A", dj_show: "#66DFFF", club_event: "#B78BFF", other: "#F2EBDD" }[kind];
  const head =
    kind === "major_festival"
      ? `<path d="M60 18l9.4 19 21 3-15.2 14.8 3.6 20.9L60 65.8 41.2 75.7l3.6-20.9L29.6 40l21-3z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`
      : kind === "dj_show"
        ? `<circle cx="60" cy="46" r="26" fill="${c}" stroke="${INK}" stroke-width="4"/><circle cx="60" cy="46" r="9" fill="${INK}"/><circle cx="60" cy="46" r="3" fill="${c}"/>`
        : kind === "club_event"
          ? `<rect x="36" y="22" width="48" height="48" rx="8" fill="${c}" stroke="${INK}" stroke-width="4"/><path d="M46 56V36l14 10 14-10v20" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`
          : `<path d="M60 20l28 48H32z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><circle cx="60" cy="54" r="5" fill="${INK}"/>`;
  // Approximate (city-centre) locations get a dashed stem and no ground dot: never drawn as a venue pin.
  const stem = approximate
    ? `<path d="M60 74v34" stroke="${c}" stroke-width="4" stroke-dasharray="5 5"/>`
    : `<path d="M60 74v32" stroke="${c}" stroke-width="5"/><ellipse cx="60" cy="110" rx="12" ry="4" fill="${c}" opacity=".55"/>`;
  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${stem}${head}</svg>`;
}
