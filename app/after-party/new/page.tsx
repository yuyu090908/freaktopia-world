import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AfterPartyForm } from "./AfterPartyForm";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("afterPartyNewTitle"), description: tu("afterPartyNewDescription") };
}

export default function Page() {
  return (
    <Suspense>
      <AfterPartyForm />
    </Suspense>
  );
}
