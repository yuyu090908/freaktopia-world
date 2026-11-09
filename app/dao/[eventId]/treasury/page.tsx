import type { Metadata } from "next";
import { TreasuryView } from "@/components/dao/views/TreasuryView";

export const metadata: Metadata = { title: "DAO Treasury", description: "Event budget, approvals and staking escrow, kept separate (demo)." };

export default function Page() {
  return <TreasuryView />;
}
