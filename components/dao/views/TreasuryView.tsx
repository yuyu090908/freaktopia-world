"use client";

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

const STATUS_STYLE: Record<PaymentRequest["status"], { label: string; color: string }> = {
  pending: { label: "Pending approval", color: "#FFAD5B" },
  approved: { label: "Approved · awaiting record", color: "#55BCEB" },
  executed_demo: { label: "Recorded (demo, no funds moved)", color: "#B6F05C" },
  rejected: { label: "Rejected", color: "#FF625C" },
};

export function TreasuryView() {
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
    if (!r.ok) return toast({ title: "Not done", body: r.error.message, tone: "error" });
    toast({ title: what === "approve" ? "Approval recorded" : "Payment recorded (demo)", body: r.data.note ?? "Logged in the audit trail.", tone: "success" });
    void reload(true);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[34px] uppercase leading-none sm:text-5xl">Treasury</h1>
        <p className="mt-2 max-w-2xl text-sm text-mute">Staked tokens are members&apos; principal and are kept apart from event money. They can never pay for anything. Event spending needs multiple approvals and an invoice or quote.</p>
      </div>

      <DemoNotice>
        <b>No real payments.</b> {t.paymentsEnabled ? "A payment rail is configured but not implemented in this build, so payments cannot be executed." : "Payments are not connected. Executing a payment only records it in the demo audit log. No USDT, money or tokens move."}
      </DemoNotice>

      <section aria-labelledby="stake-h" className="neon-acid rounded-[24px] border-2 bg-surface p-4">
        <h2 id="stake-h" className="flex items-center gap-2 text-xl uppercase"><Lock className="size-5 text-acid" aria-hidden />Staking escrow (separate)</h2>
        <p className="mt-2 font-display text-4xl">{t.summary.stakedTokens.toLocaleString("en-US")} <span className="text-xl text-mute">{symbol}</span></p>
        <p className="mt-1 text-sm text-mute">{staking?.label ?? "Member stakes"} · not spendable · returned to stakers after the lock period. Demo ledger, no chain.</p>
      </section>

      <section aria-labelledby="ops-h">
        <SubHead id="ops-h" title="Event funds (demo figures)" />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat label="Event budget" value={usd(t.summary.eventBudget)} accent="#B6F05C" />
          <Stat label="Ticket revenue" value={usd(t.summary.ticketRevenue)} accent="#55BCEB" />
          <Stat label="Sponsors" value={usd(t.summary.sponsorContributions)} accent="#A276E9" />
          <Stat label="Approved spend" value={usd(t.summary.approvedExpenses)} accent="#FF625C" />
          <Stat label="Pending" value={usd(t.summary.pendingPayments)} accent="#FFAD5B" />
          <Stat label="Remaining" value={usd(t.summary.remaining)} accent="#F5F2EA" />
        </div>
      </section>

      <section aria-labelledby="budget-h">
        <SubHead id="budget-h" title="Budget lines" />
        <ul className="space-y-2">
          {t.budget.map((b) => (
            <li key={b.id} className="rounded-2xl border border-line bg-surface p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-bold">{b.label}</span>
                <span className="text-sm text-mute">{usd(b.committed)} / {usd(b.allocated)}</span>
              </div>
              <div className="text-[12px] text-mute">{CATEGORY_LABEL[b.category]}</div>
              <Progress value={b.allocated ? Math.min(1, b.committed / b.allocated) : 0} label={`${b.label} committed`} color={b.committed > b.allocated ? "#FF625C" : "#B6F05C"} className="mt-2" />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="tiers-h" className="rounded-[22px] border border-line p-4">
        <h2 id="tiers-h" className="flex items-center gap-2 text-lg uppercase"><ShieldAlert className="size-5 text-orange" aria-hidden />Approval rules</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {t.tiers.map((x, i) => (
            <li key={i}>
              {x.below ? `Under ${usd(x.below)}` : `${usd(t.tiers[i - 1]?.below ?? 0)} and above`}: <b>{x.approvals} approval{x.approvals > 1 ? "s" : ""}</b> ({x.roles.map((r) => ROLE_LABEL[r]).join(", ")}). Requester can&apos;t approve.
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pay-h">
        <SubHead id="pay-h" title="Payment requests" action={t.can.request ? <Button size="sm" onClick={() => setOpen(true)}>Request payment</Button> : undefined} />
        {!t.payments ? (
          <Gate reason="Payment details are visible to staked members only." />
        ) : !t.payments.length ? (
          <p className="text-sm text-mute">No payment requests yet.</p>
        ) : (
          <ul className="space-y-3">
            {t.payments.map((p) => {
              const st = STATUS_STYLE[p.status];
              const item = t.budget.find((b) => b.id === p.budgetItemId);
              return (
                <li key={p.id} className="rounded-[22px] border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display text-2xl">{usd(p.amount)}</span>
                    <span className="rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-ink" style={{ background: st.color }}>{st.label}</span>
                  </div>
                  <p className="mt-1 font-bold">{p.payee}</p>
                  <p className="text-sm text-mute">{p.memo}</p>
                  <p className="mt-1 text-[12px] text-mute">{item?.label ?? p.budgetItemId} · from {p.fromAccount.replace("_", " ")} · requested {ago(p.requestedAt)}{p.executedAt ? ` · recorded ${fmtDate(new Date(p.executedAt).toISOString())}` : ""}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
                    <BadgeCheck className="size-4 text-acid" aria-hidden />
                    <span>Approvals {p.approvals.length}/{p.requiredApprovals}:</span>
                    {p.requiredRoles.map((r) => {
                      const done = p.approvals.find((a) => a.role === r);
                      return <span key={r} className={`rounded-full px-2 py-0.5 font-bold ${done ? "bg-acid text-ink" : "border border-line text-mute"}`}>{ROLE_LABEL[r]}{done ? " ✓" : ""}</span>;
                    })}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {p.evidence.length ? p.evidence.map((e, i) => (
                      <a key={e.id} href={e.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line px-3 text-sm font-bold hover:border-acid"><FileText className="size-4" aria-hidden />Evidence {i + 1}</a>
                    )) : <span className="text-[12px] text-coral">No invoice or quote attached. It can&apos;t be recorded as paid.</span>}
                  </div>
                  {(t.can.approve && p.status === "pending") || (p.status === "approved" && (t.roles.includes("organizer") || t.roles.includes("treasurer"))) ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {t.can.approve && p.status === "pending" && <Button size="sm" disabled={busy !== null} onClick={() => act(p.id, "approve")}>{busy === p.id + "approve" ? "Approving…" : "Approve"}</Button>}
                      {p.status === "approved" && <Button size="sm" variant="purple" disabled={busy !== null} onClick={() => act(p.id, "execute")}>{busy === p.id + "execute" ? "Recording…" : "Record as paid (demo)"}</Button>}
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
    toast({ title: "Payment requested", body: "Approvers have been asked to review it.", tone: "success" });
    setF({ ...f, amount: "", payee: "", memo: "" });
    setEvidence([]);
    onDone();
  };
  return (
    <BottomSheet open={open} onClose={onClose} title="Request payment" footer={<Button className="w-full" disabled={busy || !f.amount || !f.payee || f.memo.length < 3} onClick={submit}>{busy ? "Sending…" : "Send for approval"}</Button>}>
      <div className="space-y-3">
        <p className="rounded-xl bg-surface-2 p-2 text-[12px] text-mute"><Wallet className="mr-1 inline size-4" aria-hidden />Demo: approvals and records only. Staking escrow can never be selected as a source.</p>
        <Field id="pay-item" label="Budget line">
          <Select id="pay-item" value={f.budgetItemId} onChange={(e) => setF({ ...f, budgetItemId: e.target.value })}>
            {budget.map((b) => <option key={b.id} value={b.id}>{b.label} ({usd(b.allocated - b.committed)} left)</option>)}
          </Select>
        </Field>
        <Field id="pay-from" label="Pay from">
          <Select id="pay-from" value={f.fromAccount} onChange={(e) => setF({ ...f, fromAccount: e.target.value })}>
            <option value="event_budget">Event budget</option>
            <option value="ticket_revenue">Ticket revenue</option>
            <option value="sponsors">Sponsors</option>
          </Select>
        </Field>
        <Field id="pay-amount" label="Amount (USD)">
          <Input id="pay-amount" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") })} />
        </Field>
        <Field id="pay-payee" label="Payee">
          <Input id="pay-payee" value={f.payee} maxLength={120} onChange={(e) => setF({ ...f, payee: e.target.value })} />
        </Field>
        <Field id="pay-memo" label="What is it for?">
          <Input id="pay-memo" value={f.memo} maxLength={300} onChange={(e) => setF({ ...f, memo: e.target.value })} />
        </Field>
        <ImagePicker label="Attach invoice / quote (image)" onUploaded={(x) => setEvidence((e) => [...e, ...x].slice(0, 5))} />
        {evidence.length > 0 && <p className="text-[12px] text-acid">{evidence.length} evidence file(s) attached.</p>}
        {err && <p role="alert" className="text-sm text-coral">{err}</p>}
      </div>
    </BottomSheet>
  );
}
