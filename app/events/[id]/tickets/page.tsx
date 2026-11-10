import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EVENTS, getEvent } from "@/lib/data";
import { TicketSelector } from "@/components/event/TicketSelector";

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
  return <TicketSelector event={event} />;
}
