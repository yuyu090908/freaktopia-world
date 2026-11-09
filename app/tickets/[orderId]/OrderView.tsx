"use client";

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
  const r = rng(seed);
  const cells = Array.from({ length: 21 * 21 }, () => r() > 0.52);
  return (
    <svg viewBox="0 0 21 21" className="size-36 rounded-xl bg-cream p-2" role="img" aria-label="Decorative demo code, not valid for entry">
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
  const ok = useHydrated();
  const order = useDemo((s) => s.orders.find((o) => o.id === orderId));
  const look = useDemo((s) => s.profile.look);
  if (!ok) return <LoadingSkeleton variant="page" />;
  if (!order) return <ErrorState title="Ticket not found" body="このデモチケットはこのブラウザに保存されていません。" retry={<ButtonLink href="/tickets">My tickets</ButtonLink>} />;
  const e = getEvent(order.eventId)!;

  return (
    <div className="mx-auto max-w-xl px-4 pt-6">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="size-9 shrink-0 text-acid" aria-hidden />
        <div>
          <h1 className="text-3xl uppercase">Demo purchase complete</h1>
          <p className="text-sm text-mute">デモ購入が完了しました（実際の決済は行われていません）</p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-[28px] border-[3px] border-ink bg-cream text-ink shadow-[0_8px_0_#000]">
        <div className="relative aspect-[5/2]">
          <EventCover id={e.id} sizes="(min-width:640px) 600px, 100vw" />
          <span className="absolute right-3 top-3 -rotate-6 rounded-lg border-[3px] border-coral bg-cream px-2 py-1 font-display text-sm text-coral">SAMPLE · NOT VALID</span>
        </div>
        <div className="p-5">
          <div className="text-xs font-extrabold uppercase tracking-widest">FREAKTOPIA demo ticket</div>
          <div className="mt-1 font-display text-3xl uppercase leading-none">{e.name}</div>
          <div className="mt-2 text-sm font-semibold">{e.city} · {fmtDateLong(e.startsAt)} · {fmtTime(e.startsAt)}</div>
          <div className="my-4 border-t-[3px] border-dashed border-ink/30" />
          <div className="flex items-center gap-4">
            <FakeCode seed={order.id} />
            <div className="min-w-0 space-y-1.5 text-sm">
              <div><span className="font-bold">Order</span><br /><span className="font-mono">{order.id}</span></div>
              <div><span className="font-bold">Holder</span><br />@{order.holder}</div>
              <div className="flex items-center gap-1.5">
                <Alien look={look} className="size-10" title="Your alien avatar" />
                <span className="text-xs">Avatar check-in enabled</span>
              </div>
            </div>
          </div>
          <ul className="mt-4 space-y-1 text-sm">
            {order.lines.map((l) => (
              <li key={l.kind} className="flex justify-between"><span>{l.qty} × {l.name}</span><span className="font-bold">{money(l.qty * l.price)}</span></li>
            ))}
            <li className="flex justify-between border-t border-ink/20 pt-1 font-display text-lg"><span>Total (demo)</span><span>{money(order.total)}</span></li>
          </ul>
        </div>
      </div>

      <Card className="mt-6 p-4">
        <div className="flex items-center gap-2 font-bold"><Info className="size-4 text-blue" aria-hidden /> Demo vs. production</div>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-xs uppercase text-mute">
            <tr><th className="py-1 pr-2 font-bold">Step</th><th className="py-1 pr-2 font-bold">Phase 1 demo</th><th className="py-1 font-bold">Production</th></tr>
          </thead>
          <tbody className="divide-y divide-line align-top">
            <tr><td className="py-2 pr-2 font-semibold">Payment</td><td className="py-2 pr-2">None taken</td><td className="py-2">Secure payment provider</td></tr>
            <tr><td className="py-2 pr-2 font-semibold">Ticket</td><td className="py-2 pr-2">Saved in this browser</td><td className="py-2">Signed ticket in your account</td></tr>
            <tr><td className="py-2 pr-2 font-semibold">Entry</td><td className="py-2 pr-2">Not valid</td><td className="py-2">Scannable at the door</td></tr>
            <tr><td className="py-2 pr-2 font-semibold">Receipt</td><td className="py-2 pr-2">None</td><td className="py-2">Email receipt & refunds policy</td></tr>
          </tbody>
        </table>
      </Card>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <ButtonLink href="/tickets" variant="secondary">My tickets</ButtonLink>
        <Link href={e.status === "live" ? "/live" : `/events/${e.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-line font-extrabold uppercase">
          {e.status === "live" ? "Enter live map" : "Back to event"} <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
