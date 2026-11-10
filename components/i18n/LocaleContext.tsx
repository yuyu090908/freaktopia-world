"use client";

import { createContext, useCallback, useContext } from "react";
import { usePathname } from "next/navigation";
import { DEFAULT_LOCALE, localizedPath, splitLocalePath, type Locale } from "@/i18n/config";

const Ctx = createContext<{ locale: Locale; prefixed: boolean }>({ locale: DEFAULT_LOCALE, prefixed: false });

export function LocaleProvider({ locale, prefixed, children }: { locale: Locale; prefixed: boolean; children: React.ReactNode }) {
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
