"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useDemo, useHydrated } from "@/lib/store";
import { getEvent, EVENTS } from "@/lib/data";
import { EmptyState, LoadingSkeleton } from "@/components/ui/States";
import { ButtonLink } from "@/components/ui/primitives";
import { TicketCard } from "@/components/cards/TicketCard";
import { TicketDaoInfo } from "@/components/dao/TicketDaoInfo";

export function MyTickets() {
  const tu = useTranslations("tickets");
  const ok = useHydrated();
  const orders = useDemo((s) => s.orders);
  if (!ok) return <LoadingSkeleton variant="list" />;
  if (!orders.length)
    return (
      <div className="space-y-6">
      <EmptyState
        className="mx-4 md:mx-0"
        title={tu("noTicketsYet")}
        body={tu("text")}
        action={<ButtonLink href={`/events/${EVENTS.find((e) => e.status === "confirmed")?.id ?? EVENTS[0].id}/tickets`}>{tu("tryADemoPurchase")}</ButtonLink>}
      />
      <div className="px-4 md:px-0"><CommunityPasses /></div>
      </div>
    );
  return (
    <div className="space-y-6 px-4 md:px-0">
      <ul className="space-y-3">
        {orders.map((o) => (
          <li key={o.id}>
            <TicketCard order={o} />
            {getEvent(o.eventId) && <TicketDaoInfo eventId={o.eventId} />}
          </li>
        ))}
      </ul>
      <CommunityPasses />
    </div>
  );
}

/** Free passes for community parties (with a real entry QR) live with the RSVP in My parties. */
function CommunityPasses() {
  const tu = useTranslations("tickets");
  return (
    <section className="rounded-[20px] border border-line bg-surface p-4" aria-labelledby="community-passes">
      <h2 id="community-passes" className="text-[18px] uppercase">{tu("communityPasses")}</h2>
      <p className="mt-1 text-[14px] text-mute">{tu("communityPassesBody")}</p>
      <Link href="/profile/parties" className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-acid underline underline-offset-4">{tu("openMyParties")} <ArrowRight className="size-4" aria-hidden /></Link>
    </section>
  );
}
