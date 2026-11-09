import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ARCHIVE_EVENTS, EVENTS, getEvent } from "@/lib/data";
import { EventDetail } from "./EventDetail";

export function generateStaticParams() {
  return [...EVENTS, ...ARCHIVE_EVENTS].map((e) => ({ id: e.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const e = getEvent(id);
  if (!e) return { title: "Event not found" };
  return { title: `${e.name} · ${e.city}`, description: `${e.tagline} ${e.description} (Demo event)` };
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = getEvent(id);
  if (!event) notFound();
  return <EventDetail event={event} />;
}
