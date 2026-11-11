import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Library } from "./Library";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("music");
  return { title: t("myLibrary"), robots: { index: false } };
}

export default function Page() {
  return <Library />;
}
