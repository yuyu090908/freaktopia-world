import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/http";
import * as party from "@/lib/party/service";
import { Memories, type EventData } from "./Memories";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("partyMemoriesTitle"), description: tu("partyMemoriesDescription") };
}

/** Server-rendered first view (same data as the API), so the page shows without waiting for a client fetch. */
async function initialEvent(eventId: string): Promise<EventData | null> {
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return null;
  try {
    const user = await currentUser();
    return JSON.parse(JSON.stringify(await party.partyEvent(user?.id ?? null, eventId)));
  } catch {
    return null;
  }
}

export default async function Page({ params }: { params: Promise<{ handle: string; eventId: string }> }) {
  const { handle, eventId } = await params;
  return <Memories handle={decodeURIComponent(handle)} eventId={eventId} initial={await initialEvent(eventId)} />;
}
