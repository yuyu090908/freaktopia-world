import type { Metadata } from "next";
import { WorldExplorer } from "./WorldExplorer";

export const metadata: Metadata = {
  title: "World Map",
  description: "Find demo raves, clubs and festivals on a real world map. Filter by city, genre, date, level and more.",
};

export default function WorldPage() {
  return <WorldExplorer />;
}
