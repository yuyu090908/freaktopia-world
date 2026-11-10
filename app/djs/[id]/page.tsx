import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DJS, getDJ } from "@/lib/data";
import { DJProfile } from "./DJProfile";

export function generateStaticParams() {
  return DJS.map((d) => ({ id: d.id }));
}
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const d = getDJ((await params).id);
  const tu = await getTranslations("seo");
  return { title: d ? tu("djWithName", { name: d.name }) : tu("dj"), description: d?.bio };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const dj = getDJ((await params).id);
  if (!dj) notFound();
  return <DJProfile dj={dj} />;
}
