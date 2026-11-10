import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/InfoPage";
import { ButtonLink } from "@/components/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("aboutTitle"), description: tu("aboutDescription") };
}

export default function Page() {
  const tu = useTranslations("pages");
  return (
    <InfoPage kicker={tu("about")} title={tu("aLivingWorldOfNights")} sub={tu("dj")}>
      <section>
        <h2>{tu("theIdea")}</h2>
        <p>{tu("freaktopiaWorldTurnsThePlanning")}</p>
        <p>{tu("onTheNightEveryoneCan")}</p>
      </section>
      <section>
        <h2>{tu("whoItsFor")}</h2>
        <ul>
          <li><strong>{tu("fans")}</strong> {tu("discoverSupportAttendAndPlay")}</li>
          <li><strong>DJs</strong> {tu("applyAuditionLiveFor30")}</li>
          <li><strong>{tu("organizers")}</strong> {tu("createEventsInSevenSteps")}</li>
          <li><strong>{tu("venueOwners")}</strong> {tu("listSpacesAndGetMatched")}</li>
        </ul>
      </section>
      <section>
        <h2>{tu("phase1")}</h2>
        <p>{tu("thisIsAnInteractivePrototype")}</p>
      </section>
      <ButtonLink href="/world" size="lg">{tu("exploreTheWorld")}</ButtonLink>
    </InfoPage>
  );
}
