/**
 * AI STAGE DESIGNER: concept specs, instruction-based edits, budget reference
 * estimates and the prompt sent to an image model.
 *
 * Demo provider ("demo-compositor") renders each concept as vector layers composited
 * on top of the real venue photo, so walls, ceiling, pillars, floor and camera angle are
 * untouched by construction. A production image model receives the same photo, a mask
 * of the stage zone and buildPrompt() (see lib/dao/providers.ts).
 */
import { THEME_META } from "./meta";
import type { BudgetLine, ConceptSpec, ConceptVersion, Layout, StageTheme, VenueSpec } from "./types";

const LAYOUTS: Layout[] = ["center", "wide", "split", "arch", "tower"];

const THEME_BASE: Record<StageTheme, Partial<ConceptSpec>> = {
  alien_invasion: { booth: "ufo", installation: "tentacles", alienCount: 2, alienScale: 1.2, beams: 8, lasers: true, haze: 0.5 },
  cyber_rave: { booth: "pod", installation: "rings", alienCount: 1, alienScale: 0.8, beams: 10, lasers: true, ledScreens: 3, haze: 0.4 },
  psychedelic_jungle: { booth: "altar", installation: "vines", alienCount: 2, alienScale: 1, beams: 6, lasers: false, haze: 0.6 },
  underground_warehouse: { booth: "crate", installation: "pipes", alienCount: 0, alienScale: 0.8, beams: 6, lasers: false, ledScreens: 0, haze: 0.7 },
  cosmic_portal: { booth: "pod", installation: "orbs", alienCount: 1, alienScale: 1.1, beams: 8, lasers: true, haze: 0.4 },
  mutant_carnival: { booth: "skull", installation: "tentacles", alienCount: 3, alienScale: 0.9, beams: 7, lasers: false, haze: 0.3 },
  neon_industrial: { booth: "crate", installation: "pipes", alienCount: 1, alienScale: 0.9, beams: 9, lasers: true, ledScreens: 2, haze: 0.5 },
  custom: { booth: "pod", installation: "orbs", alienCount: 1, alienScale: 1, beams: 6, lasers: false, haze: 0.4 },
};

const NAMES: Record<StageTheme, string[]> = {
  alien_invasion: ["MOTHERSHIP DESCENT", "TRACTOR BEAM", "FIRST CONTACT", "ABDUCTION DECK", "SAUCER SWARM"],
  cyber_rave: ["GRIDLOCK", "CHROME POD", "SYNTH CATHEDRAL", "PACKET STORM", "NEON KERNEL"],
  psychedelic_jungle: ["SPORE CANOPY", "VINE TEMPLE", "FUNGAL BLOOM", "UV THICKET", "MOSS ALTAR"],
  underground_warehouse: ["RAW CONCRETE", "CRATE STACK", "SODIUM HAZE", "PIPE ORGAN", "LOADING BAY"],
  cosmic_portal: ["EVENT HORIZON", "RING GATE", "ORBIT ALTAR", "WORMHOLE", "STAR NURSERY"],
  mutant_carnival: ["FREAK PARADE", "BIG TOP OOZE", "RINGMASTER", "SIDESHOW SLIME", "CANDY MUTANT"],
  neon_industrial: ["STEEL GLOW", "TRUSS LINES", "VOLT YARD", "TUBE FORGE", "SIGNAL PLANT"],
  custom: ["CONCEPT A", "CONCEPT B", "CONCEPT C", "CONCEPT D", "CONCEPT E"],
};

const VARIANTS: Partial<ConceptSpec>[] = [
  {},
  { ledSides: true, beams: 12, alienScale: 1.4 },
  { ledScreens: 1, lasers: false, haze: 0.3, alienCount: 1 },
  { ledScreens: 2, installation: "rings", speakerDeco: true },
  { beams: 4, ledScreens: 0, alienScale: 0.7, speakerDeco: false, haze: 0.2 },
];

function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function clampSpec(s: ConceptSpec): ConceptSpec {
  const c = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
  return {
    ...s,
    ledScreens: Math.round(c(s.ledScreens, 0, 3)),
    beams: Math.round(c(s.beams, 0, 16)),
    alienScale: Math.round(c(s.alienScale, 0.5, 1.8) * 100) / 100,
    alienCount: Math.round(c(s.alienCount, 0, 3)),
    haze: Math.round(c(s.haze, 0, 1) * 100) / 100,
  };
}

/** 3–5 concepts for a theme; deterministic for a given seed. */
export function generateConceptSpecs(theme: StageTheme, count: number, seed: string, venue: VenueSpec): { name: string; spec: ConceptSpec; description: string }[] {
  const n = Math.min(5, Math.max(3, count));
  const meta = THEME_META[theme];
  const base = THEME_BASE[theme];
  const h = hashStr(seed + theme);
  const lowCeiling = venue.ceilingHeightM > 0 && venue.ceilingHeightM < 4;
  return Array.from({ length: n }, (_, i) => {
    const v = VARIANTS[(i + (h % VARIANTS.length)) % VARIANTS.length];
    const palette: [string, string, string] = i % 2 ? [meta.palette[1], meta.palette[0], meta.palette[2]] : meta.palette;
    const spec = clampSpec({
      layout: LAYOUTS[(i + h) % LAYOUTS.length],
      palette,
      ledScreens: 2,
      ledSides: false,
      beams: 8,
      lasers: false,
      alienScale: 1,
      alienCount: 1,
      booth: "pod",
      speakerDeco: true,
      installation: "orbs",
      haze: 0.4,
      pyroFx: false,
      ...base,
      ...v,
      // Respect the venue: low ceilings get no tower layout and smaller sculptures.
      ...(lowCeiling ? { layout: (i % 2 ? "wide" : "center") as Layout, alienScale: Math.min(0.9, (v.alienScale ?? base.alienScale ?? 1)) } : {}),
      ...(venue.safetyRestrictions.some((r) => /haze|smoke|スモーク/i.test(r)) ? { haze: 0 } : {}),
    });
    fitToCeiling(spec, venue.ceilingHeightM);
    const name = NAMES[theme][i % 5];
    return { name, spec, description: describe(theme, spec) };
  });
}

export function describe(theme: StageTheme, s: ConceptSpec) {
  const parts = [
    `${THEME_META[theme].label} concept with a ${s.layout} layout`,
    s.ledScreens ? `${s.ledScreens} LED screen${s.ledScreens > 1 ? "s" : ""} behind a ${s.booth} DJ booth` : `a ${s.booth} DJ booth without a back screen`,
    s.ledSides ? "side LED columns" : null,
    s.beams ? `${s.beams} moving-head beams${s.lasers ? " plus laser fans" : ""}` : null,
    s.alienCount ? `${s.alienCount} alien sculpture${s.alienCount > 1 ? "s" : ""} (scale ${s.alienScale}×)` : null,
    s.installation !== "none" ? `${s.installation} art installation` : null,
    s.speakerDeco ? "wrapped speaker stacks" : null,
  ].filter(Boolean);
  return parts.join(", ") + ".";
}

/* ---------- edits from natural language ---------- */

const COLORS: [RegExp, string][] = [
  [/紫|purple|violet/i, "#A276E9"],
  [/緑|green|acid|lime/i, "#B6F05C"],
  [/赤|red|coral/i, "#FF625C"],
  [/青|blue|cyan/i, "#55BCEB"],
  [/橙|オレンジ|orange|amber/i, "#FFAD5B"],
  [/ピンク|pink|magenta/i, "#FF4FD8"],
  [/白|white/i, "#F5F2EA"],
];

export function applyInstruction(spec: ConceptSpec, text: string): { spec: ConceptSpec; applied: string[]; ignored: string[] } {
  let s = { ...spec };
  const applied: string[] = [];
  const clauses = text
    .split(/[。.!\n;；、,]/)
    .map((c) => c.trim())
    .filter(Boolean);
  const ignored: string[] = [];
  for (const c of clauses.length ? clauses : [text]) {
    let hit = false;
    const bigger = /大きく|でかく|bigger|larger|huge|giant/i.test(c);
    const smaller = /小さく|smaller|tiny/i.test(c);
    if (/宇宙人|エイリアン|alien|sculpture|彫刻/i.test(c)) {
      if (bigger) (s.alienScale *= 1.35), applied.push("Alien sculptures enlarged");
      else if (smaller) (s.alienScale *= 0.7), applied.push("Alien sculptures reduced");
      else if (/増や|more|add|追加/i.test(c)) (s.alienCount += 1), applied.push("Added an alien sculpture");
      else if (/なし|消|remove|no /i.test(c)) (s.alienCount = 0), applied.push("Removed alien sculptures");
      else (s.alienScale *= 1.2), applied.push("Alien sculptures emphasised");
      hit = true;
    }
    if (/LED|スクリーン|screen|ビジョン/i.test(c)) {
      if (/左右|両側|両サイド|side|sides|both/i.test(c)) (s.ledSides = true), applied.push("LED columns added left and right");
      else if (/なし|消|remove|no /i.test(c)) (s.ledScreens = 0), (s.ledSides = false), applied.push("LED screens removed");
      else (s.ledScreens += 1), applied.push("Extra LED screen added");
      hit = true;
    }
    if (/レーザー|laser/i.test(c)) {
      s.lasers = !/なし|消|remove|no /i.test(c);
      applied.push(s.lasers ? "Laser fans added" : "Lasers removed");
      hit = true;
    }
    if (/スモーク|ヘイズ|haze|smoke|fog/i.test(c)) {
      s.haze = /なし|消|remove|no |少な|less/i.test(c) ? 0 : Math.min(1, s.haze + 0.3);
      applied.push(s.haze ? "More haze" : "Haze removed");
      hit = true;
    }
    if (/照明|ライト|light|beam|ビーム/i.test(c) || COLORS.some(([r]) => r.test(c))) {
      const picked = COLORS.filter(([r]) => r.test(c)).map(([, v]) => v);
      if (picked.length) {
        const p: [string, string, string] = [picked[0], picked[1] ?? picked[0], s.palette[2]];
        s.palette = p;
        applied.push(`Lighting palette changed to ${picked.length > 1 ? "two colours" : "one colour"}`);
        hit = true;
      }
      if (/増や|more|add|追加|派手/i.test(c)) (s.beams += 4), applied.push("More beams"), (hit = true);
      if (/減ら|less|fewer|控えめ/i.test(c)) (s.beams -= 3), applied.push("Fewer beams"), (hit = true);
    }
    if (/予算|安く|抑え|節約|cheaper|budget|low.?cost|save/i.test(c)) {
      s = { ...s, ledScreens: Math.min(s.ledScreens, 1), ledSides: false, lasers: false, beams: Math.min(s.beams, 6), alienScale: Math.min(s.alienScale, 1), alienCount: Math.min(s.alienCount, 1), pyroFx: false, speakerDeco: false };
      applied.push("Budget version: fewer screens, no lasers, smaller sculptures");
      hit = true;
    }
    if (/ブース|booth/i.test(c)) {
      const m = /ufo|円盤/i.test(c) ? "ufo" : /pod|ポッド/i.test(c) ? "pod" : /crate|木箱/i.test(c) ? "crate" : /skull|骸骨/i.test(c) ? "skull" : /altar|祭壇/i.test(c) ? "altar" : null;
      if (m) (s.booth = m as ConceptSpec["booth"]), applied.push(`Booth changed to ${m}`), (hit = true);
    }
    if (!/宇宙人|エイリアン|alien/i.test(c) && /中央|center|centre/i.test(c)) (s.layout = "center"), applied.push("Centred layout"), (hit = true);
    if (/ワイド|横長|wide/i.test(c)) (s.layout = "wide"), applied.push("Wide layout"), (hit = true);
    if (/炎|火|pyro|flame|CO2/i.test(c)) {
      s.pyroFx = !/なし|消|remove|no /i.test(c);
      applied.push(s.pyroFx ? "Flame/CO2 effects added (needs fire-safety approval)" : "Flame effects removed");
      hit = true;
    }
    if (!hit) ignored.push(c);
  }
  return { spec: clampSpec(s), applied, ignored };
}

/* ---------- budget reference estimate ---------- */

export function estimate(spec: ConceptSpec, venue: VenueSpec): { low: number; high: number; lines: BudgetLine[]; basis: "ai_reference_estimate" } {
  const scale = Math.max(0.6, Math.min(2.2, Math.sqrt(Math.max(100, venue.capacity) / 1000)));
  const lines: BudgetLine[] = [];
  const add = (item: string, low: number, high: number, n = 1) => n > 0 && lines.push({ item: n > 1 ? `${item} ×${n}` : item, low: Math.round(low * n * scale), high: Math.round(high * n * scale) });
  add("LED screen (rental, per screen)", 2_500, 7_000, spec.ledScreens);
  if (spec.ledSides) add("Side LED columns (pair)", 3_000, 8_000);
  add("Moving-head beams (rental)", 140, 380, spec.beams);
  if (spec.lasers) add("Laser fans + certified operator", 2_000, 6_000);
  add("Alien sculpture (fabrication)", 1_200 * spec.alienScale ** 2, 4_500 * spec.alienScale ** 2, spec.alienCount);
  add(`DJ booth build (${spec.booth})`, 1_500, 5_500);
  if (spec.speakerDeco) add("Speaker wraps / scenic", 600, 2_000);
  if (spec.installation !== "none") add(`Art installation (${spec.installation})`, 1_500, 6_000);
  if (spec.haze > 0) add("Haze machines + fluid", 250, 900);
  if (spec.pyroFx) add("CO2 / flame FX + licensed pyro technician", 3_000, 9_000);
  add("Rigging, crew & transport", 2_000, 7_500);
  const low = lines.reduce((a, l) => a + l.low, 0);
  const high = lines.reduce((a, l) => a + l.high, 0);
  return { low, high, lines, basis: "ai_reference_estimate" };
}

/** Rough power draw (kW) of the concept's lighting/video/FX for feasibility checks. */
/**
 * Shrink a concept until its tallest element keeps 0.5 m clearance under the ceiling
 * (same rule as the structural feasibility check). Open-air venues (0 m) are left alone.
 * Order: smaller sculptures → no tower → no rear LED wall → no sculptures.
 */
function fitToCeiling(spec: ConceptSpec, ceilingM: number) {
  if (!(ceilingM > 0)) return spec;
  const max = ceilingM - 0.5;
  while (heightNeedM(spec) > max && spec.alienScale > 0.5) spec.alienScale = Math.max(0.5, Math.round((spec.alienScale - 0.1) * 10) / 10);
  if (heightNeedM(spec) > max && spec.layout === "tower") spec.layout = "center";
  if (heightNeedM(spec) > max) spec.ledScreens = 0;
  if (heightNeedM(spec) > max) spec.alienCount = 0;
  return spec;
}

export function powerDrawKw(spec: ConceptSpec) {
  return Math.round((spec.ledScreens * 4.5 + (spec.ledSides ? 6 : 0) + spec.beams * 0.5 + (spec.lasers ? 2.5 : 0) + spec.haze * 1.5 + 3) * 10) / 10;
}

/** Height (m) the tallest element needs. */
export function heightNeedM(spec: ConceptSpec) {
  const tower = spec.layout === "tower" ? 1.6 : 1;
  return Math.round((2.2 + spec.alienScale * 2.4 * (spec.alienCount ? 1 : 0.4) + (spec.ledScreens ? 0.8 : 0)) * tower * 10) / 10;
}

export function buildPrompt(theme: StageTheme, spec: ConceptSpec, venue: VenueSpec, customTheme?: string, instruction?: string) {
  return [
    `Edit the provided photo of ${venue.name} (${venue.setting}, capacity ${venue.capacity}).`,
    "KEEP UNCHANGED: building shape, walls, ceiling, pillars, floor, windows, the camera angle and perspective.",
    "Only add temporary event production inside the masked stage zone and on the lighting rig above it.",
    `Theme: ${customTheme || THEME_META[theme].label}. Palette ${spec.palette.join(", ")}.`,
    `Elements: ${describe(theme, spec)}`,
    instruction ? `Requested change: ${instruction}` : "",
    "Original FREAKTOPIA-style alien characters only; no logos, brands or real people.",
    "Output is an AI concept visual, not a construction plan.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function newVersion(prev: ConceptVersion | null, spec: ConceptSpec, venue: VenueSpec, theme: StageTheme, by: string, now: number, extra: Partial<ConceptVersion> = {}): ConceptVersion {
  return {
    version: (prev?.version ?? 0) + 1,
    spec,
    applied: [],
    ignored: [],
    createdAt: now,
    createdBy: by,
    provider: "demo-compositor",
    prompt: buildPrompt(theme, spec, venue, undefined, extra.instruction),
    estimate: estimate(spec, venue),
    ...extra,
  };
}
