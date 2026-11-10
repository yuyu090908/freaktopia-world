import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { WorldView } from "./WorldView";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("partyWorldTitle"), description: tu("partyWorldDescription") };
}

export default async function Page({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return <WorldView handle={decodeURIComponent(handle)} />;
}
