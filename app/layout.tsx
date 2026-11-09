import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { Footer } from "@/components/layout/Footer";
import { FooterGate } from "@/components/layout/FooterGate";
import { Toaster } from "@/components/ui/Toaster";
import { KeyboardWatcher } from "@/components/layout/KeyboardWatcher";
import { SITE_URL } from "@/lib/utils";

const bowlby = localFont({
  src: "./fonts/bowlby-one-latin-400-normal.woff2",
  variable: "--font-bowlby",
  display: "swap",
  weight: "400",
  fallback: ["Arial Black", "Impact", "sans-serif"],
  adjustFontFallback: "Arial",
});

const inter = localFont({
  src: "./fonts/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "FREAKTOPIA WORLD — The world is your dancefloor",
    template: "%s · FREAKTOPIA WORLD",
  },
  description:
    "Discover. Support. Create. Rave. A living world of music, aliens, DJs, festivals and unforgettable nights. Phase 1 interactive prototype with demo data.",
  applicationName: "FREAKTOPIA WORLD",
  openGraph: {
    title: "FREAKTOPIA WORLD",
    description: "THE WORLD IS YOUR DANCEFLOOR. Discover. Support. Create. Rave.",
    type: "website",
    siteName: "FREAKTOPIA WORLD",
  },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#080808",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bowlby.variable} ${inter.variable}`}>
      <body>
        <Header />
        <main id="main" className="app-main">
          {children}
          <FooterGate>
            <Footer />
          </FooterGate>
        </main>
        <MobileBottomNav />
        <Toaster />
        <KeyboardWatcher />
      </body>
    </html>
  );
}
