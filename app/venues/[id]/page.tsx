import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { VENUES, getVenue } from "@/lib/data";
import { VenueDetail } from "./VenueDetail";

export function generateStaticParams() {
  return VENUES.map((v) => ({ id: v.id }));
}
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const v = getVenue((await params).id);
  const tu = await getTranslations("seo");
  return { title: v ? tu("venueWithName", { name: v.name }) : tu("venue"), description: v?.description };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <VenueDetail id={(await params).id} />;
}
