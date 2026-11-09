import type { Metadata } from "next";
import { AvatarStudio } from "./AvatarStudio";

export const metadata: Metadata = { title: "Alien Avatar", description: "Pick your alien, change its outfit and accessories, and level it up." };

export default function Page() {
  return <AvatarStudio />;
}
