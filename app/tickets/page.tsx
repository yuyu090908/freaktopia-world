import type { Metadata } from "next";
import { MyTickets } from "./MyTickets";
import { PageTitle } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "My Tickets", description: "Your demo tickets saved in this browser." };

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl md:px-6">
      <PageTitle kicker="Wallet" title="My tickets" sub="デモ購入したチケットはこのブラウザに保存されます。" />
      <MyTickets />
    </div>
  );
}
