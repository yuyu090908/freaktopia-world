import type { Metadata } from "next";
import { MembersView } from "@/components/dao/views/MembersView";

export const metadata: Metadata = { title: "DAO Members", description: "Members, roles and badges (demo)." };

export default function Page() {
  return <MembersView />;
}
