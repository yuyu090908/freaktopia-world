import type { Metadata } from "next";
import { DaoHome } from "@/components/dao/views/DaoHome";

export const metadata: Metadata = { title: "DAO Home", description: "Votes, discussion, stage designs and progress for this event's community DAO (demo)." };

export default function Page() {
  return <DaoHome />;
}
