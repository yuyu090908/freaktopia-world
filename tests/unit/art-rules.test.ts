import { describe, expect, it } from "vitest";
import { ART, CITY_ART, TICKET_ART, cityArt, coverFor, distinctCovers } from "@/lib/art";

describe("official image registry and cover rules", () => {
  it("has ten city posters with metadata and five ticket designs", () => {
    expect(CITY_ART).toHaveLength(10);
    for (const c of CITY_ART) {
      expect(c.poster).toBeTruthy();
      expect(c.scene).toBeTruthy();
      expect(c.accent).toMatch(/^#[0-9A-F]{6}$/i);
    }
    expect(new Set(CITY_ART.map((c) => c.id)).size).toBe(10);
    expect(Object.keys(TICKET_ART)).toEqual(["basic", "silver", "gold", "vip", "legend"]);
  });

  it("finds a city's own poster and never a look-alike", () => {
    expect(cityArt("Berlin")?.id).toBe("berlin");
    expect(cityArt("rio de janeiro")?.id).toBe("rio");
    expect(cityArt("São Paulo")).toBeNull();
    expect(cityArt("New York")).toBeNull(); // no official New York poster yet
    expect(cityArt(null)).toBeNull();
  });

  it("picks covers by rule: organizer → city → genre → shared scene", () => {
    expect(coverFor("a", { image: ART.logo, city: "Berlin" }).source).toBe("organizer");
    const berlin = coverFor("a", { city: "Berlin", genres: ["House"] });
    expect(berlin.source).toBe("city");
    expect(berlin.src).toBe(CITY_ART[0].scene);
    expect(coverFor("a", { city: "Seoul", genres: ["Techno"] })).toMatchObject({ source: "genre", src: ART.panelStage });
    expect(coverFor("a", { city: "Seoul", genres: [] }).source).toBe("fallback");
    // Stable: the same input always gives the same picture.
    expect(coverFor("xyz").src).toBe(coverFor("xyz").src);
  });

  it("never shows the same picture twice in a row in a list", () => {
    const list = [
      { id: "1", city: "Amsterdam", genres: ["Techno"] },
      { id: "2", city: "Amsterdam", genres: ["Techno"] },
      { id: "3", city: "Seoul", genres: ["Techno"] },
      { id: "4", city: "Seoul", genres: ["Techno"] },
    ];
    const m = distinctCovers(list);
    const srcs = list.map((x) => m.get(x.id)!.src);
    for (let i = 1; i < srcs.length; i++) expect(srcs[i]).not.toBe(srcs[i - 1]);
    expect(m.get("1")!.source).toBe("city");
  });
});
