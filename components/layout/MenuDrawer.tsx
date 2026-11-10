"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CalendarDays, ChevronRight, Globe2, Orbit, PlusCircle, type LucideIcon } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useCleanPath, useLocalHref } from "@/components/i18n/LocaleContext";
import { useAuth } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import { LogoMark } from "./Logo";
import { MENU_GROUPS, MENU_LEGAL, type MenuAccent, type MenuItem } from "./nav";

/**
 * FREAKTOPIA "cosmic control panel" menu.
 * Dark panels; colour only on headings, icons, the left rail and the active row, so white text stays readable.
 * Phones: quick access 2×2, then one panel per category in a single column. Tablet/desktop: the same panels in two columns.
 */

const ACCENT: Record<MenuAccent, { text: string; rail: string; ring: string; glow: string; soft: string }> = {
  lime: { text: "text-[#C1FF53]", rail: "bg-[#C1FF53]", ring: "border-[#C1FF53]", glow: "shadow-[0_0_14px_-2px_rgba(193,255,83,0.55)]", soft: "bg-[#C1FF53]/10" },
  pink: { text: "text-[#FF79CD]", rail: "bg-[#FF79CD]", ring: "border-[#FF79CD]", glow: "shadow-[0_0_14px_-2px_rgba(255,121,205,0.55)]", soft: "bg-[#FF79CD]/10" },
  cyan: { text: "text-[#66DFFF]", rail: "bg-[#66DFFF]", ring: "border-[#66DFFF]", glow: "shadow-[0_0_14px_-2px_rgba(102,223,255,0.55)]", soft: "bg-[#66DFFF]/10" },
  purple: { text: "text-[#C3A1FF]", rail: "bg-[#C3A1FF]", ring: "border-[#C3A1FF]", glow: "shadow-[0_0_14px_-2px_rgba(195,161,255,0.55)]", soft: "bg-[#C3A1FF]/10" },
  orange: { text: "text-[#FFB45C]", rail: "bg-[#FFB45C]", ring: "border-[#FFB45C]", glow: "shadow-[0_0_14px_-2px_rgba(255,180,92,0.55)]", soft: "bg-[#FFB45C]/10" },
};

const press = "transition-[transform,background-color,border-color] duration-150 active:scale-[0.97] motion-reduce:active:scale-100";

/** Where "My World" goes: the person's own party world, or My parties (which asks to sign in) when we don't know them yet. */
function useMyWorldHref() {
  const status = useAuth((s) => s.status);
  const publicId = useAuth((s) => s.me?.alien?.publicId ?? null);
  return { href: status === "signedIn" && publicId ? `/u/${publicId}/world` : "/profile/parties", signedOut: status === "signedOut" };
}

const isActive = (path: string, to: string) => path === to || (to !== "/" && path.startsWith(to + "/"));

export function MenuDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("nav");
  const href = useLocalHref();
  const path = useCleanPath();
  const myWorld = useMyWorldHref();
  const target = (i: MenuItem) => (i.mine ? myWorld.href : i.href);

  const quick: { to: string; label: string; icon: LucideIcon; accent: MenuAccent; action?: boolean }[] = [
    { to: "/world", label: t("world"), icon: Globe2, accent: "lime" },
    { to: "/events", label: t("events"), icon: CalendarDays, accent: "lime" },
    { to: "/events/create", label: t("pages.createEvent"), icon: PlusCircle, accent: "pink", action: true },
    { to: myWorld.href, label: t("pages.myWorld"), icon: Orbit, accent: "purple" },
  ];

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t("menu")}
      tone="cosmic"
      headerStart={<LogoMark className="size-9 shrink-0" />}
      className="md:max-w-3xl"
    >
      <nav aria-label={t("allPages")} className="space-y-4 pb-2" data-testid="menu">
        {/* Quick access: the four most used places. "Create event" is the one action panel. */}
        <section aria-labelledby="menu-quick">
          <h3 id="menu-quick" className="sr-only">{t("quickAccess")}</h3>
          <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {quick.map((q) => {
              const a = ACCENT[q.accent];
              const active = isActive(path, q.to);
              return (
                <li key={q.label} className="flex min-w-0">
                  <Link
                    href={href(q.to)}
                    aria-current={active ? "page" : undefined}
                    data-testid="menu-quick"
                    className={cn(
                      "flex min-h-[76px] w-full min-w-0 flex-col justify-between gap-2 rounded-[18px] border p-3 outline-offset-2",
                      press,
                      q.action
                        ? "border-[#FF79CD] bg-[#FF79CD] text-[#120F19] shadow-[0_0_22px_-6px_rgba(255,121,205,0.8)] hover:bg-[#ff8fd6]"
                        : cn("border-[#383044] bg-[#211C2C] text-white hover:border-white/30", active && cn(a.ring, a.glow)),
                    )}
                  >
                    <q.icon className={cn("size-5 shrink-0", q.action ? "text-[#120F19]" : a.text)} strokeWidth={2.2} aria-hidden />
                    <span className="text-[15px] font-extrabold leading-tight [overflow-wrap:anywhere]">{q.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="grid gap-3 md:grid-cols-2">
          {MENU_GROUPS.map((g) => {
            const a = ACCENT[g.accent];
            const hid = `menu-${g.group}`;
            return (
              <section
                key={g.group}
                aria-labelledby={hid}
                data-testid={`menu-group-${g.group}`}
                className="relative overflow-hidden rounded-[18px] border border-[#383044] bg-[#211C2C] py-3 pl-4 pr-2"
              >
                <span aria-hidden className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r-full", a.rail)} />
                <h3 id={hid} className={cn("flex items-center gap-2 pb-1.5 pr-2 text-lg uppercase leading-tight tracking-wide", a.text)}>
                  <g.icon className="size-5 shrink-0" strokeWidth={2.2} aria-hidden />
                  <span className="min-w-0">{t(`groups.${g.group}`)}</span>
                </h3>
                <ul className="divide-y divide-[#383044]/70">
                  {g.items.map((i) => {
                    const to = target(i);
                    const active = isActive(path, to);
                    return (
                      <li key={i.key}>
                        <Link
                          href={href(to)}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "-ml-2 flex min-h-12 items-center gap-3 rounded-xl border border-transparent px-2 py-2 outline-offset-0 hover:bg-white/5",
                            press,
                            "active:bg-white/10",
                            active && cn(a.ring, a.soft, a.glow),
                          )}
                        >
                          <i.icon className={cn("size-5 shrink-0", a.text)} strokeWidth={2} aria-hidden />
                          <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-white [overflow-wrap:anywhere]">
                            {t(`pages.${i.key}`)}
                            {i.badge && (
                              <span className="ml-2 inline-block whitespace-nowrap rounded-full border border-[#B9B2C4]/50 px-1.5 py-px align-[2px] text-[10px] font-extrabold uppercase tracking-wider text-[#B9B2C4]">
                                {t(`badge.${i.badge}`)}
                              </span>
                            )}
                            {i.mine && myWorld.signedOut && <span className="block text-xs font-medium text-[#B9B2C4]">{t("signInForMyWorld")}</span>}
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-[#B9B2C4]" aria-hidden />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <ul className="flex flex-wrap items-center justify-center gap-x-1 pt-1" aria-label={t("legal")}>
          {MENU_LEGAL.map((l) => (
            <li key={l.href}>
              <Link href={href(l.href)} className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-[#B9B2C4] underline-offset-4 hover:text-white hover:underline">
                {t(`pages.${l.key}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </BottomSheet>
  );
}
