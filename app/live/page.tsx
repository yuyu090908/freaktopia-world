import type { Metadata } from "next";
import { LiveFestival } from "./LiveFestival";

export const metadata: Metadata = { title: "Live Festival", description: "Join the illustrated live venue map with your alien avatar. Demo of event-day features." };

export default function Page() {
  return <LiveFestival />;
}
