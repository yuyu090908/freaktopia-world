import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { VenueForm } from "./VenueForm";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("venuesNewTitle"), description: tu("venuesNewDescription") };
}

export default function Page() {
  return <VenueForm />;
}
