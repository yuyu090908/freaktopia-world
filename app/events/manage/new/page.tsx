import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { PlanForm } from "./PlanForm";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("opsNewTitle"), description: tu("opsDescription"), robots: { index: false } };
}

export default function Page() {
  return <PlanForm />;
}
