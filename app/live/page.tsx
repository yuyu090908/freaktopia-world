import type { Metadata } from "next";
import { LiveDiscovery } from "./LiveDiscovery";

export const metadata: Metadata = { title: "Live", description: "THE WORLD IS LIVE. Discover festivals, watch DJ sets and join with your alien avatar. Demo data; real streams are not connected in this build." };

export default function Page() {
  return <LiveDiscovery />;
}
