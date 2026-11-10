import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthShell, GoogleDemoForm } from "@/components/auth/AuthForms";
import { authConfig } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("googleDemoTitle"), robots: { index: false } };
}

/** DEMO ONLY: exists while Google OAuth isn't configured and no real database is connected. */
export default async function Page() {
  if (authConfig().google !== "demo-simulator") notFound();
  const t = await getTranslations("auth");
  return (
    <AuthShell title={t("googleDemoTitle")}>
      <Suspense>
        <GoogleDemoForm />
      </Suspense>
    </AuthShell>
  );
}
