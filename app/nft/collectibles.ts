import type { AlienLook } from "@/lib/types";

/** Preview-only collectibles. Nothing here is minted or on-chain. */
export const COLLECTIBLES: { id: string; name: string; edition: string; rarity: "Common" | "Rare" | "Mythic"; bg: string; look: AlienLook; desc: string }[] = [
  { id: "c-gloop-gold", name: "Golden Gloop", edition: "1 of 50", rarity: "Mythic", bg: "#FFAD5B", look: { species: "slime", body: "#FFAD5B", accent: "#A276E9", outfit: "kimono", outfitColor: "#080808", accessory: "crown" }, desc: "Awarded to the first supporters of a LV.5 event." },
  { id: "c-fuzz-neon", name: "Neon Fuzz", edition: "1 of 500", rarity: "Rare", bg: "#B6F05C", look: { species: "fuzz", body: "#FF625C", accent: "#55BCEB", outfit: "vest", outfitColor: "#55BCEB", accessory: "shades" }, desc: "Glows under blacklight. Probably." },
  { id: "c-vinyl-blue", name: "Blue Note Mutant", edition: "1 of 500", rarity: "Rare", bg: "#55BCEB", look: { species: "vinyl", body: "#55BCEB", accent: "#FFAD5B", outfit: "jacket", outfitColor: "#A276E9", accessory: "cap" }, desc: "A 12-inch head pressed on blue vinyl." },
  { id: "c-jelly-pink", name: "Coral Jelly", edition: "1 of 2,000", rarity: "Common", bg: "#FF625C", look: { species: "jelly", body: "#FF625C", accent: "#F5F2EA", outfit: "none", outfitColor: "#000", accessory: "antenna" }, desc: "Wobbly souvenir from a reef disco." },
  { id: "c-slime-violet", name: "Violet Ooze", edition: "1 of 2,000", rarity: "Common", bg: "#A276E9", look: { species: "slime", body: "#A276E9", accent: "#B6F05C", outfit: "hoodie", outfitColor: "#FFAD5B", accessory: "headphones" }, desc: "Leaves purple footprints everywhere." },
  { id: "c-fuzz-cream", name: "Cosmic Cream", edition: "1 of 100", rarity: "Mythic", bg: "#F5F2EA", look: { species: "fuzz", body: "#F5F2EA", accent: "#FF625C", outfit: "kimono", outfitColor: "#A276E9", accessory: "crown" }, desc: "Rumoured to appear only at sunrise sets." },
];
