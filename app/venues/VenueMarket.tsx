"use client";

import { useTranslations } from "next-intl";
import { ART } from "@/lib/art";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, Search, Sparkles, X } from "lucide-react";
import { VENUES } from "@/lib/data";
import { VenueCard } from "@/components/cards/Cards";
import { ButtonLink, Chip, DemoBadge, PageTitle } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { useDemo } from "@/lib/store";

const SIZES = [
  ["any", "anySize"],
  ["s", "< 500"],
  ["m", "500–2,000"],
  ["l", "2,000+"],
] as const;

export function VenueMarket() {
  const tu = useTranslations("venues");
  const mine = useDemo((s) => s.venues);
  const [q, setQ] = useState("");
  const [size, setSize] = useState<(typeof SIZES)[number][0]>("any");
  const [city, setCity] = useState<string | null>(null);
  const all = useMemo(() => [...mine, ...VENUES], [mine]);
  const cities = Array.from(new Set(VENUES.map((v) => v.city))).sort();
  const list = all.filter((v) => {
    const s = q.trim().toLowerCase();
    if (s && ![v.name, v.city, v.country, ...v.amenities].join(" ").toLowerCase().includes(s)) return false;
    if (city && v.city !== city) return false;
    if (size === "s" && v.capacity >= 500) return false;
    if (size === "m" && (v.capacity < 500 || v.capacity > 2000)) return false;
    if (size === "l" && v.capacity < 2000) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl md:px-6">
      <PageTitle art={{ src: ART.panelMarket, pos: "50% 45%" }} kicker={tu("venueMarket")} title={tu("spacesForStrangeNights")} sub={tu("text")} />

      <div className="grid gap-3 px-4 sm:grid-cols-2 md:px-0">
        <Link href="/venues/new" className="flex min-h-20 items-center gap-4 rounded-[24px] border-[3px] border-ink bg-acid p-4 text-ink">
          <Building2 className="size-8 shrink-0" aria-hidden />
          <span><span className="block font-display text-xl uppercase">{tu("listYourVenue")}</span><span className="text-sm font-semibold">{tu("n5QuickStepsPhotosPrice")}</span></span>
        </Link>
        <Link href="/venues/planner" className="flex min-h-20 items-center gap-4 rounded-[24px] border-[3px] border-ink bg-purple p-4 text-ink">
          <Sparkles className="size-8 shrink-0" aria-hidden />
          <span><span className="block font-display text-xl uppercase">{tu("aiEventPlanner")}</span><span className="text-sm font-semibold">{tu("text2")}</span></span>
        </Link>
      </div>

      <div className="mt-6 space-y-2.5">
        <div role="search" className="relative mx-4 md:mx-0">
          <label htmlFor="v-q" className="sr-only">{tu("searchVenues")}</label>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-mute" aria-hidden />
          <input id="v-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tu("searchVenueCityOrEquipment")} className="h-[52px] w-full rounded-full border-2 border-line bg-surface pl-12 pr-12 outline-none focus:border-acid" />
          {q && <button type="button" onClick={() => setQ("")} aria-label={tu("clear")} className="absolute right-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center"><X className="size-4" /></button>}
        </div>
        <div className="rail !gap-2 md:!px-0" role="group" aria-label={tu("capacity")}>
          {SIZES.map(([k, l]) => <Chip key={k} active={size === k} onClick={() => setSize(k)}>{k === "any" ? tu(l) : l}</Chip>)}
        </div>
        <div className="rail !gap-2 md:!px-0" role="group" aria-label={tu("city")}>
          <Chip active={!city} onClick={() => setCity(null)}>{tu("allCities")}</Chip>
          {cities.map((c) => <Chip key={c} active={city === c} onClick={() => setCity(city === c ? null : c)}>{c}</Chip>)}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 px-4 md:px-0">
        <span className="text-sm font-bold" aria-live="polite">{tu("lengthVenues", { length: list.length })}</span>
        <DemoBadge label={tu("sampleListings")} />
      </div>
      <h2 className="sr-only">{tu("venues")}</h2>
      {list.length ? (
        <ul className="mt-3 grid gap-4 px-4 sm:grid-cols-2 md:px-0 lg:grid-cols-3">
          {list.map((v) => <li key={v.id} className="cv-auto flex"><VenueCard venue={v} className="w-full" /></li>)}
        </ul>
      ) : (
        <EmptyState className="mx-4 mt-4 md:mx-0" title={tu("noVenuesFound")} body={tu("text3")} action={<ButtonLink href="/venues/new">{tu("listAVenue")}</ButtonLink>} />
      )}
    </div>
  );
}
