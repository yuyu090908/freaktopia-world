import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { EventOps } from "./EventOps";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("opsTitle"), description: tu("opsDescription"), robots: { index: false } };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EventOps id={id} />;
}
