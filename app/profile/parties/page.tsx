import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { MyParties } from "./MyParties";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("myPartiesTitle"), description: tu("myPartiesDescription"), robots: { index: false } };
}

export default function Page() {
  return <MyParties />;
}
