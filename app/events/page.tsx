import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ART } from "@/lib/art";
import type { Metadata } from "next";
import { EventsBrowser } from "./EventsBrowser";
import { PageTitle } from "@/components/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return {
  title: tu("eventsTitle"),
  description: tu("eventsDescription"),
};
}

export default function EventsPage() {
  const tu = useTranslations("pages");
  return (
    <div className="mx-auto max-w-6xl md:px-6">
      <PageTitle art={{ src: ART.mapCities, pos: "50% 40%" }} kicker={tu("events")} title={tu("findYourNight")} sub={tu("text4")} />
      <EventsBrowser />
    </div>
  );
}
