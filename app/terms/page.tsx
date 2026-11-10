import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/InfoPage";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("termsTitle"), description: tu("termsDescription") };
}

export default function Page() {
  const tu = useTranslations("pages");
  return (
    <InfoPage kicker={tu("legal")} title={tu("termsOfUse")} sub={tu("text7")}>
      <section><h2>{tu("n1Prototype")}</h2><p>{tu("freaktopiaWorldPhase1Is")}</p></section>
      <section><h2>{tu("n2NoTransactions")}</h2><p>{tu("noPaymentsAreProcessedNo")}</p></section>
      <section><h2>{tu("n3YourContent")}</h2><p>{tu("anythingYouEnterProfilesEvents")}</p></section>
      <section><h2>{tu("n4Draft")}</h2><p>{tu("theseTermsAreAPlaceholder")}</p></section>
    </InfoPage>
  );
}
