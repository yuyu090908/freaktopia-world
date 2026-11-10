import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { NFTMarket } from "./NFTMarket";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("nftTitle"), description: tu("nftDescription") };
}

export default function Page() {
  return <NFTMarket />;
}
