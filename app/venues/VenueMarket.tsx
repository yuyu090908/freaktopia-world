"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, Search, Sparkles, X } from "lucide-react";
import { VENUES } from "@/lib/data";
import { VenueCard } from "@/components/cards/Cards";
import { ButtonLink, Chip, DemoBadge, PageTitle } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { useDemo } from "@/lib/store";

const SIZES = [
  ["any", "Any size"],
  ["s", "< 500"],
  ["m", "500–2,000"],
  ["l", "2,000+"],
] as const;

export function VenueMarket() {
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
      <PageTitle kicker="Venue Market" title="Spaces for strange nights" sub="会場を探す、または自分の会場を掲載してイベント主催者とつながろう。" />

      <div className="grid gap-3 px-4 sm:grid-cols-2 md:px-0">
        <Link href="/venues/new" className="flex min-h-20 items-center gap-4 rounded-[24px] border-[3px] border-ink bg-acid p-4 text-ink">
          <Building2 className="size-8 shrink-0" aria-hidden />
          <span><span className="block font-display text-xl uppercase">List your venue</span><span className="text-sm font-semibold">5 quick steps · photos, price, dates</span></span>
        </Link>
        <Link href="/venues/planner" className="flex min-h-20 items-center gap-4 rounded-[24px] border-[3px] border-ink bg-purple p-4 text-ink">
          <Sparkles className="size-8 shrink-0" aria-hidden />
          <span><span className="block font-display text-xl uppercase">AI event planner</span><span className="ja text-sm font-semibold">初めてでも企画をサポート（デモ）</span></span>
        </Link>
      </div>

      <div className="mt-6 space-y-2.5">
        <div role="search" className="relative mx-4 md:mx-0">
          <label htmlFor="v-q" className="sr-only">Search venues</label>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-mute" aria-hidden />
          <input id="v-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search venue, city or equipment" className="h-[52px] w-full rounded-full border-2 border-line bg-surface pl-12 pr-12 outline-none focus:border-acid" />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Clear" className="absolute right-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center"><X className="size-4" /></button>}
        </div>
        <div className="rail !gap-2 md:!px-0" role="group" aria-label="Capacity">
          {SIZES.map(([k, l]) => <Chip key={k} active={size === k} onClick={() => setSize(k)}>{l}</Chip>)}
        </div>
        <div className="rail !gap-2 md:!px-0" role="group" aria-label="City">
          <Chip active={!city} onClick={() => setCity(null)}>All cities</Chip>
          {cities.map((c) => <Chip key={c} active={city === c} onClick={() => setCity(city === c ? null : c)}>{c}</Chip>)}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 px-4 md:px-0">
        <span className="text-sm font-bold" aria-live="polite">{list.length} venues</span>
        <DemoBadge label="Sample listings" />
      </div>
      {list.length ? (
        <ul className="mt-3 grid gap-4 px-4 sm:grid-cols-2 md:px-0 lg:grid-cols-3">
          {list.map((v) => <li key={v.id} className="cv-auto flex"><VenueCard venue={v} className="w-full" /></li>)}
        </ul>
      ) : (
        <EmptyState className="mx-4 mt-4 md:mx-0" title="No venues found" body="条件を変えるか、会場を掲載してください。" action={<ButtonLink href="/venues/new">List a venue</ButtonLink>} />
      )}
    </div>
  );
}
