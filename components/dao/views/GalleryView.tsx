"use client";

import { Tx } from "@/components/i18n/Tx";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { GitCompare, MessagesSquare, Sparkles, X } from "lucide-react";
import { ButtonLink, Chip } from "@/components/ui/primitives";
import { LoadingSkeleton, EmptyState } from "@/components/ui/States";
import { useDaoQuery } from "@/lib/dao/client";
import { STATE_META, THEME_META, usd } from "@/lib/dao/meta";
import type { StageTheme } from "@/lib/dao/types";
import { ConceptRender } from "../ConceptRender";
import { useDao, type ConceptDto } from "../DaoContext";
import { StateTag } from "../DaoUi";

export function GalleryView() {
  const tu = useTranslations("dao");
  const { eventId } = useDao();
  const base = `/dao/${eventId}`;
  const { state } = useDaoQuery<{ concepts: ConceptDto[] }>(`${eventId}/gallery`);
  const [theme, setTheme] = useState<StageTheme | "all">("all");
  const [compare, setCompare] = useState<string[]>([]);
  if (state.status === "loading") return <LoadingSkeleton variant="cards" />;
  if (state.status === "error") return <p role="alert">{state.error.message}</p>;
  const all = state.data.concepts;
  const themes = [...new Set(all.map((c) => c.theme as StageTheme))];
  const list = theme === "all" ? all : all.filter((c) => c.theme === theme);
  const picked = compare.map((id) => all.find((c) => c.id === id)).filter(Boolean) as ConceptDto[];
  const toggle = (id: string) => setCompare((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : xs.length >= 3 ? [...xs.slice(1), id] : [...xs, id]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[34px] uppercase leading-none sm:text-5xl">{tu("stageGallery")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-mute">{tu("communityStageConceptsGeneratedOver")}</p>
        </div>
        <ButtonLink href={`${base}/stage-designer`} variant="primary"><Sparkles className="size-4" aria-hidden /> {tu("newDesign")}</ButtonLink>
      </div>

      {themes.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0" role="group" aria-label={tu("filterByTheme")}>
          <Chip active={theme === "all"} onClick={() => setTheme("all")}>{tu("allLength", { length: all.length })}</Chip>
          {themes.map((t) => <Chip key={t} active={theme === t} onClick={() => setTheme(t)}><Tx>{THEME_META[t].label}</Tx></Chip>)}
        </div>
      )}

      {!list.length ? (
        <EmptyState title={tu("noPublishedConceptsYet")} body={tu("openTheAiStageDesigner")} action={<ButtonLink href={`${base}/stage-designer`}>{tu("openDesigner")}</ButtonLink>} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <li key={c.id} id={c.id} className="neon scroll-mt-28 overflow-hidden rounded-[22px] border bg-surface target:ring-2 target:ring-acid">
              {c.photo && <ConceptRender photoUrl={c.photo.url} zone={c.photo.stageZone} ceilingY={c.photo.ceilingY} spec={c.current.spec} title={tu("nameStageConcept", { name: c.name })} showLabel />}
              <div className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase text-ink" style={{ background: THEME_META[c.theme as StageTheme]?.palette[0] ?? "#B6F05C" }}>{THEME_META[c.theme as StageTheme]?.label ?? c.theme}</span>
                  {c.proposal && <StateTag state={c.proposal.state} />}
                  {c.vote?.winner && <span className="rounded-full bg-acid px-2 py-0.5 text-[11px] font-extrabold uppercase text-ink">{tu("voteWinner")}</span>}
                </div>
                <h2 className="font-display text-2xl uppercase leading-none">{c.name}</h2>
                <p className="text-[12px] text-mute">{tu("byCreatorhandleVVersionValue", { creatorHandle: c.creatorHandle, version: c.current.version, value: c.photo?.generated ? tu("illustratedDemoPlate") : "" })}</p>
                <p className="line-clamp-3 text-sm">{c.description}</p>
                <p className="text-sm"><span className="text-mute">{tu("aiEstimate")}</span> <b>{usd(c.current.estimate.low)} – {usd(c.current.estimate.high)}</b></p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {c.discussionId && (
                    <Link href={`${base}/discussion?thread=${c.discussionId}`} className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line px-3 text-sm font-bold hover:border-acid">
                      <MessagesSquare className="size-4" aria-hidden /> {c.comments}
                    </Link>
                  )}
                  {c.proposal && (
                    <Link href={`${base}/proposals/${c.proposal.id}`} className="inline-flex min-h-11 items-center rounded-full border border-line px-3 text-sm font-bold hover:border-acid">
                      <Tx>{STATE_META[c.proposal.state].label}</Tx>
                    </Link>
                  )}
                  <button type="button" aria-pressed={compare.includes(c.id)} onClick={() => toggle(c.id)} className={`inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-bold ${compare.includes(c.id) ? "bg-acid text-ink" : "border border-line hover:border-acid"}`}>
                    <GitCompare className="size-4" aria-hidden /> {compare.includes(c.id) ? tu("comparing") : tu("compare")}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {picked.length >= 2 && (
        <section aria-labelledby="cmp-h" className="rounded-[24px] border border-acid/60 bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 id="cmp-h" className="text-xl uppercase">{tu("compareLength", { length: picked.length })}</h2>
            <button type="button" onClick={() => setCompare([])} className="inline-flex min-h-11 items-center gap-1 px-2 text-sm font-bold text-mute hover:text-cream"><X className="size-4" aria-hidden /> {tu("clear")}</button>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase text-mute">
                  <th scope="col" className="py-2 pr-3">{tu("feature")}</th>
                  {picked.map((c) => <th key={c.id} scope="col" className="py-2 pr-3 font-display text-base text-cream">{c.name}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {([
                  [tu("theme"), (c: ConceptDto) => THEME_META[c.theme as StageTheme]?.label ?? c.theme],
                  [tu("aiEstimate2"), (c: ConceptDto) => `${usd(c.current.estimate.low)} – ${usd(c.current.estimate.high)}`],
                  [tu("ledScreens"), (c: ConceptDto) => `${c.current.spec.ledScreens}${c.current.spec.ledSides ? " + sides" : ""}`],
                  [tu("beamsLasers"), (c: ConceptDto) => `${c.current.spec.beams} / ${c.current.spec.lasers ? "yes" : "no"}`],
                  [tu("aliens"), (c: ConceptDto) => `${c.current.spec.alienCount} × ${Math.round(c.current.spec.alienScale * 100)}%`],
                  [tu("booth"), (c: ConceptDto) => c.current.spec.booth],
                  [tu("hazePyro"), (c: ConceptDto) => `${c.current.spec.haze > 0.05 ? `haze ${Math.round(c.current.spec.haze * 100)}%` : "no haze"} / ${c.current.spec.pyroFx ? "pyro FX" : "none"}`],
                  [tu("comments"), (c: ConceptDto) => String(c.comments)],
                ] as const).map(([k, f]) => (
                  <tr key={k}>
                    <th scope="row" className="py-2 pr-3 font-bold text-mute">{k}</th>
                    {picked.map((c) => <td key={c.id} className="py-2 pr-3">{f(c)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
