"use client";

import { useEffect } from "react";

/**
 * Script fonts for the non-Latin locales, loaded only for the language being shown.
 * Each font's @font-face CSS for Japanese, Korean and Chinese alone was ~30 KB gzipped and render-blocking on
 * every page in every language. Imported on demand, only the active locale's CSS loads, after first paint;
 * until then the system CJK/Thai fonts in the :lang() stacks (globals.css) are used (font-display: swap).
 */
const LOADERS: Record<string, () => Promise<{ default: { variable: string } }>> = {
  ja: () => import("./fonts/ja"),
  ko: () => import("./fonts/ko"),
  "zh-CN": () => import("./fonts/zh"),
  th: () => import("./fonts/th"),
  ru: () => import("./fonts/noto"),
  vi: () => import("./fonts/noto"),
};

export function LocaleFont({ locale }: { locale: string }) {
  useEffect(() => {
    const load = LOADERS[locale];
    if (!load) return;
    let cls = "";
    load().then((m) => {
      cls = m.default.variable;
      document.documentElement.classList.add(cls);
    });
    return () => {
      if (cls) document.documentElement.classList.remove(cls);
    };
  }, [locale]);
  return null;
}
