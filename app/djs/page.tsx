import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { DJArena } from "./DJArena";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("djsTitle"), description: tu("djsDescription") };
}

export default function Page() {
  return <DJArena />;
}
