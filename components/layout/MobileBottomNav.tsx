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
      className="hide-on-kb fixed inset-x-0 bottom-0 z-50 bg-gradient-to-t from-ink from-70% to-transparent px-2 pb-[max(env(safe-area-inset-bottom),6px)] lg:hidden"
    >
      <ul className="mx-auto grid h-[calc(var(--nav-h)-6px)] max-w-xl grid-cols-5 rounded-[26px] border border-purple/45 bg-[#0d0b12]/95 shadow-[0_-6px_30px_-8px_rgba(162,118,233,0.55)]">
        {MAIN_NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
          return (
            <li key={href} className="flex">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="group relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold tracking-wide"
              >
                <span
                  className={cn(
                    "flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                    active ? "text-acid drop-shadow-[0_0_8px_rgba(182,240,92,0.7)]" : "text-cream/80 group-hover:text-cream",
                  )}
                >
                  <Icon className="size-[22px]" strokeWidth={active ? 2.6 : 2} aria-hidden />
                </span>
                <span className={active ? "text-acid" : "text-cream/75"}>{label}</span>
                {active && <span aria-hidden className="absolute bottom-1.5 h-[3px] w-7 rounded-full bg-acid shadow-[0_0_10px_#B6F05C]" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
