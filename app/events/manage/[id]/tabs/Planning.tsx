"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, ShieldAlert, UserCheck } from "lucide-react";
import { Field, Input, Select } from "@/components/forms/Fields";
import { Button } from "@/components/ui/primitives";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ConfirmedBadge, SafetyNote, Section, StatusPill, SuggestionBadge, useOpsPost } from "@/components/ops/shared";
import { REQ_KEYS } from "@/lib/ops/planner";
import { SCALE_LEVELS, type ReqCategory, type Requirement } from "@/lib/ops/types";
import type { TabProps } from "../ctx";

const CATS: ReqCategory[] = ["venue", "sound", "lighting_video", "dj", "staff", "safety"];

export function Planning({ v, reload, eid }: TabProps) {
  const t = useTranslations("ops");
  const post = useOpsPost();
  const [addKey, setAddKey] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [expertFor, setExpertFor] = useState<Requirement | null>(null);
  const canEdit = !!v.me.can.edit_requirements;
  const level = SCALE_LEVELS[v.level - 1];
  const update = async (r: Requirement, patch: Record<string, unknown>) => {
    if (await post(`events/${eid}/requirements/${r.id}`, patch)) await reload();
  };
  return (
    <>
      <Section title={t("planTitle")} id="plan-h" action={<SuggestionBadge />}>
        <p className="text-sm text-mute">{t("planSub", { level: v.level, name: t(`level.${level.key}`) })}</p>
        <SafetyNote className="mt-3">{t("safetyDisclaimer")}</SafetyNote>
      </Section>
      {CATS.map((c) => {
        const rows = v.requirements.filter((r) => r.category === c);
        if (!rows.length) return null;
        return (
          <Section key={c} title={t(`cat.${c}`)} id={`cat-${c}`}>
            <ul className="divide-y divide-line" data-testid={`reqs-${c}`}>
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3" data-key={r.key}>
                  <div className="min-w-0 flex-1 basis-56">
                    <div className="flex flex-wrap items-center gap-2 font-bold">
                      {r.safetyCritical && <ShieldAlert className="size-4 text-coral" aria-label={t("safetyCritical")} />}
                      <span>{t(`req.${r.key}`)}</span>
                      {r.source === "planner" ? <SuggestionBadge /> : <span className="text-[10px] font-extrabold uppercase tracking-widest text-mute">{t(`source.${r.source}`)}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-mute">
                      {r.credential && <span>{t("needsCredential", { cred: t(`cred.${r.credential}`) })}</span>}
                      {r.coveredBy && <span>{t(`covered.${r.coveredBy}`)}</span>}
                      {r.expertConfirmation && <ConfirmedBadge label={t("expertConfirmedBy", { name: r.expertConfirmation.by })} />}
                    </div>
                  </div>
                  <StatusPill status={r.status} label={t(`status.${r.status}`)} />
                  {canEdit && r.status !== "booked" ? (
                    <label className="flex items-center gap-1 text-sm">
                      <span className="sr-only">{t("quantity")}</span>×
                      <input
                        type="number"
                        min={1}
                        defaultValue={r.quantity}
                        className="h-11 w-20 rounded-xl border-2 border-line bg-ink px-2 text-cream"
                        onBlur={(e) => {
                          const q = Number(e.target.value);
                          if (q && q !== r.quantity) {
                            if (r.safetyCritical && q < r.quantity) setExpertFor({ ...r, quantity: q });
                            else void update(r, { quantity: q });
                          }
                        }}
                        data-testid={`qty-${r.key}`}
                      />
                    </label>
                  ) : (
                    <span className="font-bold tabular-nums">×{r.quantity}</span>
                  )}
                  {canEdit && !r.safetyCritical && r.status !== "booked" && (
                    <Button size="sm" variant="ghost" onClick={() => void update(r, { notNeeded: r.status !== "not_needed" })}>
                      {r.status === "not_needed" ? t("markNeeded") : t("markNotNeeded")}
                    </Button>
                  )}
                  {r.safetyCritical && !r.expertConfirmation && v.me.can.confirm_expert && (
                    <Button size="sm" variant="ghost" onClick={() => setExpertFor(r)} data-testid={`expert-${r.key}`}>
                      <UserCheck className="size-4" aria-hidden /> {t("recordExpert")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        );
      })}
      {canEdit && (
        <Section title={t("addRequirement")} id="add-h">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1 basis-56">
              <Field id="add-key" label={t("item")}>
                <Select id="add-key" value={addKey} onChange={(e) => setAddKey(e.target.value)}>
                  <option value="">—</option>
                  {REQ_KEYS.map((k) => <option key={k} value={k}>{t(`req.${k}`)}</option>)}
                </Select>
              </Field>
            </div>
            <div className="w-28">
              <Field id="add-qty" label={t("quantity")}><Input id="add-qty" type="number" min={1} value={addQty} onChange={(e) => setAddQty(Math.max(1, Number(e.target.value) || 1))} /></Field>
            </div>
            <Button disabled={!addKey} onClick={async () => { if (await post(`events/${eid}/requirements`, { key: addKey, quantity: addQty }, t("saved"))) { setAddKey(""); await reload(); } }}>
              <Plus className="size-4" aria-hidden /> {t("add")}
            </Button>
          </div>
        </Section>
      )}
      {expertFor && <ExpertSheet r={expertFor} onClose={() => setExpertFor(null)} onSave={async (name) => { await update(expertFor, { expertName: name, quantity: expertFor.quantity }); setExpertFor(null); }} />}
    </>
  );
}

function ExpertSheet({ r, onClose, onSave }: { r: Requirement; onClose: () => void; onSave: (name: string) => Promise<void> }) {
  const t = useTranslations("ops");
  const [name, setName] = useState("");
  return (
    <BottomSheet open onClose={onClose} title={t("recordExpert")} footer={<div className="flex justify-end"><Button disabled={name.trim().length < 3} onClick={() => void onSave(name.trim())} data-testid="save-expert">{t("save")}</Button></div>}>
      <p className="text-sm">{t("expertBody", { item: t(`req.${r.key}`), qty: r.quantity })}</p>
      <div className="mt-3">
        <Field id="ex-name" label={t("expertName")} hint={t("expertHint")}>
          <Input id="ex-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} data-testid="expert-name" />
        </Field>
      </div>
    </BottomSheet>
  );
}
