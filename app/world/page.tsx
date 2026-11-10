import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { WorldExplorer } from "./WorldExplorer";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return {
  title: tu("worldTitle"),
  description: tu("worldDescription"),
};
}

export default function WorldPage() {
  return <WorldExplorer />;
}
