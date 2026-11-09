import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTitle } from "@/components/ui/primitives";
import { LoadingSkeleton } from "@/components/ui/States";
import { CompareView } from "./CompareView";

export const metadata: Metadata = { title: "Festival Compare", description: "Compare 2–3 festivals side by side (demo data)." };

export default function ComparePage() {
  return (
    <div className="mx-auto max-w-6xl md:px-6">
      <PageTitle kicker="World ranking" title="Festival compare" sub="2〜3イベントを並べて比較。リンクを共有すると同じ比較を開けます。" />
      <Suspense fallback={<LoadingSkeleton variant="list" />}>
        <CompareView />
      </Suspense>
    </div>
  );
}
