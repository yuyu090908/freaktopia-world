"use client";

import { useEffect, useState } from "react";
import { Lock, RotateCcw, Save } from "lucide-react";
import { Alien, STARTERS } from "@/components/art/Alien";
import { Button, Chip, PageTitle, Progress } from "@/components/ui/primitives";
import { Field, Input } from "@/components/forms/Fields";
import { LoadingSkeleton } from "@/components/ui/States";
import { grantXp, toast, useDemo, useHydrated } from "@/lib/store";
import { userLevel } from "@/lib/levels";
import type { Accessory, AlienLook, Outfit } from "@/lib/types";
import { cn } from "@/lib/utils";

const OUTFITS: { id: Outfit; label: string; lv: number }[] = [
  { id: "none", label: "None", lv: 1 },
  { id: "hoodie", label: "Hoodie", lv: 1 },
  { id: "jacket", label: "Jacket", lv: 1 },
  { id: "vest", label: "Rave vest", lv: 2 },
  { id: "kimono", label: "Kimono", lv: 3 },
];
const ACCESSORIES: { id: Accessory; label: string; lv: number }[] = [
  { id: "none", label: "None", lv: 1 },
  { id: "headphones", label: "Headphones", lv: 1 },
  { id: "cap", label: "Cap", lv: 1 },
  { id: "shades", label: "Shades", lv: 2 },
  { id: "antenna", label: "Antenna", lv: 2 },
  { id: "crown", label: "Crown", lv: 4 },
];
const SWATCHES = ["#B6F05C", "#FF625C", "#A276E9", "#55BCEB", "#FFAD5B", "#F5F2EA"];

export function AvatarStudio() {
  const ok = useHydrated();
  return ok ? <Studio /> : <LoadingSkeleton variant="page" />;
}

function Studio() {
  const profile = useDemo((s) => s.profile);
  const saveLook = useDemo((s) => s.saveLook);
  const [look, setLook] = useState<AlienLook>(profile.look);
  const [name, setName] = useState(profile.avatarName);
  const [starter, setStarter] = useState(() => STARTERS.find((s) => s.look.species === profile.look.species)?.id ?? STARTERS[0].id);
  const lv = userLevel(profile.xp);
  const dirty = JSON.stringify(look) !== JSON.stringify(profile.look) || name !== profile.avatarName;

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const pick = (id: string) => {
    const s = STARTERS.find((x) => x.id === id)!;
    setStarter(id);
    setLook({ ...s.look, outfit: look.outfit, outfitColor: look.outfitColor, accessory: s.look.accessory });
    if (STARTERS.some((x) => x.name === name)) setName(s.name);
  };

  const save = () => {
    const trimmed = name.trim().slice(0, 20) || "NAMELESS";
    saveLook(look, trimmed);
    setName(trimmed);
    toast({ title: "Avatar saved", body: "Stored in this browser.", tone: "success" });
    if (!profile.avatarSaved) grantXp(50, "Created your alien");
  };

  return (
    <div className="mx-auto max-w-5xl md:px-6">
      <PageTitle kicker="Alien World" title="Make your alien" sub="キャラクターを選んで、名前・衣装・アクセサリーをカスタマイズ。" />
      <div className="md:grid md:grid-cols-[1fr_1.1fr] md:gap-8">
        {/* Preview */}
        <div className="px-4 md:sticky md:top-24 md:self-start md:px-0">
          <div className="relative overflow-hidden rounded-[32px] border-[3px] border-ink" style={{ background: look.accent }}>
            <div className="halftone absolute inset-0" aria-hidden />
            <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full opacity-50" aria-hidden>
              {Array.from({ length: 12 }).map((_, i) => <path key={i} d={`M100 100 L${100 + Math.cos((i / 12) * Math.PI * 2) * 200} ${100 + Math.sin((i / 12) * Math.PI * 2) * 200} L${100 + Math.cos(((i + 0.5) / 12) * Math.PI * 2) * 200} ${100 + Math.sin(((i + 0.5) / 12) * Math.PI * 2) * 200} Z`} fill="#F5F2EA" opacity="0.35" />)}
            </svg>
            <Alien look={look} className="relative mx-auto aspect-square w-[78%] py-4" title={`Preview of ${name}`} bob />
            <div className="relative flex items-center justify-between gap-2 border-t-[3px] border-ink bg-ink px-4 py-3">
              <div className="min-w-0 truncate font-display text-xl">{name || "NAMELESS"}</div>
              <span className="shrink-0 rounded-full bg-purple px-2.5 py-1 font-display text-sm text-ink">LV.{lv.level}</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-sm font-bold"><span>XP</span><span className="text-mute">{profile.xp} total · {lv.intoLevel}/{lv.need} to LV.{lv.level + 1}</span></div>
            <Progress value={lv.pct} color="#A276E9" label="XP progress" />
          </div>
        </div>

        {/* Controls */}
        <div className="mt-6 space-y-7 px-4 md:mt-0 md:px-0">
          <fieldset>
            <legend className="text-xl uppercase font-display">Character</legend>
            <div className="mt-3 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Starter character">
              {STARTERS.map((s) => (
                <button key={s.id} type="button" role="radio" aria-checked={starter === s.id} onClick={() => pick(s.id)} className={cn("rounded-3xl border-[3px] p-2 text-left transition-transform active:scale-[0.98]", starter === s.id ? "border-acid bg-surface-2" : "border-line bg-surface")}>
                  <div className="rounded-2xl" style={{ background: s.look.accent }}><Alien look={s.look} className="mx-auto aspect-square w-[80%]" /></div>
                  <div className="mt-2 px-1 font-display text-base leading-tight">{s.name}</div>
                  <div className="px-1 pb-1 text-xs text-mute">{s.blurb}</div>
                </button>
              ))}
            </div>
          </fieldset>

          <Field id="av-name" label="Name" hint="20文字まで">
            <Input id="av-name" maxLength={20} value={name} onChange={(e) => setName(e.target.value.toUpperCase())} />
          </Field>

          <Swatches label="Body colour" value={look.body} onChange={(c) => setLook({ ...look, body: c })} />
          <Swatches label="Accent colour" value={look.accent} onChange={(c) => setLook({ ...look, accent: c })} />

          <fieldset>
            <legend className="font-display text-xl uppercase">Outfit</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {OUTFITS.map((o) => {
                const locked = lv.level < o.lv;
                return (
                  <Chip key={o.id} active={look.outfit === o.id} disabled={locked} onClick={() => setLook({ ...look, outfit: o.id })} className={locked ? "opacity-50" : ""} aria-label={locked ? `${o.label}, unlocks at level ${o.lv}` : o.label}>
                    {locked && <Lock className="size-3.5" aria-hidden />}{o.label}{locked && <span className="text-xs">LV.{o.lv}</span>}
                  </Chip>
                );
              })}
            </div>
          </fieldset>
          {look.outfit !== "none" && <Swatches label="Outfit colour" value={look.outfitColor} onChange={(c) => setLook({ ...look, outfitColor: c })} />}

          <fieldset>
            <legend className="font-display text-xl uppercase">Accessory</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {ACCESSORIES.map((a) => {
                const locked = lv.level < a.lv;
                return (
                  <Chip key={a.id} active={look.accessory === a.id} disabled={locked} onClick={() => setLook({ ...look, accessory: a.id })} className={locked ? "opacity-50" : ""} aria-label={locked ? `${a.label}, unlocks at level ${a.lv}` : a.label}>
                    {locked && <Lock className="size-3.5" aria-hidden />}{a.label}{locked && <span className="text-xs">LV.{a.lv}</span>}
                  </Chip>
                );
              })}
            </div>
            <p className="ja mt-2 text-xs text-mute">ロックされたアイテムは、イベントの応援・チケット購入・投票でXPを貯めると解放されます。</p>
          </fieldset>

          <div className="sticky bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom)+12px)] z-30 flex gap-3 rounded-full bg-ink/90 p-1.5 lg:bottom-6">
            <Button variant="ghost" onClick={() => { setLook(profile.look); setName(profile.avatarName); }} disabled={!dirty} aria-label="Discard changes"><RotateCcw className="size-4" aria-hidden /></Button>
            <Button className="flex-1" size="lg" onClick={save}><Save className="size-5" aria-hidden /> {dirty ? "Save avatar" : "Saved"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Swatches({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  return (
    <fieldset>
      <legend className="font-display text-xl uppercase">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {SWATCHES.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={c} onClick={() => onChange(c)} className={cn("size-11 rounded-full border-[3px] border-ink", value === c && "ring-4 ring-cream ring-offset-2 ring-offset-ink")} style={{ background: c }} />
        ))}
      </div>
    </fieldset>
  );
}
