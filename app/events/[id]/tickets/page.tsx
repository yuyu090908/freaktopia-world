import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EVENTS, getEvent } from "@/lib/data";
import { TicketSelector } from "@/components/event/TicketSelector";
import { ticketsOnSale } from "@/lib/event-status";
import { EmptyState } from "@/components/ui/States";
import { ButtonLink } from "@/components/ui/primitives";

/** Statuses follow the clock (lib/clock): re-render at least hourly so an event that ended is not shown as upcoming. */
export const revalidate = 3600;

export function generateStaticParams() {
  return EVENTS.map((e) => ({ id: e.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const e = getEvent(id);
  const tu = await getTranslations("seo");
  return { title: e ? tu("ticketsWithName", { name: e.name }) : tu("tickets") };
}

export default async function TicketsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = getEvent(id);
  if (!event) notFound();
  // Only a confirmed event with places left sells tickets; otherwise say why instead of showing prices.
  if (!ticketsOnSale(event)) {
    const tu = await getTranslations("eventFilters");
    return (
      <div className="mx-auto max-w-xl px-4 py-10" data-testid="tickets-not-on-sale">
        <EmptyState
          title={event.status === "ended" ? tu("notOnSaleEnded") : tu("notOnSaleYet")}
          body={event.status === "ended" ? tu("notOnSaleEndedBody") : tu("notOnSaleYetBody")}
          action={<ButtonLink href={`/events/${event.id}`} variant="secondary">{tu("backToEvent")}</ButtonLink>}
        />
      </div>
    );
  }
  return <TicketSelector event={event} />;
}
