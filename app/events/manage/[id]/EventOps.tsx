"use client";

import Link from "next/link";
import { useMemo, useState, type ComponentType } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, ClipboardList, Gauge, HardHat, LayoutDashboard, PiggyBank, ShieldCheck, Users } from "lucide-react";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { EmptyState } from "@/components/ui/States";
import { SignInGate, useOps, useWhen } from "@/components/ops/shared";
import { SCALE_LEVELS } from "@/lib/ops/types";
import { cn } from "@/lib/utils";
import type { TabProps, View } from "./ctx";
import { Overview } from "./tabs/Overview";
import { Planning } from "./tabs/Planning";
import { Resources } from "./tabs/Resources";
import { Operations } from "./tabs/Operations";
import { Budget } from "./tabs/Budget";
import { Safety } from "./tabs/Safety";

type TabId = "overview" | "planning" | "resources" | "operations" | "budget" | "safety";
const TABS: { id: TabId; icon: ComponentType<{ className?: string }>; Comp: ComponentType<TabProps>; show: (v: View) => boolean }[] = [
  { id: "overview", icon: LayoutDashboard, Comp: Overview, show: () => true },
  { id: "planning", icon: ClipboardList, Comp: Planning, show: (v) => ["owner", "manager", "lead"].includes(v.me.role) },
  { id: "resources", icon: Users, Comp: Resources, show: (v) => !!v.me.can.recruit || v.agreements.length > 0 },
  { id: "operations", icon: HardHat, Comp: Operations, show: () => true },
  { id: "budget", icon: PiggyBank, Comp: Budget, show: (v) => !!v.me.can.read_budget },
  { id: "safety", icon: ShieldCheck, Comp: Safety, show: () => true },
];

export function EventOps({ id }: { id: string }) {
  const t = useTranslations("ops");
  const href = useLocalHref();
  return (
    <div className="mx-auto max-w-6xl pb-24 md:px-6">
      <div className="px-4 pt-4 md:px-0 md:pt-6">
        <Link href={href("/events/manage")} className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-mute hover:text-cream">
          <ArrowLeft className="size-4" aria-hidden /> {t("backToList")}
        </Link>
      </div>
      <div className="px-4 md:px-0">
        <SignInGate returnTo={`/events/manage/${id}`}>
          <Inner id={id} />
        </SignInGate>
      </div>
    </div>
  );
}

function Inner({ id }: { id: string }) {
  const t = useTranslations("ops");
  const when = useWhen();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { data, error, reload } = useOps<{ view: View }>(`/api/ops/events/${id}`);
  const v = data?.view;
  const tabs = useMemo(() => (v ? TABS.filter((x) => x.show(v)) : []), [v]);
  const asked = (search.get("tab") as TabId | null) ?? "overview";
  const [local, setLocal] = useState<TabId | null>(null);
  const current = tabs.find((x) => x.id === (local ?? asked)) ?? tabs[0];
  const go = (tab: TabId) => {
    setLocal(tab);
    const q = new URLSearchParams(search.toString());
    q.set("tab", tab);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  if (error) return <EmptyState title={t("notFoundTitle")} body={t("notFoundBody")} />;
  if (!v || !current) return <div className="mt-4 h-64 animate-pulse rounded-3xl bg-surface" aria-busy="true" />;
  const Comp = current.Comp;
  const level = SCALE_LEVELS[v.level - 1];
  return (
    <div>
      <header className="pb-4 pt-2">
        <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-acid">{t("manageKicker")}</div>
        <h1 className="mt-1 text-[34px] uppercase leading-none sm:text-5xl" data-testid="ops-title">
          {v.event.name}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-mute">
          <span>{when(v.event.startAt, v.event.timezone)}</span>
          <span>·</span>
          <span>{v.event.city}{v.event.venueName ? ` · ${v.event.venueName}` : ""}</span>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-acid" data-testid="ops-level">
            L{v.level} · {t(`level.${level.key}`)}
          </span>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold" data-testid="ops-role">{t(`role.${v.me.role}`)}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold"><Gauge className="size-3.5" aria-hidden /> {t("readinessShort", { pct: v.readiness.overall })}</span>
        </div>
      </header>
      <div className="lg:grid lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-6">
        <nav aria-label={t("sections")} className="sticky top-14 z-10 -mx-4 mb-4 overflow-x-auto border-b border-line bg-ink/95 px-4 py-2 backdrop-blur lg:static lg:mx-0 lg:mb-0 lg:self-start lg:border-0 lg:bg-transparent lg:p-0">
          <ul className="flex gap-2 lg:flex-col" role="tablist">
            {tabs.map((x) => {
              const Icon = x.icon;
              const active = x.id === current.id;
              return (
                <li key={x.id}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => go(x.id)}
                    data-testid={`tab-${x.id}`}
                    className={cn("flex min-h-11 w-full items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-extrabold uppercase tracking-wide lg:rounded-2xl", active ? "bg-acid text-ink" : "bg-surface text-cream hover:bg-surface-2")}
                  >
                    <Icon className="size-4" />
                    {t(`tab.${x.id}`)}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <div role="tabpanel" className="min-w-0 space-y-4">
          <Comp v={v} reload={reload} eid={id} />
        </div>
      </div>
    </div>
  );
}
