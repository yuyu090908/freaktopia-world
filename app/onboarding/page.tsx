import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WelcomeGate } from "@/components/alien/WelcomeGate";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("alien");
  return { title: t("born"), robots: { index: false } };
}

export default function Page() {
  return <WelcomeGate />;
}
