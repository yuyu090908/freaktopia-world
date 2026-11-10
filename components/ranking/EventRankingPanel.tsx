"use client";

import { Tx } from "@/components/i18n/Tx";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Trophy } from "lucide-react";
import { CATEGORY_META } from "@/lib/ranking/meta";
import type { RankingCategory } from "@/lib/ranking/types";

interface History {
  mode: "demo" | "production";
  points: { date: string; ranks: Partial<Record<RankingCategory, number | null>>; supporters: number }[];
}

/** Current WORLD RANKING positions + 14-day rank sparkline for one event. */
export function EventRankingPanel({ eventId }: { eventId: string }) {
  const tu = useTranslations("ranking");
  const [data, setData] = useState<History | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const ctl = new AbortController();
    fetch(`/api/events/${eventId}/ranking-history?days=14`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch((e) => {
        if (e?.name !== "AbortError") setError(true);
      });
    return () => ctl.abort();
  }, [eventId]);

  if (error) return <p className="text-sm text-mute">{tu("rankingHistoryIsUnavailableRight")}</p>;
  if (!data) return <div className="skeleton h-40 rounded-3xl" aria-label={tu("loadingRanking")} />;
  const last = data.points[data.points.length - 1];
  const series = data.points.map((p) => p.ranks.popular ?? null);
  const max = Math.max(...series.map((v) => v ?? 0), 5);
  const pts = series
    .map((v, i) => (v === null ? null : `${(i / (series.length - 1)) * 100},${((v - 1) / (max - 1 || 1)) * 36 + 2}`))
    .filter(Boolean)
    .join(" ");
  const cats: RankingCategory[] = ["popular", "trending", "tickets", "funded"];
  return (
    <div className="neon rounded-3xl border bg-surface/90 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-display text-lg uppercase">
          <Trophy className="size-5 text-orange" aria-hidden /> {tu("worldRanking")}
        </div>
        {data.mode === "demo" && <span className="text-[11px] font-bold uppercase tracking-wider text-orange">{tu("demoData")}</span>}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cats.map((c) => (
          <div key={c} className="rounded-2xl bg-surface-2 p-2.5">
            <dt className="text-[11px] font-bold uppercase tracking-wider text-mute"><Tx>{CATEGORY_META[c].label}</Tx></dt>
            <dd className="font-display text-2xl" style={{ color: CATEGORY_META[c].color }}>{last.ranks[c] ? `#${last.ranks[c]}` : "—"}</dd>
          </div>
        ))}
      </dl>
      <figure className="mt-3">
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-14 w-full" role="img" aria-label={tu("mostPopularRankOverThe", { length: data.points.length })}>
          <polyline points={pts} fill="none" stroke="#B6F05C" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        <figcaption className="flex justify-between text-[11px] text-mute">
          <span>{tu("lengthDaysAgo", { length: data.points.length })}</span>
          <span>{tu("mostPopularRankHigherLine")}</span>
          <span>{tu("today")}</span>
        </figcaption>
      </figure>
      <Link href="/rankings" className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-acid">
        {tu("openWorldRanking")} <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
