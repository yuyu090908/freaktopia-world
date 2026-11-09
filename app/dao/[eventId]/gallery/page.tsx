import type { Metadata } from "next";
import { GalleryView } from "@/components/dao/views/GalleryView";

export const metadata: Metadata = { title: "Stage Design Gallery", description: "Community stage concepts with budget estimates and vote status (demo)." };

export default function Page() {
  return <GalleryView />;
}
