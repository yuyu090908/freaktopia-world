import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/InfoPage";
import { ContactForm } from "./ContactForm";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("contactTitle"), description: tu("contactDescription") };
}

export default function Page() {
  const tu = useTranslations("pages");
  return (
    <InfoPage kicker={tu("contact")} title={tu("sayHello")} sub={tu("text3")}>
      <ContactForm />
    </InfoPage>
  );
}
