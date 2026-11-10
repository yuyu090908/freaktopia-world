import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTitle } from "@/components/ui/primitives";
import { LoadingSkeleton } from "@/components/ui/States";
import { CompareView } from "./CompareView";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("rankingsCompareTitle"), description: tu("rankingsCompareDescription") };
}

export default function ComparePage() {
  const tu = useTranslations("pages");
  return (
    <div className="mx-auto max-w-6xl md:px-6">
      <PageTitle kicker={tu("worldRanking")} title={tu("festivalCompare")} sub={tu("n23")} />
      <Suspense fallback={<LoadingSkeleton variant="list" />}>
        <CompareView />
      </Suspense>
    </div>
  );
}
