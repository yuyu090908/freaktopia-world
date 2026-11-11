"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Menu, Search, X } from "lucide-react";
import { Logo } from "./Logo";
import { AlertsBell } from "./AlertsBell";
import { DESKTOP_NAV, isTopLevel, parentOf } from "./nav";
import { MenuDrawer } from "./MenuDrawer";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { DemoBadge } from "@/components/ui/primitives";
import { DJS, EVENTS, VENUES } from "@/lib/data";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { AccountButton } from "@/components/auth/AccountButton";
import { useCleanPath, useLocalHref, useLocaleInfo } from "@/components/i18n/LocaleContext";
import { formatEventDate } from "@/lib/i18n/format";

export function Header() {
  const path = useCleanPath();
  const href = useLocalHref();
  const t = useTranslations("nav");
  const router = useRouter();
  const [search, setSearch] = useState(false);
  const [menu, setMenu] = useState(false);
  const top = isTopLevel(path);

  // Desktop links that don't fit in one row wrap onto a hidden second row instead of running under the buttons
  // on the right. Wrapped links are also taken out of the tab order; every page is in the menu anyway.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const fit = () => {
      const links = [...nav.querySelectorAll<HTMLElement>("a")];
      const first = links[0]?.offsetTop ?? 0;
      for (const a of links) {
        const out = a.offsetTop > first + 4;
        a.style.visibility = out ? "hidden" : "";
        if (out) a.setAttribute("tabindex", "-1");
        else a.removeAttribute("tabindex");
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(nav);
    void document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, [path, t]); // t changes with the language, and so do the label widths

  // Count in-app navigations so "back" never leaves the site on a fresh deep link.
  const visits = useRef(0);
  useEffect(() => {
    visits.current += 1;
    setMenu(false);
    setSearch(false);
  }, [path]);

  const goBack = () => {
    if (visits.current > 1) router.back();
    else router.push(href(parentOf(path)));
  };

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-full focus:bg-acid focus:px-4 focus:py-3 focus:text-ink">
        {t("skipToContent")}
      </a>
      <header className="sticky top-0 z-50 border-b border-purple/20 bg-ink/[.96] shadow-[0_8px_30px_-12px_rgba(183,139,255,0.35)] pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-[64px] max-w-6xl items-center gap-0.5 px-2 min-[400px]:gap-1 min-[400px]:px-3 md:px-6">
          {!top && (
            <button type="button" onClick={goBack} aria-label={t("goBack")} className="-ml-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-surface">
              <ArrowLeft className="size-5" />
            </button>
          )}
          <Logo />
          <span className="ml-1 hidden min-[400px]:inline-flex"><DemoBadge /></span>
          <nav ref={navRef} aria-label={t("main")} className="ml-3 hidden h-11 min-w-0 flex-1 flex-wrap items-center gap-x-0.5 overflow-hidden xl:ml-5 lg:flex">
            {DESKTOP_NAV.map((n) => {
              const active = path === n.href || path.startsWith(n.href + "/");
              return (
                <Link
                  key={n.href}
                  href={href(n.href)}
                  aria-current={active ? "page" : undefined}
                  className={cn("relative inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-2.5 text-sm font-bold uppercase xl:px-3", active ? "text-acid after:absolute after:inset-x-3 after:bottom-1 after:h-[3px] after:rounded-full after:bg-acid" : "text-cream/80 hover:bg-surface hover:text-cream")}
                >
                  {t(n.key)}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-0.5 min-[400px]:gap-1.5">
            <Link href={href("/events/create")} className="hidden min-h-11 items-center whitespace-nowrap rounded-full bg-acid px-4 text-sm font-extrabold uppercase text-ink xl:inline-flex">
              {t("createEvent")}
            </Link>
            <LanguageSwitcher />
            <button type="button" onClick={() => setSearch(true)} aria-label={t("searchLabel")} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-surface">
              <Search className="size-5" />
            </button>
            <span className="hidden sm:contents">
              <AlertsBell />
            </span>
            <AccountButton />
            <button type="button" onClick={() => setMenu(true)} aria-label={t("openMenu")} aria-expanded={menu} aria-haspopup="dialog" data-testid="menu-open" className="inline-flex size-11 items-center justify-center rounded-full hover:bg-surface">
              <Menu className="size-5" />
            </button>
          </div>
        </div>
      </header>
      <SearchSheet open={search} onClose={() => setSearch(false)} />
      <MenuDrawer open={menu} onClose={() => setMenu(false)} />
    </>
  );
}

function SearchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const { locale } = useLocaleInfo();
  const href = useLocalHref();
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return null;
    const ev = EVENTS.filter((e) => [e.name, e.city, e.country, ...e.genres].join(" ").toLowerCase().includes(s)).slice(0, 6);
    const dj = DJS.filter((d) => [d.name, d.city, ...d.genres].join(" ").toLowerCase().includes(s)).slice(0, 4);
    const vn = VENUES.filter((v) => [v.name, v.city].join(" ").toLowerCase().includes(s)).slice(0, 4);
    return { ev, dj, vn };
  }, [q]);
  const total = results ? results.ev.length + results.dj.length + results.vn.length : 0;

  return (
    <BottomSheet open={open} onClose={onClose} title={t("search")} className="md:max-w-xl">
      <label className="relative block">
        <span className="sr-only">{t("search")}</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-mute" aria-hidden />
        <input
          data-autofocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          enterKeyHint="search"
          placeholder={t("searchPlaceholder")}
          className="h-14 w-full rounded-2xl border-2 border-line bg-ink pl-12 pr-12 text-base outline-none focus:border-acid"
        />
        {q && (
          <button type="button" aria-label={tc("clear")} onClick={() => setQ("")} className="absolute right-1.5 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full">
            <X className="size-4" />
          </button>
        )}
      </label>
      {!results && (
        <div className="mt-5">
          <div className="text-xs font-bold uppercase tracking-wider text-mute">{t("searchTry")}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {["Tokyo", "Techno", "Berlin", "Amapiano", "Disco", "London"].map((t) => ( // i18n-ignore — search terms that match event data
              <button key={t} type="button" onClick={() => setQ(t)} className="min-h-11 rounded-full bg-surface-2 px-4 text-sm font-bold">
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
      {results && (
        <div className="mt-4 space-y-5" aria-live="polite">
          <p className="text-sm text-mute">{tc("results", { count: total })}</p>
          {results.ev.length > 0 && (
            <ResultGroup title={t("searchEvents")}>
              {results.ev.map((e) => (
                <ResultLink key={e.id} href={href(`/events/${e.id}`)} title={e.name} sub={`${e.city} · ${formatEventDate(locale, e.startsAt, "UTC", { month: "short", day: "numeric" })} · ${e.genres.join(", ")}`} />
              ))}
            </ResultGroup>
          )}
          {results.dj.length > 0 && (
            <ResultGroup title={t("searchDjs")}>
              {results.dj.map((d) => (
                <ResultLink key={d.id} href={href(`/djs/${d.id}`)} title={d.name} sub={`${d.city} · ${d.genres.join(", ")}`} />
              ))}
            </ResultGroup>
          )}
          {results.vn.length > 0 && (
            <ResultGroup title={t("searchVenues")}>
              {results.vn.map((v) => (
                <ResultLink key={v.id} href={href(`/venues/${v.id}`)} title={v.name} sub={`${v.city} · ${t("capacity", { count: v.capacity })}`} />
              ))}
            </ResultGroup>
          )}
          {total === 0 && <p className="py-6 text-center text-mute">{t("searchNone")}</p>}
        </div>
      )}
    </BottomSheet>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-bold uppercase tracking-wider text-mute">{title}</div>
      <ul className="divide-y divide-line">{children}</ul>
    </div>
  );
}

function ResultLink({ href, title, sub }: { href: string; title: string; sub: string }) {
  return (
    <li>
      <Link href={href} className="flex min-h-14 flex-col justify-center py-2">
        <span className="font-bold">{title}</span>
        <span className="text-sm text-mute">{sub}</span>
      </Link>
    </li>
  );
}
