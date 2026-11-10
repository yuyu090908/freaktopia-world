import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { MyTickets } from "./MyTickets";
import { PageTitle } from "@/components/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("ticketsTitle"), description: tu("ticketsDescription") };
}

export default function Page() {
  const tu = useTranslations("pages");
  return (
    <div className="mx-auto max-w-3xl md:px-6">
      <PageTitle kicker={tu("wallet")} title={tu("myTickets")} sub={tu("text6")} />
      <MyTickets />
    </div>
  );
}
