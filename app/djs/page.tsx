import type { Metadata } from "next";
import { DJArena } from "./DJArena";

export const metadata: Metadata = { title: "DJ Arena", description: "Search DJs, watch 30-minute demo auditions, vote and climb the rankings." };

export default function Page() {
  return <DJArena />;
}
