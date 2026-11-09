import type { Metadata } from "next";
import { CreateEventForm } from "./CreateEventForm";

export const metadata: Metadata = { title: "Create Event", description: "Create an event in 7 steps: basics, date, venue, DJ call, tickets, after party and review." };

export default function Page() {
  return <CreateEventForm />;
}
