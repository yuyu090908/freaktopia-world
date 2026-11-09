"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MAIN_NAV } from "./nav";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="hide-on-kb fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-ink/95 pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto grid h-[var(--nav-h)] max-w-xl grid-cols-5">
        {MAIN_NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
          return (
            <li key={href} className="flex">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="group flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-wide"
              >
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                    active ? "bg-acid text-ink" : "text-cream/75 group-hover:text-cream",
                  )}
                >
                  <Icon className="size-[22px]" strokeWidth={active ? 2.6 : 2} aria-hidden />
                </span>
                <span className={active ? "text-cream" : "text-cream/70"}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
