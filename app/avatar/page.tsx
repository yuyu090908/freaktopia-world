import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { AvatarStudio } from "./AvatarStudio";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("avatarTitle"), description: tu("avatarDescription") };
}

export default function Page() {
  return <AvatarStudio />;
}
