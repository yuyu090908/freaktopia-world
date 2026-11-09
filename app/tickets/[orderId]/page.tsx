import type { Metadata } from "next";
import { OrderView } from "./OrderView";

export const metadata: Metadata = { title: "Demo ticket", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <OrderView orderId={orderId} />;
}
