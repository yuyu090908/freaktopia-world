import type { Metadata } from "next";
import { ProposalsView } from "@/components/dao/views/ProposalsView";

export const metadata: Metadata = { title: "DAO Proposals", description: "Community proposals for this event (demo)." };

export default function Page() {
  return <ProposalsView />;
}
