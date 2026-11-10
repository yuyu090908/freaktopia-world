import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Planner } from "./Planner";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("venuesPlannerTitle"), description: tu("venuesPlannerDescription") };
}

export default function Page() {
  return (
    <Suspense>
      <Planner />
    </Suspense>
  );
}
