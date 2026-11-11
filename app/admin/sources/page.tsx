import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { SourcesAdmin } from "./SourcesAdmin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("discoveryAdmin");
  return { title: t("title"), robots: { index: false } };
}

export default function Page() {
  return <SourcesAdmin />;
}
