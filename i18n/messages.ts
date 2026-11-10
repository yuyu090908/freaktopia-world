import type { Locale } from "./config";

type Dict = { [k: string]: string | Dict };

// Only the active locale (plus English for fallback) is loaded: each JSON is its own chunk.
const LOADERS: Record<Locale, () => Promise<{ default: Dict }>> = {
  en: () => import("@/messages/en.json"),
  ja: () => import("@/messages/ja.json"),
  ko: () => import("@/messages/ko.json"),
  "zh-CN": () => import("@/messages/zh-CN.json"),
  ru: () => import("@/messages/ru.json"),
  th: () => import("@/messages/th.json"),
  es: () => import("@/messages/es.json"),
  pt: () => import("@/messages/pt.json"),
  fr: () => import("@/messages/fr.json"),
  de: () => import("@/messages/de.json"),
  vi: () => import("@/messages/vi.json"),
  id: () => import("@/messages/id.json"),
};

/** Deep-merges b over a: keys missing in a locale fall back to English. */
export function mergeDicts(a: Dict, b: Dict): Dict {
  const out: Dict = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const base = out[k];
    out[k] = typeof v === "object" && typeof base === "object" ? mergeDicts(base, v) : v;
  }
  return out;
}

export async function loadMessages(locale: Locale): Promise<Dict> {
  const en = (await LOADERS.en()).default;
  if (locale === "en") return en;
  return mergeDicts(en, (await LOADERS[locale]()).default);
}

/** Every leaf key path ("nav.home") of a dictionary. */
export function flatKeys(d: Dict, prefix = ""): string[] {
  return Object.entries(d).flatMap(([k, v]) => (typeof v === "string" ? [prefix + k] : flatKeys(v, `${prefix}${k}.`)));
}

export type { Dict };
