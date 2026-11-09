import type { Metadata } from "next";
import { SettingsView } from "@/components/dao/views/SettingsView";

export const metadata: Metadata = { title: "DAO Settings", description: "Staking and voting configuration (demo)." };

export default function Page() {
  return <SettingsView />;
}
