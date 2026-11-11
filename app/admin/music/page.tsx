import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { MusicAdmin } from "./MusicAdmin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("musicAdmin");
  return { title: t("title"), robots: { index: false } };
}

export default function Page() {
  return <MusicAdmin />;
}
