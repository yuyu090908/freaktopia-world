"use client";

import { Tx } from "@/components/i18n/Tx";
import { type Tu } from "@/lib/i18n/tu";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Share2 } from "lucide-react";
import { EventCover } from "@/components/cards/Cards";
import { Button, DemoNotice } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { getDJ, getEvent } from "@/lib/data";
import { toast, useDemo } from "@/lib/store";
import { fmtNum, fmtUsd } from "@/lib/ranking/meta";
import type { EventMetrics, RankableEvent } from "@/lib/ranking/types";
import type { EventLevel } from "@/lib/types";
import { fmtDate } from "@/lib/utils";

interface Row {
  event: RankableEvent & { level: EventLevel };
  metrics: EventMetrics;
  ranks: { popular?: number | null; tickets?: number | null; funded?: number | null };
}
interface Res {
  mode: "demo" | "production";
  asOf: string;
  rows: Row[];
  shareUrl: string;
}

const ITEMS = (tu: Tu): { label: string; render: (r: Row) => string }[] => ([
  { label: tu("city"), render: (r) => `${r.event.city}, ${r.event.country}` },
  { label: tu("date"), render: (r) => fmtDate(r.event.startsAt, { month: "short", day: "numeric", year: "numeric" }) },
  { label: tu("genre"), render: (r) => r.event.genres.join(" / ") },
  { label: tu("ticketPrice"), render: (r) => (r.event.minPrice === 0 ? "Free" : `From $${r.event.minPrice}`) },
  { label: tu("lineup"), render: (r) => r.event.lineup.map((d) => getDJ(d)?.name ?? d).join(", ") },
  { label: tu("supporters"), render: (r) => `${fmtNum(r.metrics.supporters_count)}${r.ranks.popular ? ` (#${r.ranks.popular})` : ""}` },
  { label: tu("ticketsSold"), render: (r) => `${fmtNum(r.metrics.tickets_sold)}${r.ranks.tickets ? ` (#${r.ranks.tickets})` : ""}` },
  { label: tu("eventLevel"), render: (r) => `LV.${r.event.level}` },
  { label: tu("funding"), render: (r) => `${fmtUsd(r.metrics.funding_usd)} / ${fmtUsd(r.event.goal)} (${Math.round((r.metrics.funding_usd / r.event.goal) * 100)}%)` },
  { label: tu("afterParty"), render: (r) => (r.event.afterParty ? `${r.event.afterParty.name} · ${r.event.afterParty.sold}/${r.event.afterParty.capacity}` : "—") },
  { label: tu("djRecruiting"), render: (r) => (r.event.djRecruiting ? "Yes" : "No") },
]);

export function CompareView() {
  const tu = useTranslations("ranking");
  const params = useSearchParams();
  const ids = (params.get("ids") ?? "").split(",").filter(Boolean).slice(0, 3);
  const key = ids.join(",");
  const [res, setRes] = useState<Res | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clearCompare = useDemo((s) => s.clearCompare);

  useEffect(() => {
    if (ids.length < 2) return;
    setRes(null);
    setError(null);
    fetch("/api/rankings/compare", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventIds: ids }) })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b?.error?.message ?? `HTTP ${r.status}`);
        return b as Res;
      })
      .then(setRes)
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const share = async () => {
    const url = window.location.origin + (res?.shareUrl ?? `/rankings/compare?ids=${key}`);
    try {
      if (navigator.share) await navigator.share({ title: tu("freaktopiaFestivalCompare"), url });
      else {
        await navigator.clipboard.writeText(url);
        toast({ title: tu("linkCopied"), body: "この比較をそのまま共有できます。", tone: "success" });
      }
    } catch {
      /* cancelled */
    }
  };

  if (ids.length < 2)
    return (
      <EmptyState
        className="mx-4 mt-6 md:mx-0"
        title={tu("pick23Events")}
        body={tu("n23")}
        action={<Link href="/rankings" className="inline-flex min-h-12 items-center rounded-full bg-acid px-5 font-extrabold uppercase text-ink">{tu("openRanking")}</Link>}
      />
    );

  return (
    <div className="px-4 md:px-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/rankings" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-acid"><ArrowLeft className="size-4" aria-hidden /> {tu("backToRanking")}</Link>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={clearCompare}>{tu("clearSelection")}</Button>
          <Button size="sm" onClick={share}><Share2 className="size-4" aria-hidden /> {tu("share")}</Button>
        </div>
      </div>
      {res?.mode === "demo" && <DemoNotice className="mt-3">{tu("demoComparisonAllEventsAnd")}</DemoNotice>}
      {error && <p role="alert" className="mt-4 rounded-2xl bg-coral/15 p-4 text-sm">{error}</p>}
      {!res && !error && <div className="skeleton mt-4 h-96 rounded-3xl" role="status" aria-label={tu("loadingComparison")} />}
      {res && (
        <div className="mt-4 overflow-x-auto rounded-3xl border border-purple/40 bg-surface/90" tabIndex={0} role="region" aria-label={tu("comparisonTableScrollSideways")}>
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <caption className="sr-only">{tu("festivalComparison")}</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 w-28 bg-surface p-3 text-xs uppercase text-mute">{tu("event")}</th>
                {res.rows.map((r) => (
                  <th key={r.event.id} scope="col" className="min-w-[160px] p-3 align-top">
                    <div className="relative mb-2 aspect-[16/10] overflow-hidden rounded-2xl">
                      <EventCover id={r.event.id} sizes="200px" />
                    </div>
                    <Link href={`/events/${r.event.id}`} className="font-display text-base uppercase leading-none hover:text-acid">{getEvent(r.event.id)?.name ?? r.event.name}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ITEMS(tu).map((it) => (
                <tr key={it.label} className="border-t border-line">
                  <th scope="row" className="sticky left-0 z-10 bg-surface p-3 text-xs font-bold uppercase text-mute"><Tx>{it.label}</Tx></th>
                  {res.rows.map((r) => (
                    <td key={r.event.id} className="p-3 align-top font-semibold">{it.render(r)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {res && <p className="mt-2 text-xs text-mute">{tu("dataAsOfReplaceUtc", { replace: res.asOf.slice(0, 16).replace("T", " ") })}</p>}
    </div>
  );
}
