import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AlienCustomizer } from "@/components/profile/AlienCustomizer";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("alien");
  return { title: t("customizeTitle"), robots: { index: false } };
}

export default async function Page() {
  const t = await getTranslations("alien");
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 md:px-6 md:pt-10">
      <h1 className="mb-6 text-4xl uppercase md:text-5xl">{t("customizeTitle")}</h1>
      <AlienCustomizer />
    </div>
  );
}
