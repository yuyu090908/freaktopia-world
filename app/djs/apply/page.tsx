import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { DJApplyForm } from "./DJApplyForm";
import { LoadingSkeleton } from "@/components/ui/States";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("djsApplyTitle"), description: tu("djsApplyDescription") };
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingSkeleton variant="page" />}>
      <DJApplyForm />
    </Suspense>
  );
}
