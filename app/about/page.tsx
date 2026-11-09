import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/InfoPage";
import { ButtonLink } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "About", description: "What FREAKTOPIA WORLD is and who it’s for." };

export default function Page() {
  return (
    <InfoPage kicker="About" title="A living world of nights out" sub="世界中のDJ・音楽ファン・主催者・会場オーナーがつながり、現実のイベントをゲーム感覚で育てるプラットフォーム。">
      <section>
        <h2>The idea</h2>
        <p>FREAKTOPIA WORLD turns the planning of real events into a shared game. Fans discover nights on a world map, support the ones they want to happen, and watch the stage evolve from a tiny DJ booth into a mega festival as supporters and funding grow.</p>
        <p>On the night, everyone can join the illustrated venue map with their own alien avatar, and the fun continues into after parties, collectibles and, later, running your own in-game club.</p>
      </section>
      <section>
        <h2>Who it’s for</h2>
        <ul>
          <li><strong>Fans</strong> discover, support, attend and play.</li>
          <li><strong>DJs</strong> apply, audition live for 30 minutes and climb the rankings.</li>
          <li><strong>Organizers</strong> create events in seven steps and grow them with their community.</li>
          <li><strong>Venue owners</strong> list spaces and get matched with events.</li>
        </ul>
      </section>
      <section>
        <h2>Phase 1</h2>
        <p>This is an interactive prototype. All content is fictional demo data, and payments, live streaming, wallets and NFT minting are not connected yet.</p>
      </section>
      <ButtonLink href="/world" size="lg">Explore the world</ButtonLink>
    </InfoPage>
  );
}
