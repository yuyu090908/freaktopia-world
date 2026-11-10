"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Rocket } from "lucide-react";
import { Button, ButtonLink, DemoNotice } from "@/components/ui/primitives";
import { Field, Input } from "@/components/forms/Fields";
import { daoApi, signInWithDemoWallet, useDaoQuery } from "@/lib/dao/client";
import { getEvent } from "@/lib/data";
import { toast } from "@/lib/store";

/** Shown on /dao/[eventId] when the event has no DAO yet. */
export function LaunchDao({ eventId, onDone }: { eventId: string; onDone: () => void }) {
  const tu = useTranslations("dao");
  const ev = getEvent(eventId)!;
  const { state, reload } = useDaoQuery<{ session: { wallet: string } | null }>("session");
  const [min, setMin] = useState(50);
  const [lock, setLock] = useState(30);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const signedIn = state.status === "ok" && !!state.data.session;

  const create = async () => {
    setBusy(true);
    setErr(null);
    if (!signedIn) {
      const s = await signInWithDemoWallet();
      if (!s.ok) {
        setBusy(false);
        return setErr(s.error.message);
      }
      await reload(true);
    }
    const r = await daoApi(`${eventId}/create`, { method: "POST", json: { minimumStake: min, lockDurationDays: lock } });
    setBusy(false);
    if (!r.ok) return setErr(r.error.message);
    toast({ title: tu("daoLaunchedDemo"), body: ev.name, tone: "success" });
    onDone();
  };

  return (
    <div className="mx-auto max-w-xl px-4 pb-16 pt-8">
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-acid">{tu("communityDao")}</p>
      <h1 className="mt-2 text-4xl uppercase">{tu("nameHasNoDaoYet", { name: ev.name })}</h1>
      <p className="mt-3 text-mute">{tu("organizersCanOpenADao")}</p>
      {ev.status === "ended" ? (
        <p className="mt-6">{tu("thisEventHasEnded")} <ButtonLink href="/dao" variant="ghost" size="sm">{tu("browseDaos")}</ButtonLink></p>
      ) : (
        <div className="neon mt-6 space-y-4 rounded-3xl border bg-surface/90 p-4">
          <DemoNotice>{tu("demoYouActAsThis")}</DemoNotice>
          <Field id="launch-min" label={tu("minimumStakeFrkDemo")}>
            <Input id="launch-min" type="number" min={1} value={min} onChange={(e) => setMin(Number(e.target.value))} />
          </Field>
          <Field id="launch-lock" label={tu("lockDurationDays")} hint={tu("n7365Days")}>
            <Input id="launch-lock" type="number" min={7} max={365} value={lock} onChange={(e) => setLock(Number(e.target.value))} />
          </Field>
          <Button className="w-full" onClick={create} disabled={busy}>
            <Rocket className="size-5" aria-hidden /> {busy ? tu("launching") : signedIn ? tu("launchDao") : tu("signInWithDemoWallet")}
          </Button>
          {err && <p role="alert" className="text-sm text-coral">{err}</p>}
        </div>
      )}
    </div>
  );
}
