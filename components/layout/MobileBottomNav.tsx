"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCleanPath, useLocalHref } from "@/components/i18n/LocaleContext";
import { MAIN_NAV } from "./nav";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const path = useCleanPath();
  const href = useLocalHref();
  const t = useTranslations("nav");
  return (
    <nav
      aria-label={t("primary")}
      className="hide-on-kb fixed inset-x-0 bottom-0 z-50 bg-gradient-to-t from-ink from-70% to-transparent px-2 pb-[max(env(safe-area-inset-bottom),6px)] lg:hidden"
    >
      <ul className="mx-auto grid h-[calc(var(--nav-h)-6px)] max-w-xl grid-cols-5 rounded-[26px] border border-purple/45 bg-surface/95 shadow-[0_-6px_30px_-8px_rgba(183,139,255,0.45)]">
        {MAIN_NAV.map(({ href: to, key, icon: Icon, also }) => {
          const active = to === "/" ? path === "/" : [to, ...also].some((p) => path === p || path.startsWith(p + "/"));
          return (
            <li key={to} className="flex min-w-0">
              <Link
                href={href(to)}
                aria-current={active ? "page" : undefined}
                className="group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold tracking-wide"
              >
                <span
                  className={cn(
                    "flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                    active ? "text-acid drop-shadow-[0_0_8px_rgba(193,255,83,0.6)]" : "text-cream/80 group-hover:text-cream",
                  )}
                >
                  <Icon className="size-[22px]" strokeWidth={active ? 2.6 : 2} aria-hidden />
                </span>
                <span className={cn("max-w-full truncate px-0.5", active ? "text-acid" : "text-cream/75")}>{t(key)}</span>
                {active && <span aria-hidden className="absolute bottom-1.5 h-[3px] w-7 rounded-full bg-acid shadow-[0_0_10px_var(--color-acid)]" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
