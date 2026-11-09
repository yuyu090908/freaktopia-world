import type { Metadata } from "next";
import { Suspense } from "react";
import { Planner } from "./Planner";

export const metadata: Metadata = { title: "AI Event Planner (demo)", description: "A beginner-friendly event planning assistant. Phase 1 uses simple rules, not a real AI model." };

export default function Page() {
  return (
    <Suspense>
      <Planner />
    </Suspense>
  );
}
