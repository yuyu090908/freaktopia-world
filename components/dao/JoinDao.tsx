"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { CheckCircle2, KeyRound, Lock, ShieldAlert, Wallet } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button, DemoNotice } from "@/components/ui/primitives";
import { Field, Input } from "@/components/forms/Fields";
import { daoApi, signInWithDemoWallet } from "@/lib/dao/client";
import { DEMO_CHAIN, shortAddr } from "@/lib/dao/meta";
import { toast } from "@/lib/store";
import { fmtDate } from "@/lib/utils";
import { useDao } from "./DaoContext";

/** Join flow: 1. connect demo wallet + sign  2. stake (demo ledger)  3. confirmation. */
export function JoinDao({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tu = useTranslations("dao");
  const { home, reload, eventId } = useDao();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ tx: string; lockedUntil: number; flagged: { reason: string } | null } | null>(null);
  const cfg = home?.dao.config;
  const [amount, setAmount] = useState<number>(cfg?.minimumStake ?? 100);
  if (!home || !cfg) return null;
  const signedIn = !!home.me;
  const step = done ? 3 : signedIn ? 2 : 1;

  const connect = async () => {
    setBusy(true);
    setErr(null);
    const r = await signInWithDemoWallet();
    setBusy(false);
    if (!r.ok) return setErr(r.error.message);
    toast({ title: tu("demoWalletSignedIn"), body: shortAddr(r.data.session.wallet), tone: "success" });
    await reload(true);
  };
  const stake = async () => {
    setBusy(true);
    setErr(null);
    const r = await daoApi<{ txHash: string; lockedUntil: number; flagged: { reason: string } | null }>(`${eventId}/join`, { method: "POST", json: { amount, chainId: cfg.chainId, stakingContract: cfg.stakingContract } });
    setBusy(false);
    if (!r.ok) return setErr(r.error.message);
    setDone({ tx: r.data.txHash, lockedUntil: r.data.lockedUntil, flagged: r.data.flagged });
    await reload(true);
  };

  return (
    <BottomSheet open={open} onClose={() => { onClose(); setDone(null); setErr(null); }} title={tu("joinThisDao")}>
      <ol className="mb-4 grid grid-cols-3 gap-2 text-[11px] font-extrabold uppercase tracking-wider" aria-label={tu("joinSteps")}>
        {[tu("connect"), tu("stake"), tu("done")].map((l, i) => (
          <li key={l} aria-current={step === i + 1 ? "step" : undefined} className={`rounded-full px-2 py-1.5 text-center ${step > i ? "bg-acid text-ink" : step === i + 1 ? "border-2 border-acid text-acid" : "border border-line text-mute"}`}>
            {i + 1}. {l}
          </li>
        ))}
      </ol>
      <DemoNotice className="mb-4">
        <b>{tu("demoWalletDemoStaking")}</b> {tu("aThrowawayKeyIsCreated")} <b>{tu("notConnectedToAnyBlockchain")}</b> {tu("nameHoldsNoTokensAnd", { name: DEMO_CHAIN.name })}
      </DemoNotice>

      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-mute">{tu("connectingAWalletAloneDoes")}</p>
          <Button className="w-full" onClick={connect} disabled={busy}>
            <Wallet className="size-5" aria-hidden /> {busy ? tu("signing") : tu("connectDemoWalletSign")}
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {[
              [tu("network"), `${DEMO_CHAIN.name.split(" (")[0]} · ${cfg.chainId}`],
              [tu("stakingContract"), shortAddr(cfg.stakingContract)],
              [tu("minimumStake"), `${cfg.minimumStake} ${cfg.tokenSymbol}`],
              [tu("lock"), tu("daysN", { n: cfg.lockDurationDays })],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0 rounded-2xl bg-surface-2 p-2.5">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-mute">{k}</dt>
                <dd className="truncate font-bold">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="flex gap-2 text-[13px] text-mute">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden /> {cfg.unstakingRules}
          </p>
          <p className="flex gap-2 text-[13px] text-mute">
            <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden /> {tu("oneAccountOneVoteStaking")}
          </p>
          <Field id="stake-amount" label={tu("stakeAmountTokensymbol", { tokenSymbol: cfg.tokenSymbol })} hint={tu("atLeastMinimumstake", { minimumStake: cfg.minimumStake })}>
            <Input id="stake-amount" type="number" inputMode="numeric" min={cfg.minimumStake} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </Field>
          <Button className="w-full" onClick={stake} disabled={busy || !(amount >= cfg.minimumStake)}>
            {busy ? tu("staking") : tu("stakeValueJoinDemo", { value: amount || 0 })}
          </Button>
        </div>
      )}

      {step === 3 && done && (
        <div className="space-y-3 text-center">
          <CheckCircle2 className="mx-auto size-12 text-acid" aria-hidden />
          <p className="font-display text-2xl uppercase">{tu("youreIn")}</p>
          <p className="text-sm text-mute">
            {tu("demoStakeLockedUntilFmtdate", { fmtDate: fmtDate(new Date(done.lockedUntil).toISOString(), { month: "short", day: "numeric", year: "numeric" }) })} <code className="break-all text-[11px]">{done.tx.slice(0, 22)}…</code>
          </p>
          {done.flagged && (
            <p role="alert" className="flex gap-2 rounded-2xl border border-coral/50 bg-coral/10 p-3 text-left text-sm">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-coral" aria-hidden /> {tu("reasonYourVotesWillBe", { reason: done.flagged.reason })}
            </p>
          )}
          <Button className="w-full" onClick={onClose}>
            {tu("goToTheDao")}
          </Button>
        </div>
      )}
      {err && (
        <p role="alert" className="mt-3 rounded-2xl border border-coral/50 bg-coral/10 p-3 text-sm text-cream">
          {err}
        </p>
      )}
    </BottomSheet>
  );
}
