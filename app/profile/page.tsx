import type { Metadata } from "next";
import { ProfileView } from "./ProfileView";

export const metadata: Metadata = { title: "Profile", description: "Your alien, level, XP, tickets, favorites, collection and settings." };

export default function Page() {
  return <ProfileView />;
}
