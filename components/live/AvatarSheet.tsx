"use client";

import { Tx } from "@/components/i18n/Tx";
import { type Tu } from "@/lib/i18n/tu";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Alien, STARTERS } from "@/components/art/Alien";
import { BottomSheet } from "@/components/ui/BottomSheet";
import Link from "next/link";
import { useMyAvatar } from "@/lib/auth/client";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { useDemo } from "@/lib/store";
import type { Accessory, AlienLook, Outfit } from "@/lib/types";
import type { DanceMove, Emote } from "@/lib/live/types";
import { cn } from "@/lib/utils";

/** Extra original characters for the live venue (in addition to the four starters). */
export const LIVE_CHARACTERS: { id: string; name: string; look: AlienLook }[] = [
  ...STARTERS.map((s) => ({ id: s.id, name: s.name, look: s.look })),
  { id: "spore-dj", name: "SPORE DJ", look: { species: "fuzz", body: "#B6F05C", accent: "#A276E9", outfit: "hoodie", outfitColor: "#080808", accessory: "cap" } }, // i18n-ignore: character name
  { id: "dub-drone", name: "DUB DRONE", look: { species: "vinyl", body: "#A276E9", accent: "#B6F05C", outfit: "vest", outfitColor: "#55BCEB", accessory: "headphones" } }, // i18n-ignore: character name
  { id: "moon-mochi", name: "MOON MOCHI", look: { species: "jelly", body: "#F5F2EA", accent: "#FF625C", outfit: "kimono", outfitColor: "#FF625C", accessory: "crown" } }, // i18n-ignore: character name
  { id: "lava-loop", name: "LAVA LOOP", look: { species: "slime", body: "#FF625C", accent: "#FFAD5B", outfit: "jacket", outfitColor: "#171717", accessory: "shades" } }, // i18n-ignore: character name
];

const COLORS = ["#B6F05C", "#FF625C", "#A276E9", "#55BCEB", "#FFAD5B", "#F5F2EA", "#171717"];
const OUTFITS: Outfit[] = ["none", "hoodie", "jacket", "vest", "kimono"];
const ACCESSORIES: Accessory[] = ["none", "headphones", "shades", "crown", "antenna", "cap"];
const DANCES = (tu: Tu): { id: DanceMove; label: string }[] => ([{ id: "bounce", label: tu("bounce") }, { id: "wiggle", label: tu("wiggle") }, { id: "spin", label: tu("spin") }]);
const EMOTES = (tu: Tu): { id: Emote; label: string }[] => ([{ id: "none", label: tu("none") }, { id: "wave", label: tu("wave") }, { id: "heart", label: tu("heart") }, { id: "fire", label: tu("fire") }, { id: "alien", label: tu("alien") }]);
const VIS = (tu: Tu): { id: "public" | "friends" | "hidden"; label: string; sub: string }[] => ([
  { id: "public", label: tu("public"), sub: tu("everyoneInTheRoomSees") },
  { id: "friends", label: tu("friends"), sub: tu("onlyMutualFriendsSeeIt") },
  { id: "hidden", label: tu("hidden"), sub: tu("nobodyElseSeesItYou") },
]);

export function AvatarSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const tu = useTranslations("live");
  const ta = useTranslations("avatarStudio");
  const me = useMyAvatar();
  const href = useLocalHref();
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
  // Signed in: the festival avatar IS the account alien. Only dance, emote and visibility are chosen here,
  // so LIVE never shows a second, different alien for the same person.
  const nameOk = me.account || (name.trim().length >= 2 && name.trim().length <= 24);

  const save = () => {
    if (!nameOk) return;
    if (!me.account) saveLook({ ...look, accessory: look.accessory === "dao_antenna" ? "antenna" : look.accessory }, name.trim());
    setLive({ liveDance: dance, liveEmote: emote, liveVisibility: vis });
    onSaved();
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={tu("myFestivalAvatar")}
      footer={
        <button type="button" onClick={save} disabled={!nameOk} className="flex min-h-12 w-full items-center justify-center rounded-full bg-acid font-extrabold uppercase text-ink disabled:opacity-40">
          {tu("saveAvatar")}
        </button>
      }
    >
      <div className="space-y-5">
        {me.account ? (
          <div className="flex items-center gap-3" data-testid="live-account-alien">
            <Alien look={me.look} className="size-28 shrink-0" title={tu("previewOf", { name: me.name })} bob />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-display text-xl uppercase leading-tight">{me.name}</p>
              {me.publicId && <p className="font-mono text-[12px] text-mute">{me.publicId}</p>}
              <p className="mt-1 text-[13px] text-mute">{tu("accountAlienNote")}</p>
              <Link href={href("/profile/alien")} className="mt-2 inline-flex min-h-11 items-center font-bold text-acid underline underline-offset-4">{tu("changeOutfitOnMyAlien")}</Link>
            </div>
          </div>
        ) : (
        <>
        <div className="flex items-center gap-3">
          <Alien look={look} className="size-28 shrink-0" title={tu("previewOf", { name })} bob />
          <label className="min-w-0 flex-1 text-sm font-bold">
            {tu("avatarName")}
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 24))} className="mt-1 min-h-11 w-full rounded-2xl border-2 border-line bg-surface px-3 text-[16px] font-normal outline-none focus:border-acid" aria-invalid={!nameOk} />
            {!nameOk && <span className="mt-1 block text-[12px] font-normal text-coral">{tu("n224Characters")}</span>}
          </label>
        </div>

        <fieldset>
          <legend className="text-sm font-extrabold uppercase text-mute">{tu("character")}</legend>
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
            <legend className="text-sm font-extrabold uppercase text-mute">{k === "body" ? tu("bodyColor") : k === "accent" ? tu("eyeAccentColor") : tu("outfitColor")}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setLook({ ...look, [k]: c })} aria-label={tu("colorSwatch", { part: k === "body" ? tu("bodyColor") : k === "accent" ? tu("eyeAccentColor") : tu("outfitColor"), color: c })} aria-pressed={look[k] === c} className={cn("size-11 rounded-full border-4", look[k] === c ? "border-cream" : "border-ink")} style={{ background: c }} />
              ))}
            </div>
          </fieldset>
        ))}

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-bold">
            {tu("outfit")}
            <select value={look.outfit} onChange={(e) => setLook({ ...look, outfit: e.target.value as Outfit })} className="mt-1 min-h-11 w-full rounded-2xl border-2 border-line bg-surface px-3 text-[16px] capitalize">
              {OUTFITS.map((o) => <option key={o} value={o}>{ta(o === "vest" ? "raveVest" : o)}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold">
            {tu("accessory")}
            <select value={look.accessory} onChange={(e) => setLook({ ...look, accessory: e.target.value as Accessory })} className="mt-1 min-h-11 w-full rounded-2xl border-2 border-line bg-surface px-3 text-[16px] capitalize">
              {ACCESSORIES.map((o) => <option key={o} value={o}>{ta(o)}</option>)}
            </select>
          </label>
        </div>
        </>
        )}

        <fieldset>
          <legend className="text-sm font-extrabold uppercase text-mute">{tu("danceOnDanceZones")}</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {DANCES(tu).map((d) => <button key={d.id} type="button" aria-pressed={dance === d.id} onClick={() => setDance(d.id)} className={cn("min-h-11 rounded-full border-2 text-sm font-bold", dance === d.id ? "border-acid bg-acid text-ink" : "border-line")}><Tx>{d.label}</Tx></button>)}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-extrabold uppercase text-mute">{tu("emote")}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {EMOTES(tu).map((d) => <button key={d.id} type="button" aria-pressed={emote === d.id} onClick={() => setEmote(d.id)} className={cn("min-h-11 rounded-full border-2 px-3 text-sm font-bold", emote === d.id ? "border-acid bg-acid text-ink" : "border-line")}><Tx>{d.label}</Tx></button>)}
          </div>
        </fieldset>

        <VisibilityPicker value={vis} onChange={setVis} />
      </div>
    </BottomSheet>
  );
}

export function VisibilityPicker({ value, onChange }: { value: "public" | "friends" | "hidden"; onChange: (v: "public" | "friends" | "hidden") => void }) {
  const tu = useTranslations("live");
  return (
    <fieldset>
      <legend className="text-sm font-extrabold uppercase text-mute">{tu("whoCanSeeMyAvatar")}</legend>
      <div className="mt-2 space-y-2" role="radiogroup" aria-label={tu("avatarVisibility")}>
        {VIS(tu).map((v) => (
          <button key={v.id} type="button" role="radio" aria-checked={value === v.id} onClick={() => onChange(v.id)} className={cn("flex min-h-12 w-full items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left", value === v.id ? "border-acid bg-acid/10" : "border-line")}>
            <span className={cn("size-4 shrink-0 rounded-full border-2", value === v.id ? "border-acid bg-acid" : "border-mute")} aria-hidden />
            <span><b className="block text-sm">{v.label}</b><span className="text-[12px] text-mute">{v.sub}</span></span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-mute">{tu("yourAvatarsSpotIsVirtual")}</p>
    </fieldset>
  );
}
