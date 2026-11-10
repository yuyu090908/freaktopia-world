import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { VenueMarket } from "./VenueMarket";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("venuesTitle"), description: tu("venuesDescription") };
}

export default function Page() {
  return <VenueMarket />;
}
