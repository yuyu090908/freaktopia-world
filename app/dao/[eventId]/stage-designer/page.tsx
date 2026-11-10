import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { StageDesigner } from "@/components/dao/views/StageDesigner";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("daoEventIdStageDesignerTitle"), description: tu("daoEventIdStageDesignerDescription") };
}

export default function Page() {
  return <StageDesigner />;
}
