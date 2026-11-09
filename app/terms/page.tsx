import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/InfoPage";

export const metadata: Metadata = { title: "Terms", description: "Prototype terms of use." };

export default function Page() {
  return (
    <InfoPage kicker="Legal" title="Terms of use" sub="プロトタイプ版の利用条件（ドラフト）。正式な規約は本番公開前に法務確認のうえ掲載します。">
      <section><h2>1. Prototype</h2><p>FREAKTOPIA WORLD Phase 1 is a design prototype. All events, DJs, venues, tickets and collectibles are fictional.</p></section>
      <section><h2>2. No transactions</h2><p>No payments are processed, no tickets are issued, no streams are broadcast and no digital assets are minted. Demo purchases have no value.</p></section>
      <section><h2>3. Your content</h2><p>Anything you enter (profiles, events, venues, photos) stays in your own browser storage and is not uploaded.</p></section>
      <section><h2>4. Draft</h2><p>These terms are a placeholder and will be replaced by reviewed terms before launch.</p></section>
    </InfoPage>
  );
}
