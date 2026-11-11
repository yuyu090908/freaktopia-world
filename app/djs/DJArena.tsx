"use client";

import { useTranslations } from "next-intl";
import { ART } from "@/lib/art";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Mic2, Play, Search, Trophy, X } from "lucide-react";
import { DJS, GENRES } from "@/lib/data";
import { AlienAvatar, DJCard } from "@/components/cards/Cards";
import { ButtonLink, Chip, DemoBadge, PageTitle, SectionHeader } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { useDemo } from "@/lib/store";
import { compact } from "@/lib/utils";
import type { Genre } from "@/lib/types";

export function DJArena() {
  const tu = useTranslations("djs");
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState<Genre | null>(null);
  const [bpm, setBpm] = useState<"any" | "slow" | "mid" | "fast">("any");
  const votes = useDemo((s) => s.votes);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return DJS.filter((d) => {
      if (s && ![d.name, d.city, d.country, ...d.genres].join(" ").toLowerCase().includes(s)) return false;
      if (genre && !d.genres.includes(genre)) return false;
      if (bpm === "slow" && d.bpm[0] >= 120) return false;
      if (bpm === "mid" && (d.bpm[1] < 120 || d.bpm[0] > 135)) return false;
      if (bpm === "fast" && d.bpm[1] < 135) return false;
      return true;
    }).sort((a, b) => a.rank - b.rank);
  }, [q, genre, bpm]);
  const ranking = [...DJS].sort((a, b) => b.votes + (votes[b.id] ?? 0) * 10 - (a.votes + (votes[a.id] ?? 0) * 10)).slice(0, 5);
  const onAir = DJS[2];

  return (
    <div className="mx-auto max-w-6xl md:px-6">
      <PageTitle art={{ src: ART.panelUniverse, pos: "88% 78%" }} kicker={tu("djArena")} title={tu("whoRulesTheBooth")} sub={tu("dj")} />

      {/* On-air audition banner */}
      <div className="px-4 md:px-0">
        <Link href={`/djs/${onAir.id}/audition`} className="flex items-center gap-4 overflow-hidden rounded-[28px] border-[3px] border-ink bg-coral p-4 text-ink">
          <AlienAvatar look={onAir.look} size={72} ring="#080808" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase"><span className="size-2 rounded-full bg-ink" aria-hidden /> {tu("auditionOnAirDemo")}</div>
            <div className="truncate font-display text-2xl uppercase">{onAir.name}</div>
            <div className="text-sm font-semibold">{tu("n30MinuteLiveAuditionVote")}</div>
          </div>
          <span className="hidden size-12 shrink-0 items-center justify-center rounded-full bg-ink text-cream min-[400px]:flex"><Play className="size-5" aria-hidden /></span>
        </Link>
      </div>

      {/* Search */}
      <div className="mt-6 space-y-2.5">
        <div role="search" className="relative mx-4 md:mx-0">
          <label htmlFor="dj-q" className="sr-only">{tu("searchDjs")}</label>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-mute" aria-hidden />
          <input id="dj-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tu("searchDjCityOrGenre")} className="h-[52px] w-full rounded-full border-2 border-line bg-surface pl-12 pr-12 outline-none focus:border-acid" />
          {q && <button type="button" onClick={() => setQ("")} aria-label={tu("clear")} className="absolute right-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center"><X className="size-4" /></button>}
        </div>
        <div className="rail !gap-2 md:!px-0" role="group" aria-label={tu("genreFilter")}>
          <Chip active={!genre} onClick={() => setGenre(null)}>{tu("allGenres")}</Chip>
          {GENRES.map((g) => <Chip key={g} active={genre === g} onClick={() => setGenre(genre === g ? null : g)}>{g}</Chip>)}
        </div>
        <div className="rail !gap-2 md:!px-0" role="group" aria-label={tu("bpmFilter")}>
          {([["any", tu("anyBpm")], ["slow", "< 120 BPM"], ["mid", "120–135"], ["fast", "135+ BPM"]] as const).map(([k, l]) => (
            <Chip key={k} active={bpm === k} onClick={() => setBpm(k)}>{l}</Chip>
          ))}
        </div>
      </div>

      <h2 className="sr-only">{tu("allDjs")}</h2>
      <div className="mt-4 flex items-center gap-2 px-4 md:px-0">
        <span className="text-sm font-bold" aria-live="polite">{list.length} DJs</span>
        <DemoBadge label={tu("sampleProfiles")} />
      </div>
      {list.length ? (
        <ul className="mt-3 grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 md:px-0 lg:grid-cols-4">
          {list.map((d) => (
            <li key={d.id} className="cv-auto flex"><DJCard dj={d} className="!w-full !max-w-none" /></li>
          ))}
        </ul>
      ) : (
        <EmptyState className="mx-4 mt-4 md:mx-0" title={tu("noDjsFound")} body={tu("text")} />
      )}

      {/* Ranking */}
      <section aria-labelledby="rank" className="mt-12">
        <SectionHeader id="rank" title={tu("djRanking")} sub={tu("text2")} action={<Link href="/quests#rankings" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-acid">{tu("cities")} <ArrowRight className="size-4" aria-hidden /></Link>} />
        <ol className="mx-4 overflow-hidden rounded-3xl border border-line md:mx-0">
          {ranking.map((d, i) => (
            <li key={d.id} className="border-b border-line bg-surface last:border-b-0">
              <Link href={`/djs/${d.id}`} className="flex items-center gap-3 p-3">
                <span className="w-8 text-center font-display text-2xl" style={{ color: ["#FFAD5B", "#F5F2EA", "#FF625C"][i] ?? "#b9b5ab" }}>{i + 1}</span>
                <AlienAvatar look={d.look} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-extrabold">{d.name}</span>
                  <span className="block text-xs text-mute">{d.city}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-bold"><Trophy className="size-4 text-orange" aria-hidden />{compact(d.votes + (votes[d.id] ?? 0) * 10)}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <div className="mx-4 mt-10 rounded-[28px] border-[3px] border-ink bg-purple p-6 text-ink md:mx-0">
        <h2 className="text-3xl uppercase">{tu("areYouADj")}</h2>
        <p className="mt-2 font-medium">{tu("dj30")}</p>
        <ButtonLink href="/djs/apply" variant="secondary" className="mt-4"><Mic2 className="size-4" aria-hidden /> {tu("applyAsDj")}</ButtonLink>
      </div>
    </div>
  );
}
