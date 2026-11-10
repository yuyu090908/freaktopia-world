import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/primitives";
import { AlertsView } from "./AlertsView";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("alertsTitle"), description: tu("alertsDescription") };
}

export default function AlertsPage() {
  const tu = useTranslations("pages");
  return (
    <div className="mx-auto max-w-3xl md:px-6">
      <PageTitle kicker={tu("eventAlerts")} title={tu("yourAlerts")} sub={tu("text2")} />
      <AlertsView />
    </div>
  );
}
