import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { LevelsAdmin } from "./LevelsAdmin";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return {
  title: tu("worldLevelsTitle"),
  description: tu("worldLevelsDescription"),
};
}

export default function LevelsPage() {
  return <LevelsAdmin />;
}
