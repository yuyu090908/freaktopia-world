import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/ui/States";
import { RankingsView } from "./RankingsView";

export const metadata: Metadata = {
  title: "World Ranking",
  description: "WORLD RANKING: the most popular, trending, funded and attended festivals in FREAKTOPIA WORLD (demo data).",
};

export default function RankingsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton variant="page" />}>
      <RankingsView />
    </Suspense>
  );
}
