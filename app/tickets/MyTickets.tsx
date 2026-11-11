"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useDemo, useHydrated } from "@/lib/store";
import { getEvent, EVENTS } from "@/lib/data";
import { EmptyState, LoadingSkeleton } from "@/components/ui/States";
import { ButtonLink, DemoBadge } from "@/components/ui/primitives";
import { fmtDate, moneyCents } from "@/lib/utils";
import { TicketDaoInfo } from "@/components/dao/TicketDaoInfo";

export function MyTickets() {
  const tu = useTranslations("tickets");
  const ok = useHydrated();
  const orders = useDemo((s) => s.orders);
  if (!ok) return <LoadingSkeleton variant="list" />;
  if (!orders.length)
    return (
      <EmptyState
        className="mx-4 md:mx-0"
        title={tu("noTicketsYet")}
        body={tu("text")}
        action={<ButtonLink href={`/events/${EVENTS[0].id}/tickets`}>{tu("tryADemoPurchase")}</ButtonLink>}
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
                <div className="flex items-center gap-2"><DemoBadge label={tu("demoTicket")} /></div>
                <div className="mt-1.5 truncate font-display text-lg uppercase">{e?.name}</div>
                <div className="text-sm text-mute">{e && fmtDate(e.startsAt, { month: "short", day: "numeric", year: "numeric" })} · {o.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}</div>
              </div>
              <span className="shrink-0 font-display">{moneyCents(Math.round(o.total * 100))}</span>
              <ArrowRight className="size-5 shrink-0" aria-hidden />
            </Link>
            {e && <TicketDaoInfo eventId={e.id} />}
          </li>
        );
      })}
    </ul>
  );
}
