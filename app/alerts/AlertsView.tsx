"use client";

import { useTx } from "@/components/i18n/Tx";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BellRing } from "lucide-react";
import { ToggleRow } from "@/components/forms/Fields";
import { Button, DemoNotice } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { ALERT_LABELS, ALERT_TYPES, deriveAlerts } from "@/lib/alerts";
import { getEvent } from "@/lib/data";
import { useDemo, useIsHydrated } from "@/lib/store";
import type { FreakEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useDaoQuery } from "@/lib/dao/client";

/** In-app alert inbox + per-type settings. External push is not connected in Phase 1. */
export function AlertsView() {
  const tx = useTx();
  const tu = useTranslations("alerts");
  const hydrated = useIsHydrated();
  const followed = useDemo((s) => s.followedEvents);
  const prefs = useDemo((s) => s.alertPrefs);
  const consent = useDemo((s) => s.alertsConsent);
  const setConsent = useDemo((s) => s.setAlertsConsent);
  const setPref = useDemo((s) => s.setAlertPref);
  const read = useDemo((s) => s.readAlerts);
  const markRead = useDemo((s) => s.markAlertsRead);
  const [top10, setTop10] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/rankings?category=popular&pageSize=10")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setTop10(new Set(d.items.map((i: { event: { id: string } }) => i.event.id))))
      .catch(() => {});
  }, []);

  const events = useMemo(() => followed.map((id) => getEvent(id)).filter(Boolean) as FreakEvent[], [followed]);
  const alerts = consent ? deriveAlerts(events, top10, prefs) : [];
  const unread = alerts.filter((a) => !read.includes(a.id));

  if (!hydrated) return <div className="skeleton mx-4 h-64 rounded-3xl md:mx-0" role="status" aria-label={tu("loadingAlerts")} />;

  return (
    <div className="space-y-6 px-4 md:px-0">
      <DemoNotice>{tu("alertsAreGeneratedInThis")}</DemoNotice>
      {!consent ? (
        <div className="neon rounded-3xl border bg-surface/90 p-5">
          <h2 className="text-2xl uppercase">{tu("turnOnInAppAlerts")}</h2>
          <p className="mt-2 text-sm text-mute">{tu("top10Dj")}</p>
          <Button className="mt-4" onClick={() => setConsent(true)}><BellRing className="size-4" aria-hidden /> {tu("allowInAppAlerts")}</Button>
        </div>
      ) : (
        <section aria-labelledby="inbox">
          <div className="flex items-center justify-between gap-2">
            <h2 id="inbox" className="text-2xl uppercase">{tu("inbox")} {unread.length > 0 && <span className="text-acid">({unread.length})</span>}</h2>
            {unread.length > 0 && <Button size="sm" variant="ghost" onClick={() => markRead(alerts.map((a) => a.id))}>{tu("markAllRead")}</Button>}
          </div>
          {alerts.length === 0 ? (
            <EmptyState
              className="mt-3"
              title={tu("noAlertsYet")}
              body={tu("worldRanking")}
              action={<Link href="/rankings" className="inline-flex min-h-12 items-center rounded-full bg-acid px-5 font-extrabold uppercase text-ink">{tu("findEvents")}</Link>}
            />
          ) : (
            <ul className="mt-3 space-y-2">
              {alerts.map((a) => (
                <li key={a.id}>
                  <Link href={`/events/${a.eventId}`} onClick={() => markRead([a.id])} className={cn("flex min-h-14 gap-3 rounded-2xl border-2 p-3", read.includes(a.id) ? "border-line bg-surface/70" : "border-acid/60 bg-acid/10")}>
                    <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", read.includes(a.id) ? "bg-line" : "bg-acid")} aria-hidden />
                    <span className="min-w-0">
                      <span className="block font-bold">{a.eventName}: {tx(a.label)}</span>
                      <span className="block text-sm text-mute">{tx(a.body)}</span>
                    </span>
                    {!read.includes(a.id) && <span className="sr-only">{tu("unread")}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {consent && <DaoAlerts />}
      <section aria-labelledby="alert-settings">
        <h2 id="alert-settings" className="text-2xl uppercase">{tu("alertSettings")}</h2>
        <div className="mt-3 space-y-2">
          <ToggleRow checked={consent} onChange={setConsent} label={tu("inAppAlerts")} sub={tu("text")} />
          {ALERT_TYPES.map((t) => (
            <ToggleRow key={t} checked={prefs[t]} onChange={(v) => setPref(t, v)} label={tx(ALERT_LABELS[t].en)} />
          ))}
        </div>
      </section>
    </div>
  );
}

/** DAO notifications (new votes, replies, proposal moves, results) from the server, for signed-in DAO members. */
function DaoAlerts() {
  const tu = useTranslations("alerts");
  const { state } = useDaoQuery<{ items: { id: string; at: number; title: string; body: string; href: string }[]; signedIn: boolean }>("notifications");
  if (state.status !== "ok" || !state.data.signedIn) return null;
  return (
    <section aria-labelledby="dao-alerts" data-testid="dao-alerts">
      <h2 id="dao-alerts" className="text-2xl uppercase">{tu("festivalDao")}</h2>
      {state.data.items.length === 0 ? (
        <p className="mt-2 text-sm text-mute">{tu("noDaoNotificationsYet")}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {state.data.items.map((a) => (
            <li key={a.id}>
              <Link href={a.href} className="flex min-h-14 flex-col justify-center rounded-2xl border-2 border-purple/50 bg-purple/10 p-3">
                <span className="font-bold">{a.title}</span>
                <span className="text-sm text-mute">{a.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
