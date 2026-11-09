import type { Metadata } from "next";
import { ProposalDetail } from "@/components/dao/views/ProposalDetail";

export const metadata: Metadata = { title: "DAO Proposal", description: "Proposal detail, lifecycle, vote and audit trail (demo)." };

export default function Page() {
  return <ProposalDetail />;
}
