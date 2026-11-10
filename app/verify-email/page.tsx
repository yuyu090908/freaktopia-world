import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AuthShell, VerifyEmail } from "@/components/auth/AuthForms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("verifyTitle"), robots: { index: false } };
}

export default async function Page() {
  const t = await getTranslations("auth");
  return (
    <AuthShell title={t("checkEmailTitle")}>
      <Suspense>
        <VerifyEmail />
      </Suspense>
    </AuthShell>
  );
}
