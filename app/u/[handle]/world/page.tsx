import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/http";
import * as party from "@/lib/party/service";
import type { WorldData } from "@/components/party/shared";
import { WorldView } from "./WorldView";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("partyWorldTitle"), description: tu("partyWorldDescription") };
}

/** The first view is rendered on the server with the same data the API returns, so the world shows without waiting for a client fetch. */
async function initialWorld(handle: string): Promise<{ world: WorldData } | null> {
  if (!/^(FREAK-\d{8}|demo)$/i.test(handle)) return null;
  try {
    const user = await currentUser();
    return JSON.parse(JSON.stringify({ world: await party.world(user?.id ?? null, handle) }));
  } catch {
    return null; // the client fetch then shows the right error
  }
}

export default async function Page({ params }: { params: Promise<{ handle: string }> }) {
  const handle = decodeURIComponent((await params).handle);
  return <WorldView handle={handle} initial={await initialWorld(handle)} />;
}
