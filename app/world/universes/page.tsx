import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Universes } from "./Universes";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("universesTitle"), description: tu("universesDescription") };
}

export default function Page() {
  return <Universes />;
}
