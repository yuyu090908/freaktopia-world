import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { CreateEventForm } from "./CreateEventForm";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("eventsCreateTitle"), description: tu("eventsCreateDescription") };
}

export default function Page() {
  return <CreateEventForm />;
}
