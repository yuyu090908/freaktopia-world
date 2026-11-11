"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { PageTitle } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { Section, SignInGate, useWhen } from "@/components/ops/shared";
import { useParty } from "@/components/party/shared";

interface Review {
  flags: { eventId: string; eventName: string; kind: string; value: number }[];
  log: { at: string; by: string; eventId: string | null; action: string; reason: string }[];
}

/** Admin-only (OPS_ADMIN_EMAILS): anomaly flags and the audit log of every manual correction. Flags are signals for review, not verdicts. */
export function Audit() {
  const t = useTranslations("party");
  const tl = useTranslations("loyalty");
  const td = useTranslations("discoveryAdmin");
  return (
    <div className="mx-auto max-w-5xl pb-24 md:px-6">
      <PageTitle kicker={t("kicker")} title={t("auditTitle")} sub={t("auditSub")}>
        <Link href="/admin/loyalty" className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-acid underline">{tl("admin.title")}</Link>
        <Link href="/admin/sources" className="ml-4 mt-3 inline-flex min-h-11 items-center text-sm font-bold text-acid underline">{td("title")}</Link>
      </PageTitle>
      <div className="px-4 md:px-0">
        <SignInGate returnTo="/world/audit">
          <Inner />
        </SignInGate>
      </div>
    </div>
  );
}

function Inner() {
  const t = useTranslations("party");
  const when = useWhen();
  const { data, error } = useParty<Review>("/api/party/admin");
  if (error) return <EmptyState title={t("auditForbidden")} body={t("auditForbiddenBody")} />;
  if (!data) return <div className="h-48 animate-pulse rounded-3xl bg-surface" />;
  return (
    <div className="space-y-4">
      <Section title={t("anomalies")} id="anom">
        {data.flags.length === 0 ? (
          <p className="text-sm text-mute">{t("noAnomalies")}</p>
        ) : (
          <ul className="divide-y divide-line" data-testid="anomalies">
            {data.flags.map((f, i) => (
              <li key={i} className="py-2 text-sm">
                <span className="font-extrabold uppercase">{f.eventName}</span> · <span className="text-orange">{t(`anomaly.${f.kind}`, { n: f.value })}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-mute">{t("anomalyNote")}</p>
      </Section>
      <Section title={t("auditLog")} id="log">
        {data.log.length === 0 ? (
          <p className="text-sm text-mute">{t("noAudit")}</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {data.log.map((l, i) => (
              <li key={i} className="py-2">
                <span className="text-xs text-mute">{when(l.at)}</span> · <b>{t.has(`action.${l.action}`) ? t(`action.${l.action}`) : l.action}</b>
                {l.reason ? ` · ${l.reason}` : ""}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
