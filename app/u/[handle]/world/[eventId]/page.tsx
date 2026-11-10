import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Memories } from "./Memories";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("partyMemoriesTitle"), description: tu("partyMemoriesDescription") };
}

export default async function Page({ params }: { params: Promise<{ handle: string; eventId: string }> }) {
  const { handle, eventId } = await params;
  return <Memories handle={decodeURIComponent(handle)} eventId={eventId} />;
}
