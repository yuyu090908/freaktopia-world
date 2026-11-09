import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/primitives";
import { AlertsView } from "./AlertsView";

export const metadata: Metadata = { title: "Alerts", description: "In-app alerts for the events you follow." };

export default function AlertsPage() {
  return (
    <div className="mx-auto max-w-3xl md:px-6">
      <PageTitle kicker="Event alerts" title="Your alerts" sub="フォロー中のイベントのお知らせ。通知の種類ごとにオン・オフできます。" />
      <AlertsView />
    </div>
  );
}
