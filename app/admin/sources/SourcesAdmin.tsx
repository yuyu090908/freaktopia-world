"use client";

/**
 * Admin only (OPS_ADMIN_EMAILS): EVENT SOURCES and EVENT QUALITY.
 * Shows each outside source's real state (not configured / unapproved / connected / paused / error) and what
 * must be set to turn it on (env var NAMES only, never values). Sync, pause, refresh intervals, purge, and
 * hiding single events. Nothing here is sample data: with no source connected the lists are empty.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import { Button, PageTitle } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { Section, SignInGate, useWhen } from "@/components/ops/shared";
import { useParty } from "@/components/party/shared";
import { api } from "@/lib/auth/client";
import { toast } from "@/lib/store";
import type { ChangeRecord, SourceStatus } from "@/lib/discovery/types";
import { cn } from "@/lib/utils";

type Brief = { id: string; title: string; city: string | null; startsAtUtc: string; source: string; hidden: boolean };
interface Overview {
  sources: SourceStatus[];
  quality: {
    duplicates: { a: Brief; b: Brief }[];
    timeTbd: Brief[];
    noVenue: Brief[];
    noLocation: Brief[];
    approximateLocation: Brief[];
    cancelled: Brief[];
    hidden: Brief[];
    changes: ChangeRecord[];
  };
}

export function SourcesAdmin() {
  const t = useTranslations("discoveryAdmin");
  return (
    <div className="mx-auto max-w-5xl pb-24 md:px-6">
      <PageTitle kicker="EVENT SOURCES" title={t("title")} sub={t("sub")} />
      <div className="px-4 md:px-0">
        <SignInGate returnTo="/admin/sources">
          <Inner />
        </SignInGate>
      </div>
    </div>
  );
}

const STATE_COLOR: Record<SourceStatus["state"], string> = { connected: "#B6F05C", paused: "#E8C66A", error: "#FF625C", unapproved: "#FFB45C", not_configured: "#9AA3B2" };
const inputCls = "min-h-11 w-20 rounded-xl border-2 border-line bg-ink px-2 font-bold";

function Inner() {
  const t = useTranslations("discoveryAdmin");
  const when = useWhen();
  const [n, setN] = useState(0);
  const { data, error } = useParty<Overview>(`/api/discovery/admin?v=${n}`);
  const [busy, setBusy] = useState<string | null>(null);
  if (error) return <EmptyState title={t("forbidden")} body={t("forbiddenBody")} />;
  if (!data) return <div className="h-48 animate-pulse rounded-3xl bg-surface" />;

  const post = async (path: string, body: unknown, okMsg?: string) => {
    setBusy(path);
    const r = await api<{ result?: { error?: string; skipped?: string; stored?: number } }>(`/api/discovery/admin/${path}`, "POST", body);
    setBusy(null);
    if (!r.ok) return toast({ title: t("err", { code: r.code }), tone: "error" });
    const res = r.data.result;
    if (res?.error) toast({ title: t("syncFailed", { error: res.error }), tone: "error" });
    else if (res?.skipped) toast({ title: t(`skipped.${res.skipped}`), tone: "error" });
    else if (okMsg) toast({ title: okMsg, tone: "success" });
    setN((x) => x + 1);
  };

  return (
    <div className="space-y-4" data-testid="sources-admin">
      <Section title={t("sources")} id="sources">
        <ul className="space-y-3">
          {data.sources.map((s) => (
            <li key={s.id} className="rounded-2xl border border-line bg-ink/60 p-3" data-testid={`source-${s.id}`}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[16px] font-extrabold">{s.name}</h3>
                <span className="rounded-full border-2 px-2 py-0.5 text-[11px] font-extrabold uppercase" style={{ borderColor: STATE_COLOR[s.state], color: STATE_COLOR[s.state] }} data-testid="source-state">
                  {t(`state.${s.state}`)}
                </span>
                <a href={s.termsUrl} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex min-h-11 items-center gap-1 text-[13px] font-bold text-acid">
                  {t("terms")} <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </div>
              <p className="mt-1 text-[13px] text-mute">{t(`stateHelp.${s.state}`)}</p>
              {s.state !== "connected" && s.state !== "paused" && s.state !== "error" && (
                <p className="mt-1 text-[13px]">
                  {t("needs")} <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[12px]">{s.needs.join(", ")}</code>
                </p>
              )}
              <dl className="mt-2 grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-4">
                <div><dt className="text-[11px] uppercase text-mute">{t("lastSync")}</dt><dd>{when(s.lastSyncAt)}</dd></div>
                <div><dt className="text-[11px] uppercase text-mute">{t("lastSuccess")}</dt><dd>{when(s.lastSuccessAt)}</dd></div>
                <div><dt className="text-[11px] uppercase text-mute">{t("events")}</dt><dd>{s.eventCount}</dd></div>
                <div><dt className="text-[11px] uppercase text-mute">{t("regions")}</dt><dd>{s.regions.length ? s.regions.join(", ") : "—"}</dd></div>
              </dl>
              {s.lastError && <p className="mt-2 rounded-xl bg-danger/10 p-2 text-[12px] text-danger" role="alert">{t("lastError", { count: s.errorCount })}: {s.lastError}</p>}
              <Intervals s={s} onSave={(intervals) => post("intervals", { source: s.id, intervals }, t("saved"))} />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" disabled={s.state === "not_configured" || s.state === "unapproved" || busy !== null} onClick={() => post("sync", { source: s.id }, t("synced"))}>
                  {busy === "sync" ? t("syncing") : t("syncNow")}
                </Button>
                <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => post("pause", { source: s.id, paused: !s.paused }, s.paused ? t("resumed") : t("pausedOk"))}>
                  {s.paused ? t("resume") : t("pause")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-danger"
                  disabled={busy !== null || s.eventCount === 0}
                  onClick={() => {
                    if (window.prompt(t("purgeConfirm", { name: s.name })) === "DELETE") void post("purge", { source: s.id, confirm: "DELETE" }, t("purged"));
                  }}
                >
                  {t("purge")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("quality")} id="quality">
        <QList title={t("q.duplicates")} empty={t("q.none")} testId="q-duplicates">
          {data.quality.duplicates.map((d) => (
            <li key={`${d.a.id}|${d.b.id}`} className="py-1.5 text-[13px]">
              <b>{d.a.title}</b> ({d.a.source}) ↔ <b>{d.b.title}</b> ({d.b.source}) · {d.a.city}
            </li>
          ))}
        </QList>
        {(["cancelled", "timeTbd", "noVenue", "noLocation", "approximateLocation", "hidden"] as const).map((k) => (
          <QList key={k} title={t(`q.${k}`)} empty={t("q.none")} testId={`q-${k}`}>
            {data.quality[k].map((e) => (
              <EventLine key={e.id} e={e} onHide={(hidden) => post("hide", { eventId: e.id, hidden }, hidden ? t("hiddenOk") : t("shownOk"))} />
            ))}
          </QList>
        ))}
        <QList title={t("q.changes")} empty={t("q.none")} testId="q-changes">
          {data.quality.changes.map((c) => (
            <li key={c.id} className="py-1.5 text-[13px]">
              {when(c.at)} · <code className="text-[12px]">{c.eventId}</code> · {c.fields.map((f) => t(`field.${f}`)).join(", ")}
            </li>
          ))}
        </QList>
      </Section>
    </div>
  );
}

function Intervals({ s, onSave }: { s: SourceStatus; onSave: (v: SourceStatus["intervals"]) => void }) {
  const t = useTranslations("discoveryAdmin");
  const [v, setV] = useState(s.intervals);
  const changed = JSON.stringify(v) !== JSON.stringify(s.intervals);
  const field = (k: keyof SourceStatus["intervals"]) => (
    <label className="flex items-center gap-2 text-[13px] font-bold">
      {t(`interval.${k}`)}
      <input type="number" min={1} max={168} className={inputCls} value={v[k]} onChange={(e) => setV({ ...v, [k]: Math.max(1, Math.min(168, Number(e.target.value) || 1)) })} />
      {t("hours")}
    </label>
  );
  return (
    <fieldset className="mt-3">
      <legend className="text-[12px] font-extrabold uppercase text-mute">{t("intervals")}</legend>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
        {field("within48h")}
        {field("within30d")}
        {field("later")}
        <Button size="sm" variant="secondary" disabled={!changed} onClick={() => onSave(v)}>{t("save")}</Button>
      </div>
    </fieldset>
  );
}

function QList({ title, empty, testId, children }: { title: string; empty: string; testId: string; children: React.ReactNode[] }) {
  return (
    <div className="border-b border-line/60 py-3 last:border-0" data-testid={testId}>
      <h3 className="text-[14px] font-extrabold uppercase">
        {title} <span className="text-mute">({children.length})</span>
      </h3>
      {children.length ? <ul className="mt-1 max-h-72 overflow-y-auto">{children}</ul> : <p className="text-[13px] text-mute">{empty}</p>}
    </div>
  );
}

function EventLine({ e, onHide }: { e: Brief; onHide: (hidden: boolean) => void }) {
  const t = useTranslations("discoveryAdmin");
  const when = useWhen();
  return (
    <li className={cn("flex flex-wrap items-center gap-2 py-1.5 text-[13px]", e.hidden && "opacity-60")}>
      <span className="min-w-0 flex-1">
        <b>{e.title}</b> · {e.city ?? "—"} · {when(e.startsAtUtc)} · {e.source}
      </span>
      <Button size="sm" variant="secondary" onClick={() => onHide(!e.hidden)}>{e.hidden ? t("unhide") : t("hide")}</Button>
    </li>
  );
}
