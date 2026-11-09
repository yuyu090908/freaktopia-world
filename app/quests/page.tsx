import type { Metadata } from "next";
import { Quests } from "./Quests";

export const metadata: Metadata = { title: "Quests & Rankings", description: "Festival quests, achievement badges, city and DJ rankings, and your club." };

export default function Page() {
  return <Quests />;
}
