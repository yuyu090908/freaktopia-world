import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { ProposalsView } from "@/components/dao/views/ProposalsView";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("daoEventIdProposalsTitle"), description: tu("daoEventIdProposalsDescription") };
}

export default function Page() {
  return <ProposalsView />;
}
