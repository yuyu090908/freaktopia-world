import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EVENTS, getEvent } from "@/lib/data";
import { LiveEvent } from "./LiveEvent";

export function generateStaticParams() {
  return EVENTS.map((e) => ({ eventId: e.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ eventId: string }> }): Promise<Metadata> {
  const e = getEvent((await params).eventId);
  return { title: e ? `${e.name} · Live` : "Live", description: e ? `${e.tagline} Watch, explore the festival map and join with your alien avatar (demo).` : undefined };
}

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  if (!getEvent(eventId)) notFound();
  return <LiveEvent eventId={eventId} />;
}
