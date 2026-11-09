import type { Metadata } from "next";
import { DiscussionView } from "@/components/dao/views/DiscussionView";

export const metadata: Metadata = { title: "DAO Discussion", description: "Member discussion threads for this event DAO (demo)." };

export default function Page() {
  return <DiscussionView />;
}
