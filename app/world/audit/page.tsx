import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Audit } from "./Audit";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("partyAuditTitle"), description: tu("partyAuditDescription"), robots: { index: false } };
}

export default function Page() {
  return <Audit />;
}
