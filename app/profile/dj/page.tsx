import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { DjStudio } from "./DjStudio";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("music");
  return { title: t("studioTitle"), robots: { index: false } };
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DjStudio />
    </Suspense>
  );
}
