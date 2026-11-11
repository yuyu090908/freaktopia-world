"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, Globe } from "lucide-react";
import { LOCALES, LOCALE_META, localizedPath, splitLocalePath, toLocale, type Locale } from "@/i18n/config";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useAuth } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

/**
 * Globe + language code. Desktop: a popover list. Phone: a bottom sheet.
 * Each language is written in its own script. Switching keeps the page (and its client state: the
 * map is not reloaded), saves the choice (profile when signed in, cookie otherwise) and re-renders
 * server text in place.
 */
/**
 * Swaps the URL in place and lets the App Router adopt it. The router's state tree remembers the URL each
 * page segment was loaded from and refetches that URL on refresh, which would bring the old language back,
 * so those entries are rewritten to the new URL first.
 */
function swapHistoryUrl(oldHref: string, newHref: string) {
  const state = window.history.state as Record<string, unknown> | null;
  const tree = state?.__PRIVATE_NEXTJS_INTERNALS_TREE;
  const rewrite = (node: unknown): unknown =>
    Array.isArray(node)
      ? node.map((v, i) => (i === 2 && typeof v === "string" && v === oldHref ? newHref : rewrite(v)))
      : node && typeof node === "object"
        ? Object.fromEntries(Object.entries(node).map(([k, v]) => [k, rewrite(v)]))
        : node;
  // 1) a Next-internal entry (has __NA) is written as-is, 2) a plain entry makes the router adopt URL + tree.
  if (state && tree) window.history.replaceState({ ...state, __PRIVATE_NEXTJS_INTERNALS_TREE: rewrite(tree) }, "", newHref);
  window.history.replaceState(null, "", newHref);
}

export function LanguageSwitcher() {
  const t = useTranslations("language");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const signedIn = useAuth((s) => s.status === "signedIn");
  const [open, setOpen] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [busy, setBusy] = useState(false);
  const pop = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pendingRefresh = useRef(false);
  const currentPath = usePathname();

  useEffect(() => {
    if (!pendingRefresh.current) return;
    pendingRefresh.current = false;
    router.refresh();
  }, [currentPath, router]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (!open || !desktop) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape") {
          setOpen(false);
          btn.current?.focus();
        }
        return;
      }
      if (!pop.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    pop.current?.querySelector<HTMLElement>("[aria-checked=true]")?.focus();
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open, desktop]);

  const choose = async (l: Locale) => {
    setOpen(false);
    if (l === locale || busy) return;
    setBusy(true);
    document.cookie = `NEXT_LOCALE=${l}; path=/; max-age=31536000; samesite=lax`;
    // Saves to the profile when signed in (the server also re-sets the cookie).
    await fetch("/api/locale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale: l }) }).catch(() => undefined);
    const { pathname, search, hash } = window.location;
    const { locale: prefixed } = splitLocalePath(pathname);
    document.documentElement.lang = LOCALE_META[l].hreflang;
    // /ja/x and /ko/x are rewritten to the same route, so replace() swaps the prefix without remounting the
    // page's client components (the map and its data stay as they are).
    // Only the changed segments are re-rendered on replace(), so once the new URL is in place a refresh
    // re-renders the root layout and the dictionaries it provides (see the effect below).
    if (prefixed) {
      pendingRefresh.current = true;
      swapHistoryUrl(pathname + search, localizedPath(l, pathname) + search + hash);
    } else router.refresh();
    setBusy(false);
  };

  const list = (
    <ul role="radiogroup" aria-label={t("choose")} className={cn(desktop ? "max-h-[70vh] overflow-y-auto p-1.5" : "grid grid-cols-1 gap-1 min-[400px]:grid-cols-2")}>
      {LOCALES.map((l) => {
        const active = l === locale;
        return (
          <li key={l}>
            <button
              type="button"
              role="radio"
              aria-checked={active}
              lang={LOCALE_META[l].hreflang}
              onClick={() => choose(l)}
              data-testid={`lang-${l}`}
              className={cn("flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-acid", active ? "bg-acid/15 text-acid" : "hover:bg-surface-2")}
            >
              <span className="w-12 shrink-0 text-xs font-extrabold uppercase text-mute">{l}</span>
              <span className="min-w-0 flex-1">{LOCALE_META[l].native}</span>
              {active && <Check className="size-4 shrink-0" aria-hidden />}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="relative">
      <button
        ref={btn}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup={desktop ? "true" : "dialog"}
        aria-expanded={open}
        data-testid="lang-switcher"
        className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-extrabold uppercase hover:bg-surface"
      >
        <Globe className="size-5" aria-hidden />
        {/* The accessible name starts with the visible text (WCAG 2.5.3 Label in Name), then says what the button does. */}
        <span className="hidden min-[360px]:inline">{toLocale(locale) === "zh-CN" ? "中文" : locale}</span>{/* i18n-ignore: language names are always shown in their own script */}
        <span className="sr-only"> {t("button", { name: LOCALE_META[locale].native })}</span>
      </button>
      {desktop && open && (
        <div ref={pop} className="absolute right-0 top-[calc(100%+8px)] z-[70] w-72 rounded-2xl border-2 border-line bg-[#0D121B] shadow-[0_16px_40px_rgba(0,0,0,.6)]">
          <div className="border-b border-line px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-mute">{t("choose")}</div>
          {list}
          <p className="border-t border-line px-4 py-2.5 text-[11px] leading-snug text-mute">
            {signedIn ? t("savedProfile") : t("savedBrowser")} · {t("userContentNote")}
          </p>
        </div>
      )}
      {!desktop && (
        <BottomSheet open={open} onClose={() => setOpen(false)} title={t("choose")}>
          {list}
          <p className="mt-3 text-xs leading-snug text-mute">
            {signedIn ? t("savedProfile") : t("savedBrowser")} · {t("userContentNote")}
          </p>
        </BottomSheet>
      )}
    </div>
  );
}
