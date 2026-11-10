import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AccountSettings } from "@/components/profile/AccountSettings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("settings"), robots: { index: false } };
}

export default async function Page() {
  const t = await getTranslations("profile");
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 md:px-6 md:pt-10">
      <h1 className="mb-6 text-4xl uppercase md:text-5xl">{t("settings")}</h1>
      <AccountSettings />
    </div>
  );
}
