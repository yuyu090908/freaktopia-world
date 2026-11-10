import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { LiveDiscovery } from "./LiveDiscovery";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("liveTitle"), description: tu("liveDescription") };
}

export default function Page() {
  return <LiveDiscovery />;
}
