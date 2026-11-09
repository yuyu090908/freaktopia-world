import type { Metadata } from "next";
import { StageDesigner } from "@/components/dao/views/StageDesigner";

export const metadata: Metadata = { title: "AI Stage Designer", description: "Generate AI stage concepts from real venue photos (demo compositor)." };

export default function Page() {
  return <StageDesigner />;
}
