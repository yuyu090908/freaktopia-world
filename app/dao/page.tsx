import type { Metadata } from "next";
import { DaoIndexView } from "@/components/dao/views/DaoIndexView";

export const metadata: Metadata = {
  title: "Festival DAO",
  description: "Event DAOs: stake to join, discuss, propose, vote one-person-one-vote and design the stage with AI (demo data, no blockchain connected).",
};

export default function Page() {
  return <DaoIndexView />;
}
