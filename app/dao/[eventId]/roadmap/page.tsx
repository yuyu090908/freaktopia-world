import type { Metadata } from "next";
import { RoadmapView } from "@/components/dao/views/RoadmapView";

export const metadata: Metadata = { title: "DAO Roadmap", description: "Festival build game and production milestones (demo)." };

export default function Page() {
  return <RoadmapView />;
}
