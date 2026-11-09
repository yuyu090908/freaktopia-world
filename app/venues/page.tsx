import type { Metadata } from "next";
import { VenueMarket } from "./VenueMarket";

export const metadata: Metadata = { title: "Venue Market", description: "Find a venue for your event or list your own space. Includes a demo AI event planner." };

export default function Page() {
  return <VenueMarket />;
}
