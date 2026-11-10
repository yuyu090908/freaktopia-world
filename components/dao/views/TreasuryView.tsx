"use client";

import { Tx, useTx } from "@/components/i18n/Tx";
import { type Tu } from "@/lib/i18n/tu";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { BadgeCheck, FileText, Lock, ShieldAlert, Wallet } from "lucide-react";
import { Button, DemoNotice, Progress, Stat } from "@/components/ui/primitives";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { LoadingSkeleton } from "@/components/ui/States";
import { Field, Input, Select } from "@/components/forms/Fields";
import { daoApi, useDaoQuery } from "@/lib/dao/client";
import { CATEGORY_LABEL, ROLE_LABEL, usd } from "@/lib/dao/meta";
import type { BudgetItem, DaoRole, PaymentRequest, TreasuryAccount } from "@/lib/dao/types";
import { toast } from "@/lib/store";
import { fmtDate } from "@/lib/utils";
import { useDao } from "../DaoContext";
import { Gate, SubHead, ago } from "../DaoUi";
import { ImagePicker } from "./DiscussionView";

interface TreasuryDto {
  summary: { stakedTokens: number; eventBudget: number; ticketRevenue: number; sponsorContributions: number; allocated: number; approvedExpenses: number; pendingPayments: number; remaining: number };
  accounts: TreasuryAccount[];
  budget: (BudgetItem & { committed: number })[];
  payments: (PaymentRequest & { evidence: { id: string; url: string }[] })[] | null;
  paymentsEnabled: boolean;
  tiers: { below: number | null; approvals: number; roles: DaoRole[] }[];
  can: { request: boolean; approve: boolean };
  roles: DaoRole[];
}

const STATUS_STYLE = (tu: Tu): Record<PaymentRequest["status"], { label: string; color: string }> => ({
  pending: { label: tu("pendingApproval"), color: "#FFAD5B" },
  approved: { label: tu("approvedAwaitingRecord"), color: "#55BCEB" },
  executed_demo: { label: tu("recordedDemoNoFundsMoved"), color: "#B6F05C" },
  rejected: { label: tu("rejected"), color: "#FF625C" },
});

export function TreasuryView() {
  const tx = useTx();
  const tu = useTranslations("dao");
  const { eventId, home } = useDao();
  const { state, reload } = useDaoQuery<TreasuryDto>(`${eventId}/treasury`);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  if (state.status === "loading") return <LoadingSkeleton variant="list" />;
  if (state.status === "error") return <p role="alert">{state.error.message}</p>;
  const t = state.data;
  const symbol = home?.summary.tokenSymbol ?? "TOKEN";
  const staking = t.accounts.find((a) => a.kind === "staking_escrow");

  const act = async (id: string, what: "approve" | "execute") => {
    setBusy(id + what);
    const r = await daoApi<{ note?: string }>(`${eventId}/treasury/payments/${id}/${what}`, { method: "POST" });
    setBusy(null);
    if (!r.ok) return toast({ title: tu("notDone"), body: r.error.message, tone: "error" });
    toast({ title: what === "approve" ? tu("approvalRecorded") : tu("paymentRecordedDemo"), body: r.data.note ?? tu("loggedInTheAuditTrail"), tone: "success" });
    void reload(true);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[34px] uppercase leading-none sm:text-5xl">{tu("treasury")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-mute">{tu("stakedTokensAreMembersPrincipal")}</p>
      </div>

      <DemoNotice>
        <b>{tu("noRealPayments")}</b> {t.paymentsEnabled ? tu("aPaymentRailIsConfigured") : tu("paymentsAreNotConnectedExecuting")}
      </DemoNotice>

      <section aria-labelledby="stake-h" className="neon-acid rounded-[24px] border-2 bg-surface p-4">
        <h2 id="stake-h" className="flex items-center gap-2 text-xl uppercase"><Lock className="size-5 text-acid" aria-hidden />{tu("stakingEscrowSeparate")}</h2>
        <p className="mt-2 font-display text-4xl">{t.summary.stakedTokens.toLocaleString("en-US")} <span className="text-xl text-mute">{symbol}</span></p>
        <p className="mt-1 text-sm text-mute">{tu("valueNotSpendableReturnedTo", { value: staking?.label ?? tu("memberStakes") })}</p>
      </section>

      <section aria-labelledby="ops-h">
        <SubHead id="ops-h" title={tu("eventFundsDemoFigures")} />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat label={tu("eventBudget")} value={usd(t.summary.eventBudget)} accent="#B6F05C" />
          <Stat label={tu("ticketRevenue")} value={usd(t.summary.ticketRevenue)} accent="#55BCEB" />
          <Stat label={tu("sponsors")} value={usd(t.summary.sponsorContributions)} accent="#A276E9" />
          <Stat label={tu("approvedSpend")} value={usd(t.summary.approvedExpenses)} accent="#FF625C" />
          <Stat label={tu("pending")} value={usd(t.summary.pendingPayments)} accent="#FFAD5B" />
          <Stat label={tu("remaining")} value={usd(t.summary.remaining)} accent="#F5F2EA" />
        </div>
      </section>

      <section aria-labelledby="budget-h">
        <SubHead id="budget-h" title={tu("budgetLines")} />
        <ul className="space-y-2">
          {t.budget.map((b) => (
            <li key={b.id} className="rounded-2xl border border-line bg-surface p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-bold"><Tx>{b.label}</Tx></span>
                <span className="text-sm text-mute">{usd(b.committed)} / {usd(b.allocated)}</span>
              </div>
              <div className="text-[12px] text-mute"><Tx>{CATEGORY_LABEL[b.category]}</Tx></div>
              <Progress value={b.allocated ? Math.min(1, b.committed / b.allocated) : 0} label={tu("committedOf", { name: tx(b.label) })} color={b.committed > b.allocated ? "#FF625C" : "#B6F05C"} className="mt-2" />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="tiers-h" className="rounded-[22px] border border-line p-4">
        <h2 id="tiers-h" className="flex items-center gap-2 text-lg uppercase"><ShieldAlert className="size-5 text-orange" aria-hidden />{tu("approvalRules")}</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {t.tiers.map((x, i) => (
            <li key={i}>
              {x.below ? tu("underUsd", { usd: usd(x.below) }) : tu("usdAndAbove", { usd: usd(t.tiers[i - 1]?.below ?? 0) })}: <b>{tu("approvalsCount", { n: x.approvals })}</b> {tu("joinRequesterCantApprove", { join: x.roles.map((r) => ROLE_LABEL[r]).join(", ") })}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pay-h">
        <SubHead id="pay-h" title={tu("paymentRequests")} action={t.can.request ? <Button size="sm" onClick={() => setOpen(true)}>{tu("requestPayment")}</Button> : undefined} />
        {!t.payments ? (
          <Gate reason={tu("paymentDetailsAreVisibleTo")} />
        ) : !t.payments.length ? (
          <p className="text-sm text-mute">{tu("noPaymentRequestsYet")}</p>
        ) : (
          <ul className="space-y-3">
            {t.payments.map((p) => {
              const st = STATUS_STYLE(tu)[p.status];
              const item = t.budget.find((b) => b.id === p.budgetItemId);
              return (
                <li key={p.id} className="rounded-[22px] border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display text-2xl">{usd(p.amount)}</span>
                    <span className="rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-ink" style={{ background: st.color }}><Tx>{st.label}</Tx></span>
                  </div>
                  <p className="mt-1 font-bold">{p.payee}</p>
                  <p className="text-sm text-mute">{p.memo}</p>
                  <p className="mt-1 text-[12px] text-mute">{tu("valueFromReplaceRequestedAgo", { value: item?.label ?? p.budgetItemId, replace: p.fromAccount.replace("_", " "), ago: ago(p.requestedAt), value2: p.executedAt ? tu("recordedFmtdate", { fmtDate: fmtDate(new Date(p.executedAt).toISOString()) }) : "" })}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
                    <BadgeCheck className="size-4 text-acid" aria-hidden />
                    <span>{tu("approvalsLengthRequiredapprovals", { length: p.approvals.length, requiredApprovals: p.requiredApprovals })}</span>
                    {p.requiredRoles.map((r) => {
                      const done = p.approvals.find((a) => a.role === r);
                      return <span key={r} className={`rounded-full px-2 py-0.5 font-bold ${done ? "bg-acid text-ink" : "border border-line text-mute"}`}><Tx>{ROLE_LABEL[r]}</Tx>{done ? " ✓" : ""}</span>;
                    })}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {p.evidence.length ? p.evidence.map((e, i) => (
                      <a key={e.id} href={e.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line px-3 text-sm font-bold hover:border-acid"><FileText className="size-4" aria-hidden />{tu("evidenceValue", { value: i + 1 })}</a>
                    )) : <span className="text-[12px] text-coral">{tu("noInvoiceOrQuoteAttached")}</span>}
                  </div>
                  {(t.can.approve && p.status === "pending") || (p.status === "approved" && (t.roles.includes("organizer") || t.roles.includes("treasurer"))) ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {t.can.approve && p.status === "pending" && <Button size="sm" disabled={busy !== null} onClick={() => act(p.id, "approve")}>{busy === p.id + "approve" ? tu("approving") : tu("approve")}</Button>}
                      {p.status === "approved" && <Button size="sm" variant="purple" disabled={busy !== null} onClick={() => act(p.id, "execute")}>{busy === p.id + "execute" ? tu("recording") : tu("recordAsPaidDemo")}</Button>}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <PaymentForm open={open} onClose={() => setOpen(false)} budget={t.budget} onDone={() => { setOpen(false); void reload(true); }} />
    </div>
  );
}

function PaymentForm({ open, onClose, budget, onDone }: { open: boolean; onClose: () => void; budget: TreasuryDto["budget"]; onDone: () => void }) {
  const tu = useTranslations("dao");
  const { eventId } = useDao();
  const [f, setF] = useState({ budgetItemId: budget[0]?.id ?? "", amount: "", payee: "", memo: "", fromAccount: "event_budget" });
  const [evidence, setEvidence] = useState<{ id: string; url: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setErr(null);
    const r = await daoApi(`${eventId}/treasury/payments`, { method: "POST", json: { ...f, amount: Number(f.amount), evidenceMediaIds: evidence.map((e) => e.id) } });
    setBusy(false);
    if (!r.ok) return setErr(r.error.message);
    toast({ title: tu("paymentRequested"), body: tu("approversHaveBeenAskedTo"), tone: "success" });
    setF({ ...f, amount: "", payee: "", memo: "" });
    setEvidence([]);
    onDone();
  };
  return (
    <BottomSheet open={open} onClose={onClose} title={tu("requestPayment")} footer={<Button className="w-full" disabled={busy || !f.amount || !f.payee || f.memo.length < 3} onClick={submit}>{busy ? tu("sending") : tu("sendForApproval")}</Button>}>
      <div className="space-y-3">
        <p className="rounded-xl bg-surface-2 p-2 text-[12px] text-mute"><Wallet className="mr-1 inline size-4" aria-hidden />{tu("demoApprovalsAndRecordsOnly")}</p>
        <Field id="pay-item" label={tu("budgetLine")}>
          <Select id="pay-item" value={f.budgetItemId} onChange={(e) => setF({ ...f, budgetItemId: e.target.value })}>
            {budget.map((b) => <option key={b.id} value={b.id}>{tu("labelUsdLeft", { label: b.label, usd: usd(b.allocated - b.committed) })}</option>)}
          </Select>
        </Field>
        <Field id="pay-from" label={tu("payFrom")}>
          <Select id="pay-from" value={f.fromAccount} onChange={(e) => setF({ ...f, fromAccount: e.target.value })}>
            <option value="event_budget">{tu("eventBudget")}</option>
            <option value="ticket_revenue">{tu("ticketRevenue")}</option>
            <option value="sponsors">{tu("sponsors")}</option>
          </Select>
        </Field>
        <Field id="pay-amount" label={tu("amountUsd")}>
          <Input id="pay-amount" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") })} />
        </Field>
        <Field id="pay-payee" label={tu("payee")}>
          <Input id="pay-payee" value={f.payee} maxLength={120} onChange={(e) => setF({ ...f, payee: e.target.value })} />
        </Field>
        <Field id="pay-memo" label={tu("whatIsItFor")}>
          <Input id="pay-memo" value={f.memo} maxLength={300} onChange={(e) => setF({ ...f, memo: e.target.value })} />
        </Field>
        <ImagePicker label={tu("attachInvoiceQuoteImage")} onUploaded={(x) => setEvidence((e) => [...e, ...x].slice(0, 5))} />
        {evidence.length > 0 && <p className="text-[12px] text-acid">{tu("lengthEvidenceFileSAttached", { length: evidence.length })}</p>}
        {err && <p role="alert" className="text-sm text-coral">{err}</p>}
      </div>
    </BottomSheet>
  );
}
