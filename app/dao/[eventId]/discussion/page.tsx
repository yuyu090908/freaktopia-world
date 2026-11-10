import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { DiscussionView } from "@/components/dao/views/DiscussionView";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("daoEventIdDiscussionTitle"), description: tu("daoEventIdDiscussionDescription") };
}

export default function Page() {
  return <DiscussionView />;
}
