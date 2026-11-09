"use client";

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

const PROD_CHECKLIST = [
  "DAO_DATA_MODE=production with a real database (see db/migrations/0002_festival_dao.sql).",
  "DAO_SESSION_SECRET (32+ chars) and DAO_ALLOWED_CHAIN_IDS set to the real chain.",
  "Independently audited staking contract deployed; DAO_STAKING_AUDITED=true and DAO_RPC_URL set.",
  "Image model configured (STAGE_AI_PROVIDER / STAGE_AI_API_KEY) with rights and content checks.",
  "Payment rail reviewed by legal; DAO_PAYMENTS_ENABLED stays off until then.",
  "Real people for venue manager and specialist sign-offs (no demo stand-ins).",
];

export function SettingsView() {
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
    toast({ title: "Settings saved", body: "Open votes keep their snapshot.", tone: "success" });
    void reload(true);
    void reloadHome(true);
  };

  const setRoles = async (roles: DaoRole[]) => {
    setBusy("role");
    const r = await daoApi(`${eventId}/demo-role`, { method: "POST", json: { roles } });
    setBusy(null);
    if (!r.ok) return toast({ title: "Not switched", body: r.error.message, tone: "error" });
    toast({ title: roles.length ? `Demo view: ${roles.map((x) => ROLE_LABEL[x]).join(", ")}` : "Demo view: member", tone: "success" });
    void reload(true);
    void reloadHome(true);
  };

  const unstake = async () => {
    setBusy("unstake");
    const r = await daoApi<{ unlockAt: number; note: string }>(`${eventId}/unstake`, { method: "POST" });
    setBusy(null);
    if (!r.ok) return toast({ title: "Not done", body: r.error.message, tone: "error" });
    toast({ title: `Unlocking on ${fmtDate(new Date(r.data.unlockAt).toISOString())}`, body: r.data.note, tone: "success" });
    void reloadHome(true);
  };

  const signOut = async () => {
    setBusy("out");
    await daoApi("auth/logout", { method: "POST" });
    forgetDemoWallet();
    setBusy(null);
    toast({ title: "Signed out", body: "The demo wallet key was removed from this browser.", tone: "success" });
    void reloadHome();
  };

  const rows: [string, string][] = [
    ["Network", c.chainId === DEMO_CHAIN.id ? `${DEMO_CHAIN.name} (${c.chainId}) · demo, not connected` : `Chain ${c.chainId}`],
    ["Token contract", c.tokenContract],
    ["Staking contract", c.stakingContract],
    ["Token", c.tokenSymbol],
    ["Minimum stake", `${c.minimumStake} ${c.tokenSymbol}`],
    ["Lock period", `${c.lockDurationDays} days`],
    ["Eligibility snapshot", fmtDate(new Date(c.eligibilitySnapshotAt).toISOString(), { year: "numeric", month: "short", day: "numeric" })],
    ["Default quorum / threshold", `${Math.round(c.defaultQuorum * 100)}% / ${Math.round(c.defaultThreshold * 100)}%`],
    ["Discussion / voting", `${c.discussionDays} / ${c.votingDays} days`],
    ["Vote weight", "1 account = 1 vote (stake never adds weight)"],
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[34px] uppercase leading-none sm:text-5xl">Settings</h1>
        <p className="mt-2 text-sm text-mute">DAO status: <b className="uppercase text-cream">{s.status}</b></p>
      </div>

      {s.demo && <DemoNotice><b>Demo DAO.</b> Contracts are placeholders on a local demo chain. Nothing here is connected to a real blockchain or payment provider.</DemoNotice>}

      <section aria-labelledby="cfg-h">
        <SubHead id="cfg-h" title="Configuration" />
        <dl className="divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-surface">
          {rows.map(([k, v]) => (
            <div key={k} className="grid gap-1 p-3 sm:grid-cols-[200px_1fr]">
              <dt className="text-[12px] font-bold uppercase text-mute">{k}</dt>
              <dd className="min-w-0 break-all text-sm">{v}</dd>
            </div>
          ))}
          <div className="grid gap-1 p-3 sm:grid-cols-[200px_1fr]">
            <dt className="text-[12px] font-bold uppercase text-mute">Unstaking rules</dt>
            <dd className="text-sm">{c.unstakingRules}</dd>
          </div>
        </dl>
      </section>

      {s.canEdit && (
        <section aria-labelledby="edit-h" className="rounded-[22px] border border-acid/50 bg-surface p-4">
          <h2 id="edit-h" className="flex items-center gap-2 text-xl uppercase"><Settings2 className="size-5 text-acid" aria-hidden />Edit (organizer)</h2>
          <p className="mt-1 text-[12px] text-mute">Stake and chain settings are locked while a vote is open. Every change is written to the audit log.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {([
              ["minimumStake", `Minimum stake (${c.tokenSymbol})`],
              ["lockDurationDays", "Lock period (days, 7–365)"],
              ["defaultQuorum", "Default quorum (%)"],
              ["defaultThreshold", "Approval threshold (%, 50–100)"],
              ["discussionDays", "Discussion period (days)"],
              ["votingDays", "Voting period (days)"],
            ] as const).map(([k, label]) => (
              <Field key={k} id={`cfg-${k}`} label={label}>
                <Input id={`cfg-${k}`} inputMode="numeric" value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value.replace(/[^\d.]/g, "") })} />
              </Field>
            ))}
          </div>
          <div className="mt-3">
            <Field id="cfg-unstake" label="Unstaking rules">
              <Textarea id="cfg-unstake" rows={3} value={form.unstakingRules ?? ""} onChange={(e) => setForm({ ...form, unstakingRules: e.target.value })} />
            </Field>
          </div>
          {err && <p role="alert" className="mt-2 text-sm text-coral">{err}</p>}
          <Button className="mt-3 w-full sm:w-auto" disabled={busy !== null} onClick={save}>{busy === "save" ? "Saving…" : "Save settings"}</Button>
        </section>
      )}

      {signedIn && s.demo && (
        <section aria-labelledby="role-h" className="rounded-[22px] border border-line bg-surface p-4">
          <h2 id="role-h" className="flex items-center gap-2 text-xl uppercase"><Theater className="size-5 text-purple" aria-hidden />Demo role view</h2>
          <p className="mt-1 text-sm text-mute">Try the staff tools. This only changes what your demo session can do in this demo DAO; it is not available in production.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy !== null} aria-pressed={s.roles.every((r) => r === "member")} onClick={() => setRoles([])} className={`min-h-11 rounded-full px-4 text-sm font-bold ${s.roles.every((r) => r === "member") ? "bg-acid text-ink" : "border border-line"}`}>Member</button>
            {DEMO_ROLES.map((r) => {
              const on = s.roles.includes(r);
              return (
                <button key={r} type="button" disabled={busy !== null} aria-pressed={on} onClick={() => setRoles(on ? s.roles.filter((x) => x !== r && x !== "member") : [...s.roles.filter((x) => x !== "member"), r])} className={`min-h-11 rounded-full px-4 text-sm font-bold ${on ? "bg-purple text-ink" : "border border-line"}`}>
                  {ROLE_LABEL[r]}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {signedIn && (
        <section aria-labelledby="acct-h" className="rounded-[22px] border border-line bg-surface p-4">
          <h2 id="acct-h" className="text-xl uppercase">Your account</h2>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            {home?.me?.staked && <Button variant="ghost" disabled={busy !== null} onClick={unstake}>{busy === "unstake" ? "Requesting…" : "Request unstake"}</Button>}
            <Button variant="ghost" disabled={busy !== null} onClick={signOut}><LogOut className="size-4" aria-hidden /> Sign out &amp; forget demo wallet</Button>
          </div>
          <p className="mt-2 text-[12px] text-mute">Unstaking starts the unlock period. Votes already open keep their snapshot; new posts and votes need a locked stake.</p>
        </section>
      )}

      <section aria-labelledby="prod-h" className="rounded-[22px] border border-line p-4">
        <h2 id="prod-h" className="flex items-center gap-2 text-xl uppercase"><ShieldCheck className="size-5 text-acid" aria-hidden />Before going live</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-mute">
          {PROD_CHECKLIST.map((x) => <li key={x}>{x}</li>)}
        </ul>
      </section>
    </div>
  );
}
