import { describe, expect, it } from "vitest";
import { BASE_ACCESSORIES, COLOR_KEYS, EYES, FAMILIES, MOUTHS, OUTFITS, PATTERNS, SPECIALS, toLook, validateCosmetics } from "@/lib/alien/catalog";
import { rollAlien, traitsFor } from "@/lib/alien/generate";
import { hashPassword, verifyPassword } from "@/lib/auth/crypto";
import { safeReturnTo, sameOrigin } from "@/lib/auth/http";

describe("alien generation", () => {
  it("derives the same traits from the same seed (deterministic, re-renderable)", () => {
    const a = rollAlien();
    expect(a.seed).toMatch(/^[0-9a-f]{32}$/);
    expect(traitsFor(a.seed)).toEqual(a.traits);
    expect(a.assetVersion).toBe(1);
  });

  it("uses fresh secure randomness for each roll and covers every family and part", () => {
    const rolls = Array.from({ length: 600 }, rollAlien);
    expect(new Set(rolls.map((r) => r.seed)).size).toBe(600);
    const seen = (k: keyof (typeof rolls)[0]["traits"]) => new Set(rolls.map((r) => r.traits[k]));
    expect([...seen("family")].sort()).toEqual([...FAMILIES].sort());
    for (const r of rolls) {
      const t = r.traits;
      expect(COLOR_KEYS).toContain(t.bodyColor);
      expect(t.accentColor).not.toBe(t.bodyColor);
      expect(EYES).toContain(t.eyes);
      expect(MOUTHS).toContain(t.mouth);
      expect(PATTERNS).toContain(t.pattern);
      expect(SPECIALS).toContain(t.special);
      expect(BASE_ACCESSORIES).toContain(t.accessory);
      expect(OUTFITS).toContain(t.outfit);
      expect(t.name).toMatch(/^[A-Z]+-\d{2}$/);
    }
    expect(seen("eyes").size).toBe(EYES.length);
    expect(seen("pattern").size).toBe(PATTERNS.length);
  });

  it("maps the identity onto the renderer's look", () => {
    const { traits } = rollAlien();
    const look = toLook(traits);
    expect(look.species).toBe(traits.family);
    expect(look.eyes).toBe(traits.eyes);
  });

  it("only lets outfit, outfit colour and accessory change, and earned accessories need ownership", () => {
    expect(validateCosmetics({ outfit: "kimono", outfitColor: "mint", accessory: "halo" })).toBeNull();
    expect(validateCosmetics({ accessory: "crown" })).toBe("accessory");
    expect(validateCosmetics({ accessory: "crown" }, ["crown"])).toBeNull();
    expect(validateCosmetics({ outfit: "spacesuit" as never })).toBe("outfit");
  });
});

describe("auth primitives", () => {
  it("hashes passwords with scrypt and never stores plaintext", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(h).not.toContain("correct horse battery");
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong horse battery", h)).toBe(false);
    expect(await verifyPassword("anything", null)).toBe(false);
    expect(await hashPassword("correct horse battery")).not.toBe(h); // salted
  });

  it("blocks cross-site state changes (CSRF)", () => {
    const r = (h: Record<string, string>) => new Request("http://localhost:3000/api/auth/signin", { method: "POST", headers: { host: "localhost:3000", ...h } });
    expect(sameOrigin(r({ origin: "http://localhost:3000", "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(sameOrigin(r({ origin: "https://evil.example" }))).toBe(false);
    expect(sameOrigin(r({ "sec-fetch-site": "cross-site" }))).toBe(false);
  });

  it("only accepts same-site relative return paths", () => {
    expect(safeReturnTo("/ja/world")).toBe("/ja/world");
    expect(safeReturnTo("//evil.example")).toBe("/");
    expect(safeReturnTo("https://evil.example")).toBe("/");
    expect(safeReturnTo("/\\evil")).toBe("/");
  });
});
