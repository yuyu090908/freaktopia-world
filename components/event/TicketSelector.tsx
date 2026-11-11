"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, ShieldAlert, Ticket } from "lucide-react";
import type { FreakEvent, TicketKind } from "@/lib/types";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button, DemoBadge, DemoNotice, PageTitle } from "@/components/ui/primitives";
import { grantXp, toast, uid, useDemo } from "@/lib/store";
import { fetchQuote, RANK_COLOR, type Quote } from "@/lib/loyalty/client";
import { DEFAULT_RULES, feeBreakdown } from "@/lib/loyalty/rules";
import { cn, fmtDateLong, money, moneyCents } from "@/lib/utils";
import Image from "next/image";
import { TICKET_ART, type TicketTier } from "@/lib/art";

/** Which official pass design each ticket kind uses. Only the kinds this event sells are shown. */
const TIER: Record<TicketKind, TicketTier> = { main: "basic", afterparty: "silver", allnight: "gold", vip: "vip" };

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
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const tl = useTranslations("loyalty");
  // Price breakdown from the server (rank discount on the platform fee only). Until it answers, or if it can't,
  // the regular fee is shown without any discount: never a discount the server did not confirm.
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteFailed, setQuoteFailed] = useState(false);
  useEffect(() => {
    let live = true;
    const tm = setTimeout(async () => {
      const q = await fetchQuote(subtotal);
      if (!live) return;
      setQuote(q);
      setQuoteFailed(!q);
    }, 200);
    return () => {
      live = false;
      clearTimeout(tm);
    };
  }, [subtotal]);
  const fresh = quote && quote.ticketsCents === Math.round(subtotal * 100) ? quote : null;
  const b = fresh ?? feeBreakdown(subtotal, "rookie", DEFAULT_RULES);

  const set = (k: TicketKind, d: number) => setQty((q) => ({ ...q, [k]: Math.max(0, Math.min(MAX, q[k] + d)) }));

  const complete = async () => {
    setBusy(true);
    // Recalculated on the server right before the order is stored; if anything changed, show it and ask again.
    const q = await fetchQuote(subtotal);
    if (!q) {
      setBusy(false);
      toast({ title: tl("checkout.quoteFailed"), tone: "error" });
      return;
    }
    if (q.totalCents !== b.totalCents) {
      setQuote(q);
      setBusy(false);
      toast({ title: tl("checkout.priceUpdated") });
      return;
    }
    const id = uid("FK");
    const { rank, discountPct, feeRatePct, ticketsCents, regularFeeCents, discountCents, finalFeeCents, totalCents, rulesVersion, signedIn, quotedAt } = q;
    addOrder({
      id, eventId: event.id, lines, total: totalCents / 100, createdAt: new Date().toISOString(), holder: username, demo: true,
      pricing: { rank, discountPct, feeRatePct, ticketsCents, regularFeeCents, discountCents, finalFeeCents, totalCents, rulesVersion, signedIn, quotedAt },
    });
    grantXp(60, tu("xpGotTicketsFor", { name: event.name }));
    setTimeout(() => router.push(`/tickets/${id}`), 350);
  };

  return (
    <div className="mx-auto max-w-3xl md:px-6">
      <PageTitle kicker={tu("tickets")} title={event.name} sub={`${event.city} · ${fmtDateLong(event.startsAt)}`}>
        <div className="mt-3"><DemoBadge label={tu("demoCheckoutNoPayment")} /></div>
      </PageTitle>

      <fieldset className="min-w-0 md:px-0">
        <legend className="sr-only">{tu("chooseTickets")}</legend>
        {/* Phones: one big pass at a time (swipe). Wider screens: a comparison grid. */}
        <div className="rail rail-grid pb-2 md:grid-cols-2" data-testid="ticket-tiers">
        {tickets.map((t) => {
          const n = qty[t.kind];
          const art = TICKET_ART[TIER[t.kind]];
          return (
            <div key={t.kind} data-testid="ticket-tier" data-selected={n > 0} className={cn("flex w-[82vw] max-w-[360px] shrink-0 snap-center flex-col overflow-hidden rounded-3xl border-2 bg-surface transition-colors md:w-auto md:max-w-none", n ? "border-acid shadow-[0_0_24px_-8px_rgba(193,255,83,0.7)]" : "border-line")}>
              <div className="relative aspect-[17/10] bg-ink">
                <Image src={art.src} alt={tu("ticketDesignAlt", { tier: art.label })} fill sizes="(min-width:768px) 360px, 82vw" className="object-contain p-2" />
                {n > 0 && <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-acid px-2.5 py-1 text-xs font-extrabold uppercase text-ink"><Check className="size-3.5" aria-hidden />{tu("selected")}</span>}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border-[3px] border-ink text-ink" style={{ background: COLORS[t.kind] }}>
                    <Ticket className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <h2 className="text-xl uppercase">{t.name}</h2>
                      <span className="font-display text-xl">{money(t.price)}</span>
                    </div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-mute">{art.label}</div>
                  </div>
                </div>
                <ul className="mt-2 space-y-0.5 text-sm text-cream/85">
                  {t.perks.map((p) => (
                    <li key={p} className="flex gap-1.5"><Check className="mt-0.5 size-4 shrink-0 text-acid" aria-hidden />{p}</li>
                  ))}
                </ul>
                <div className="mt-auto flex items-center justify-between gap-3 pt-3">
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
          );
        })}
        </div>
        <p className="mt-2 px-4 text-[12px] text-mute md:px-0">{tu("ticketArtNote")}</p>
      </fieldset>

      <DemoNotice className="mx-4 mt-5 md:mx-0">
        <strong>{tu("phase1DemoCheckout")}</strong> {tu("completingThisFlowCreatesA")}
      </DemoNotice>

      <div className="h-28" aria-hidden />
      <div className="sticky-cta fixed inset-x-0 z-40 border-t border-purple/40 bg-ink px-4 py-3 shadow-[0_-10px_30px_-12px_rgba(162,118,233,0.5)]">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase text-mute">{tu("ticketsCount", { n: count })}</div>
            <div className="font-display text-2xl" aria-live="polite">{moneyCents(b.totalCents)}</div>
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
          <li className="flex justify-between gap-3 py-2.5 text-sm">
            <span>{tl("checkout.tickets")}</span>
            <span>{moneyCents(b.ticketsCents)}</span>
          </li>
          <li className="flex justify-between gap-3 py-2.5 text-sm text-mute">
            <span>{tl("checkout.platformFee", { pct: b.feeRatePct })}</span>
            <span>{moneyCents(b.regularFeeCents)}</span>
          </li>
          {b.discountCents > 0 && (
            <li className="flex justify-between gap-3 py-2.5 text-sm font-bold" style={{ color: RANK_COLOR[b.rank] }} data-testid="loyalty-discount">
              <span>{tl("checkout.loyaltyDiscount", { rank: tl(`rank.${b.rank}`), pct: b.discountPct })}</span>
              <span>−{moneyCents(b.discountCents)}</span>
            </li>
          )}
          <li className="flex justify-between gap-3 py-2.5 text-sm">
            <span>{tl("checkout.finalFee")}</span>
            <span data-testid="final-fee">{moneyCents(b.finalFeeCents)}</span>
          </li>
          <li className="flex justify-between gap-3 py-3 font-display text-xl">
            <span>{tu("total")}</span>
            <span data-testid="order-total">{moneyCents(b.totalCents)}</span>
          </li>
        </ul>
        <p className="mt-1 text-xs text-mute">{tl("checkout.excludes")}</p>
        <LoyaltyNote quote={fresh} failed={quoteFailed} />
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

/** What the rank does for this order, and what attending would do for the rank (buying alone never counts). */
function LoyaltyNote({ quote, failed }: { quote: Quote | null; failed: boolean }) {
  const t = useTranslations("loyalty");
  if (failed) return <p className="mt-3 rounded-2xl border border-line p-3 text-sm" data-testid="loyalty-note">{t("checkout.quoteFailed")}</p>;
  if (!quote) return null;
  const rank = t(`rank.${quote.rank}`);
  return (
    <div className="mt-3 rounded-2xl border p-3 text-sm" style={{ borderColor: `${RANK_COLOR[quote.rank]}88` }} data-testid="loyalty-note">
      {quote.signedIn ? (
        <p className="font-bold">{t("checkout.yourRank", { rank, pct: quote.discountPct })}</p>
      ) : (
        <p>
          {t("checkout.signInForRank")} <a href="/login?next=/profile" className="font-bold text-acid underline">{t("signIn")}</a>
        </p>
      )}
      {quote.signedIn && quote.afterThisEvent && <p className="mt-1">{t("checkout.afterThis", { count: quote.afterThisEvent.remaining, rank: t(`rank.${quote.afterThisEvent.rank}`) })}</p>}
      <p className="mt-1 text-xs text-mute">{t("checkout.purchaseDoesNotCount")}</p>
    </div>
  );
}
