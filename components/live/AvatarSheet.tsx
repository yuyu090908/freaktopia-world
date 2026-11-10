"use client";

import { useEffect, useState } from "react";
import { Alien, STARTERS } from "@/components/art/Alien";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useDemo } from "@/lib/store";
import type { Accessory, AlienLook, Outfit } from "@/lib/types";
import type { DanceMove, Emote } from "@/lib/live/types";
import { cn } from "@/lib/utils";

/** Extra original characters for the live venue (in addition to the four starters). */
export const LIVE_CHARACTERS: { id: string; name: string; look: AlienLook }[] = [
  ...STARTERS.map((s) => ({ id: s.id, name: s.name, look: s.look })),
  { id: "spore-dj", name: "SPORE DJ", look: { species: "fuzz", body: "#B6F05C", accent: "#A276E9", outfit: "hoodie", outfitColor: "#080808", accessory: "cap" } },
  { id: "dub-drone", name: "DUB DRONE", look: { species: "vinyl", body: "#A276E9", accent: "#B6F05C", outfit: "vest", outfitColor: "#55BCEB", accessory: "headphones" } },
  { id: "moon-mochi", name: "MOON MOCHI", look: { species: "jelly", body: "#F5F2EA", accent: "#FF625C", outfit: "kimono", outfitColor: "#FF625C", accessory: "crown" } },
  { id: "lava-loop", name: "LAVA LOOP", look: { species: "slime", body: "#FF625C", accent: "#FFAD5B", outfit: "jacket", outfitColor: "#171717", accessory: "shades" } },
];

const COLORS = ["#B6F05C", "#FF625C", "#A276E9", "#55BCEB", "#FFAD5B", "#F5F2EA", "#171717"];
const OUTFITS: Outfit[] = ["none", "hoodie", "jacket", "vest", "kimono"];
const ACCESSORIES: Accessory[] = ["none", "headphones", "shades", "crown", "antenna", "cap"];
const DANCES: { id: DanceMove; label: string }[] = [{ id: "bounce", label: "Bounce" }, { id: "wiggle", label: "Wiggle" }, { id: "spin", label: "Spin" }];
const EMOTES: { id: Emote; label: string }[] = [{ id: "none", label: "None" }, { id: "wave", label: "👋 Wave" }, { id: "heart", label: "💚 Heart" }, { id: "fire", label: "🔥 Fire" }, { id: "alien", label: "👽 Alien" }];
const VIS: { id: "public" | "friends" | "hidden"; label: string; sub: string }[] = [
  { id: "public", label: "Public", sub: "Everyone in the room sees your avatar." },
  { id: "friends", label: "Friends", sub: "Only mutual friends see it." },
  { id: "hidden", label: "Hidden", sub: "Nobody else sees it. You still explore." },
];

export function AvatarSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const profile = useDemo((s) => s.profile);
  const live = { v: useDemo((s) => s.liveVisibility), d: useDemo((s) => s.liveDance), e: useDemo((s) => s.liveEmote) };
  const saveLook = useDemo((s) => s.saveLook);
  const setLive = useDemo((s) => s.setLive);
  const [look, setLook] = useState<AlienLook>(profile.look);
  const [name, setName] = useState(profile.avatarName);
  const [dance, setDance] = useState<DanceMove>(live.d);
  const [emote, setEmote] = useState<Emote>(live.e);
  const [vis, setVis] = useState(live.v);
  useEffect(() => {
    if (!open) return;
    setLook(profile.look);
    setName(profile.avatarName);
    setDance(live.d);
    setEmote(live.e);
    setVis(live.v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const nameOk = name.trim().length >= 2 && name.trim().length <= 24;

  const save = () => {
    if (!nameOk) return;
    saveLook({ ...look, accessory: look.accessory === "dao_antenna" ? "antenna" : look.accessory }, name.trim());
    setLive({ liveDance: dance, liveEmote: emote, liveVisibility: vis });
    onSaved();
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="My festival avatar"
      footer={
        <button type="button" onClick={save} disabled={!nameOk} className="flex min-h-12 w-full items-center justify-center rounded-full bg-acid font-extrabold uppercase text-ink disabled:opacity-40">
          Save avatar
        </button>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Alien look={look} className="size-28 shrink-0" title={`${name} preview`} bob />
          <label className="min-w-0 flex-1 text-sm font-bold">
            Avatar name
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 24))} className="mt-1 min-h-11 w-full rounded-2xl border-2 border-line bg-surface px-3 text-[16px] font-normal outline-none focus:border-acid" aria-invalid={!nameOk} />
            {!nameOk && <span className="mt-1 block text-[12px] font-normal text-coral">2–24 characters.</span>}
          </label>
        </div>

        <fieldset>
          <legend className="text-sm font-extrabold uppercase text-mute">Character</legend>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {LIVE_CHARACTERS.map((c) => (
              <button key={c.id} type="button" onClick={() => { setLook(c.look); setName(c.name); }} aria-pressed={look.species === c.look.species && look.body === c.look.body} className={cn("flex flex-col items-center rounded-2xl border-2 p-1.5 text-[10px] font-extrabold", look.species === c.look.species && look.body === c.look.body ? "border-acid bg-acid/10" : "border-line")}>
                <Alien look={c.look} className="size-12" />
                <span className="mt-0.5 line-clamp-1">{c.name}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {(["body", "accent", "outfitColor"] as const).map((k) => (
          <fieldset key={k}>
            <legend className="text-sm font-extrabold uppercase text-mute">{k === "body" ? "Body color" : k === "accent" ? "Eye / accent color" : "Outfit color"}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setLook({ ...look, [k]: c })} aria-label={`${k} ${c}`} aria-pressed={look[k] === c} className={cn("size-11 rounded-full border-4", look[k] === c ? "border-cream" : "border-ink")} style={{ background: c }} />
              ))}
            </div>
          </fieldset>
        ))}

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-bold">
            Outfit
            <select value={look.outfit} onChange={(e) => setLook({ ...look, outfit: e.target.value as Outfit })} className="mt-1 min-h-11 w-full rounded-2xl border-2 border-line bg-surface px-3 text-[16px] capitalize">
              {OUTFITS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold">
            Accessory
            <select value={look.accessory} onChange={(e) => setLook({ ...look, accessory: e.target.value as Accessory })} className="mt-1 min-h-11 w-full rounded-2xl border-2 border-line bg-surface px-3 text-[16px] capitalize">
              {ACCESSORIES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        </div>

        <fieldset>
          <legend className="text-sm font-extrabold uppercase text-mute">Dance (on dance zones)</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {DANCES.map((d) => <button key={d.id} type="button" aria-pressed={dance === d.id} onClick={() => setDance(d.id)} className={cn("min-h-11 rounded-full border-2 text-sm font-bold", dance === d.id ? "border-acid bg-acid text-ink" : "border-line")}>{d.label}</button>)}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-extrabold uppercase text-mute">Emote</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {EMOTES.map((d) => <button key={d.id} type="button" aria-pressed={emote === d.id} onClick={() => setEmote(d.id)} className={cn("min-h-11 rounded-full border-2 px-3 text-sm font-bold", emote === d.id ? "border-acid bg-acid text-ink" : "border-line")}>{d.label}</button>)}
          </div>
        </fieldset>

        <VisibilityPicker value={vis} onChange={setVis} />
      </div>
    </BottomSheet>
  );
}

export function VisibilityPicker({ value, onChange }: { value: "public" | "friends" | "hidden"; onChange: (v: "public" | "friends" | "hidden") => void }) {
  return (
    <fieldset>
      <legend className="text-sm font-extrabold uppercase text-mute">Who can see my avatar</legend>
      <div className="mt-2 space-y-2" role="radiogroup" aria-label="Avatar visibility">
        {VIS.map((v) => (
          <button key={v.id} type="button" role="radio" aria-checked={value === v.id} onClick={() => onChange(v.id)} className={cn("flex min-h-12 w-full items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left", value === v.id ? "border-acid bg-acid/10" : "border-line")}>
            <span className={cn("size-4 shrink-0 rounded-full border-2", value === v.id ? "border-acid bg-acid" : "border-mute")} aria-hidden />
            <span><b className="block text-sm">{v.label}</b><span className="text-[12px] text-mute">{v.sub}</span></span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-mute">Your avatar&apos;s spot is virtual. FREAKTOPIA never uses GPS, and being on the map is not the same as being at the venue.</p>
    </fieldset>
  );
}
