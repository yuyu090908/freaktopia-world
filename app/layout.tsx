import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { LOCALES, LOCALE_META, PATH_HEADER, urlCode } from "@/i18n/config";
import { currentLocale } from "@/i18n/request";
import { LocaleProvider } from "@/components/i18n/LocaleContext";
import { SessionSync } from "@/components/auth/SessionSync";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { Footer } from "@/components/layout/Footer";
import { FooterGate } from "@/components/layout/FooterGate";
import { Toaster } from "@/components/ui/Toaster";
import { KeyboardWatcher } from "@/components/layout/KeyboardWatcher";
import { LocaleFont } from "@/components/i18n/LocaleFont";
import { SITE_URL } from "@/lib/utils";
import { PlayerProvider } from "@/components/music/PlayerProvider";

const bowlby = localFont({
  src: "./fonts/bowlby-one-latin-400-normal.woff2",
  variable: "--font-bowlby",
  display: "swap",
  weight: "400",
  fallback: ["Arial Black", "Impact", "sans-serif"], // i18n-ignore — font names
  adjustFontFallback: "Arial",
});

const inter = localFont({
  src: "./fonts/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
});

// Script fonts for the non-Latin locales are loaded on demand for the active locale only (LocaleFont).

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await currentLocale();
  const t = await getTranslations({ locale, namespace: "meta" });
  const path = (await headers()).get(PATH_HEADER) ?? "/";
  const suffix = path === "/" ? "" : path;
  const languages: Record<string, string> = Object.fromEntries(LOCALES.map((l) => [LOCALE_META[l].hreflang, `/${urlCode(l)}${suffix}`]));
  languages["x-default"] = suffix || "/";
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("title"), template: "%s · FREAKTOPIA WORLD" },
    description: t("description"),
    applicationName: "FREAKTOPIA WORLD",
    alternates: { canonical: `/${urlCode(locale)}${suffix}`, languages },
    openGraph: { title: "FREAKTOPIA WORLD", description: t("ogDescription"), type: "website", siteName: "FREAKTOPIA WORLD", locale: LOCALE_META[locale].intl.replace("-", "_") },
    icons: { icon: "/icon.svg", apple: "/icon.svg" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0B0910",
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, prefixed } = await currentLocale();
  const messages = await getMessages();
  const fonts = [bowlby, inter].map((f) => f.variable).join(" ");
  return (
    <html lang={LOCALE_META[locale].hreflang} dir={LOCALE_META[locale].dir} className={fonts}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
        <LocaleProvider locale={locale} prefixed={prefixed}>
        <SessionSync />
        <PlayerProvider>
        <Header />
        <main id="main" className="app-main">
          {children}
          <FooterGate>
            <Footer />
          </FooterGate>
        </main>
        <MobileBottomNav />
        </PlayerProvider>
        <Toaster />
        <KeyboardWatcher />
        <LocaleFont locale={locale} />
        </LocaleProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
