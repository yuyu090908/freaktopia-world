import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EVENTS, getEvent } from "@/lib/data";
import { LiveEvent } from "./LiveEvent";

export function generateStaticParams() {
  return EVENTS.map((e) => ({ eventId: e.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ eventId: string }> }): Promise<Metadata> {
  const e = getEvent((await params).eventId);
  const tu = await getTranslations("seo");
  return { title: e ? tu("liveWithName", { name: e.name }) : tu("live"), description: e ? tu("liveDescription", { tagline: e.tagline }) : undefined };
}

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  if (!getEvent(eventId)) notFound();
  return <LiveEvent eventId={eventId} />;
}
