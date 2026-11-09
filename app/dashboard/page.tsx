import type { Metadata } from "next";
import { Suspense } from "react";
import { Dashboard } from "./Dashboard";
import { LoadingSkeleton } from "@/components/ui/States";

export const metadata: Metadata = { title: "Dashboard", description: "Role-based dashboards for organizers, DJs, venue owners and fans." };

export default function Page() {
  return (
    <Suspense fallback={<LoadingSkeleton variant="page" />}>
      <Dashboard />
    </Suspense>
  );
}
