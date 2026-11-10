import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ART } from "@/lib/art";
import type { Metadata } from "next";
import { AfterPartyList } from "./AfterPartyList";
import { PageTitle } from "@/components/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("afterPartyTitle"), description: tu("afterPartyDescription") };
}

export default function Page() {
  const tu = useTranslations("pages");
  return (
    <div className="mx-auto max-w-6xl md:px-6">
      <PageTitle art={{ src: ART.panelAfterparty, pos: "50% 50%" }} kicker={tu("afterParty")} title={tu("theNightIsntOver")} sub={tu("text")} />
      <AfterPartyList />
    </div>
  );
}
