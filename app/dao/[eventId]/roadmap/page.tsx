import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { RoadmapView } from "@/components/dao/views/RoadmapView";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("daoEventIdRoadmapTitle"), description: tu("daoEventIdRoadmapDescription") };
}

export default function Page() {
  return <RoadmapView />;
}
