"use client";

/**
 * Admin only (OPS_ADMIN_EMAILS): FREAK LOYALTY rules, rank distribution, audit exclusions and their log.
 * Changes that take benefits away are announced: they need a notice and start ≥ 30 days later.
 * The distribution counts real accounts only; with no data it shows zeros, never sample numbers.
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, PageTitle } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { Section, SignInGate, useWhen } from "@/components/ops/shared";
import { useParty } from "@/components/party/shared";
import { api } from "@/lib/auth/client";
import { toast } from "@/lib/store";
import { RANK_COLOR } from "@/lib/loyalty/client";
import { RANKS, reducesBenefits, type LoyaltyRules, type Rank } from "@/lib/loyalty/rules";

interface Overview {
  doc: { rules: LoyaltyRules; scheduled: { rules: LoyaltyRules; effectiveAt: string; notice: string } | null; updatedAt: string };
  distribution: Record<Rank, number>;
  peopleWithCheckins: number;
  exclusions: { eventId: string; name: string; reason: string; at: string }[];
  log: { at: string; action: string; reason: string; eventId: string | null }[];
  noticeDays: number;
}

export function LoyaltyAdmin() {
  const t = useTranslations("loyalty");
  return (
    <div className="mx-auto max-w-5xl pb-24 md:px-6">
      <PageTitle kicker="FREAK LOYALTY" title={t("admin.title")} sub={t("admin.sub")} />
      <div className="px-4 md:px-0">
        <SignInGate returnTo="/admin/loyalty">
          <Inner />
        </SignInGate>
      </div>
    </div>
  );
}

const inputCls = "min-h-11 w-full rounded-xl border-2 border-line bg-ink px-3 font-bold";

function Inner() {
  const t = useTranslations("loyalty");
  const when = useWhen();
  const [n, setN] = useState(0);
  const { data, error } = useParty<Overview>(`/api/loyalty/admin?v=${n}`);
  const [draft, setDraft] = useState<LoyaltyRules | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");
  const [date, setDate] = useState("");
  const [ex, setEx] = useState({ eventId: "", reason: "" });
  useEffect(() => {
    if (data) setDraft(data.doc.rules);
  }, [data]);
  if (error) return <EmptyState title={t("admin.forbidden")} body={t("admin.forbiddenBody")} />;
  if (!data || !draft) return <div className="h-48 animate-pulse rounded-3xl bg-surface" />;
  const reduces = reducesBenefits(data.doc.rules, draft);
  const errText = (code: string, extra: Record<string, unknown>) => (t.has(`admin.err.${code}`) ? t(`admin.err.${code}`, { days: data.noticeDays, rule: String(extra.rule ?? "") }) : t("admin.err.generic"));

  const save = async () => {
    const r = await api("/api/loyalty/admin/rules", "POST", { rules: draft, reason, ...(reduces ? { notice, effectiveAt: date ? new Date(date).toISOString() : null } : {}) });
    if (!r.ok) return toast({ title: errText(r.code, r.data), tone: "error" });
    toast({ title: reduces ? t("admin.scheduledOk") : t("admin.savedOk"), tone: "success" });
    setReason("");
    setNotice("");
    setN((x) => x + 1);
  };
  const cancel = async () => {
    const r = await api("/api/loyalty/admin/cancel", "POST", { reason: reason || "Cancelled by admin" });
    if (!r.ok) return toast({ title: errText(r.code, r.data), tone: "error" });
    setN((x) => x + 1);
  };
  const exclude = async (eventId: string, on: boolean, why: string) => {
    const r = await api("/api/loyalty/admin/exclusions", "POST", { eventId, exclude: on, reason: why });
    if (!r.ok) return toast({ title: errText(r.code, r.data), tone: "error" });
    setEx({ eventId: "", reason: "" });
    setN((x) => x + 1);
  };
  const setRank = (i: number, k: "min" | "discountPct", v: number) => setDraft({ ...draft, ranks: draft.ranks.map((r, j) => (j === i ? { ...r, [k]: v } : r)) });
  const num = (s: string) => (s === "" ? 0 : Number(s));

  return (
    <div className="space-y-4" data-testid="loyalty-admin">
      <Section title={t("admin.distribution")} id="dist">
        <p className="mb-2 text-sm text-mute">{t("admin.distributionNote", { count: data.peopleWithCheckins })}</p>
        <dl className="grid grid-cols-5 gap-2 text-center">
          {RANKS.map((r) => (
            <div key={r} className="rounded-2xl bg-ink p-2">
              <dd className="font-display text-2xl" style={{ color: RANK_COLOR[r] }}>{data.distribution[r]}</dd>
              <dt className="text-[11px] font-bold uppercase text-mute">{t(`rank.${r}`)}</dt>
            </div>
          ))}
        </dl>
      </Section>

      <Section title={t("admin.rules")} id="rules">
        {data.doc.scheduled && (
          <div className="mb-3 rounded-2xl border border-[#FF79CD]/50 bg-[#FF79CD]/10 p-3 text-sm">
            <p className="font-bold">{t("admin.scheduled", { date: when(data.doc.scheduled.effectiveAt) })}</p>
            <p>{data.doc.scheduled.notice}</p>
            <Button variant="secondary" size="sm" className="mt-2" onClick={cancel}>{t("admin.cancelScheduled")}</Button>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-bold">{t("admin.feeRate")}<input type="number" step="0.1" min={0} max={30} className={inputCls} value={draft.feeRatePct} onChange={(e) => setDraft({ ...draft, feeRatePct: num(e.target.value) })} /></label>
          <label className="text-sm font-bold">{t("admin.maxDiscount")}<input type="number" min={0} max={100} className={inputCls} value={draft.maxDiscountPct} onChange={(e) => setDraft({ ...draft, maxDiscountPct: num(e.target.value) })} /></label>
          <label className="text-sm font-bold">{t("admin.minFee")}<input type="number" step="0.01" min={0} max={100} className={inputCls} value={draft.minFeeUsd} onChange={(e) => setDraft({ ...draft, minFeeUsd: num(e.target.value) })} /></label>
        </div>
        <label className="mt-3 flex min-h-11 items-center gap-3 text-sm font-bold">
          <input type="checkbox" className="size-5 accent-[#C1FF53]" checked={draft.fullDiscountEnabled} onChange={(e) => setDraft({ ...draft, fullDiscountEnabled: e.target.checked })} />
          {t("admin.fullDiscount")}
        </label>
        <p className="text-xs text-mute">{t("admin.fullDiscountHint")}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[360px] text-left text-sm">
            <thead className="text-xs uppercase text-mute"><tr><th className="py-1">{t("colRank")}</th><th className="py-1">{t("admin.minEvents")}</th><th className="py-1">{t("colDiscount")}</th></tr></thead>
            <tbody>
              {draft.ranks.map((r, i) => (
                <tr key={r.rank}>
                  <td className="py-1 pr-2 font-bold" style={{ color: RANK_COLOR[r.rank] }}>{t(`rank.${r.rank}`)}</td>
                  <td className="py-1 pr-2"><input aria-label={`${t(`rank.${r.rank}`)} ${t("admin.minEvents")}`} type="number" min={0} disabled={i === 0} className={inputCls} value={r.min} onChange={(e) => setRank(i, "min", num(e.target.value))} /></td>
                  <td className="py-1"><input aria-label={`${t(`rank.${r.rank}`)} ${t("colDiscount")}`} type="number" min={0} max={100} className={inputCls} value={r.discountPct} onChange={(e) => setRank(i, "discountPct", num(e.target.value))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {reduces && (
          <div className="mt-3 space-y-2 rounded-2xl border border-[#FFB45C]/50 bg-[#FFB45C]/10 p-3" data-testid="loyalty-reduces">
            <p className="text-sm font-bold">{t("admin.reducesWarn", { days: data.noticeDays })}</p>
            <label className="block text-sm font-bold">{t("admin.notice")}<textarea className={`${inputCls} min-h-20 py-2`} value={notice} onChange={(e) => setNotice(e.target.value)} /></label>
            <label className="block text-sm font-bold">{t("admin.effectiveAt")}<input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></label>
          </div>
        )}
        <label className="mt-3 block text-sm font-bold">{t("admin.reason")}<input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <div className="mt-3 flex gap-2">
          <Button onClick={save}>{reduces ? t("admin.schedule") : t("admin.save")}</Button>
          <Button variant="secondary" onClick={() => setDraft(data.doc.rules)}>{t("admin.reset")}</Button>
        </div>
      </Section>

      <Section title={t("admin.exclusions")} id="excl">
        <p className="mb-2 text-sm text-mute">{t("admin.exclusionsNote")}</p>
        {data.exclusions.length > 0 && (
          <ul className="mb-3 divide-y divide-line text-sm">
            {data.exclusions.map((x) => (
              <li key={x.eventId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><strong>{x.name}</strong> · {x.reason} · {when(x.at)}</span>
                <Button size="sm" variant="secondary" onClick={() => { const why = prompt(t("admin.restoreReason")); if (why) exclude(x.eventId, false, why); }}>{t("admin.restore")}</Button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <input aria-label={t("admin.eventId")} placeholder={t("admin.eventId")} className={inputCls} value={ex.eventId} onChange={(e) => setEx({ ...ex, eventId: e.target.value })} />
          <input aria-label={t("admin.reason")} placeholder={t("admin.reason")} className={inputCls} value={ex.reason} onChange={(e) => setEx({ ...ex, reason: e.target.value })} />
          <Button onClick={() => exclude(ex.eventId.trim(), true, ex.reason)}>{t("admin.exclude")}</Button>
        </div>
      </Section>

      <Section title={t("admin.log")} id="llog">
        {data.log.length === 0 ? (
          <p className="text-sm text-mute">{t("admin.noLog")}</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {data.log.map((l, i) => (
              <li key={i} className="py-2"><span className="font-bold">{t.has(`admin.action.${l.action}`) ? t(`admin.action.${l.action}`) : l.action}</span> · {l.reason} · <span className="text-mute">{when(l.at)}</span></li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
