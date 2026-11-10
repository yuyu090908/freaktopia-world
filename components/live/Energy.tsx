"use client";

import { Tx } from "@/components/i18n/Tx";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Info, Zap } from "lucide-react";
import { ENERGY_LEVELS, REACTION_META, levelFor } from "@/lib/live/energy";
import { REACTION_KINDS, type ReactionKind } from "@/lib/live/types";
import { cn } from "@/lib/utils";

export function EnergyMeter({ energy, compact = false }: { energy: number; compact?: boolean }) {
  const tu = useTranslations("live");
  const lv = levelFor(energy);
  const [info, setInfo] = useState(false);
  return (
    <section aria-label={tu("liveEnergyGameMetric")} className={cn("rounded-3xl border border-line bg-surface p-3", lv.key === "ALIEN_INVASION" && "shadow-[0_0_40px_-6px_rgba(162,118,233,0.9)]", lv.key === "PEAK_TIME" && "shadow-[0_0_30px_-8px_rgba(255,98,92,0.8)]")} data-testid="energy">
      <div className="flex items-center gap-2">
        <Zap className="size-5 shrink-0" style={{ color: lv.color }} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-mute">{tu("liveEnergyGameMetric2")}</div>
          <div className="font-display text-lg uppercase leading-tight" style={{ color: lv.color }} data-testid="energy-level"><Tx>{lv.label}</Tx></div>
        </div>
        <div className="font-display text-3xl tabular-nums" data-testid="energy-value" aria-label={tu("energyEnergyOf100", { energy })}>{energy}</div>
        <button type="button" onClick={() => setInfo(!info)} aria-expanded={info} aria-label={tu("howEnergyWorks")} className="inline-flex size-11 items-center justify-center rounded-full bg-surface-2"><Info className="size-4" /></button>
      </div>
      <div className="mt-2 flex gap-1" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={energy} aria-label={tu("energyMeter")}>
        {ENERGY_LEVELS.map((l, i) => {
          const max = ENERGY_LEVELS[i + 1]?.min ?? 101;
          const fill = Math.max(0, Math.min(1, (energy - l.min) / (max - l.min)));
          return (
            <div key={l.key} className="h-3 flex-1 overflow-hidden rounded-full bg-[#2a2a2a]" style={{ flexGrow: max - l.min }}>
              <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${fill * 100}%`, background: l.color }} />
            </div>
          );
        })}
      </div>
      {!compact && (
        <div className="mt-1 flex justify-between text-[9px] font-bold uppercase text-mute" aria-hidden>
          {ENERGY_LEVELS.map((l) => <span key={l.key}><Tx>{l.label}</Tx></span>)}
        </div>
      )}
      {info && (
        <p className="mt-2 rounded-2xl bg-surface-2 p-3 text-[12px] leading-relaxed text-mute">
          {tu("energyIsA")} <b className="text-cream">{tu("gameScore")}</b> {tu("fromUniqueActiveParticipantsRate")}
        </p>
      )}
    </section>
  );
}

export function ReactionBar({ onReact, counts, note }: { onReact: (k: ReactionKind) => void; counts?: Partial<Record<ReactionKind, number>>; note?: string | null }) {
  const tu = useTranslations("live");
  const last = useRef(0);
  return (
    <div>
      <div className="grid grid-cols-5 gap-1.5" role="group" aria-label={tu("crowdReactions")}>
        {REACTION_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              const now = Date.now();
              if (now - last.current < 220) return;
              last.current = now;
              onReact(k);
            }}
            aria-label={tu("reactLabel", { label: REACTION_META[k].label })}
            className="flex min-h-14 flex-col items-center justify-center rounded-2xl border-2 border-line bg-surface-2 active:scale-95"
            style={{ borderColor: counts?.[k] ? REACTION_META[k].color : undefined }}
          >
            <span className="text-xl leading-none" aria-hidden>{REACTION_META[k].emoji}</span>
            <span className="mt-0.5 text-[9px] font-extrabold uppercase tracking-wide"><Tx>{REACTION_META[k].label}</Tx></span>
          </button>
        ))}
      </div>
      {note && <p className="mt-1.5 text-[11px] text-mute" role="status">{note}</p>}
    </div>
  );
}
