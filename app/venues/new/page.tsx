import type { Metadata } from "next";
import { VenueForm } from "./VenueForm";

export const metadata: Metadata = { title: "List Your Venue", description: "List your venue in five steps: details, photos, pricing, equipment and available dates." };

export default function Page() {
  return <VenueForm />;
}
