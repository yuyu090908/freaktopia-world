import type { Metadata } from "next";
import { VotesView } from "@/components/dao/views/VotesView";

export const metadata: Metadata = { title: "DAO Votes", description: "Open and closed DAO votes (demo)." };

export default function Page() {
  return <VotesView />;
}
