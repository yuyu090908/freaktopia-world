"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Lightbulb, ShieldAlert } from "lucide-react";
import { Button, DemoBadge, Stat } from "@/components/ui/primitives";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { SafetyNote, Section, SuggestionBadge, useMoney, useOps, useOpsPost, useWhen } from "@/components/ops/shared";
import type { BudgetCategory, Requirement } from "@/lib/ops/types";
import type { Candidate, TabProps } from "../ctx";

export function Budget({ v, reload, eid }: TabProps) {
  const t = useTranslations("ops");
  const money = useMoney();
  const when = useWhen();
  const post = useOpsPost();
  const [alt, setAlt] = useState<BudgetCategory | null>(null);
  const b = v.budget;
  if (!b) return null;
  const estimateSum = b.rows.reduce((a, r) => a + r.estimate, 0);
  const over = b.rows.filter((r) => r.overPct != null);
  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" data-testid="budget-totals">
        <Stat label={t("bTotal")} value={money(b.total)} />
        <Stat label={t("bEstimate")} value={money(estimateSum)} />
        <Stat label={t("bQuoted")} value={money(b.quoted)} accent="#55BCEB" />
        <Stat label={t("bContracted")} value={money(b.contracted)} accent="#B6F05C" />
        <Stat label={t("bPaid")} value={money(b.paid)} accent="#A276E9" />
        <Stat label={t("bRemaining")} value={money(b.remaining)} accent={b.remaining < 0 ? "#FF625C" : "#F5F2EA"} />
      </div>
      {over.length > 0 && (
        <div role="alert" className="flex gap-2 rounded-2xl border border-coral/50 bg-coral/10 p-3 text-sm" data-testid="budget-over">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-coral" aria-hidden />
          <span>{t("overBudget", { list: over.map((r) => t(`budget.${r.category}`)).join(", ") })}</span>
        </div>
      )}
      <Section title={t("budgetByCategory")} id="bud-h" action={<SuggestionBadge />}>
        <p className="mb-2 text-xs text-mute">{t("estimateIsSuggestion")}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm" data-testid="budget-table">
            <thead className="text-[11px] uppercase tracking-wider text-mute">
              <tr><th className="py-1">{t("category")}</th><th>{t("bEstimate")}</th><th>{t("bQuoted")}</th><th>{t("bContracted")}</th><th>{t("bPaid")}</th><th /></tr>
            </thead>
            <tbody>
              {b.rows.map((r) => (
                <tr key={r.category} className="border-t border-line" data-category={r.category} data-over={r.overPct != null ? "1" : "0"}>
                  <td className="py-2 font-bold">
                    <span className="inline-flex items-center gap-1">{r.safety && <ShieldAlert className="size-3.5 text-coral" aria-label={t("safetyCritical")} />}{t(`budget.${r.category}`)}</span>
                  </td>
                  <td>
                    {v.me.can.edit_budget ? (
                      <input
                        type="number"
                        min={0}
                        defaultValue={r.estimate}
                        aria-label={t("estimateFor", { cat: t(`budget.${r.category}`) })}
                        className="h-11 w-28 rounded-xl border-2 border-line bg-ink px-2 tabular-nums text-cream"
                        onBlur={async (e) => { const n = Number(e.target.value); if (n !== r.estimate && (await post(`events/${eid}/budget/${r.category}`, { estimateUsd: n }))) await reload(); }}
                      />
                    ) : (
                      money(r.estimate)
                    )}
                  </td>
                  <td className="tabular-nums">{money(r.quoted)}</td>
                  <td className="tabular-nums">{money(r.contracted)}</td>
                  <td className="tabular-nums">{money(r.paid)}</td>
                  <td className="whitespace-nowrap">
                    {r.overPct != null && (
                      <span className="mr-2 text-xs font-bold text-coral">+{r.overPct}%</span>
                    )}
                    {r.overPct != null && (
                      <Button size="sm" variant="ghost" onClick={() => setAlt(r.category)} data-testid={`alternatives-${r.category}`}>
                        <Lightbulb className="size-4" aria-hidden /> {t("alternatives")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <SafetyNote className="mt-3">{t("neverCutSafety")}</SafetyNote>
      </Section>
      <Section title={t("payments")} id="pay-h">
        <p className="mb-2 text-xs text-orange">{t("paymentRecordOnly")}</p>
        {v.payments.length === 0 ? (
          <p className="text-sm text-mute">{t("noPayments")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {v.payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2">
                <span>{when(p.at)}{p.note ? ` · ${p.note}` : ""}</span>
                <span className="font-bold tabular-nums">{money(p.amountUsd)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {alt && <Alternatives eid={eid} category={alt} onClose={() => setAlt(null)} />}
    </>
  );
}

function Alternatives({ eid, category, onClose }: { eid: string; category: BudgetCategory; onClose: () => void }) {
  const t = useTranslations("ops");
  const money = useMoney();
  const { data } = useOps<{ alternatives: { requirement: Requirement; currentPrice: number | null; alternatives: Candidate[]; safetyCritical: boolean }[] }>(`/api/ops/events/${eid}/budget/${category}/alternatives`);
  return (
    <BottomSheet open onClose={onClose} title={t("alternativesFor", { cat: t(`budget.${category}`) })}>
      <div className="mb-2"><SuggestionBadge /></div>
      {!data && <div className="h-20 animate-pulse rounded-2xl bg-surface" />}
      <ul className="space-y-3" data-testid="alternatives">
        {data?.alternatives.map((a) => (
          <li key={a.requirement.id} className="rounded-2xl bg-surface-2 p-3 text-sm">
            <div className="font-bold">{t(`req.${a.requirement.key}`)} ×{a.requirement.quantity}</div>
            <div className="text-xs text-mute">{t("currentQuote", { v: money(a.currentPrice) })}</div>
            {a.safetyCritical && <p className="mt-1 text-xs text-coral">{t("sameSpecOnly")}</p>}
            {a.alternatives.length === 0 ? (
              <p className="mt-1 text-xs text-mute">{t("noCheaper")}</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {a.alternatives.map((c) => (
                  <li key={c.listing.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{c.providerName ? <b>{c.providerName}</b> : null}{c.providerName ? " · " : ""}{c.listing.title} {c.listing.demo && <DemoBadge />}</span>
                    <span className="font-bold tabular-nums">{money(c.listing.priceUsd)} · {t("matchScore")} {c.score}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-mute">{t("alternativesNote")}</p>
    </BottomSheet>
  );
}
