"use client";

import { useTranslations } from "next-intl";
import { useMyAvatar } from "@/lib/auth/client";
import Link from "next/link";
import { CheckCircle2, ArrowRight, Info } from "lucide-react";
import { useDemo, useHydrated } from "@/lib/store";
import { getEvent } from "@/lib/data";
import { EventCover } from "@/components/cards/Cards";
import { Alien } from "@/components/art/Alien";
import { ButtonLink, Card } from "@/components/ui/primitives";
import { ErrorState, LoadingSkeleton } from "@/components/ui/States";
import { fmtDateLong, fmtTime, money, rng } from "@/lib/utils";

/** Decorative pseudo-QR pattern. Intentionally not a scannable code. */
function FakeCode({ seed }: { seed: string }) {
  const tu = useTranslations("tickets");
  const r = rng(seed);
  const cells = Array.from({ length: 21 * 21 }, () => r() > 0.52);
  return (
    <svg viewBox="0 0 21 21" className="size-36 rounded-xl bg-cream p-2" role="img" aria-label={tu("decorativeDemoCodeNotValid")}>
      {cells.map((on, i) => (on ? <rect key={i} x={i % 21} y={Math.floor(i / 21)} width="1" height="1" fill="#080808" /> : null))}
      {[[0, 0], [14, 0], [0, 14]].map(([x, y]) => (
        <g key={`${x}${y}`}>
          <rect x={x} y={y} width="7" height="7" fill="#080808" />
          <rect x={x + 1} y={y + 1} width="5" height="5" fill="#F5F2EA" />
          <rect x={x + 2} y={y + 2} width="3" height="3" fill="#080808" />
        </g>
      ))}
      <text x="10.5" y="11.6" textAnchor="middle" fontSize="3" fill="#FF625C" fontWeight="900" transform="rotate(-20 10.5 10.5)">DEMO</text>
    </svg>
  );
}

export function OrderView({ orderId }: { orderId: string }) {
  const tu = useTranslations("tickets");
  const ok = useHydrated();
  const order = useDemo((s) => s.orders.find((o) => o.id === orderId));
  const { look } = useMyAvatar();
  if (!ok) return <LoadingSkeleton variant="page" />;
  if (!order) return <ErrorState title={tu("ticketNotFound")} body={tu("text2")} retry={<ButtonLink href="/tickets">{tu("myTickets")}</ButtonLink>} />;
  const e = getEvent(order.eventId)!;

  return (
    <div className="mx-auto max-w-xl px-4 pt-6">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="size-9 shrink-0 text-acid" aria-hidden />
        <div>
          <h1 className="text-3xl uppercase">{tu("demoPurchaseComplete")}</h1>
          <p className="text-sm text-mute">{tu("text3")}</p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-[28px] border-[3px] border-ink bg-cream text-ink shadow-[0_8px_0_#000]">
        <div className="relative aspect-[5/2]">
          <EventCover id={e.id} sizes="(min-width:640px) 600px, 100vw" />
          <span className="absolute right-3 top-3 -rotate-6 rounded-lg border-[3px] border-coral bg-cream px-2 py-1 font-display text-sm text-coral">{tu("sampleNotValid")}</span>
        </div>
        <div className="p-5">
          <div className="text-xs font-extrabold uppercase tracking-widest">{tu("freaktopiaDemoTicket")}</div>
          <div className="mt-1 font-display text-3xl uppercase leading-none">{e.name}</div>
          <div className="mt-2 text-sm font-semibold">{e.city} · {fmtDateLong(e.startsAt)} · {fmtTime(e.startsAt)}</div>
          <div className="my-4 border-t-[3px] border-dashed border-ink/30" />
          <div className="flex items-center gap-4">
            <FakeCode seed={order.id} />
            <div className="min-w-0 space-y-1.5 text-sm">
              <div><span className="font-bold">{tu("order")}</span><br /><span className="font-mono">{order.id}</span></div>
              <div><span className="font-bold">{tu("holder")}</span><br />@{order.holder}</div>
              <div className="flex items-center gap-1.5">
                <Alien look={look} className="size-10" title={tu("yourAlienAvatar")} />
                <span className="text-xs">{tu("avatarCheckInEnabled")}</span>
              </div>
            </div>
          </div>
          <ul className="mt-4 space-y-1 text-sm">
            {order.lines.map((l) => (
              <li key={l.kind} className="flex justify-between"><span>{l.qty} × {l.name}</span><span className="font-bold">{money(l.qty * l.price)}</span></li>
            ))}
            <li className="flex justify-between border-t border-ink/20 pt-1 font-display text-lg"><span>{tu("totalDemo")}</span><span>{money(order.total)}</span></li>
          </ul>
        </div>
      </div>

      <Card className="mt-6 p-4">
        <div className="flex items-center gap-2 font-bold"><Info className="size-4 text-blue" aria-hidden /> {tu("demoVsProduction")}</div>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-xs uppercase text-mute">
            <tr><th className="py-1 pr-2 font-bold">{tu("step")}</th><th className="py-1 pr-2 font-bold">{tu("phase1Demo")}</th><th className="py-1 font-bold">{tu("production")}</th></tr>
          </thead>
          <tbody className="divide-y divide-line align-top">
            <tr><td className="py-2 pr-2 font-semibold">{tu("payment")}</td><td className="py-2 pr-2">{tu("noneTaken")}</td><td className="py-2">{tu("securePaymentProvider")}</td></tr>
            <tr><td className="py-2 pr-2 font-semibold">{tu("ticket")}</td><td className="py-2 pr-2">{tu("savedInThisBrowser")}</td><td className="py-2">{tu("signedTicketInYourAccount")}</td></tr>
            <tr><td className="py-2 pr-2 font-semibold">{tu("entry")}</td><td className="py-2 pr-2">{tu("notValid")}</td><td className="py-2">{tu("scannableAtTheDoor")}</td></tr>
            <tr><td className="py-2 pr-2 font-semibold">{tu("receipt")}</td><td className="py-2 pr-2">{tu("none")}</td><td className="py-2">{tu("emailReceiptRefundsPolicy")}</td></tr>
          </tbody>
        </table>
      </Card>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <ButtonLink href="/tickets" variant="secondary">{tu("myTickets")}</ButtonLink>
        <Link href={e.status === "live" ? "/live" : `/events/${e.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-line font-extrabold uppercase">
          {e.status === "live" ? tu("enterLiveMap") : tu("backToEvent")} <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
