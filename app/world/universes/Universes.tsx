"use client";

import { useTranslations } from "next-intl";
import { PageTitle } from "@/components/ui/primitives";
import { Section } from "@/components/ops/shared";
import { UpcomingParties, WorldDirectory } from "@/components/party/Directory";

export function Universes() {
  const t = useTranslations("party");
  return (
    <div className="mx-auto max-w-6xl pb-24 md:px-6">
      <PageTitle kicker={t("kicker")} title={t("universes")} sub={t("universesSub")} />
      <div className="space-y-4 px-4 md:px-0">
        <Section title={t("directoryTitle")} id="dir">
          <WorldDirectory />
        </Section>
        <Section title={t("upcomingTitle")} id="up">
          <UpcomingParties limit={12} />
        </Section>
      </div>
    </div>
  );
}
