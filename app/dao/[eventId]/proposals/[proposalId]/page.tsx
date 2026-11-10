import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { ProposalDetail } from "@/components/dao/views/ProposalDetail";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("daoEventIdProposalsProposalIdTitle"), description: tu("daoEventIdProposalsProposalIdDescription") };
}

export default function Page() {
  return <ProposalDetail />;
}
