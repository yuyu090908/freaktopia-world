"use client";

import { createContext, useCallback, useContext } from "react";
import { usePathname } from "next/navigation";
import { z } from "zod";
import { DEFAULT_LOCALE, localizedPath, splitLocalePath, type Locale } from "@/i18n/config";

/** Zod's built-in validation messages in the visitor's language (custom form messages are translation keys). */
const ZOD_LOCALE: Record<Locale, () => Parameters<typeof z.config>[0]> = {
  en: z.locales.en, ja: z.locales.ja, ko: z.locales.ko, "zh-CN": z.locales.zhCN, ru: z.locales.ru, th: z.locales.th,
  es: z.locales.es, pt: z.locales.ptBR, fr: z.locales.fr, de: z.locales.de, vi: z.locales.vi, id: z.locales.id,
};

const Ctx = createContext<{ locale: Locale; prefixed: boolean }>({ locale: DEFAULT_LOCALE, prefixed: false });

export function LocaleProvider({ locale, prefixed, children }: { locale: Locale; prefixed: boolean; children: React.ReactNode }) {
  z.config(ZOD_LOCALE[locale]());
  return <Ctx.Provider value={{ locale, prefixed }}>{children}</Ctx.Provider>;
}

export const useLocaleInfo = () => useContext(Ctx);

/** The app path without a /ja-style prefix, whichever form the browser shows. */
export function useCleanPath() {
  return splitLocalePath(usePathname() || "/").rest;
}

/** Keeps the /ja prefix on links when the visitor arrived on a prefixed URL. */
export function useLocalHref() {
  const { locale, prefixed } = useContext(Ctx);
  return useCallback((href: string) => (prefixed && href.startsWith("/") && !href.startsWith("//") ? localizedPath(locale, href) : href), [locale, prefixed]);
}
