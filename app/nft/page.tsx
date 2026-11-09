import type { Metadata } from "next";
import { NFTMarket } from "./NFTMarket";

export const metadata: Metadata = { title: "NFT Market (preview)", description: "Preview of future FREAKTOPIA collectibles. Nothing is minted and no wallet is connected in Phase 1." };

export default function Page() {
  return <NFTMarket />;
}
