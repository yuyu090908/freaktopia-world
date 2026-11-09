"use client";

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

/** In-app alert inbox + per-type settings. External push is not connected in Phase 1. */
export function AlertsView() {
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

  if (!hydrated) return <div className="skeleton mx-4 h-64 rounded-3xl md:mx-0" role="status" aria-label="Loading alerts" />;

  return (
    <div className="space-y-6 px-4 md:px-0">
      <DemoNotice>Alerts are generated in this browser from the events you follow (demo). プッシュ通知・メールは未接続です。</DemoNotice>
      {!consent ? (
        <div className="neon rounded-3xl border bg-surface/90 p-5">
          <h2 className="text-2xl uppercase">Turn on in-app alerts?</h2>
          <p className="ja mt-2 text-sm text-mute">フォロー中のイベントのTOP10入り、チケット販売、DJ募集などをアプリ内でお知らせします。いつでもオフにできます。</p>
          <Button className="mt-4" onClick={() => setConsent(true)}><BellRing className="size-4" aria-hidden /> Allow in-app alerts</Button>
        </div>
      ) : (
        <section aria-labelledby="inbox">
          <div className="flex items-center justify-between gap-2">
            <h2 id="inbox" className="text-2xl uppercase">Inbox {unread.length > 0 && <span className="text-acid">({unread.length})</span>}</h2>
            {unread.length > 0 && <Button size="sm" variant="ghost" onClick={() => markRead(alerts.map((a) => a.id))}>Mark all read</Button>}
          </div>
          {alerts.length === 0 ? (
            <EmptyState
              className="mt-3"
              title="No alerts yet"
              body="WORLD RANKINGやイベントページでイベントをフォローすると、ここにお知らせが届きます。"
              action={<Link href="/rankings" className="inline-flex min-h-12 items-center rounded-full bg-acid px-5 font-extrabold uppercase text-ink">Find events</Link>}
            />
          ) : (
            <ul className="mt-3 space-y-2">
              {alerts.map((a) => (
                <li key={a.id}>
                  <Link href={`/events/${a.eventId}`} onClick={() => markRead([a.id])} className={cn("flex min-h-14 gap-3 rounded-2xl border-2 p-3", read.includes(a.id) ? "border-line bg-surface/70" : "border-acid/60 bg-acid/10")}>
                    <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", read.includes(a.id) ? "bg-line" : "bg-acid")} aria-hidden />
                    <span className="min-w-0">
                      <span className="block font-bold">{a.title}</span>
                      <span className="ja block text-sm text-mute">{a.body}</span>
                    </span>
                    {!read.includes(a.id) && <span className="sr-only">Unread</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <section aria-labelledby="alert-settings">
        <h2 id="alert-settings" className="text-2xl uppercase">Alert settings</h2>
        <div className="mt-3 space-y-2">
          <ToggleRow checked={consent} onChange={setConsent} label="In-app alerts" sub="アプリ内通知の受け取り（同意）" />
          {ALERT_TYPES.map((t) => (
            <ToggleRow key={t} checked={prefs[t]} onChange={(v) => setPref(t, v)} label={ALERT_LABELS[t].en} sub={ALERT_LABELS[t].ja} />
          ))}
        </div>
      </section>
    </div>
  );
}
