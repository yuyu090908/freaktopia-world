"use client";

import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { AFTER_PARTIES } from "@/lib/data";
import { AfterPartyCard } from "@/components/cards/Cards";
import { ButtonLink, DemoBadge } from "@/components/ui/primitives";
import { useDemo } from "@/lib/store";

export function AfterPartyList() {
  const tu = useTranslations("afterParty");
  const mine = useDemo((s) => s.afterParties);
  const all = [...mine, ...AFTER_PARTIES];
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-4 md:px-0">
        <span className="text-sm font-bold">{tu("lengthAfterParties", { length: all.length })}</span>
        <DemoBadge label={tu("sampleData")} />
        <ButtonLink href="/after-party/new" size="sm" className="ml-auto"><Plus className="size-4" aria-hidden /> {tu("create")}</ButtonLink>
      </div>
      <ul className="mt-4 grid gap-4 px-4 sm:grid-cols-2 md:px-0 lg:grid-cols-3">
        {all.map((p) => <li key={p.id} className="flex"><AfterPartyCard party={p} className="w-full" /></li>)}
      </ul>
    </>
  );
}
