import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { GalleryView } from "@/components/dao/views/GalleryView";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("daoEventIdGalleryTitle"), description: tu("daoEventIdGalleryDescription") };
}

export default function Page() {
  return <GalleryView />;
}
