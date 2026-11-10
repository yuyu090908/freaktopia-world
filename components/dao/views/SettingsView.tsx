"use client";

import { Tx } from "@/components/i18n/Tx";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { LogOut, Settings2, ShieldCheck, Theater } from "lucide-react";
import { Button, DemoNotice } from "@/components/ui/primitives";
import { LoadingSkeleton } from "@/components/ui/States";
import { Field, Input, Textarea } from "@/components/forms/Fields";
import { daoApi, forgetDemoWallet, useDaoQuery } from "@/lib/dao/client";
import { DEMO_CHAIN, ROLE_LABEL } from "@/lib/dao/meta";
import type { DaoConfig, DaoRole, DaoStatus } from "@/lib/dao/types";
import { toast } from "@/lib/store";
import { fmtDate } from "@/lib/utils";
import { useDao } from "../DaoContext";
import { SubHead } from "../DaoUi";

interface SettingsDto {
  config: DaoConfig;
  status: DaoStatus;
  canEdit: boolean;
  demo: boolean;
  roles: DaoRole[];
  staked: boolean;
}

const DEMO_ROLES: DaoRole[] = ["organizer", "treasurer", "moderator", "venue_owner"];

const PROD_CHECKLIST = ["prodDataMode", "prodSessionSecret", "prodStakingAudited", "prodImageModel", "prodPaymentRail", "prodRealPeople"] as const;

export function SettingsView() {
  const tu = useTranslations("dao");
  const { eventId, home, reload: reloadHome } = useDao();
  const { state, reload } = useDaoQuery<SettingsDto>(`${eventId}/settings`);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (state.status !== "ok") return;
    const c = state.data.config;
    setForm({
      minimumStake: String(c.minimumStake),
      lockDurationDays: String(c.lockDurationDays),
      defaultQuorum: String(Math.round(c.defaultQuorum * 100)),
      defaultThreshold: String(Math.round(c.defaultThreshold * 100)),
      discussionDays: String(c.discussionDays),
      votingDays: String(c.votingDays),
      unstakingRules: c.unstakingRules,
    });
  }, [state]);

  if (state.status === "loading") return <LoadingSkeleton variant="list" />;
  if (state.status === "error") return <p role="alert">{state.error.message}</p>;
  const s = state.data;
  const c = s.config;
  const signedIn = !!home?.me;

  const save = async () => {
    setBusy("save");
    setErr(null);
    const r = await daoApi(`${eventId}/settings`, {
      method: "PATCH",
      json: {
        minimumStake: Number(form.minimumStake),
        lockDurationDays: Number(form.lockDurationDays),
        defaultQuorum: Number(form.defaultQuorum) / 100,
        defaultThreshold: Number(form.defaultThreshold) / 100,
        discussionDays: Number(form.discussionDays),
        votingDays: Number(form.votingDays),
        unstakingRules: form.unstakingRules,
      },
    });
    setBusy(null);
    if (!r.ok) return setErr(r.error.issues?.length ? `${r.error.message} (${r.error.issues.map((i) => i.path).join(", ")})` : r.error.message);
    toast({ title: tu("settingsSaved"), body: tu("openVotesKeepTheirSnapshot"), tone: "success" });
    void reload(true);
    void reloadHome(true);
  };

  const setRoles = async (roles: DaoRole[]) => {
    setBusy("role");
    const r = await daoApi(`${eventId}/demo-role`, { method: "POST", json: { roles } });
    setBusy(null);
    if (!r.ok) return toast({ title: tu("notSwitched"), body: r.error.message, tone: "error" });
    toast({ title: roles.length ? tu("demoViewJoin", { join: roles.map((x) => ROLE_LABEL[x]).join(", ") }) : tu("demoViewMember"), tone: "success" });
    void reload(true);
    void reloadHome(true);
  };

  const unstake = async () => {
    setBusy("unstake");
    const r = await daoApi<{ unlockAt: number; note: string }>(`${eventId}/unstake`, { method: "POST" });
    setBusy(null);
    if (!r.ok) return toast({ title: tu("notDone"), body: r.error.message, tone: "error" });
    toast({ title: tu("unlockingOnFmtdate", { fmtDate: fmtDate(new Date(r.data.unlockAt).toISOString()) }), body: r.data.note, tone: "success" });
    void reloadHome(true);
  };

  const signOut = async () => {
    setBusy("out");
    await daoApi("auth/logout", { method: "POST" });
    forgetDemoWallet();
    setBusy(null);
    toast({ title: tu("signedOut"), body: tu("theDemoWalletKeyWas"), tone: "success" });
    void reloadHome();
  };

  const rows: [string, string][] = [
    [tu("network"), c.chainId === DEMO_CHAIN.id ? tu("chainDemoNotConnected", { name: DEMO_CHAIN.name, id: c.chainId }) : tu("chainN", { id: c.chainId })],
    [tu("tokenContract"), c.tokenContract],
    [tu("stakingContract"), c.stakingContract],
    [tu("token"), c.tokenSymbol],
    [tu("minimumStake"), `${c.minimumStake} ${c.tokenSymbol}`],
    [tu("lockPeriod"), tu("daysN", { n: c.lockDurationDays })],
    [tu("eligibilitySnapshot"), fmtDate(new Date(c.eligibilitySnapshotAt).toISOString(), { year: "numeric", month: "short", day: "numeric" })],
    [tu("defaultQuorumThreshold"), `${Math.round(c.defaultQuorum * 100)}% / ${Math.round(c.defaultThreshold * 100)}%`],
    [tu("discussionVoting"), tu("daysPair", { a: c.discussionDays, b: c.votingDays })],
    [tu("voteWeight"), tu("n1Account1VoteStakeNever")],
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[34px] uppercase leading-none sm:text-5xl">{tu("settings")}</h1>
        <p className="mt-2 text-sm text-mute">{tu("daoStatus")} <b className="uppercase text-cream">{s.status}</b></p>
      </div>

      {s.demo && <DemoNotice><b>{tu("demoDao")}</b> {tu("contractsArePlaceholdersOnA")}</DemoNotice>}

      <section aria-labelledby="cfg-h">
        <SubHead id="cfg-h" title={tu("configuration")} />
        <dl className="divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-surface">
          {rows.map(([k, v]) => (
            <div key={k} className="grid gap-1 p-3 sm:grid-cols-[200px_1fr]">
              <dt className="text-[12px] font-bold uppercase text-mute">{k}</dt>
              <dd className="min-w-0 break-all text-sm">{v}</dd>
            </div>
          ))}
          <div className="grid gap-1 p-3 sm:grid-cols-[200px_1fr]">
            <dt className="text-[12px] font-bold uppercase text-mute">{tu("unstakingRules")}</dt>
            <dd className="text-sm">{c.unstakingRules}</dd>
          </div>
        </dl>
      </section>

      {s.canEdit && (
        <section aria-labelledby="edit-h" className="rounded-[22px] border border-acid/50 bg-surface p-4">
          <h2 id="edit-h" className="flex items-center gap-2 text-xl uppercase"><Settings2 className="size-5 text-acid" aria-hidden />{tu("editOrganizer")}</h2>
          <p className="mt-1 text-[12px] text-mute">{tu("stakeAndChainSettingsAre")}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {([
              ["minimumStake", tu("minimumStakeSymbol", { symbol: c.tokenSymbol })],
              ["lockDurationDays", tu("lockPeriodDays7365")],
              ["defaultQuorum", tu("defaultQuorum")],
              ["defaultThreshold", tu("approvalThreshold50100")],
              ["discussionDays", tu("discussionPeriodDays")],
              ["votingDays", tu("votingPeriodDays")],
            ] as const).map(([k, label]) => (
              <Field key={k} id={`cfg-${k}`} label={label}>
                <Input id={`cfg-${k}`} inputMode="numeric" value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value.replace(/[^\d.]/g, "") })} />
              </Field>
            ))}
          </div>
          <div className="mt-3">
            <Field id="cfg-unstake" label={tu("unstakingRules")}>
              <Textarea id="cfg-unstake" rows={3} value={form.unstakingRules ?? ""} onChange={(e) => setForm({ ...form, unstakingRules: e.target.value })} />
            </Field>
          </div>
          {err && <p role="alert" className="mt-2 text-sm text-coral">{err}</p>}
          <Button className="mt-3 w-full sm:w-auto" disabled={busy !== null} onClick={save}>{busy === "save" ? tu("saving") : tu("saveSettings")}</Button>
        </section>
      )}

      {signedIn && s.demo && (
        <section aria-labelledby="role-h" className="rounded-[22px] border border-line bg-surface p-4">
          <h2 id="role-h" className="flex items-center gap-2 text-xl uppercase"><Theater className="size-5 text-purple" aria-hidden />{tu("demoRoleView")}</h2>
          <p className="mt-1 text-sm text-mute">{tu("tryTheStaffToolsThis")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy !== null} aria-pressed={s.roles.every((r) => r === "member")} onClick={() => setRoles([])} className={`min-h-11 rounded-full px-4 text-sm font-bold ${s.roles.every((r) => r === "member") ? "bg-acid text-ink" : "border border-line"}`}>{tu("member")}</button>
            {DEMO_ROLES.map((r) => {
              const on = s.roles.includes(r);
              return (
                <button key={r} type="button" disabled={busy !== null} aria-pressed={on} onClick={() => setRoles(on ? s.roles.filter((x) => x !== r && x !== "member") : [...s.roles.filter((x) => x !== "member"), r])} className={`min-h-11 rounded-full px-4 text-sm font-bold ${on ? "bg-purple text-ink" : "border border-line"}`}>
                  <Tx>{ROLE_LABEL[r]}</Tx>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {signedIn && (
        <section aria-labelledby="acct-h" className="rounded-[22px] border border-line bg-surface p-4">
          <h2 id="acct-h" className="text-xl uppercase">{tu("yourAccount")}</h2>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            {home?.me?.staked && <Button variant="ghost" disabled={busy !== null} onClick={unstake}>{busy === "unstake" ? tu("requesting") : tu("requestUnstake")}</Button>}
            <Button variant="ghost" disabled={busy !== null} onClick={signOut}><LogOut className="size-4" aria-hidden /> {tu("signOutForgetDemoWallet")}</Button>
          </div>
          <p className="mt-2 text-[12px] text-mute">{tu("unstakingStartsTheUnlockPeriod")}</p>
        </section>
      )}

      <section aria-labelledby="prod-h" className="rounded-[22px] border border-line p-4">
        <h2 id="prod-h" className="flex items-center gap-2 text-xl uppercase"><ShieldCheck className="size-5 text-acid" aria-hidden />{tu("beforeGoingLive")}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-mute">
          {PROD_CHECKLIST.map((x) => <li key={x}>{tu(x)}</li>)}
        </ul>
      </section>
    </div>
  );
}
