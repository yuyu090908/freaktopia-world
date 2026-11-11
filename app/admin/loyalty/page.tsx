import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { LoyaltyAdmin } from "./LoyaltyAdmin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("loyalty");
  return { title: t("admin.title"), robots: { index: false } };
}

export default function Page() {
  return <LoyaltyAdmin />;
}
