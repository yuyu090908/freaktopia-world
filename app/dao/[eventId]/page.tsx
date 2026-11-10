import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { DaoHome } from "@/components/dao/views/DaoHome";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("daoEventIdTitle"), description: tu("daoEventIdDescription") };
}

export default function Page() {
  return <DaoHome />;
}
