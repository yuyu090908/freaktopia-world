import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell, SignUpForm } from "@/components/auth/AuthForms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signUp"), description: t("signUpLead") };
}

export default async function Page() {
  const t = await getTranslations("auth");
  return (
    <AuthShell title={t("createAccount")} lead={t("signUpLead")}>
      <SignUpForm />
    </AuthShell>
  );
}
