"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import qrcode from "qrcode-generator";
import { useWhen } from "@/components/ops/shared";
import { useParty } from "./shared";

interface Pass {
  eventId: string;
  eventName: string;
  startAt: string;
  endAt: string;
  timezone: string;
  code: string;
  payload: string;
  checkedInAt: string | null;
}

/** QR entry pass for one RSVP. The door team scans it (or types the code); the RSVP itself never counts as attendance. */
export function PassCard({ eventId }: { eventId: string }) {
  const t = useTranslations("party");
  const when = useWhen();
  const { data, error } = useParty<{ pass: Pass }>(`/api/party/pass/${eventId}`);
  const svg = useMemo(() => {
    if (!data) return "";
    const q = qrcode(0, "M");
    q.addData(data.pass.payload);
    q.make();
    return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }, [data]);
  if (error) return <p className="mt-3 text-sm text-orange">{t("passUnavailable")}</p>;
  if (!data) return <div className="mt-3 h-64 w-56 animate-pulse rounded-3xl bg-surface" />;
  const p = data.pass;
  return (
    <div className="mt-3 inline-block rounded-3xl border-[3px] border-ink bg-cream p-4 text-ink" data-testid="pass">
      <div className="text-xs font-extrabold uppercase tracking-wider">{t("passKicker")}</div>
      <div className="max-w-56 truncate text-lg font-extrabold uppercase">{p.eventName}</div>
      <div className="text-xs">{when(p.startAt, p.timezone)}</div>
      <div className="mt-2 size-56 bg-white [&>svg]:h-full [&>svg]:w-full" role="img" aria-label={t("passQrAlt")} dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="mt-2 text-center font-mono text-2xl font-bold tracking-[0.2em]" data-testid="pass-code">{p.code}</div>
      <p className="mt-1 max-w-56 text-[11px]">{p.checkedInAt ? t("passUsed", { when: when(p.checkedInAt, p.timezone) }) : t("passNote")}</p>
    </div>
  );
}
