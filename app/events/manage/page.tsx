import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { ManageList } from "./ManageList";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("opsTitle"), description: tu("opsDescription"), robots: { index: false } };
}

export default function Page() {
  return <ManageList />;
}
