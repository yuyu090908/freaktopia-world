/**
 * Exports the alien families as standalone SVG sprites for a future 2D game map:
 *   public/aliens/<family>/{portrait,full,idle,walk,dance,emote}.svg + public/aliens/manifest.json
 * Each user's alien is still drawn live from its parts (components/art/Alien.tsx); these files are the
 * family bases, cacheable forever (versioned by ALIEN_ASSET_VERSION).
 * Run: npx vite-node scripts/export-aliens.tsx
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AlienG } from "@/components/art/Alien";
import { ALIEN_ASSET_VERSION, BASE_ACCESSORIES, BODY_COLORS, EYES, FAMILIES, MOUTHS, OUTFITS, PATTERNS, SPECIALS, toLook, type AlienFamily, type AlienTraits } from "@/lib/alien/catalog";

const BASE: Record<AlienFamily, Omit<AlienTraits, "name" | "family">> = {
  slime: { bodyColor: "lime", accentColor: "coral", eyes: "duo", mouth: "grin", pattern: "none", accessory: "none", outfit: "none", outfitColor: "violet", special: "none" },
  fuzz: { bodyColor: "violet", accentColor: "tangerine", eyes: "trio", mouth: "zigzag", pattern: "none", accessory: "none", outfit: "none", outfitColor: "sky", special: "none" },
  mutant: { bodyColor: "coral", accentColor: "lemon", eyes: "stalks", mouth: "fangs", pattern: "spots", accessory: "none", outfit: "none", outfitColor: "lime", special: "none" },
  jelly: { bodyColor: "sky", accentColor: "lime", eyes: "duo", mouth: "o", pattern: "none", accessory: "none", outfit: "none", outfitColor: "tangerine", special: "none" },
};

const POSES = {
  portrait: { viewBox: "15 -38 170 175", css: "", extra: "" },
  full: { viewBox: "0 -40 200 250", css: "", extra: "" },
  idle: { viewBox: "0 -40 200 250", css: "@keyframes a{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}.a{animation:a 2.4s ease-in-out infinite}", extra: "" },
  walk: { viewBox: "0 -40 200 250", css: "@keyframes a{0%,100%{transform:translateY(0) rotate(-4deg)}25%{transform:translateY(-8px) rotate(0)}50%{transform:translateY(0) rotate(4deg)}75%{transform:translateY(-8px) rotate(0)}}.a{animation:a .9s linear infinite;transform-origin:100px 200px}", extra: "" },
  dance: { viewBox: "0 -40 200 250", css: "@keyframes a{0%,100%{transform:rotate(-10deg) scaleY(1)}50%{transform:rotate(10deg) scaleY(.92)}}.a{animation:a .47s ease-in-out infinite;transform-origin:100px 200px}", extra: "" },
  emote: {
    viewBox: "0 -40 200 250",
    css: "@keyframes a{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}.a{animation:a 1.2s ease-in-out infinite}@keyframes h{0%{opacity:0;transform:translateY(8px) scale(.6)}30%,80%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-10px)}}.h{animation:h 1.6s ease-out infinite;transform-origin:160px 20px}",
    extra: '<g class="h"><path d="M160 34 C140 18 140 -2 156 -2 C162 -2 166 4 160 10 C154 4 158 -2 164 -2 C180 -2 180 18 160 34 Z" transform="translate(0 0)" fill="#FF625C" stroke="#080808" stroke-width="4" stroke-linejoin="round"/></g>',
  },
} as const;

const out = join(process.cwd(), "public", "aliens");
const manifest = {
  assetVersion: ALIEN_ASSET_VERSION,
  licence: "Original artwork, FREAKTOPIA WORLD",
  frame: { width: 200, height: 250, anchor: { x: 100, y: 204 }, note: "anchor = feet centre, for placing on a 2D map tile" },
  poses: Object.keys(POSES),
  families: {} as Record<string, { files: Record<string, string>; base: object }>,
  parts: { bodyColors: BODY_COLORS, eyes: EYES, mouths: MOUTHS, patterns: PATTERNS, accessories: BASE_ACCESSORIES, outfits: OUTFITS, specials: SPECIALS },
};

for (const family of FAMILIES) {
  mkdirSync(join(out, family), { recursive: true });
  const look = toLook({ family, ...BASE[family] });
  const body = renderToStaticMarkup(createElement(AlienG, { look })).replace(/fkc[^"')]*/g, `fkc-${family}`);
  manifest.families[family] = { files: {}, base: BASE[family] };
  for (const [pose, p] of Object.entries(POSES)) {
    const reduce = p.css ? `@media (prefers-reduced-motion:reduce){*{animation:none!important}}` : "";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${p.viewBox}" width="${pose === "portrait" ? 170 : 200}" height="${pose === "portrait" ? 175 : 250}">${p.css ? `<style>${p.css}${reduce}</style>` : ""}<title>${family} ${pose}</title><ellipse cx="100" cy="204" rx="58" ry="7" opacity=".35"/><g class="a">${body}</g>${p.extra}</svg>\n`;
    writeFileSync(join(out, family, `${pose}.svg`), svg);
    manifest.families[family].files[pose] = `/aliens/${family}/${pose}.svg`;
  }
}
writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log("exported", FAMILIES.length * Object.keys(POSES).length, "sprites to", out);
