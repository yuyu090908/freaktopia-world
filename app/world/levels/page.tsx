import type { Metadata } from "next";
import { LevelsAdmin } from "./LevelsAdmin";

export const metadata: Metadata = {
  title: "Festival level rules",
  description: "Edit the festival growth level thresholds (demo admin) and see every world map landmark.",
};

export default function LevelsPage() {
  return <LevelsAdmin />;
}
