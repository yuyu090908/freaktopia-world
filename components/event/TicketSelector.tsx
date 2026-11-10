"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, ShieldAlert, Ticket } from "lucide-react";
import type { FreakEvent, TicketKind } from "@/lib/types";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button, DemoBadge, DemoNotice, PageTitle } from "@/components/ui/primitives";
import { grantXp, uid, useDemo } from "@/lib/store";
import { cn, fmtDateLong, money } from "@/lib/utils";

const COLORS: Record<TicketKind, string> = { main: "#B6F05C", afterparty: "#55BCEB", allnight: "#FFAD5B", vip: "#A276E9" };
const MAX = 6;

export function TicketSelector({ event }: { event: FreakEvent }) {
  const tu = useTranslations("events");
  const router = useRouter();
  const [qty, setQty] = useState<Record<TicketKind, number>>({ main: 1, afterparty: 0, allnight: 0, vip: 0 });
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const addOrder = useDemo((s) => s.addOrder);
  const username = useDemo((s) => s.profile.username);
  const tickets = event.tickets.filter((t) => t.kind !== "afterparty" || event.afterPartyId);

  const lines = useMemo(() => tickets.filter((t) => qty[t.kind] > 0).map((t) => ({ kind: t.kind, name: t.name, qty: qty[t.kind], price: t.price })), [tickets, qty]);
  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const fee = Math.round(subtotal * 0.05 * 100) / 100;
  const total = subtotal + fee;
  const count = lines.reduce((s, l) => s + l.qty, 0);

  const set = (k: TicketKind, d: number) => setQty((q) => ({ ...q, [k]: Math.max(0, Math.min(MAX, q[k] + d)) }));

  const complete = () => {
    setBusy(true);
    const id = uid("FK");
    addOrder({ id, eventId: event.id, lines, total, createdAt: new Date().toISOString(), holder: username, demo: true });
    grantXp(60, tu("xpGotTicketsFor", { name: event.name }));
    setTimeout(() => router.push(`/tickets/${id}`), 350);
  };

  return (
    <div className="mx-auto max-w-3xl md:px-6">
      <PageTitle kicker={tu("tickets")} title={event.name} sub={`${event.city} · ${fmtDateLong(event.startsAt)}`}>
        <div className="mt-3"><DemoBadge label={tu("demoCheckoutNoPayment")} /></div>
      </PageTitle>

      <fieldset className="space-y-3 px-4 md:px-0">
        <legend className="sr-only">{tu("chooseTickets")}</legend>
        {tickets.map((t) => {
          const n = qty[t.kind];
          return (
            <div key={t.kind} className={cn("rounded-3xl border-2 bg-surface p-4 transition-colors", n ? "border-acid" : "border-line")}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl border-[3px] border-ink text-ink" style={{ background: COLORS[t.kind] }}>
                  <Ticket className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <h2 className="text-xl uppercase">{t.name}</h2>
                    <span className="font-display text-xl">{money(t.price)}</span>
                  </div>
                  <ul className="mt-1.5 space-y-0.5 text-sm text-cream/85">
                    {t.perks.map((p) => (
                      <li key={p} className="flex gap-1.5"><Check className="mt-0.5 size-4 shrink-0 text-acid" aria-hidden />{p}</li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className={cn("text-xs font-bold", t.remaining < 60 ? "text-coral" : "text-mute")}>{tu("remainingLeftDemo", { remaining: t.remaining })}</span>
                    <div className="flex items-center gap-1 rounded-full bg-ink p-1" role="group" aria-label={tu("quantityOf", { name: t.name })}>
                      <button type="button" onClick={() => set(t.kind, -1)} disabled={!n} aria-label={tu("removeOneName", { name: t.name })} className="inline-flex size-11 items-center justify-center rounded-full bg-surface-2 disabled:opacity-40">
                        <Minus className="size-4" />
                      </button>
                      <output aria-live="polite" className="w-8 text-center font-display text-lg">{n}</output>
                      <button type="button" onClick={() => set(t.kind, 1)} disabled={n >= MAX} aria-label={tu("addOneName", { name: t.name })} className="inline-flex size-11 items-center justify-center rounded-full bg-acid text-ink disabled:opacity-40">
                        <Plus className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </fieldset>

      <DemoNotice className="mx-4 mt-5 md:mx-0">
        <strong>{tu("phase1DemoCheckout")}</strong> {tu("completingThisFlowCreatesA")}
      </DemoNotice>

      <div className="h-28" aria-hidden />
      <div className="sticky-cta fixed inset-x-0 z-40 border-t border-purple/40 bg-ink px-4 py-3 shadow-[0_-10px_30px_-12px_rgba(162,118,233,0.5)]">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase text-mute">{tu("ticketsCount", { n: count })}</div>
            <div className="font-display text-2xl" aria-live="polite">{money(total)}</div>
          </div>
          <Button size="lg" disabled={!count} onClick={() => setReview(true)}>
            {tu("reviewOrder")}
          </Button>
        </div>
      </div>

      <BottomSheet
        open={review}
        onClose={() => setReview(false)}
        title={tu("confirmOrder")}
        footer={
          <Button size="lg" className="mb-1 w-full" onClick={complete} disabled={busy}>
            {busy ? tu("creatingDemoTicket") : tu("completeDemoPurchase")}
          </Button>
        }
      >
        <ul className="divide-y divide-line">
          {lines.map((l) => (
            <li key={l.kind} className="flex justify-between gap-3 py-2.5">
              <span>{l.qty} × {l.name}</span>
              <span className="font-bold">{money(l.qty * l.price)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-3 py-2.5 text-sm text-mute">
            <span>{tu("serviceFeeIllustrative")}</span>
            <span>{money(fee)}</span>
          </li>
          <li className="flex justify-between gap-3 py-3 font-display text-xl">
            <span>{tu("total")}</span>
            <span>{money(total)}</span>
          </li>
        </ul>
        <div className="mt-2 flex gap-3 rounded-2xl bg-coral/15 p-3 text-sm">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-coral" aria-hidden />
          <p>
            <strong>{tu("thisIsNotAReal")}</strong> {tu("inProductionThisStepWould")}
          </p>
        </div>
      </BottomSheet>
    </div>
  );
}
