"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { AlertTriangle, Ban, Flag, Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Section } from "@/components/ops/shared";
import { Field, Input, Textarea } from "@/components/forms/Fields";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { BOOKING_COLORS, fileToB64, useMusic, useMusicPost } from "@/components/music/shared";
import type { BookingOffer, BookingRequest, BookingTerms } from "@/lib/music/types";

interface ListRes { received: BookingRequest[]; sent: (BookingRequest & { djName: string })[] }
interface ViewRes {
  booking: BookingRequest;
  side: "dj" | "requester";
  dj: { stageName: string; slug: string } | null;
  messages: { id: string; authorId: string; authorName: string; body: string; at: string; attachment?: { id: string; name: string; mime: string; size: number } }[];
  offers: BookingOffer[];
  conflicts: { kind: string; day: string }[];
  blocked: boolean;
}

export function BookingPill({ status }: { status: string }) {
  const t = useTranslations("music");
  const c = BOOKING_COLORS[status] ?? "#5a5a5a";
  return <span className="inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-extrabold uppercase" style={{ borderColor: c, color: c }} data-testid="booking-status">{t(`bstatus.${status}`)}</span>;
}

export function BookingsPanel({ initialId }: { initialId: string | null }) {
  const t = useTranslations("music");
  const f = useFormatter();
  const { data, reload } = useMusic<ListRes>("/api/music/me/bookings");
  const [open, setOpen] = useState<string | null>(initialId);
  const row = (b: BookingRequest, who: string) => (
    <li key={b.id}>
      <button type="button" onClick={() => setOpen(b.id)} className="flex min-h-14 w-full flex-wrap items-center gap-2 rounded-2xl bg-surface-2 p-3 text-left" data-testid="booking-row" data-booking-id={b.id}>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-extrabold">{b.kind === "inquiry" ? t("inquiryFrom", { name: who }) : b.event.name || "—"}</span>
          <span className="block text-xs text-mute">{who} · {f.dateTime(new Date(b.terms.performanceStart), { dateStyle: "medium" })} · {b.event.city}</span>
        </span>
        <BookingPill status={b.status} />
      </button>
    </li>
  );
  return (
    <div className="space-y-4">
      <Section title={t("bookingsReceived")} id="br-h">
        {!data ? <div className="h-16 animate-pulse rounded-2xl bg-surface-2" /> : data.received.length === 0 ? <p className="text-sm text-mute">{t("noBookings")}</p> : <ul className="space-y-2" data-testid="received">{data.received.map((b) => row(b, b.requesterName))}</ul>}
      </Section>
      <Section title={t("bookingsSent")} id="bs-h">
        {!data ? <div className="h-16 animate-pulse rounded-2xl bg-surface-2" /> : data.sent.length === 0 ? <p className="text-sm text-mute">{t("noBookingsSent")}</p> : <ul className="space-y-2" data-testid="sent">{data.sent.map((b) => row(b, b.djName))}</ul>}
      </Section>
      {open && <BookingThread id={open} onClose={() => { setOpen(null); reload(); }} />}
    </div>
  );
}

function TermsView({ terms }: { terms: BookingTerms }) {
  const t = useTranslations("music");
  const f = useFormatter();
  const rows: [string, string][] = [
    [t("tFee"), `${f.number(terms.feeAmount)} ${terms.currency}`],
    [t("tStart"), f.dateTime(new Date(terms.performanceStart), { dateStyle: "medium", timeStyle: "short" })],
    [t("tEnd"), f.dateTime(new Date(terms.performanceEnd), { dateStyle: "medium", timeStyle: "short" })],
    [t("tSet"), t("minutes", { n: terms.setMinutes })],
    [t("tTravel"), terms.travel || "—"],
    [t("tStay"), terms.accommodation || "—"],
    [t("tEquipment"), terms.equipment || "—"],
    [t("tNotes"), terms.notes || "—"],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm" data-testid="booking-terms">
      {rows.map(([k, v]) => (<Fragment key={k}><dt className="text-mute">{k}</dt><dd className="break-words">{v}</dd></Fragment>))}
    </dl>
  );
}

export function TermsForm({ terms, onChange }: { terms: BookingTerms; onChange: (t: BookingTerms) => void }) {
  const t = useTranslations("music");
  const local = (iso: string) => {
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  };
  const set = (p: Partial<BookingTerms>) => onChange({ ...terms, ...p });
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <Field id="bt-fee" label={t("tFee")}><Input id="bt-fee" type="number" min={0} value={terms.feeAmount} onChange={(e) => set({ feeAmount: Math.max(0, Number(e.target.value) || 0) })} data-testid="bt-fee" /></Field>
        <Field id="bt-cur" label={t("tCurrency")}><Input id="bt-cur" value={terms.currency} maxLength={3} onChange={(e) => set({ currency: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} /></Field>
      </div>
      <Field id="bt-set" label={t("tSet")}><Input id="bt-set" type="number" min={15} max={720} value={terms.setMinutes} onChange={(e) => set({ setMinutes: Math.max(15, Math.min(720, Number(e.target.value) || 60)) })} /></Field>
      <Field id="bt-s" label={t("tStart")}><Input id="bt-s" type="datetime-local" value={local(terms.performanceStart)} onChange={(e) => e.target.value && set({ performanceStart: new Date(e.target.value).toISOString() })} data-testid="bt-start" /></Field>
      <Field id="bt-e" label={t("tEnd")}><Input id="bt-e" type="datetime-local" value={local(terms.performanceEnd)} onChange={(e) => e.target.value && set({ performanceEnd: new Date(e.target.value).toISOString() })} data-testid="bt-end" /></Field>
      <Field id="bt-tr" label={t("tTravel")} optional><Input id="bt-tr" value={terms.travel} maxLength={500} onChange={(e) => set({ travel: e.target.value })} /></Field>
      <Field id="bt-st" label={t("tStay")} optional><Input id="bt-st" value={terms.accommodation} maxLength={500} onChange={(e) => set({ accommodation: e.target.value })} /></Field>
      <Field id="bt-eq" label={t("tEquipment")} optional><Input id="bt-eq" value={terms.equipment} maxLength={500} onChange={(e) => set({ equipment: e.target.value })} /></Field>
      <Field id="bt-no" label={t("tNotes")} optional><Input id="bt-no" value={terms.notes} maxLength={1000} onChange={(e) => set({ notes: e.target.value })} /></Field>
    </div>
  );
}

function BookingThread({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useTranslations("music");
  const f = useFormatter();
  const href = useLocalHref();
  const post = useMusicPost();
  const { data, reload } = useMusic<ViewRes>(`/api/music/bookings/${id}`);
  const [msg, setMsg] = useState("");
  const [counter, setCounter] = useState<BookingTerms | null>(null);
  const [details, setDetails] = useState<string | null>(null);
  const [confirmOk, setConfirmOk] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!data) return <BottomSheet open onClose={onClose} title={t("bookingTitle")}><div className="h-32 animate-pulse rounded-2xl bg-surface-2" /></BottomSheet>;
  const b = data.booking;
  const dj = data.side === "dj";
  const open = ["sent", "viewed", "negotiating", "accepted"].includes(b.status);
  const run = async (action: string, body: Record<string, unknown> = {}) => {
    setBusy(true);
    const r = await post(`bookings/${b.id}/${action}`, body);
    setBusy(false);
    if (r) {
      setCounter(null);
      setDetails(null);
      setMsg("");
      void reload();
    }
  };
  return (
    <BottomSheet open onClose={onClose} title={b.kind === "inquiry" ? t("inquiry") : t("bookingTitle")}>
      <div className="space-y-4" data-testid="booking-thread">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="min-w-0 flex-1 text-lg font-extrabold">{b.event.name || t("inquiry")}</h3>
          <BookingPill status={b.status} />
        </div>
        <p className="text-sm text-mute">
          {dj ? t("fromRequester", { name: b.requesterName }) : data.dj ? <>{t("toDj")} <Link className="font-bold text-acid underline" href={href(`/djs/u/${data.dj.slug}`)}>{data.dj.stageName}</Link></> : null}
          {b.event.city && ` · ${[b.event.venue, b.event.city, b.event.country].filter(Boolean).join(", ")}`}
          {b.event.genres.length > 0 && ` · ${b.event.genres.join(", ")}`}
        </p>
        <p className="rounded-xl bg-surface-2 p-2 text-xs" data-testid="status-explainer">{t(`bexplain.${b.status}`)}</p>
        {data.conflicts.length > 0 && b.kind === "booking" && (
          <p role="alert" className="flex gap-2 rounded-xl border border-orange/50 bg-orange/10 p-2 text-sm" data-testid="conflict-warning">
            <AlertTriangle className="size-4 shrink-0 text-orange" aria-hidden />
            {t("conflictWarn", { days: [...new Set(data.conflicts.map((c) => c.day))].join(", ") })}
          </p>
        )}
        {b.kind === "booking" && (
          <div>
            <h4 className="mb-1 text-xs font-extrabold uppercase text-mute">{t("currentTerms", { v: b.termsVersion })}</h4>
            <TermsView terms={b.terms} />
            {data.offers.length > 1 && (
              <details className="mt-2 text-sm">
                <summary className="min-h-11 cursor-pointer font-bold">{t("termsHistory", { n: data.offers.length })}</summary>
                <ol className="mt-1 space-y-1" data-testid="offers-history">
                  {data.offers.map((o) => (
                    <li key={o.id} className="rounded-lg bg-surface-2 p-2 text-xs">
                      v{o.termsVersion} · {o.proposedBy === b.djId ? t("byDj") : t("byOrganizer")} · {f.number(o.terms.feeAmount)} {o.terms.currency} · {t(`offer.${o.status}`)}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        )}
        <div>
          <h4 className="mb-1 text-xs font-extrabold uppercase text-mute">{t("messages")}</h4>
          <ol className="max-h-64 space-y-2 overflow-y-auto" data-testid="booking-messages">
            {data.messages.map((m) => (
              <li key={m.id} className={m.authorId === b.djId ? "rounded-xl bg-purple/15 p-2 text-sm" : "rounded-xl bg-surface-2 p-2 text-sm"}>
                <div className="text-xs font-bold text-mute">{m.authorName} · {f.dateTime(new Date(m.at), { dateStyle: "short", timeStyle: "short" })}</div>
                {m.attachment ? <a className="font-bold text-acid underline" href={`/api/music/bookings/files/${m.attachment.id}`}><Paperclip className="mr-1 inline size-4" aria-hidden />{m.attachment.name}</a> : <p className="whitespace-pre-wrap break-words">{m.body}</p>}
              </li>
            ))}
          </ol>
          {!["declined", "cancelled", "expired"].includes(b.status) && (
            <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (msg.trim()) void run("message", { message: msg.trim() }); }}>
              <Input value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={2000} placeholder={t("writeMessage")} aria-label={t("writeMessage")} data-testid="booking-msg" />
              <Button type="submit" disabled={!msg.trim() || busy} aria-label={t("send")}><Send className="size-4" aria-hidden /></Button>
              <label className="inline-flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line" aria-label={t("attach")}>
                <Paperclip className="size-4" aria-hidden />
                <input type="file" className="sr-only" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; if (await post(`bookings/${b.id}/files`, { name: file.name, data: await fileToB64(file) })) void reload(); }} />
              </label>
            </form>
          )}
        </div>

        {counter && (
          <div className="space-y-3 rounded-2xl border border-acid/40 p-3">
            <h4 className="font-extrabold">{t("counterTitle")}</h4>
            <TermsForm terms={counter} onChange={setCounter} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCounter(null)}>{t("cancel")}</Button>
              <Button disabled={busy} onClick={() => void run("counter", { terms: counter })} data-testid="send-counter">{t("sendCounterOffer")}</Button>
            </div>
          </div>
        )}
        {details !== null && (
          <div className="space-y-2 rounded-2xl border border-line p-3">
            <Field id="bd-q" label={t("detailsQuestion")}><Textarea id="bd-q" value={details} maxLength={1000} onChange={(e) => setDetails(e.target.value)} /></Field>
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setDetails(null)}>{t("cancel")}</Button><Button disabled={!details.trim() || busy} onClick={() => void run("request_details", { message: details })}>{t("send")}</Button></div>
          </div>
        )}

        {!counter && details === null && (
          <div className="flex flex-wrap gap-2" data-testid="booking-actions">
            {dj && b.kind === "booking" && ["sent", "viewed", "negotiating"].includes(b.status) && (
              <Button disabled={busy} onClick={() => void run("accept", { termsVersion: b.termsVersion, confirm: true })} data-testid="dj-accept">{t("accept")}</Button>
            )}
            {dj && ["sent", "viewed", "negotiating", "accepted"].includes(b.status) && <Button variant="ghost" disabled={busy} onClick={() => void run("decline")} data-testid="dj-decline">{t("decline")}</Button>}
            {b.kind === "booking" && open && <Button variant="secondary" onClick={() => setCounter(b.terms)} data-testid="open-counter">{t("counterOffer")}</Button>}
            {dj && ["sent", "viewed", "negotiating"].includes(b.status) && <Button variant="ghost" onClick={() => setDetails("")} data-testid="ask-details">{t("requestDetails")}</Button>}
            {!dj && b.status === "accepted" && b.djAcceptedVersion === b.termsVersion && (
              <div className="w-full space-y-2 rounded-2xl border border-acid/60 p-3" data-testid="confirm-box">
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={confirmOk} onChange={(e) => setConfirmOk(e.target.checked)} className="mt-1 size-5 accent-[var(--color-acid)]" data-testid="confirm-check" />
                  {t("confirmStatement", { v: b.termsVersion })}
                </label>
                <Button disabled={!confirmOk || busy} onClick={() => void run("confirm", { confirm: true, termsVersion: b.termsVersion })} data-testid="confirm-booking">{t("confirmBooking")}</Button>
              </div>
            )}
            {b.status === "draft" && !dj && <Button onClick={() => void run("send")}>{t("send")}</Button>}
            {["draft", "sent", "viewed", "negotiating", "accepted", "confirmed"].includes(b.status) && (
              <Button variant="ghost" disabled={busy} onClick={() => { if (confirm(t("cancelConfirm"))) void run("cancel", { confirm: true }); }} data-testid="cancel-booking">{t("cancelBooking")}</Button>
            )}
          </div>
        )}
        {dj && (
          <div className="flex flex-wrap gap-2 border-t border-line pt-3 text-sm">
            <Button size="sm" variant="ghost" onClick={async () => { if (await post("blocks", { userId: b.requesterId, on: !data.blocked }, { success: data.blocked ? t("unblocked") : t("blocked") })) void reload(); }} data-testid="block-requester">
              <Ban className="size-4" aria-hidden /> {data.blocked ? t("unblock") : t("block")}
            </Button>
            <Button size="sm" variant="ghost" onClick={async () => { const why = prompt(t("reportPrompt")); if (why !== null) await post("reports", { targetType: "booking", targetId: b.id, reason: "spam", details: why.slice(0, 1000) }, { success: t("reported") }); }}>
              <Flag className="size-4" aria-hidden /> {t("report")}
            </Button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
