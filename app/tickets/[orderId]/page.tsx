import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { OrderView } from "./OrderView";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("ticketsOrderIdTitle"), robots: { index: false } };
}

export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <OrderView orderId={orderId} />;
}
