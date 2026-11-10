import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_HEADER, PATH_HEADER, PREFIX_HEADER, fromAcceptLanguage, splitLocalePath, toLocale } from "@/i18n/config";

/**
 * Locale routing without moving the app into a [locale] segment:
 *  - /ja/world  → served by app/world with locale ja (rewrite); the choice is remembered in a cookie
 *  - /world     → unchanged URL; locale = cookie → Accept-Language → en
 * Existing unprefixed links keep working, and a prefixed URL is a shareable, indexable language version.
 */
/** 8.0 addresses (old bookmarks and emails already sent) → 8.1 pages. The query (?token=…) is kept. */
const LEGACY: Record<string, string> = {
  "/auth/signin": "/login",
  "/auth/signup": "/signup",
  "/auth/reset": "/forgot-password",
  "/auth/verify": "/verify-email",
  "/welcome": "/onboarding",
  "/profile/settings": "/settings",
};

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const { locale: prefixed, rest } = splitLocalePath(pathname);
  const moved = LEGACY[rest.replace(/\/$/, "")];
  if (moved) {
    const url = req.nextUrl.clone();
    url.pathname = (prefixed ? `/${prefixed}` : "") + moved;
    url.search = search;
    return NextResponse.redirect(url, 308);
  }
  const headers = new Headers(req.headers);
  headers.set(PATH_HEADER, rest);

  if (prefixed) {
    headers.set(LOCALE_HEADER, prefixed);
    headers.set(PREFIX_HEADER, "1");
    const url = req.nextUrl.clone();
    url.pathname = rest;
    url.search = search;
    const res = NextResponse.rewrite(url, { request: { headers } });
    if (req.cookies.get(LOCALE_COOKIE)?.value !== prefixed) {
      res.cookies.set(LOCALE_COOKIE, prefixed, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    }
    return res;
  }

  const locale = toLocale(req.cookies.get(LOCALE_COOKIE)?.value) ?? fromAcceptLanguage(req.headers.get("accept-language")) ?? DEFAULT_LOCALE;
  headers.set(LOCALE_HEADER, locale);
  headers.delete(PREFIX_HEADER);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Pages only: no API routes, Next internals or files with an extension (images, sitemap.xml, aliens/*.svg…).
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
