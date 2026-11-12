"use client";

import { Tx } from "@/components/i18n/Tx";
import { type Tu } from "@/lib/i18n/tu";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RotateCcw, Save } from "lucide-react";
import { Container, DemoNotice, PageTitle } from "@/components/ui/primitives";
import { DEFAULT_GROWTH_CONFIG, LEVEL_COLORS, computeFestivalLevel, normalizeConfig, validateConfig, type GrowthConfig, type GrowthThreshold } from "@/lib/map/growth";
import { LANDMARK_LABEL, STATUS_META, landmarkSvg, orbSvg, type LandmarkType, type MapStatus } from "@/lib/map/landmarks";
import type { WorldMapResponse } from "@/lib/map/types";
import { toast, useDemo } from "@/lib/store";
import type { EventLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPES = Object.keys(LANDMARK_LABEL) as LandmarkType[];
const STATUSES = Object.keys(STATUS_META) as MapStatus[];
const PALETTES: Record<LandmarkType, [string, string, string]> = {
  monster_stage: ["#FF625C", "#55BCEB", "#B6F05C"],
  psychedelic_tent: ["#A276E9", "#FFAD5B", "#B6F05C"],
  cosmic_portal: ["#B6F05C", "#FFAD5B", "#55BCEB"],
  speaker_towers: ["#55BCEB", "#FF625C", "#B6F05C"],
  alien_sculpture: ["#A276E9", "#55BCEB", "#B6F05C"],
  neon_gate: ["#FFAD5B", "#A276E9", "#55BCEB"],
};

const NUM_FIELDS = (tu: Tu): { key: "supporters" | "fundingUsd" | "stakers" | "approvals"; label: string }[] => ([
  { key: "supporters", label: tu("validSupporters") },
  { key: "fundingUsd", label: tu("securedFundingUsd") },
  { key: "stakers", label: tu("stakingParticipants") },
  { key: "approvals", label: tu("approvedPrepItems") },
]);

export function LevelsAdmin() {
  const tu = useTranslations("world");
  const saved = useDemo((s) => s.mapGrowthConfig);
  const setSaved = useDemo((s) => s.setMapGrowthConfig);
  const [draft, setDraft] = useState<GrowthConfig>(DEFAULT_GROWTH_CONFIG);
  const [map, setMap] = useState<WorldMapResponse | null>(null);
  const [type, setType] = useState<LandmarkType>("monster_stage");

  useEffect(() => setDraft(saved ? normalizeConfig(saved) : DEFAULT_GROWTH_CONFIG), [saved]);
  useEffect(() => {
    fetch("/api/map")
      .then((r) => (r.ok ? r.json() : null))
      .then(setMap)
      .catch(() => {});
  }, []);

  const errors = validateConfig(draft);
  const preview = useMemo(() => {
    const counts: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (const e of map?.events ?? []) counts[computeFestivalLevel(e.growth, draft).level].push(e.name);
    return counts;
  }, [map, draft]);

  const update = (i: number, patch: Partial<GrowthThreshold>) => setDraft((d) => ({ ...d, levels: d.levels.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));

  return (
    <Container className="pb-24">
      <Link href="/world" className="mx-4 mt-4 inline-flex md:mx-0 min-h-11 items-center gap-1 text-sm font-bold text-mute hover:text-cream">
        <ArrowLeft className="size-4" aria-hidden /> {tu("backToTheWorldMap")}
      </Link>
      <PageTitle kicker={tu("worldMapAdminDemo")} title={tu("festivalLevelRules")} sub={tu("thresholdsForTheLandmarkGrowth")} />
      <DemoNotice className="mx-4 mt-4 md:mx-0">
        {tu("demoAdminChangesAreSaved")} <code>event_growth_levels</code> {tu("tableAndOnlyAdminsCan")}
      </DemoNotice>

      <section aria-labelledby="rules-h" className="mt-6 px-4 md:px-0">
        <h2 id="rules-h" className="text-2xl uppercase">{tu("thresholds")}</h2>
        <p className="mt-1 text-sm text-mute">{tu("anEventReachesALevel")}</p>
        <div className="mt-3 overflow-x-auto rounded-3xl border-2 border-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface-2 text-left text-[12px] uppercase text-mute [&_th]:whitespace-nowrap">
              <tr>
                <th className="p-3">{tu("level")}</th>
                <th className="p-3">{tu("name")}</th>
                {NUM_FIELDS(tu).map((f) => (
                  <th key={f.key} className="p-3">
                    <Tx>{f.label}</Tx>
                  </th>
                ))}
                <th className="p-3">{tu("venueContract")}</th>
              </tr>
            </thead>
            <tbody>
              {draft.levels.map((l, i) => (
                <tr key={l.level} className="border-t border-line">
                  <td className="p-3">
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-black text-ink" style={{ background: LEVEL_COLORS[l.level] }}>
                      LV.{l.level}
                    </span>
                  </td>
                  <td className="p-2">
                    <input aria-label={tu("levelLevelName", { level: l.level })} value={l.name} onChange={(e) => update(i, { name: e.target.value })} className="min-h-11 w-40 rounded-xl border-2 border-line bg-ink px-2" />
                  </td>
                  {NUM_FIELDS(tu).map((f) => (
                    <td key={f.key} className="p-2">
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        aria-label={tu("levelLevelLabel", { level: l.level, label: f.label })}
                        disabled={i === 0}
                        value={l[f.key]}
                        onChange={(e) => update(i, { [f.key]: Number(e.target.value) } as Partial<GrowthThreshold>)}
                        className="min-h-11 w-28 rounded-xl border-2 border-line bg-ink px-2 disabled:opacity-40"
                      />
                    </td>
                  ))}
                  <td className="p-2">
                    <label className="inline-flex min-h-11 items-center gap-2">
                      <input type="checkbox" disabled={i === 0} checked={l.venueContract} onChange={(e) => update(i, { venueContract: e.target.checked })} className="size-5 accent-acid" />
                      <span className="sr-only">{tu("levelLevelNeedsAVenue", { level: l.level })}</span>
                      {tu("required")}
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {errors.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-coral" role="alert">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={errors.length > 0}
            onClick={() => {
              setSaved(normalizeConfig({ ...draft, version: (saved?.version ?? 1) + 1 }));
              toast({ title: tu("levelRulesSavedThisBrowser"), body: tu("theWorldMapNowUses") });
            }}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-acid px-5 font-extrabold uppercase text-ink disabled:opacity-40"
          >
            <Save className="size-4" aria-hidden /> {tu("saveRules")}
          </button>
          <button
            type="button"
            onClick={() => {
              setSaved(null);
              setDraft(DEFAULT_GROWTH_CONFIG);
              toast({ title: tu("defaultsRestored") });
            }}
            className="inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-line px-5 font-extrabold uppercase"
          >
            <RotateCcw className="size-4" aria-hidden /> {tu("resetToDefaults")}
          </button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-5" aria-label={tu("previewWithTheseRules")}>
          {([1, 2, 3, 4, 5] as EventLevel[]).map((lv) => (
            <div key={lv} className="rounded-2xl bg-surface p-3" data-testid={`preview-lv${lv}`}>
              <div className="text-[12px] font-extrabold uppercase" style={{ color: LEVEL_COLORS[lv] }}>
                LV.{lv} {draft.levels[lv - 1].name}
              </div>
              <div className="font-display text-2xl">{preview[lv].length}</div>
              <div className="line-clamp-3 text-[11px] text-mute">{preview[lv].join(", ") || "–"}</div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="gal-h" className="mt-10 px-4 md:px-0">
        <h2 id="gal-h" className="text-2xl uppercase">{tu("landmarkGallery")}</h2>
        <p className="mt-1 text-sm text-mute">{tu("originalFreaktopiaLandmarksGenrePick")}</p>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={tu("landmarkType")}>
          {TYPES.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={type === t} onClick={() => setType(t)} className={cn("min-h-11 shrink-0 rounded-full border-2 px-4 text-sm font-bold", type === t ? "border-acid bg-acid text-ink" : "border-line")}>
              <Tx>{LANDMARK_LABEL[t]}</Tx>
            </button>
          ))}
        </div>
        <h3 className="mt-4 text-[13px] font-extrabold uppercase text-mute">{tu("levelsConfirmed")}</h3>
        <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5" data-testid="gallery-levels">
          {([1, 2, 3, 4, 5] as EventLevel[]).map((lv) => (
            <li key={lv} className="rounded-3xl bg-[#0A1727] p-2 text-center">
              <span className="mx-auto block aspect-square w-full max-w-[180px]" dangerouslySetInnerHTML={{ __html: landmarkSvg({ type, level: lv, status: "confirmed", palette: PALETTES[type], daoTier: lv >= 4 ? 2 : 0, animate: true }) }} />
              <span className="text-[12px] font-extrabold" style={{ color: LEVEL_COLORS[lv] }}>
                LV.{lv} {draft.levels[lv - 1].name}
              </span>
              <span className="block text-[11px] text-mute">{draft.levels[lv - 1].visual}</span>
            </li>
          ))}
        </ul>
        <h3 className="mt-6 text-[13px] font-extrabold uppercase text-mute">{tu("statusLevel3")}</h3>
        <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-6" data-testid="gallery-status">
          {STATUSES.map((s) => (
            <li key={s} className="rounded-3xl bg-[#0A1727] p-2 text-center">
              <span className="mx-auto block aspect-square w-full max-w-[160px]" dangerouslySetInnerHTML={{ __html: landmarkSvg({ type, level: 3, status: s, palette: PALETTES[type], fundingPct: 0.55, animate: true }) }} />
              <span className="inline-flex items-center gap-1 text-[12px] font-extrabold" style={{ color: STATUS_META[s].color }}>
                <span aria-hidden>{STATUS_META[s].glyph}</span>
                <Tx>{STATUS_META[s].label}</Tx>
              </span>
              <span className="block text-[11px] text-mute"><Tx>{STATUS_META[s].hint}</Tx></span>
            </li>
          ))}
        </ul>
        <h3 className="mt-6 text-[13px] font-extrabold uppercase text-mute">{tu("worldZoomTokens")}</h3>
        <ul className="mt-2 flex flex-wrap gap-3">
          {STATUSES.map((s) => (
            <li key={s} className="flex items-center gap-2 rounded-2xl bg-[#0A1727] px-3 py-2 text-[12px]">
              <span className="size-9" aria-hidden dangerouslySetInnerHTML={{ __html: orbSvg(3, s, LEVEL_COLORS[3]) }} />
              <Tx>{STATUS_META[s].label}</Tx>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[12px] text-mute">{tu("cancelledIsSupportedByThe")}</p>
      </section>
    </Container>
  );
}
