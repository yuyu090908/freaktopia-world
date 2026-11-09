"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Menu, Search, X } from "lucide-react";
import { Logo } from "./Logo";
import { AlertsBell } from "./AlertsBell";
import { ALL_PAGES, MAIN_NAV, isTopLevel, parentOf } from "./nav";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { DemoBadge } from "@/components/ui/primitives";
import { DJS, EVENTS, VENUES } from "@/lib/data";
import { cn, fmtDate } from "@/lib/utils";

export function Header() {
  const path = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState(false);
  const [menu, setMenu] = useState(false);
  const top = isTopLevel(path);

  // Count in-app navigations so "back" never leaves the site on a fresh deep link.
  const visits = useRef(0);
  useEffect(() => {
    visits.current += 1;
    setMenu(false);
    setSearch(false);
  }, [path]);

  const goBack = () => {
    if (visits.current > 1) router.back();
    else router.push(parentOf(path));
  };

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-full focus:bg-acid focus:px-4 focus:py-3 focus:text-ink">
        Skip to content
      </a>
      <header className="sticky top-0 z-50 border-b border-purple/20 bg-ink/[.96] shadow-[0_8px_30px_-12px_rgba(162,118,233,0.45)] pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-[64px] max-w-6xl items-center gap-0.5 px-2 min-[400px]:gap-1 min-[400px]:px-3 md:px-6">
          {!top && (
            <button type="button" onClick={goBack} aria-label="Go back" className="-ml-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-surface">
              <ArrowLeft className="size-5" />
            </button>
          )}
          <Logo />
          <span className="ml-1 hidden min-[400px]:inline-flex"><DemoBadge /></span>
          <nav aria-label="Main" className="ml-6 hidden flex-1 items-center gap-1 lg:flex">
            {[...MAIN_NAV.slice(1), { href: "/rankings", label: "Ranking" }, { href: "/djs", label: "DJ Arena" }].map((n) => {
              const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("rounded-full px-3.5 py-2.5 text-sm font-bold uppercase tracking-wide", active ? "bg-acid text-ink" : "text-cream/80 hover:text-cream")}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-0.5 min-[400px]:gap-1.5">
            <Link href="/events/create" className="hidden min-h-11 items-center rounded-full bg-acid px-4 text-sm font-extrabold uppercase text-ink lg:inline-flex">
              Create Event
            </Link>
            <button type="button" onClick={() => setSearch(true)} aria-label="Search events, DJs and venues" className="inline-flex size-11 items-center justify-center rounded-full hover:bg-surface">
              <Search className="size-5" />
            </button>
            <AlertsBell />
            <button type="button" onClick={() => setMenu(true)} aria-label="Open menu" aria-expanded={menu} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-surface">
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
    <BottomSheet open={open} onClose={onClose} title="Search" className="md:max-w-xl">
      <label className="relative block">
        <span className="sr-only">Search</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-mute" aria-hidden />
        <input
          data-autofocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          enterKeyHint="search"
          placeholder="City, genre, DJ, venue…"
          className="h-14 w-full rounded-2xl border-2 border-line bg-ink pl-12 pr-12 text-base outline-none focus:border-acid"
        />
        {q && (
          <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-1.5 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full">
            <X className="size-4" />
          </button>
        )}
      </label>
      {!results && (
        <div className="mt-5">
          <div className="text-xs font-bold uppercase tracking-wider text-mute">Try</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {["Tokyo", "Techno", "Berlin", "Amapiano", "Disco", "London"].map((t) => (
              <button key={t} type="button" onClick={() => setQ(t)} className="min-h-11 rounded-full bg-surface-2 px-4 text-sm font-bold">
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
      {results && (
        <div className="mt-4 space-y-5" aria-live="polite">
          <p className="text-sm text-mute">{total} results</p>
          {results.ev.length > 0 && (
            <ResultGroup title="Events">
              {results.ev.map((e) => (
                <ResultLink key={e.id} href={`/events/${e.id}`} title={e.name} sub={`${e.city} · ${fmtDate(e.startsAt)} · ${e.genres.join(", ")}`} />
              ))}
            </ResultGroup>
          )}
          {results.dj.length > 0 && (
            <ResultGroup title="DJs">
              {results.dj.map((d) => (
                <ResultLink key={d.id} href={`/djs/${d.id}`} title={d.name} sub={`${d.city} · ${d.genres.join(", ")}`} />
              ))}
            </ResultGroup>
          )}
          {results.vn.length > 0 && (
            <ResultGroup title="Venues">
              {results.vn.map((v) => (
                <ResultLink key={v.id} href={`/venues/${v.id}`} title={v.name} sub={`${v.city} · ${v.capacity} cap`} />
              ))}
            </ResultGroup>
          )}
          {total === 0 && <p className="py-6 text-center text-mute">No matches. Try a city or a genre.</p>}
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

function MenuDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Menu" className="md:max-w-2xl">
      <nav aria-label="All pages" className="grid grid-cols-2 gap-x-4 gap-y-5 pb-2 md:grid-cols-4">
        {ALL_PAGES.map((g) => (
          <div key={g.group} className="min-w-0">
            <div className="mb-1 text-xs font-extrabold uppercase tracking-widest text-acid">{g.group}</div>
            <ul>
              {g.items.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} className="flex min-h-11 items-center text-[15px] font-semibold text-cream/90 hover:text-cream">
                    {i.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </BottomSheet>
  );
}
