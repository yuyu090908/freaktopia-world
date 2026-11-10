"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Pencil, ShieldAlert, ShieldCheck } from "lucide-react";
import { Field, Input, Select, ToggleRow } from "@/components/forms/Fields";
import { Button, Progress } from "@/components/ui/primitives";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Section, StatusPill, useOpsPost, useWhen } from "@/components/ops/shared";
import { SCALE_LEVELS, type ScaleLevel } from "@/lib/ops/types";
import type { TabProps } from "../ctx";
import { useConflictText } from "./common";

export function Overview({ v, reload, eid }: TabProps) {
  const t = useTranslations("ops");
  const when = useWhen();
  const conflictText = useConflictText();
  const [edit, setEdit] = useState(false);
  const tz = v.event.timezone;
  const nextTasks = v.tasks.filter((x) => x.status !== "done").sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? "")).slice(0, 5);
  const key = v.schedule.filter((s) => ["load_in", "doors", "show_start", "show_end", "load_out"].includes(s.kind));
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Section title={t("readiness")} id="ready-h">
          <div className="flex items-end gap-3" data-testid="readiness">
            <div className="font-display text-5xl text-acid tabular-nums">{v.readiness.overall}%</div>
            <p className="pb-1 text-xs text-mute">{t("readinessSub")}</p>
          </div>
          <ul className="mt-3 space-y-2">
            {v.readiness.areas.map((a) => (
              <li key={a.area}>
                <div className="flex justify-between text-sm">
                  <span>{t(`area.${a.area}`)}</span>
                  <span className="font-bold tabular-nums">{a.pct}%</span>
                </div>
                <Progress value={a.pct / 100} label={t(`area.${a.area}`)} color={a.pct >= 100 ? "#B6F05C" : a.pct > 0 ? "#55BCEB" : "#FF625C"} />
              </li>
            ))}
          </ul>
        </Section>
        <Section title={t("safetyStatus")} id="safe-h">
          <div className={v.safety.approved ? "flex items-center gap-2 text-acid" : "flex items-center gap-2 text-coral"} data-testid="safety-status">
            {v.safety.approved ? <ShieldCheck className="size-8" aria-hidden /> : <ShieldAlert className="size-8" aria-hidden />}
            <span className="font-display text-2xl uppercase">{v.safety.approved ? t("safetyApproved") : t("safetyNotApproved")}</span>
          </div>
          <p className="mt-2 text-sm text-mute">{t("safetySeparate")}</p>
          <ul className="mt-3 space-y-1 text-sm">
            {v.safety.rows.map((r) => (
              <li key={r.key} className="flex items-center gap-2">
                {r.met ? <CheckCircle2 className="size-4 text-acid" aria-hidden /> : <AlertTriangle className="size-4 text-orange" aria-hidden />}
                <span>{t(`safety.${r.key}`)}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section title={t("conflicts")} id="conf-h">
        {v.conflicts.length === 0 ? (
          <p className="text-sm text-mute">{t("noConflicts")}</p>
        ) : (
          <ul className="space-y-2" data-testid="conflicts">
            {v.conflicts.map((c, i) => (
              <li key={`${c.kind}-${c.ref}-${i}`} className="flex items-start gap-2 rounded-2xl bg-surface-2 p-3 text-sm" data-kind={c.kind}>
                <StatusPill status={c.severity} label={t(`severity.${c.severity}`)} />
                <span>{conflictText(c)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title={t("nextTasks")} id="tasks-h">
          {nextTasks.length === 0 && <p className="text-sm text-mute">{t("noTasks")}</p>}
          <ul className="space-y-2 text-sm">
            {nextTasks.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">{x.templateKey ? t(`task.${x.templateKey}`) : x.title}</span>
                <span className="shrink-0 text-xs text-mute">{when(x.dueAt, tz, false)}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title={t("keyTimes")} id="times-h">
          <ul className="space-y-1 text-sm">
            {key.map((s) => (
              <li key={s.id} className="flex justify-between gap-2">
                <span>{t(`sched.${s.kind}`)}</span>
                <span className="text-mute">{when(s.startAt, tz)}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {v.me.can.edit_event && (
        <Button variant="ghost" onClick={() => setEdit(true)} data-testid="edit-event">
          <Pencil className="size-4" aria-hidden /> {t("editEvent")}
        </Button>
      )}
      {edit && <EditSheet v={v} eid={eid} onClose={() => setEdit(false)} reload={reload} />}
    </>
  );
}

function EditSheet({ v, eid, onClose, reload }: TabProps & { onClose: () => void }) {
  const t = useTranslations("ops");
  const post = useOpsPost();
  const e = v.event;
  const [name, setName] = useState(e.name);
  const [venueName, setVenue] = useState(e.venueName);
  const [attendance, setAttendance] = useState(e.attendance);
  const [override, setOverride] = useState<ScaleLevel | null>(e.levelOverride);
  const [budget, setBudget] = useState(e.budgetUsd ?? 0);
  const [streaming, setStreaming] = useState(e.streaming);
  const [djs, setDjs] = useState(e.djs);
  const save = async () => {
    const patch: Record<string, unknown> = { name, venueName, attendance, levelOverride: override, streaming, djs };
    if (v.me.can.edit_budget) patch.budgetUsd = budget;
    if (await post("events/" + eid, { patch, version: e.version }, t("saved"))) {
      onClose();
      await reload();
    }
  };
  return (
    <BottomSheet open onClose={onClose} title={t("editEvent")} footer={<div className="flex justify-end"><Button onClick={() => void save()} data-testid="save-event">{t("save")}</Button></div>}>
      <div className="space-y-3">
        <Field id="e-name" label={t("fName")}><Input id="e-name" value={name} onChange={(x) => setName(x.target.value)} maxLength={80} /></Field>
        <Field id="e-venue" label={t("fVenue")} optional><Input id="e-venue" value={venueName} onChange={(x) => setVenue(x.target.value)} maxLength={80} /></Field>
        <Field id="e-att" label={t("fAttendance")} hint={t("replanHint")}><Input id="e-att" type="number" min={1} value={attendance} onChange={(x) => setAttendance(Math.max(1, Number(x.target.value) || 1))} data-testid="edit-attendance" /></Field>
        <Field id="e-lvl" label={t("fLevel")}>
          <Select id="e-lvl" value={override ?? ""} onChange={(x) => setOverride(x.target.value ? (Number(x.target.value) as ScaleLevel) : null)}>
            <option value="">{t("levelAuto")}</option>
            {SCALE_LEVELS.map((l) => <option key={l.level} value={l.level}>L{l.level} · {t(`level.${l.key}`)}</option>)}
          </Select>
        </Field>
        {v.me.can.edit_budget && <Field id="e-bud" label={t("fBudget")}><Input id="e-bud" type="number" min={0} value={budget} onChange={(x) => setBudget(Math.max(0, Number(x.target.value) || 0))} /></Field>}
        <ToggleRow checked={djs} onChange={setDjs} label={t("fDjs")} />
        <ToggleRow checked={streaming} onChange={setStreaming} label={t("fStreaming")} />
      </div>
    </BottomSheet>
  );
}
