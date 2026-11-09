import type { Metadata } from "next";
import { Suspense } from "react";
import { AfterPartyForm } from "./AfterPartyForm";

export const metadata: Metadata = { title: "Create After Party", description: "Create an after party linked to a main event." };

export default function Page() {
  return (
    <Suspense>
      <AfterPartyForm />
    </Suspense>
  );
}
