import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { TreasuryView } from "@/components/dao/views/TreasuryView";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("daoEventIdTreasuryTitle"), description: tu("daoEventIdTreasuryDescription") };
}

export default function Page() {
  return <TreasuryView />;
}
