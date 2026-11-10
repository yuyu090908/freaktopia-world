import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { DaoIndexView } from "@/components/dao/views/DaoIndexView";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return {
  title: tu("daoTitle"),
  description: tu("daoDescription"),
};
}

export default function Page() {
  return <DaoIndexView />;
}
