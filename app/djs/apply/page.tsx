import type { Metadata } from "next";
import { Suspense } from "react";
import { DJApplyForm } from "./DJApplyForm";
import { LoadingSkeleton } from "@/components/ui/States";

export const metadata: Metadata = { title: "Apply as DJ", description: "Apply to play a demo event and book your 30-minute audition slot." };

export default function Page() {
  return (
    <Suspense fallback={<LoadingSkeleton variant="page" />}>
      <DJApplyForm />
    </Suspense>
  );
}
