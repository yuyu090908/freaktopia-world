import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { WorkView } from "./WorkView";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("opsWorkTitle"), description: tu("opsDescription"), robots: { index: false } };
}

export default function Page() {
  return <WorkView />;
}
