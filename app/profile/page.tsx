import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { ProfileView } from "./ProfileView";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("profileTitle"), description: tu("profileDescription") };
}

export default function Page() {
  return <ProfileView />;
}
