import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { AFTER_PARTIES, getAfterParty } from "@/lib/data";
import { AfterPartyDetail } from "./AfterPartyDetail";

export function generateStaticParams() {
  return AFTER_PARTIES.map((a) => ({ id: a.id }));
}
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const a = getAfterParty((await params).id);
  const tu = await getTranslations("seo");
  return { title: a ? tu("afterPartyWithName", { name: a.name }) : tu("afterParty"), description: a?.description };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <AfterPartyDetail id={(await params).id} />;
}
