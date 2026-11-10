"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { Alien } from "@/components/art/Alien";
import { btnClass } from "@/components/ui/primitives";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { AlienTraitList, FamilyBadge } from "@/components/alien/AlienTraits";
import { BASE_ACCESSORIES, BODY_COLORS, COLOR_KEYS, EARNED_ACCESSORIES, OUTFITS, toLook, type BodyColor } from "@/lib/alien/catalog";
import { api, useAuth } from "@/lib/auth/client";
import { toast } from "@/lib/store";
import type { Accessory, Outfit } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Outfit, outfit colour and head accessory only. The base alien never changes (no reroll). */
export function AlienCustomizer() {
  const t = useTranslations("alien");
  const tc = useTranslations("common");
  const tauth = useTranslations("auth");
  const href = useLocalHref();
  const { status, me, refresh } = useAuth();
  const a = me?.alien;
  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [color, setColor] = useState<BodyColor | null>(null);
  const [acc, setAcc] = useState<Accessory | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === "loading") return <p role="status" className="text-mute">{tc("loading")}</p>;
  if (!me || !a) {
    return (
      <div>
        <p className="text-mute">{me ? tauth("notVerifiedBody") : t("signInToHatch")}</p>
        {!me && <Link href={href("/auth/signup")} className={btnClass("primary", "md", "mt-4")}>{tauth("signUp")}</Link>}
      </div>
    );
  }
  const draft = { ...a, outfit: outfit ?? a.outfit, outfitColor: color ?? a.outfitColor, accessory: acc ?? a.accessory };
  const dirty = draft.outfit !== a.outfit || draft.outfitColor !== a.outfitColor || draft.accessory !== a.accessory;

  const pill = (active: boolean) => cn("min-h-11 rounded-full border-2 px-4 text-sm font-bold", active ? "border-acid bg-acid/15 text-acid" : "border-line hover:border-cream/40");

  return (
    <div className="grid gap-6 md:grid-cols-[320px_1fr]">
      <div className="md:sticky md:top-24 md:self-start">
        <div className="rounded-[28px] border-2 border-line p-4" style={{ background: `radial-gradient(circle at 50% 40%, ${BODY_COLORS[a.bodyColor]}44, #0D121B 70%)` }}>
          <Alien look={toLook(draft)} className="mx-auto h-64 w-auto" title={a.name} bob />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-display text-xl uppercase">{a.name}</span>
          <FamilyBadge family={a.family} />
        </div>
        <p className="mt-2 text-xs text-mute">{t("permanent")}</p>
      </div>
      <div className="space-y-6">
        <fieldset>
          <legend className="mb-2 text-sm font-extrabold uppercase">{t("part.outfit")}</legend>
          <div className="flex flex-wrap gap-2">
            {OUTFITS.map((o) => (
              <button key={o} type="button" aria-pressed={draft.outfit === o} onClick={() => setOutfit(o)} className={pill(draft.outfit === o)}>{t(`outfit.${o}`)}</button>
            ))}
          </div>
        </fieldset>
        <fieldset disabled={draft.outfit === "none"} className="disabled:opacity-40">
          <legend className="mb-2 text-sm font-extrabold uppercase">{t("outfitColor")}</legend>
          <div className="flex flex-wrap gap-2">
            {COLOR_KEYS.map((c) => (
              <button key={c} type="button" aria-pressed={draft.outfitColor === c} aria-label={t(`color.${c}`)} title={t(`color.${c}`)} onClick={() => setColor(c)} className={cn("size-11 rounded-full border-[3px]", draft.outfitColor === c ? "border-acid ring-2 ring-acid ring-offset-2 ring-offset-ink" : "border-ink")} style={{ background: BODY_COLORS[c] }} />
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-extrabold uppercase">{t("part.accessory")}</legend>
          <div className="flex flex-wrap gap-2">
            {BASE_ACCESSORIES.map((x) => (
              <button key={x} type="button" aria-pressed={draft.accessory === x} onClick={() => setAcc(x)} className={pill(draft.accessory === x)} data-testid={`acc-${x}`}>{t(`accessory.${x}`)}</button>
            ))}
          </div>
          <h3 className="mb-2 mt-4 font-sans text-xs font-extrabold uppercase tracking-wider text-mute">{t("earned")}</h3>
          <div className="flex flex-wrap gap-2">
            {EARNED_ACCESSORIES.map((x) => (
              <span key={x} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-dashed border-line px-4 text-sm font-bold text-mute">
                <Lock className="size-3.5" aria-hidden /> {t(`accessory.${x}`)} <span className="sr-only">({t("locked")})</span>
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-mute">{t("earnedNote")}</p>
        </fieldset>
        <button
          type="button"
          disabled={!dirty || busy}
          className={btnClass("primary", "lg", "w-full sm:w-auto")}
          data-testid="save-look"
          onClick={async () => {
            setBusy(true);
            const r = await api("/api/me/alien", "PATCH", { outfit: draft.outfit, outfitColor: draft.outfitColor, accessory: draft.accessory });
            setBusy(false);
            if (r.ok) {
              await refresh();
              setOutfit(null);
              setColor(null);
              setAcc(null);
              toast({ title: t("lookSaved"), tone: "success" });
            } else toast({ title: tauth("errors.generic"), tone: "error" });
          }}
        >
          {busy ? tc("saving") : t("saveLook")}
        </button>
        <section>
          <h2 className="mb-2 font-sans text-xs font-extrabold uppercase tracking-widest text-mute">{t("traits")}</h2>
          <AlienTraitList alien={a} />
          <p className="mt-2 text-xs text-mute">{t("noReroll")}</p>
        </section>
      </div>
    </div>
  );
}
