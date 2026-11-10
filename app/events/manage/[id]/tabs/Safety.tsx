"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertOctagon, CheckCircle2, CircleDashed, LifeBuoy, Siren } from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/forms/Fields";
import { Button, DemoBadge } from "@/components/ui/primitives";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ConfirmSheet, SafetyNote, Section, StatusPill, useMoney, useOps, useOpsPost, useWhen } from "@/components/ops/shared";
import type { Incident, IncidentType, Severity } from "@/lib/ops/types";
import type { Candidate, TabProps } from "../ctx";
import { useMemberName } from "./common";

const TYPES: IncidentType[] = ["equipment_failure", "staff_shortage", "load_in_delay", "power", "weather", "venue_facility", "cancellation", "other"];
const SEV: Severity[] = ["low", "medium", "high", "critical"];

export function Safety({ v, reload, eid }: TabProps) {
  const t = useTranslations("ops");
  const when = useWhen();
  const post = useOpsPost();
  const [approve, setApprove] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [report, setReport] = useState(false);
  const [rep, setRep] = useState<Incident | null>(null);
  const name = useMemberName(v);
  return (
    <>
      <SafetyNote>{t("goNoGo")}</SafetyNote>
      <Section title={t("checklist")} id="chk-h" action={<span className={v.safety.approved ? "text-sm font-bold text-acid" : "text-sm font-bold text-coral"} data-testid="safety-approved">{v.safety.approved ? t("safetyApproved") : t("safetyNotApproved")}</span>}>
        <ul className="divide-y divide-line" data-testid="checklist">
          {v.safety.rows.map((r) => (
            <li key={r.key} className="flex flex-wrap items-center gap-2 py-2 text-sm" data-key={r.key} data-met={r.met ? "1" : "0"}>
              {r.met ? <CheckCircle2 className="size-5 text-acid" aria-hidden /> : <CircleDashed className="size-5 text-orange" aria-hidden />}
              <div className="min-w-0 flex-1 basis-48">
                <div className="font-bold">{t(`safety.${r.key}`)}</div>
                <div className="text-xs text-mute">
                  {r.auto ? t("autoCheck") : r.met ? t("approvedBy", { name: name(r.approvedBy), at: when(r.approvedAt), ref: r.reference }) : t("manualCheck")}
                  {!r.met && r.dueAt && ` · ${t("dueBy", { at: when(r.dueAt, v.event.timezone, false) })}`}
                </div>
              </div>
              {!r.auto && v.me.can.approve_safety && (
                r.met ? (
                  <Button size="sm" variant="ghost" onClick={async () => { if (await post(`events/${eid}/safety/${r.key}`, { approve: false, reference: "", confirm: true })) await reload(); }}>{t("revoke")}</Button>
                ) : (
                  <Button size="sm" onClick={() => { setApprove(r.key); setReference(""); }} data-testid={`approve-${r.key}`}>{t("approve")}</Button>
                )
              )}
            </li>
          ))}
        </ul>
        {v.safety.expertPending.length > 0 && (
          <div className="mt-3 rounded-2xl border border-orange/40 bg-orange/10 p-3 text-sm" data-testid="expert-pending">
            <div className="font-bold">{t("expertPending", { count: v.safety.expertPending.length })}</div>
            <p className="text-xs text-mute">{t("expertPendingSub")}</p>
            <ul className="mt-1 flex flex-wrap gap-1 text-xs">
              {v.safety.expertPending.map((id) => <li key={id} className="rounded-full bg-ink px-2 py-0.5">{t(`req.${v.requirements.find((r) => r.id === id)?.key ?? "venue_permit"}`)}</li>)}
            </ul>
          </div>
        )}
      </Section>

      <Section title={t("incidents")} id="inc-h" action={v.me.can.report_incident === false ? undefined : <Button size="sm" variant="coral" onClick={() => setReport(true)} data-testid="report-incident"><Siren className="size-4" aria-hidden /> {t("reportIncident")}</Button>}>
        {v.incidents.length === 0 && <p className="text-sm text-mute">{t("noIncidents")}</p>}
        <ul className="space-y-2" data-testid="incidents">
          {v.incidents.sort((a, b) => b.at.localeCompare(a.at)).map((i) => (
            <li key={i.id} className="rounded-2xl bg-surface-2 p-3 text-sm" data-type={i.type}>
              <div className="flex flex-wrap items-center gap-2">
                <AlertOctagon className="size-4 text-coral" aria-hidden />
                <span className="min-w-0 flex-1 font-bold">{t(`incident.${i.type}`)}{(() => { const k = v.incidentTargets.find((r) => r.id === i.requirementId)?.key; return k ? ` · ${t(`req.${k}`)}` : ""; })()}</span>
                <StatusPill status={i.severity} label={t(`severity.${i.severity}`)} />
                <StatusPill status={i.status} label={t(`incStatus.${i.status}`)} />
              </div>
              {i.description && <p className="mt-1 whitespace-pre-wrap">{i.description}</p>}
              <div className="mt-1 text-xs text-mute">{when(i.at)} · {t("assignee")}: {name(i.assigneeId)}</div>
              {v.me.can.manage_incidents && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <label className="text-xs"><span className="sr-only">{t("statusLabel")}</span>
                    <select className="h-11 rounded-xl border-2 border-line bg-ink px-2 text-cream" value={i.status} onChange={async (e) => { if (await post(`events/${eid}/incidents/${i.id}`, { status: e.target.value })) await reload(); }}>
                      {(["open", "in_progress", "resolved"] as const).map((s) => <option key={s} value={s}>{t(`incStatus.${s}`)}</option>)}
                    </select>
                  </label>
                  <label className="text-xs"><span className="sr-only">{t("assignee")}</span>
                    <select className="h-11 max-w-40 rounded-xl border-2 border-line bg-ink px-2 text-cream" value={i.assigneeId ?? ""} onChange={async (e) => { if (await post(`events/${eid}/incidents/${i.id}`, { assigneeId: e.target.value || null })) await reload(); }}>
                      <option value="">{t("unassigned")}</option>
                      {v.members.map((m) => <option key={m.userId} value={m.userId}>{m.displayName}</option>)}
                    </select>
                  </label>
                  {i.requirementId && i.status !== "resolved" && ["staff_shortage", "cancellation", "equipment_failure"].includes(i.type) && (
                    <Button size="sm" variant="ghost" onClick={() => setRep(i)} data-testid="replacements"><LifeBuoy className="size-4" aria-hidden /> {t("findReplacement")}</Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <ConfirmSheet
        open={!!approve}
        onClose={() => setApprove(null)}
        title={t("approve")}
        statement={t("approveStatement", { check: approve ? t(`safety.${approve}`) : "" })}
        confirmLabel={t("approve")}
        onConfirm={async () => {
          if (!reference.trim()) return;
          if (await post(`events/${eid}/safety/${approve}`, { approve: true, reference, confirm: true }, t("saved"))) {
            setApprove(null);
            await reload();
          }
        }}
      >
        <Field id="ap-ref" label={t("reference")} hint={t("referenceHint")}><Input id="ap-ref" value={reference} maxLength={300} onChange={(e) => setReference(e.target.value)} data-testid="approve-reference" /></Field>
      </ConfirmSheet>
      {report && <ReportSheet {...{ v, reload, eid }} onClose={() => setReport(false)} />}
      {rep && <ReplacementSheet eid={eid} incident={rep} onClose={() => setRep(null)} reload={reload} />}
    </>
  );
}

function ReportSheet({ v, reload, eid, onClose }: TabProps & { onClose: () => void }) {
  const t = useTranslations("ops");
  const post = useOpsPost();
  const [type, setType] = useState<IncidentType>("equipment_failure");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [description, setDescription] = useState("");
  const [requirementId, setReq] = useState("");
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={t("reportIncident")}
      footer={<div className="flex justify-end"><Button variant="coral" disabled={description.trim().length < 3} onClick={async () => { if (await post(`events/${eid}/incidents`, { type, severity, description, requirementId: requirementId || null }, t("reported"))) { onClose(); await reload(); } }} data-testid="submit-incident">{t("report")}</Button></div>}
    >
      <div className="space-y-3">
        <Field id="i-type" label={t("incidentType")}><Select id="i-type" value={type} onChange={(e) => setType(e.target.value as IncidentType)} data-testid="incident-type">{TYPES.map((x) => <option key={x} value={x}>{t(`incident.${x}`)}</option>)}</Select></Field>
        <Field id="i-sev" label={t("severityLabel")}><Select id="i-sev" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)} data-testid="incident-severity">{SEV.map((x) => <option key={x} value={x}>{t(`severity.${x}`)}</option>)}</Select></Field>
        {v.incidentTargets.length > 0 && (
          <Field id="i-req" label={t("affects")} optional><Select id="i-req" value={requirementId} onChange={(e) => setReq(e.target.value)} data-testid="incident-req"><option value="">—</option>{v.incidentTargets.map((r) => <option key={r.id} value={r.id}>{t(`req.${r.key}`)}</option>)}</Select></Field>
        )}
        <Field id="i-desc" label={t("whatHappened")}><Textarea id="i-desc" value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} data-testid="incident-desc" /></Field>
      </div>
    </BottomSheet>
  );
}

function ReplacementSheet({ eid, incident, onClose, reload }: { eid: string; incident: Incident; onClose: () => void; reload: () => Promise<void> }) {
  const t = useTranslations("ops");
  const money = useMoney();
  const post = useOpsPost();
  const { data } = useOps<{ eligible: Candidate[]; excluded: Candidate[] }>(`/api/ops/events/${eid}/incidents/${incident.id}/replacements`);
  const [pick, setPick] = useState<Candidate | null>(null);
  return (
    <BottomSheet open onClose={onClose} title={t("findReplacement")}>
      <p className="text-sm text-mute">{t("replacementExplain")}</p>
      {!data && <div className="mt-3 h-20 animate-pulse rounded-2xl bg-surface" />}
      <ul className="mt-3 space-y-2" data-testid="replacement-list">
        {data?.eligible.length === 0 && <li className="text-sm text-mute">{t("noCandidates")}</li>}
        {data?.eligible.map((c) => (
          <li key={c.listing.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface-2 p-3 text-sm">
            <span className="min-w-0"><span className="font-bold">{c.listing.title}</span> {c.listing.demo && <DemoBadge />}<span className="block text-xs text-mute">{c.providerName ? `${c.providerName} · ` : ""}{money(c.listing.priceUsd)} · {t("matchScore")} {c.score}</span></span>
            <Button size="sm" onClick={() => setPick(c)}>{t("requestQuote")}</Button>
          </li>
        ))}
      </ul>
      <ConfirmSheet
        open={!!pick}
        onClose={() => setPick(null)}
        title={t("contactReplacement")}
        statement={t("contactStatement", { name: pick?.listing.title ?? "" })}
        confirmLabel={t("send")}
        onConfirm={async () => {
          if (pick && (await post(`events/${eid}/openings`, { kind: "quote", requirementIds: [incident.requirementId], targetListingId: pick.listing.id }, t("sent")))) {
            setPick(null);
            onClose();
            await reload();
          }
        }}
      />
    </BottomSheet>
  );
}
