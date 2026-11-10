import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Quests } from "./Quests";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("questsTitle"), description: tu("questsDescription") };
}

export default function Page() {
  return <Quests />;
}
