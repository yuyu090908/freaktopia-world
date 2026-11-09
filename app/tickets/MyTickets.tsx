"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useDemo, useHydrated } from "@/lib/store";
import { getEvent, EVENTS } from "@/lib/data";
import { EmptyState, LoadingSkeleton } from "@/components/ui/States";
import { ButtonLink, DemoBadge } from "@/components/ui/primitives";
import { fmtDate, money } from "@/lib/utils";

export function MyTickets() {
  const ok = useHydrated();
  const orders = useDemo((s) => s.orders);
  if (!ok) return <LoadingSkeleton variant="list" />;
  if (!orders.length)
    return (
      <EmptyState
        className="mx-4 md:mx-0"
        title="No tickets yet"
        body="イベントを選んで、デモ購入を試してみよう。"
        action={<ButtonLink href={`/events/${EVENTS[0].id}/tickets`}>Try a demo purchase</ButtonLink>}
      />
    );
  return (
    <ul className="space-y-3 px-4 md:px-0">
      {orders.map((o) => {
        const e = getEvent(o.eventId);
        return (
          <li key={o.id}>
            <Link href={`/tickets/${o.id}`} className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-4 hover:border-cream/30">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><DemoBadge label="Demo ticket" /></div>
                <div className="mt-1.5 truncate font-display text-lg uppercase">{e?.name}</div>
                <div className="text-sm text-mute">{e && fmtDate(e.startsAt, { month: "short", day: "numeric", year: "numeric" })} · {o.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}</div>
              </div>
              <span className="shrink-0 font-display">{money(o.total)}</span>
              <ArrowRight className="size-5 shrink-0" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
