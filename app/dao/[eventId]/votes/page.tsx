import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { VotesView } from "@/components/dao/views/VotesView";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("daoEventIdVotesTitle"), description: tu("daoEventIdVotesDescription") };
}

export default function Page() {
  return <VotesView />;
}
