"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback } from "react";
import { labelKey } from "@/lib/i18n/labels";

/** Translates a fixed English label from lib/ (see lib/i18n/labels.ts). Unknown text is shown as is. */
export function useTx() {
  const t = useTranslations("labels");
  const locale = useLocale();
  return useCallback((english: string) => {
    if (locale === "en") return english; // the source text is the English label (keeps its exact casing)
    const k = labelKey(english);
    return t.has(k) ? t(k) : english;
  }, [t, locale]);
}

export function Tx({ children }: { children: string }) {
  const tx = useTx();
  return <>{tx(children)}</>;
}
