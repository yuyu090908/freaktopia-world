import type { Metadata } from "next";
import { AfterPartyList } from "./AfterPartyList";
import { PageTitle } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "After Party", description: "Official after parties linked to main events. Organizers can create their own." };

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl md:px-6">
      <PageTitle kicker="After Party" title="The night isn’t over" sub="メインイベントの後も、夜は続く。公式アフターパーティー一覧。" />
      <AfterPartyList />
    </div>
  );
}
