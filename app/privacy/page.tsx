import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/InfoPage";

export const metadata: Metadata = { title: "Privacy", description: "How the prototype handles your data." };

export default function Page() {
  return (
    <InfoPage kicker="Legal" title="Privacy" sub="Phase 1ではサーバーに個人情報を送信しません。データはブラウザのlocalStorageにのみ保存されます。">
      <section><h2>What we store</h2><p>Demo state (profile, avatar, tickets, drafts, uploaded venue photos) is saved in your browser’s localStorage under one key. You can erase it any time from Profile → Settings → Reset all demo data.</p></section>
      <section><h2>Location</h2><p>The live venue map never uses GPS or precise location. You choose a zone yourself, and your avatar is only shown if you turn it on.</p></section>
      <section><h2>Third parties</h2><p>Map country shapes are bundled with the site (Natural Earth, public domain). No analytics, ads or trackers are included in the prototype.</p></section>
    </InfoPage>
  );
}
