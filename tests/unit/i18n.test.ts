import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { IntlMessageFormat } from "intl-messageformat";
import { createTranslator } from "next-intl";
import { DEFAULT_LOCALE, LOCALES, LOCALE_META, fromAcceptLanguage, localizedPath, splitLocalePath, toLocale } from "@/i18n/config";
import { flatKeys, loadMessages, mergeDicts } from "@/i18n/messages";
import { formatEventDate, formatEventTime, formatMoney, formatNumber } from "@/lib/i18n/format";

const dir = path.join(process.cwd(), "messages");
const read = (l: string) => JSON.parse(fs.readFileSync(path.join(dir, `${l}.json`), "utf8"));
const en = read("en");
const enKeys = flatKeys(en).sort();
const leaf = (d: Record<string, unknown>, key: string) => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], d) as string;
const vars = (s: string) => [...s.matchAll(/\{(\w+)\s*[,}]/g)].map((m) => m[1]).sort();

describe("locale config", () => {
  it("has the 12 required languages, English first and as the fallback", () => {
    expect(LOCALES).toEqual(["en", "ja", "ko", "zh-CN", "ru", "th", "es", "pt", "fr", "de", "vi", "id"]);
    expect(DEFAULT_LOCALE).toBe("en");
    for (const l of LOCALES) expect(LOCALE_META[l].native.length).toBeGreaterThan(0);
  });

  it("parses Accept-Language with quality values and never maps Traditional Chinese to zh-CN", () => {
    expect(fromAcceptLanguage("ja-JP,ja;q=0.9,en;q=0.8")).toBe("ja");
    expect(fromAcceptLanguage("en;q=0.2, th-TH;q=0.9")).toBe("th");
    expect(fromAcceptLanguage("pt-BR")).toBe("pt");
    expect(fromAcceptLanguage("zh-CN,zh;q=0.9")).toBe("zh-CN");
    expect(fromAcceptLanguage("zh-TW")).toBeNull();
    expect(fromAcceptLanguage("zh-HK,zh-TW;q=0.9")).toBeNull();
    expect(fromAcceptLanguage("in-ID")).toBe("id");
    expect(fromAcceptLanguage("xx, yy")).toBeNull();
    expect(fromAcceptLanguage("")).toBeNull();
  });

  it("splits and builds locale-prefixed paths", () => {
    expect(splitLocalePath("/ja/world")).toEqual({ locale: "ja", rest: "/world" });
    expect(splitLocalePath("/zh-cn/live/x")).toEqual({ locale: "zh-CN", rest: "/live/x" });
    expect(splitLocalePath("/ja")).toEqual({ locale: "ja", rest: "/" });
    expect(splitLocalePath("/world")).toEqual({ locale: null, rest: "/world" });
    expect(splitLocalePath("/javascript")).toEqual({ locale: null, rest: "/javascript" });
    expect(localizedPath("zh-CN", "/world")).toBe("/zh-cn/world");
    expect(localizedPath("en", "/")).toBe("/en");
    expect(toLocale("ZH-cn")).toBe("zh-CN");
    expect(toLocale("zh-TW")).toBeNull();
  });
});

describe("dictionaries (missing-key detection)", () => {
  it("English has the full key set", () => {
    expect(enKeys.length).toBeGreaterThan(400);
  });

  for (const l of LOCALES.filter((x) => x !== "en")) {
    it(`${l}: same keys as English, no empty values, same placeholders, valid ICU`, () => {
      const d = read(l);
      const keys = flatKeys(d).sort();
      expect(keys.filter((k) => !enKeys.includes(k)), "extra keys").toEqual([]);
      expect(enKeys.filter((k) => !keys.includes(k)), "missing keys").toEqual([]);
      for (const k of enKeys) {
        const v = leaf(d, k);
        expect(typeof v === "string" && v.trim().length > 0, `empty ${k}`).toBe(true);
        expect(vars(v), `placeholders ${k}`).toEqual(vars(leaf(en, k)));
        expect(() => new IntlMessageFormat(v, l).format({ ...Object.fromEntries(vars(v).map((x) => [x, 2])), ...Object.fromEntries([...v.matchAll(/<(\w+)>/g)].map((m) => [m[1], (c: unknown) => c])), count: 2, name: "N", email: "e", price: "p", date: "d", time: "t", tz: "z", level: 1, rank: 1, provider: "P" }), `ICU ${k}`).not.toThrow();
      }
    });
  }

  it("falls back to English for a key a dictionary lacks", () => {
    const merged = mergeDicts(en, { common: { save: "保存" } });
    expect(leaf(merged, "common.save")).toBe("保存");
    expect(leaf(merged, "common.cancel")).toBe("Cancel");
  });

  it("loads one locale at a time and translates plurals per language", async () => {
    const ru = await loadMessages("ru");
    const t = createTranslator({ locale: "ru", messages: ru, namespace: "world" });
    expect(t("count", { count: 1 })).toBe("1 событие");
    expect(t("count", { count: 3 })).toBe("3 события");
    expect(t("count", { count: 5 })).toBe("5 событий");
    const ja = await loadMessages("ja");
    expect(createTranslator({ locale: "ja", messages: ja, namespace: "alien" })("born")).not.toBe(en.alien.born);
  });
});

describe("Intl formatting", () => {
  it("formats money and numbers per locale", () => {
    expect(formatMoney("en", 1234, "USD")).toBe("$1,234");
    expect(formatMoney("ja", 1234, "JPY")).toMatch(/1,234/);
    expect(formatMoney("de", 1234.5, "EUR", 2)).toMatch(/1\.234,50\s?€/);
    expect(formatMoney("fr", 1234, "EUR")).toMatch(/1\s?234\s?€/);
    expect(formatNumber("de", 1234567)).toBe("1.234.567");
    expect(formatNumber("en", 1234567)).toBe("1,234,567");
  });

  it("keeps event times in the venue's time zone, not the viewer's", () => {
    const iso = "2027-03-14T13:00:00Z";
    expect(formatEventTime("en", iso, "Asia/Tokyo")).toMatch(/10:00\s?PM/);
    expect(formatEventTime("en", iso, "America/Sao_Paulo")).toMatch(/10:00\s?AM/);
    expect(formatEventDate("ja", iso, "Asia/Tokyo")).toContain("2027");
    expect(formatEventDate("th", iso, "Asia/Bangkok")).toMatch(/2027|2570/);
  });
});
