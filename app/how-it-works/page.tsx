import { Tx } from "@/components/i18n/Tx";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/InfoPage";
import { Stage } from "@/components/art/Stage";
import { LEVELS } from "@/lib/levels";
import { money } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("howItWorksTitle"), description: tu("howItWorksDescription") };
}

export default function Page() {
  const tu = useTranslations("pages");
  return (
    <InfoPage kicker={tu("howItWorks")} title={tu("discoverSupportEvolveAttendPlay")} sub={tu("lv1Lv5")}>
      <section>
        <h2>{tu("eventLevels")}</h2>
        <p>{tu("anEventsLevelIsThe")}</p>
        <ol className="mt-4 space-y-5">
          {LEVELS.map((l) => (
            <li key={l.level} className="overflow-hidden rounded-3xl border border-line bg-surface">
              <Stage level={l.level} className="h-auto w-full" />
              <div className="p-4">
                <div className="font-display text-xl" style={{ color: l.color }}>LV.{l.level} <Tx>{l.name}</Tx></div>
                <p className="!mt-1 text-sm"><Tx>{l.description}</Tx></p>
                <p className="!mt-2 text-sm text-mute">{tu("tolocalestringSupportersMoneySecured", { toLocaleString: l.supporters.toLocaleString("en-US"), money: money(l.funding) })}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h2>{tu("xpYourAlien")}</h2>
        <p>{tu("supportingBuyingTicketsVotingIn")}</p>
      </section>
    </InfoPage>
  );
}
