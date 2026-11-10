import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/InfoPage";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("privacyTitle"), description: tu("privacyDescription") };
}

export default function Page() {
  const tu = useTranslations("pages");
  return (
    <InfoPage kicker={tu("legal")} title={tu("privacy")} sub={tu("phase1Localstorage")}>
      <section><h2>{tu("whatWeStore")}</h2><p>{tu("demoStateProfileAvatarTickets")}</p></section>
      <section><h2>{tu("location")}</h2><p>{tu("theLiveVenueMapNever")}</p></section>
      <section><h2>{tu("thirdParties")}</h2><p>{tu("mapCountryShapesAreBundled")}</p></section>
    </InfoPage>
  );
}
