import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { PublicProfile } from "./PublicProfile";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("publicProfileTitle"), description: tu("publicProfileDescription") };
}

export default async function Page({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return <PublicProfile handle={decodeURIComponent(handle)} />;
}
