import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Dashboard } from "./Dashboard";
import { LoadingSkeleton } from "@/components/ui/States";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("dashboardTitle"), description: tu("dashboardDescription") };
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingSkeleton variant="page" />}>
      <Dashboard />
    </Suspense>
  );
}
