import type { Metadata } from "next";
import { EventsBrowser } from "./EventsBrowser";
import { PageTitle } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Events",
  description: "Browse demo events, support the ones you want to happen, and watch them evolve from DJ booth to mega fest.",
};

export default function EventsPage() {
  return (
    <div className="mx-auto max-w-6xl md:px-6">
      <PageTitle kicker="Events" title="Find your night" sub="応援して、育てて、参加する。気になるイベントを探そう。" />
      <EventsBrowser />
    </div>
  );
}
