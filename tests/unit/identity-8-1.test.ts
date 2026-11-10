import { describe, expect, it } from "vitest";
import { formatAlienPublicId } from "@/lib/alien/catalog";
import { laterStep } from "@/lib/auth/types";
import { getCachedTranslation, putCachedTranslation, translationKey } from "@/lib/i18n/translation-cache";

describe("8.1 Alien ID", () => {
  it("formats as FREAK- plus eight digits", () => {
    expect(formatAlienPublicId(1284)).toBe("FREAK-00001284");
    expect(formatAlienPublicId(1)).toBe("FREAK-00000001");
    expect(formatAlienPublicId(12345678)).toMatch(/^FREAK-\d{8}$/);
  });
});

describe("8.1 onboarding steps only move forward", () => {
  it("never goes back to the Reveal", () => {
    expect(laterStep("name", "reveal")).toBe("name");
    expect(laterStep("genres", "name")).toBe("genres");
    expect(laterStep("done", "reveal")).toBe("done");
    expect(laterStep("reveal", "name")).toBe("name");
    expect(laterStep("name", "done")).toBe("done");
  });
});

describe("8.1 machine translation cache", () => {
  it("keys depend on provider, target language and text", () => {
    const k = translationKey("deepl", "ja", "hello");
    expect(k).toMatch(/^[0-9a-f]{64}$/);
    expect(translationKey("deepl", "ko", "hello")).not.toBe(k);
    expect(translationKey("other", "ja", "hello")).not.toBe(k);
  });
  it("returns stored results with the provider name so the UI can label them", async () => {
    delete process.env.DATABASE_URL;
    expect(await getCachedTranslation("deepl", "ja", "unit test text")).toBeNull();
    await putCachedTranslation("deepl", "ja", "unit test text", { text: "ユニットテスト", source: "EN", provider: "deepl" });
    expect(await getCachedTranslation("deepl", "ja", "unit test text")).toEqual({ text: "ユニットテスト", source: "EN", provider: "deepl" });
    expect(await getCachedTranslation("deepl", "ko", "unit test text")).toBeNull();
  });
});
