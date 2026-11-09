import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DJS, getDJ } from "@/lib/data";
import { AuditionRoom } from "./AuditionRoom";

export function generateStaticParams() {
  return DJS.map((d) => ({ id: d.id }));
}
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const d = getDJ((await params).id);
  return { title: d ? `Audition · ${d.name}` : "Audition" };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const dj = getDJ((await params).id);
  if (!dj) notFound();
  return <AuditionRoom dj={dj} />;
}
