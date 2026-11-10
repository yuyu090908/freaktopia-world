import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/ui/States";
import { RankingsView } from "./RankingsView";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return {
  title: tu("rankingsTitle"),
  description: tu("rankingsDescription"),
};
}

export default function RankingsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton variant="page" />}>
      <RankingsView />
    </Suspense>
  );
}
