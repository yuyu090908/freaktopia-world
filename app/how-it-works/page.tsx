import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/InfoPage";
import { Stage } from "@/components/art/Stage";
import { LEVELS } from "@/lib/levels";
import { money } from "@/lib/utils";

export const metadata: Metadata = { title: "How It Works", description: "Discover, support, evolve, attend and play. How event levels work." };

export default function Page() {
  return (
    <InfoPage kicker="How it works" title="Discover → Support → Evolve → Attend → Play" sub="応援者数と開催資金によって、イベントのステージがLV.1からLV.5まで成長します。">
      <section>
        <h2>Event levels</h2>
        <p>An event’s level is the highest level where both thresholds are met: supporters and funding secured.</p>
        <ol className="mt-4 space-y-5">
          {LEVELS.map((l) => (
            <li key={l.level} className="overflow-hidden rounded-3xl border border-line bg-surface">
              <Stage level={l.level} className="h-auto w-full" />
              <div className="p-4">
                <div className="font-display text-xl" style={{ color: l.color }}>LV.{l.level} {l.name}</div>
                <p className="!mt-1 text-sm">{l.description}</p>
                <p className="!mt-2 text-sm text-mute">{l.supporters.toLocaleString("en-US")}+ supporters · {money(l.funding)}+ secured</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h2>XP & your alien</h2>
        <p>Supporting, buying tickets, voting in auditions, checking in and creating events all earn XP. Your alien levels up and unlocks new outfits and accessories.</p>
      </section>
    </InfoPage>
  );
}
