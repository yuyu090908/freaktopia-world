import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_HEADER, PREFIX_HEADER, toLocale, type Locale } from "./config";
import { loadMessages } from "./messages";

export async function currentLocale(): Promise<{ locale: Locale; prefixed: boolean }> {
  const h = await headers();
  const fromHeader = toLocale(h.get(LOCALE_HEADER));
  if (fromHeader) return { locale: fromHeader, prefixed: h.get(PREFIX_HEADER) === "1" };
  const c = await cookies();
  return { locale: toLocale(c.get(LOCALE_COOKIE)?.value) ?? DEFAULT_LOCALE, prefixed: false };
}

export default getRequestConfig(async () => {
  const { locale } = await currentLocale();
  return {
    locale,
    messages: await loadMessages(locale),
    // Event times are always formatted with the venue's own time zone (see lib/i18n/format.ts).
    timeZone: "UTC",
    onError(error) {
      if (process.env.NODE_ENV !== "production") console.warn(`[i18n:${locale}]`, error.message);
    },
    getMessageFallback({ namespace, key }) {
      return [namespace, key].filter(Boolean).join(".");
    },
  };
});
