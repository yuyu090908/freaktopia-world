"use client";

import { Tx } from "@/components/i18n/Tx";
import { useTranslations } from "next-intl";
import { ART } from "@/lib/art";
import { useState } from "react";
import { Bookmark, BookmarkCheck, Wallet } from "lucide-react";
import { Alien } from "@/components/art/Alien";
import { Button, DemoNotice, PageTitle, Tag } from "@/components/ui/primitives";
import { toast } from "@/lib/store";
import { COLLECTIBLES } from "./collectibles";

export function NFTMarket() {
  const tu = useTranslations("nft");
  const [wish, setWish] = useState<string[]>([]);
  return (
    <div className="mx-auto max-w-6xl md:px-6">
      <PageTitle art={{ src: ART.panelStage, pos: "50% 35%" }} kicker={tu("collectibles")} title={tu("nftMarket")} sub={tu("phase1Nft")} />
      <DemoNotice className="mx-4 md:mx-0"><strong>{tu("previewOnly")}</strong> {tu("nothingHereIsMintedSold")}</DemoNotice>
      <ul className="mt-6 grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 md:px-0">
        {COLLECTIBLES.map((c) => {
          const on = wish.includes(c.id);
          return (
            <li key={c.id} className="flex flex-col overflow-hidden rounded-[24px] border border-line bg-surface">
              <div className="relative aspect-square" style={{ background: c.bg }}>
                <div className="halftone absolute inset-0" aria-hidden />
                <Alien look={c.look} className="relative h-full w-full p-3" title={c.name} />
                <Tag color={c.rarity === "Mythic" ? "#A276E9" : c.rarity === "Rare" ? "#55BCEB" : "#2a2a2a"} dark={c.rarity !== "Common"} className="absolute left-2 top-2">{c.rarity}</Tag>
              </div>
              <div className="flex flex-1 flex-col p-3">
                <div className="font-display text-base leading-tight">{c.name}</div>
                <div className="text-xs text-mute">{tu("editionNotMinted", { edition: c.edition })}</div>
                <p className="mt-1 text-xs text-cream/80"><Tx>{c.desc}</Tx></p>
                <button type="button" aria-pressed={on} onClick={() => { setWish((w) => (on ? w.filter((x) => x !== c.id) : [...w, c.id])); toast({ title: on ? tu("removedFromWishlist") : tu("addedToWishlist") }); }} className="mt-auto inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border-2 border-line pt-0 text-sm font-bold">
                  {on ? <BookmarkCheck className="size-4 text-acid" aria-hidden /> : <Bookmark className="size-4" aria-hidden />} {on ? tu("wishlisted") : tu("wishlist")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mx-4 mt-8 flex flex-col items-start gap-3 rounded-3xl border border-line bg-surface p-5 md:mx-0">
        <Wallet className="size-7 text-blue" aria-hidden />
        <div className="font-display text-xl">{tu("walletConnection")}</div>
        <p className="text-sm text-mute">{tu("plannedForALaterPhase")}</p>
        <Button variant="ghost" disabled>{tu("connectWalletNotAvailable")}</Button>
      </div>
    </div>
  );
}
