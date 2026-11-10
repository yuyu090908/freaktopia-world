import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { SettingsView } from "@/components/dao/views/SettingsView";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("daoEventIdSettingsTitle"), description: tu("daoEventIdSettingsDescription") };
}

export default function Page() {
  return <SettingsView />;
}
