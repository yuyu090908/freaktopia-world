"use client";

import { useTranslations } from "next-intl";
import { BODY_COLORS } from "@/lib/alien/catalog";
import type { MeAlien } from "@/lib/auth/client";

/** Family + every trait of an identity alien, named in the visitor's language. */
export function AlienTraitList({ alien, compact = false }: { alien: MeAlien; compact?: boolean }) {
  const t = useTranslations("alien");
  const rows: [string, string, string?][] = [
    [t("part.bodyColor"), t(`color.${alien.bodyColor}`), BODY_COLORS[alien.bodyColor]],
    [t("part.accent"), t(`color.${alien.accentColor}`), BODY_COLORS[alien.accentColor]],
    [t("part.eyes"), t(`eyes.${alien.eyes}`)],
    [t("part.mouth"), t(`mouth.${alien.mouth}`)],
    [t("part.pattern"), t(`pattern.${alien.pattern}`)],
    [t("part.accessory"), t(`accessory.${alien.accessory}`)],
    [t("part.outfit"), alien.outfit === "none" ? t("outfit.none") : `${t(`outfit.${alien.outfit}`)} · ${t(`color.${alien.outfitColor}`)}`],
    [t("part.special"), t(`special.${alien.special}`)],
  ];
  return (
    <dl className={compact ? "grid grid-cols-1 gap-y-1.5 text-sm sm:grid-cols-2 sm:gap-x-6" : "grid grid-cols-1 gap-y-2 text-[15px] min-[400px]:grid-cols-2 min-[400px]:gap-x-6"} data-testid="alien-traits">
      {rows.map(([k, v, swatch]) => (
        <div key={k} className="flex min-w-0 items-baseline justify-between gap-3 border-b border-line/60 pb-1">
          <dt className="shrink-0 text-mute">{k}</dt>
          <dd className="flex min-w-0 items-center gap-1.5 text-right font-bold [overflow-wrap:normal]">
            {swatch && <span className="inline-block size-3 shrink-0 rounded-full border border-ink" style={{ background: swatch }} aria-hidden />}
            <span className="min-w-0">{v}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function FamilyBadge({ family }: { family: MeAlien["family"] }) {
  const t = useTranslations("alien");
  const color = { slime: "#B6F05C", fuzz: "#A276E9", mutant: "#FF625C", jelly: "#55BCEB" }[family];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-extrabold uppercase tracking-widest" style={{ borderColor: color, color }} data-testid="alien-family">
      {t("family")}: {t(`families.${family}`)}
    </span>
  );
}
