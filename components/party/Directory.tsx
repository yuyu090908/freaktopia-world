"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CalendarDays, Globe2 } from "lucide-react";
import { Alien } from "@/components/art/Alien";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { DemoBadge } from "@/components/ui/primitives";
import { useWhen } from "@/components/ops/shared";
import { useParty } from "./shared";
import type { AlienLook } from "@/lib/types";

interface Entry { handle: string; name: string | null; look: AlienLook | null; totalEvents: number; uniqueVisitors: number; upcoming: number; stage: number; demo: boolean }
export interface Upcoming { id: string; name: string; city: string; startAt: string; endAt: string; timezone: string; genres: string[]; organizer: string | null; handle: string | null; demo: boolean }

/** Organizer worlds with verified or upcoming published parties. Real data only; the memory-only demo world is labelled. */
export function WorldDirectory() {
  const t = useTranslations("party");
  const href = useLocalHref();
  const { data } = useParty<{ worlds: Entry[] }>("/api/party/directory");
  if (!data) return <div className="h-40 animate-pulse rounded-3xl bg-surface" />;
  if (data.worlds.length === 0) return <p className="text-sm text-mute">{t("directoryEmpty")}</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="world-directory">
      {data.worlds.map((w) => (
        <li key={w.handle}>
          <Link href={href(`/u/${w.handle}/world`)} className="flex min-h-20 items-center gap-3 rounded-3xl border-2 border-line bg-surface p-3 hover:border-acid">
            {w.look ? <Alien look={w.look} className="size-14 shrink-0 rounded-2xl bg-purple" /> : <Globe2 className="size-14 shrink-0 text-acid" aria-hidden />}
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="truncate font-extrabold uppercase">{w.name ?? "—"}</span>
                {w.demo && <DemoBadge />}
              </span>
              <span className="block text-xs text-mute">{t("directoryLine", { stage: w.stage, events: w.totalEvents, people: w.uniqueVisitors })}</span>
              {w.upcoming > 0 && <span className="block text-xs font-bold text-acid">{t("upcomingN", { n: w.upcoming })}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Published community parties. Pass `parties` when the page already loaded (and filtered) them. */
export function UpcomingParties({ limit = 6, parties }: { limit?: number; parties?: Upcoming[] }) {
  const t = useTranslations("party");
  const href = useLocalHref();
  const when = useWhen();
  const { data } = useParty<{ parties: Upcoming[] }>(parties ? null : "/api/party/upcoming");
  const all = parties ?? data?.parties;
  if (!all) return <div className="h-24 animate-pulse rounded-3xl bg-surface" />;
  const list = all.filter((p) => p.handle).slice(0, limit);
  if (list.length === 0) return <p className="text-sm text-mute">{t("noUpcomingParties")}</p>;
  return (
    <ul className="grid gap-2 sm:grid-cols-2" data-testid="upcoming-parties">
      {list.map((p) => (
        <li key={p.id}>
          <Link href={href(`/u/${p.handle}/world/${p.id}`)} className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface p-3 hover:border-acid">
            <CalendarDays className="size-5 shrink-0 text-acid" aria-hidden />
            <span className="min-w-0">
              <span className="flex items-center gap-2"><span className="truncate font-extrabold uppercase">{p.name}</span>{p.demo && <DemoBadge />}</span>
              <span className="block text-xs text-mute">{when(p.startAt, p.timezone)} · {p.city} · {p.organizer}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
