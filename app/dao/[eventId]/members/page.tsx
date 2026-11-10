import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { MembersView } from "@/components/dao/views/MembersView";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("daoEventIdMembersTitle"), description: tu("daoEventIdMembersDescription") };
}

export default function Page() {
  return <MembersView />;
}
