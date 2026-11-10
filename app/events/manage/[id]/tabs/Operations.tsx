"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Paperclip, Plus, Send, Trash2, UserPlus } from "lucide-react";
import { Field, Input, Select } from "@/components/forms/Fields";
import { Button, Chip } from "@/components/ui/primitives";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Section, StatusPill, fileToBase64, useOps, useOpsPost, useWhen } from "@/components/ops/shared";
import { isoToZoned, zonedToIso } from "@/lib/ops/time";
import type { Area, DocAudience, DocKind, Message, ScheduleItem, ScheduleKind, Task, TaskStatus, MemberRole } from "@/lib/ops/types";
import type { TabProps } from "../ctx";
import { useMemberName } from "./common";

const AREAS: Area[] = ["general", "sound", "lighting", "operations", "dj", "safety"];

export function Operations(p: TabProps) {
  return (
    <>
      <Chat {...p} />
      <Tasks {...p} />
      <Schedule {...p} />
      <Files {...p} />
      <Team {...p} />
      <Handovers {...p} />
    </>
  );
}

// ------------------------------------------------------------------ chat (general + per-area threads)

function Chat({ v, eid }: TabProps) {
  const t = useTranslations("ops");
  const when = useWhen();
  const post = useOpsPost();
  const [thread, setThread] = useState<Area>("general");
  const { data, reload } = useOps<{ messages: Message[] }>(`/api/ops/events/${eid}/messages/${thread}`);
  const [body, setBody] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = setInterval(() => void reload(), 15_000); // simple polling; no realtime service is connected
    return () => clearInterval(id);
  }, [reload]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [data]);
  const send = async () => {
    if (!body.trim()) return;
    if (await post(`events/${eid}/messages/${thread}`, { body })) {
      setBody("");
      await reload();
    }
  };
  return (
    <Section title={t("chat")} id="chat-h">
      <div className="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label={t("threads")}>
        {v.threads.map((a) => (
          <Chip key={a} active={thread === a} onClick={() => setThread(a)} className="min-h-9 px-3 text-xs" data-testid={`thread-${a}`}>
            {t(`area.${a}`)}
          </Chip>
        ))}
      </div>
      <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl bg-ink/60 p-3" data-testid="chat-log" aria-live="polite">
        {data?.messages.length === 0 && <p className="text-sm text-mute">{t("noMessages")}</p>}
        {data?.messages.map((m) => (
          <div key={m.id} className={m.authorId === v.me.userId ? "ml-auto max-w-[85%] rounded-2xl bg-acid/15 p-2 text-sm" : "max-w-[85%] rounded-2xl bg-surface-2 p-2 text-sm"}>
            <div className="text-[11px] font-bold text-mute">{m.authorName} · {when(m.at)}</div>
            <p className="whitespace-pre-wrap break-words">{m.body}</p>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <label htmlFor="chat-in" className="sr-only">{t("message")}</label>
        <Input id="chat-in" value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} placeholder={t("chatPlaceholder")} data-testid="chat-input" />
        <Button type="submit" aria-label={t("send")} data-testid="chat-send"><Send className="size-4" aria-hidden /></Button>
      </form>
    </Section>
  );
}

// ------------------------------------------------------------------ tasks

function Tasks({ v, reload, eid }: TabProps) {
  const t = useTranslations("ops");
  const when = useWhen();
  const post = useOpsPost();
  const name = useMemberName(v);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [area, setArea] = useState<Area>("general");
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState("");
  const tz = v.event.timezone;
  const mine = v.me.can.manage_all_tasks ? v.tasks : v.tasks.filter((x) => x.assigneeId === v.me.userId || (v.me.role === "lead" && x.area === v.me.area) || x.area === "general");
  const canEdit = (x: Task) => !!v.me.can.manage_all_tasks || (v.me.role === "lead" && x.area === v.me.area) || x.assigneeId === v.me.userId;
  const save = async (body: Record<string, unknown>) => {
    if (await post(`events/${eid}/tasks`, body)) await reload();
  };
  const done = mine.filter((x) => x.status === "done").length;
  return (
    <Section title={t("tasks")} id="tasks2-h" action={<span className="text-sm text-mute">{t("tasksDone", { done, total: mine.length })}</span>}>
      <ul className="divide-y divide-line" data-testid="tasks">
        {mine.sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? "")).map((x) => (
          <li key={x.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
            <span className={x.status === "done" ? "min-w-0 flex-1 basis-48 text-mute line-through" : "min-w-0 flex-1 basis-48"}>{x.templateKey ? t(`task.${x.templateKey}`) : x.title}</span>
            <span className="text-xs text-mute">{t(`area.${x.area}`)} · {name(x.assigneeId)} · {when(x.dueAt, tz, false)}</span>
            {canEdit(x) ? (
              <label className="text-xs">
                <span className="sr-only">{t("statusLabel")}</span>
                <select className="h-11 rounded-xl border-2 border-line bg-ink px-2 text-cream" value={x.status} onChange={(e) => void save({ id: x.id, status: e.target.value as TaskStatus })} data-testid="task-status">
                  {(["todo", "doing", "done"] as TaskStatus[]).map((s) => <option key={s} value={s}>{t(`taskStatus.${s}`)}</option>)}
                </select>
              </label>
            ) : (
              <StatusPill status={x.status} label={t(`taskStatus.${x.status}`)} />
            )}
            {v.me.can.manage_all_tasks && (
              <label className="text-xs">
                <span className="sr-only">{t("assignee")}</span>
                <select className="h-11 max-w-36 rounded-xl border-2 border-line bg-ink px-2 text-cream" value={x.assigneeId ?? ""} onChange={(e) => void save({ id: x.id, assigneeId: e.target.value || null })}>
                  <option value="">{t("unassigned")}</option>
                  {v.members.map((m) => <option key={m.userId} value={m.userId}>{m.displayName}</option>)}
                </select>
              </label>
            )}
          </li>
        ))}
      </ul>
      {(v.me.can.manage_all_tasks || v.me.role === "lead") && (
        <>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setAdding(true)} data-testid="add-task"><Plus className="size-4" aria-hidden /> {t("addTask")}</Button>
          <BottomSheet open={adding} onClose={() => setAdding(false)} title={t("addTask")} footer={<div className="flex justify-end"><Button disabled={title.trim().length < 2} onClick={async () => { await save({ title, area: v.me.role === "lead" ? v.me.area : area, assigneeId: assignee || null, dueAt: due ? zonedToIso(due, "12:00", tz) : null }); setAdding(false); setTitle(""); }} data-testid="save-task">{t("save")}</Button></div>}>
            <div className="space-y-3">
              <Field id="t-title" label={t("taskTitle")}><Input id="t-title" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} data-testid="task-title" /></Field>
              {v.me.role !== "lead" && (
                <Field id="t-area" label={t("areaLabel")}><Select id="t-area" value={area} onChange={(e) => setArea(e.target.value as Area)}>{AREAS.map((a) => <option key={a} value={a}>{t(`area.${a}`)}</option>)}</Select></Field>
              )}
              <Field id="t-as" label={t("assignee")} optional><Select id="t-as" value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="">{t("unassigned")}</option>{v.members.map((m) => <option key={m.userId} value={m.userId}>{m.displayName}</option>)}</Select></Field>
              <Field id="t-due" label={t("due")} optional><Input id="t-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
            </div>
          </BottomSheet>
        </>
      )}
    </Section>
  );
}

// ------------------------------------------------------------------ schedule

const KINDS: ScheduleKind[] = ["load_in", "setup", "soundcheck", "rehearsal", "doors", "show_start", "set", "show_end", "load_out"];

function Schedule({ v, reload, eid }: TabProps) {
  const t = useTranslations("ops");
  const when = useWhen();
  const post = useOpsPost();
  const [edit, setEdit] = useState<Partial<ScheduleItem> | null>(null);
  const tz = v.event.timezone;
  const can = !!v.me.can.edit_schedule;
  const djListings = v.listings.filter((l) => l.items.some((i) => i.key === "dj_performer"));
  return (
    <Section title={t("schedule")} id="sched-h" action={can ? <Button size="sm" variant="ghost" onClick={() => setEdit({ kind: "set", startAt: v.event.startAt, endAt: v.event.startAt })} data-testid="add-slot"><Plus className="size-4" aria-hidden /> {t("addSlot")}</Button> : undefined}>
      <p className="mb-2 text-xs text-mute">{t("timesIn", { tz })}</p>
      <ol className="space-y-1" data-testid="schedule">
        {v.schedule.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl px-2 py-1.5 text-sm odd:bg-surface-2">
            <span className="w-40 shrink-0 tabular-nums text-mute">{when(s.startAt, tz)}</span>
            <span className="min-w-0 flex-1 font-bold">{t(`sched.${s.kind}`)}{s.listingId ? ` · ${v.listings.find((l) => l.id === s.listingId)?.title ?? ""}` : ""}{s.note ? ` · ${s.note}` : ""}</span>
            {can && <button type="button" className="min-h-11 px-2 text-xs font-bold text-acid underline" onClick={() => setEdit(s)}>{t("edit")}</button>}
          </li>
        ))}
      </ol>
      {edit && (
        <SlotSheet
          tz={tz}
          item={edit}
          djListings={djListings.map((l) => ({ id: l.id, title: l.title }))}
          onClose={() => setEdit(null)}
          onDelete={edit.id ? async () => { if (await post(`events/${eid}/schedule/${edit.id}/delete`)) { setEdit(null); await reload(); } } : undefined}
          onSave={async (body) => { if (await post(`events/${eid}/schedule`, body, t("saved"))) { setEdit(null); await reload(); } }}
        />
      )}
    </Section>
  );
}

function SlotSheet({ tz, item, djListings, onClose, onSave, onDelete }: { tz: string; item: Partial<ScheduleItem>; djListings: { id: string; title: string }[]; onClose: () => void; onSave: (b: Record<string, unknown>) => Promise<void>; onDelete?: () => Promise<void> }) {
  const t = useTranslations("ops");
  const s0 = isoToZoned(item.startAt ?? new Date().toISOString(), tz);
  const e0 = isoToZoned(item.endAt ?? item.startAt ?? new Date().toISOString(), tz);
  const [kind, setKind] = useState<ScheduleKind>(item.kind ?? "set");
  const [date, setDate] = useState(s0.date);
  const [start, setStart] = useState(s0.time);
  const [endDate, setEndDate] = useState(e0.date);
  const [end, setEnd] = useState(e0.time);
  const [listingId, setListing] = useState(item.listingId ?? "");
  const [note, setNote] = useState(item.note ?? "");
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={item.id ? t("editSlot") : t("addSlot")}
      footer={
        <div className="flex justify-between gap-2">
          {onDelete ? <Button variant="ghost" onClick={() => void onDelete()} aria-label={t("delete")}><Trash2 className="size-4" aria-hidden /></Button> : <span />}
          <Button onClick={() => void onSave({ ...(item.id ? { id: item.id } : {}), kind, startAt: zonedToIso(date, start, tz), endAt: zonedToIso(endDate, end, tz), listingId: listingId || null, note })} data-testid="save-slot">{t("save")}</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Field id="s-kind" label={t("slotKind")}><Select id="s-kind" value={kind} onChange={(e) => setKind(e.target.value as ScheduleKind)} data-testid="slot-kind">{KINDS.map((k) => <option key={k} value={k}>{t(`sched.${k}`)}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="s-d" label={t("fDate")}><Input id="s-d" type="date" value={date} onChange={(e) => { setDate(e.target.value); setEndDate(e.target.value); }} /></Field>
          <Field id="s-s" label={t("fStart")}><Input id="s-s" type="time" value={start} onChange={(e) => setStart(e.target.value)} data-testid="slot-start" /></Field>
          <Field id="s-ed" label={t("endDate")}><Input id="s-ed" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
          <Field id="s-e" label={t("fEnd")}><Input id="s-e" type="time" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="slot-end" /></Field>
        </div>
        {kind === "set" && djListings.length > 0 && (
          <Field id="s-dj" label={t("performer")} optional><Select id="s-dj" value={listingId} onChange={(e) => setListing(e.target.value)}><option value="">—</option>{djListings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</Select></Field>
        )}
        <Field id="s-n" label={t("note")} optional><Input id="s-n" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </BottomSheet>
  );
}

// ------------------------------------------------------------------ files

const DOC_KINDS: DocKind[] = ["floor_plan", "stage_design", "equipment_list", "timetable", "contract", "emergency_manual", "photo", "other"];

function Files({ v, reload, eid }: TabProps) {
  const t = useTranslations("ops");
  const when = useWhen();
  const post = useOpsPost();
  const [kind, setKind] = useState<DocKind>("floor_plan");
  const [audience, setAudience] = useState<DocAudience>("team");
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const upload = async (f: File) => {
    if (f.size > 5 * 1024 * 1024) {
      const { toast } = await import("@/lib/store");
      toast({ title: t("err.FILE_TOO_LARGE"), tone: "error" });
      return;
    }
    setBusy(true);
    const data = await fileToBase64(f);
    const r = await post(`events/${eid}/documents`, { name: f.name, mime: f.type || "application/octet-stream", data, kind, audience }, t("uploaded"));
    setBusy(false);
    if (file.current) file.current.value = "";
    if (r) await reload();
  };
  const audiences: DocAudience[] = v.me.role === "owner" || v.me.role === "manager" ? ["team", "leads", "managers"] : v.me.role === "lead" ? ["team", "leads"] : ["team"];
  return (
    <Section title={t("files")} id="files-h">
      <ul className="space-y-1" data-testid="files">
        {v.documents.length === 0 && <li className="text-sm text-mute">{t("noFiles")}</li>}
        {v.documents.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
            <Paperclip className="size-4 text-mute" aria-hidden />
            <span className="min-w-0 flex-1 truncate font-bold">{d.name}</span>
            <span className="text-xs text-mute">{t(`doc.${d.kind}`)} · {t(`audience.${d.audience}`)} · {Math.ceil(d.size / 1024)} KB · {when(d.at)}</span>
            <a href={`/api/ops/documents/${d.id}`} className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-acid underline"><Download className="size-4" aria-hidden />{t("download")}</a>
          </li>
        ))}
      </ul>
      {v.me.can.upload_documents && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Field id="f-kind" label={t("docKind")}><Select id="f-kind" value={kind} onChange={(e) => setKind(e.target.value as DocKind)}>{DOC_KINDS.map((k) => <option key={k} value={k}>{t(`doc.${k}`)}</option>)}</Select></Field>
          <Field id="f-aud" label={t("whoCanOpen")}><Select id="f-aud" value={audience} onChange={(e) => setAudience(e.target.value as DocAudience)}>{audiences.map((a) => <option key={a} value={a}>{t(`audience.${a}`)}</option>)}</Select></Field>
          <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full bg-cream px-5 text-sm font-extrabold uppercase text-ink">
            <Paperclip className="size-4" aria-hidden /> {busy ? t("uploading") : t("upload")}
            <input ref={file} type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.docx,.xlsx" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} data-testid="file-input" />
          </label>
        </div>
      )}
      <p className="mt-2 text-xs text-mute">{t("filesNote")}</p>
    </Section>
  );
}

// ------------------------------------------------------------------ team

function Team({ v, reload, eid }: TabProps) {
  const t = useTranslations("ops");
  const post = useOpsPost();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("staff");
  const [area, setArea] = useState<Area>("operations");
  const roles: MemberRole[] = v.me.can.manage_managers ? ["manager", "lead", "staff", "vendor"] : ["lead", "staff", "vendor"];
  return (
    <Section title={t("team")} id="team-h">
      <ul className="space-y-1" data-testid="members">
        {v.members.map((m) => (
          <li key={m.userId} className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 font-bold">{m.displayName}{m.userId === v.me.userId ? ` (${t("you")})` : ""}</span>
            <span className="text-xs">{t(`role.${m.role}`)} · {t(`area.${m.area}`)}</span>
            {v.me.can.manage_members && m.role !== "owner" && m.userId !== v.me.userId && (m.role !== "manager" || v.me.can.manage_managers) && (
              <button type="button" className="min-h-11 px-2 text-xs font-bold text-coral underline" onClick={async () => { if (await post(`events/${eid}/members/${m.userId}/remove`)) await reload(); }}>{t("remove")}</button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-mute">{t("rolesExplain")}</p>
      {v.me.can.manage_members && (
        <form
          className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await post<{ invited: boolean }>(`events/${eid}/members`, { email, role, area });
            if (r) {
              const { toast } = await import("@/lib/store");
              toast({ title: t("inviteSent"), body: t("inviteSentBody"), tone: "success" });
              setEmail("");
              await reload();
            }
          }}
        >
          <Field id="inv-email" label={t("inviteEmail")}><Input id="inv-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="invite-email" /></Field>
          <Field id="inv-role" label={t("roleLabel")}><Select id="inv-role" value={role} onChange={(e) => setRole(e.target.value as MemberRole)} data-testid="invite-role">{roles.map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}</Select></Field>
          <Field id="inv-area" label={t("areaLabel")}><Select id="inv-area" value={area} onChange={(e) => setArea(e.target.value as Area)} data-testid="invite-area">{AREAS.map((a) => <option key={a} value={a}>{t(`area.${a}`)}</option>)}</Select></Field>
          <Button type="submit" data-testid="invite"><UserPlus className="size-4" aria-hidden /> {t("invite")}</Button>
        </form>
      )}
    </Section>
  );
}

// ------------------------------------------------------------------ equipment handovers

function Handovers({ v, reload, eid }: TabProps) {
  const t = useTranslations("ops");
  const when = useWhen();
  const post = useOpsPost();
  const [form, setForm] = useState<{ bookingId: string; direction: "out" | "return"; quantity: number; condition: "ok" | "minor_damage" | "damaged" | "missing"; note: string } | null>(null);
  const bookings = v.bookings.filter((b) => b.status === "confirmed" || b.status === "completed");
  if (!v.me.can.record_handover || !bookings.length) return null;
  const title = (bid: string) => v.listings.find((l) => l.id === v.bookings.find((b) => b.id === bid)?.listingId)?.title ?? "—";
  return (
    <Section title={t("handovers")} id="ho-h">
      <ul className="space-y-1 text-sm">
        {bookings.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
            <span className="min-w-0 flex-1 font-bold">{title(b.id)} ×{b.quantity}</span>
            <Button size="sm" variant="ghost" onClick={() => setForm({ bookingId: b.id, direction: "out", quantity: b.quantity, condition: "ok", note: "" })}>{t("handOut")}</Button>
            <Button size="sm" variant="ghost" onClick={() => setForm({ bookingId: b.id, direction: "return", quantity: b.quantity, condition: "ok", note: "" })}>{t("handReturn")}</Button>
          </li>
        ))}
      </ul>
      {v.handovers.length > 0 && (
        <ol className="mt-3 space-y-1 text-xs text-mute" data-testid="handover-log">
          {v.handovers.map((h) => (
            <li key={h.id}>{when(h.at)} · {title(h.bookingId)} · {t(`direction.${h.direction}`)} ×{h.quantity} · {t(`condition.${h.condition}`)}{h.note ? ` · ${h.note}` : ""}</li>
          ))}
        </ol>
      )}
      {form && (
        <BottomSheet open onClose={() => setForm(null)} title={t(`direction.${form.direction}`)} footer={<div className="flex justify-end"><Button onClick={async () => { if (await post(`events/${eid}/handovers`, form, t("saved"))) { setForm(null); await reload(); } }}>{t("save")}</Button></div>}>
          <div className="space-y-3">
            <Field id="h-q" label={t("quantity")}><Input id="h-q" type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Math.max(0, Number(e.target.value) || 0) })} /></Field>
            <Field id="h-c" label={t("conditionLabel")}><Select id="h-c" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value as typeof form.condition })}>{(["ok", "minor_damage", "damaged", "missing"] as const).map((c) => <option key={c} value={c}>{t(`condition.${c}`)}</option>)}</Select></Field>
            <Field id="h-n" label={t("note")} optional><Input id="h-n" value={form.note} maxLength={500} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
            <p className="text-xs text-mute">{t("handoverNote")}</p>
          </div>
        </BottomSheet>
      )}
    </Section>
  );
}
