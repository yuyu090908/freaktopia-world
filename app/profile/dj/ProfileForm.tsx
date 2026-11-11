"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Field, Input, Select, Textarea, ToggleRow } from "@/components/forms/Fields";
import { Button, Chip } from "@/components/ui/primitives";
import { Section } from "@/components/ops/shared";
import { Cover } from "@/components/music/PlayerProvider";
import { fileToB64, useMusicPost } from "@/components/music/shared";
import { DJ_GENRES } from "@/lib/music/genres";
import type { DjProfile } from "@/lib/music/types";

/** Activate / edit the DJ profile on the existing account (no second account). */
export function ProfileForm({ profile, onSaved }: { profile: DjProfile | null; onSaved: () => void }) {
  const t = useTranslations("music");
  const post = useMusicPost();
  const [v, setV] = useState({
    stageName: profile?.stageName ?? "", bio: profile?.bio ?? "", country: profile?.country ?? "", city: profile?.city ?? "", genres: (profile?.genres ?? []) as string[],
    yearsExperience: profile?.yearsExperience ?? 0, equipment: profile?.equipment ?? "", regions: (profile?.regions ?? []).join(", "), bookingStatus: profile?.bookingStatus ?? "open",
    contactPolicy: profile?.contactPolicy ?? "organizers", bufferHours: profile?.bufferHours ?? 12, links: profile?.links ?? [], pastEvents: (profile?.pastEvents ?? []).join("\n"),
    imageId: profile?.imageId ?? null, showAlien: profile?.showAlien ?? true, visibility: profile?.visibility ?? "public",
  });
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }));
  const save = async () => {
    setBusy(true);
    const r = await post(
      "profile",
      {
        ...v,
        regions: v.regions.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10),
        pastEvents: v.pastEvents.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 20),
        links: v.links.filter((l) => l.url.trim()),
        genres: v.genres,
      },
      { success: profile ? t("profileSaved") : t("profileActivated") },
    );
    setBusy(false);
    if (r) onSaved();
  };
  return (
    <Section title={profile ? t("editProfile") : t("activateProfile")} id="djp-h">
      {!profile && <p className="mb-3 text-sm text-mute">{t("activateSub")}</p>}
      <div className="grid gap-3 md:grid-cols-2" data-testid="dj-profile-form">
        <Field id="dp-name" label={t("pStageName")}><Input id="dp-name" value={v.stageName} maxLength={40} onChange={(e) => set({ stageName: e.target.value })} data-testid="dp-name" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="dp-city" label={t("pCity")}><Input id="dp-city" value={v.city} maxLength={60} onChange={(e) => set({ city: e.target.value })} data-testid="dp-city" /></Field>
          <Field id="dp-country" label={t("pCountry")}><Input id="dp-country" value={v.country} maxLength={60} onChange={(e) => set({ country: e.target.value })} /></Field>
        </div>
        <fieldset className="md:col-span-2">
          <legend className="mb-1 text-sm font-bold">{t("pGenres")}</legend>
          <div className="flex flex-wrap gap-2">
            {DJ_GENRES.map((g) => (
              <Chip key={g} active={v.genres.includes(g)} onClick={() => set({ genres: v.genres.includes(g) ? v.genres.filter((x) => x !== g) : [...v.genres, g].slice(0, 6) })} aria-pressed={v.genres.includes(g)}>{g}</Chip>
            ))}
          </div>
        </fieldset>
        <div className="md:col-span-2"><Field id="dp-bio" label={t("pBio")} optional><Textarea id="dp-bio" value={v.bio} maxLength={1200} onChange={(e) => set({ bio: e.target.value })} /></Field></div>
        <Field id="dp-years" label={t("pYears")}><Input id="dp-years" type="number" min={0} max={60} value={v.yearsExperience} onChange={(e) => set({ yearsExperience: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })} /></Field>
        <Field id="dp-eq" label={t("pEquipment")} optional><Input id="dp-eq" value={v.equipment} maxLength={300} onChange={(e) => set({ equipment: e.target.value })} /></Field>
        <Field id="dp-reg" label={t("pRegions")} hint={t("pRegionsHint")} optional><Input id="dp-reg" value={v.regions} maxLength={600} onChange={(e) => set({ regions: e.target.value })} /></Field>
        <Field id="dp-buf" label={t("pBuffer")} hint={t("pBufferHint")}><Input id="dp-buf" type="number" min={0} max={72} value={v.bufferHours} onChange={(e) => set({ bufferHours: Math.max(0, Math.min(72, Number(e.target.value) || 0)) })} /></Field>
        <Field id="dp-bs" label={t("pBooking")}>
          <Select id="dp-bs" value={v.bookingStatus} onChange={(e) => set({ bookingStatus: e.target.value as typeof v.bookingStatus })} data-testid="dp-booking">
            {(["open", "limited", "closed"] as const).map((x) => <option key={x} value={x}>{t(`booking.${x}`)}</option>)}
          </Select>
        </Field>
        <Field id="dp-cp" label={t("pContact")} hint={t("pContactHint")}>
          <Select id="dp-cp" value={v.contactPolicy} onChange={(e) => set({ contactPolicy: e.target.value as typeof v.contactPolicy })} data-testid="dp-contact">
            {(["organizers", "anyone", "none"] as const).map((x) => <option key={x} value={x}>{t(`contact.${x}`)}</option>)}
          </Select>
        </Field>
        <div className="md:col-span-2"><Field id="dp-past" label={t("pPast")} hint={t("pPastHint")} optional><Textarea id="dp-past" value={v.pastEvents} maxLength={2400} onChange={(e) => set({ pastEvents: e.target.value })} /></Field></div>
        <div className="space-y-2 md:col-span-2">
          <p className="text-sm font-bold">{t("pLinks")}</p>
          {v.links.map((l, i) => (
            <div key={i} className="flex gap-2">
              <Input aria-label={t("pLinkLabel")} value={l.label} maxLength={30} placeholder={t("pLinkLabel")} className="max-w-36" onChange={(e) => set({ links: v.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              <Input aria-label={t("pLinkUrl")} value={l.url} maxLength={300} placeholder="https://" onChange={(e) => set({ links: v.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
              <button type="button" aria-label={t("remove")} className="inline-flex size-12 shrink-0 items-center justify-center" onClick={() => set({ links: v.links.filter((_, j) => j !== i) })}><Trash2 className="size-4" aria-hidden /></button>
            </div>
          ))}
          {v.links.length < 6 && <Button variant="ghost" size="sm" onClick={() => set({ links: [...v.links, { label: "", url: "" }] })}><Plus className="size-4" aria-hidden /> {t("pAddLink")}</Button>}
          <p className="text-xs text-mute">{t("pLinksHint")}</p>
        </div>
        <div className="flex items-center gap-3 md:col-span-2">
          <Cover id={v.imageId} size={64} className="rounded-full" />
          <Field id="dp-img" label={t("pImage")} optional hint={t("fCoverHint")}>
            <input id="dp-img" type="file" accept="image/png,image/jpeg,image/webp" className="block w-full text-sm" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const r = await post<{ image: { id: string } }>("images", { data: await fileToB64(f) }); if (r) set({ imageId: r.image.id }); }} />
          </Field>
        </div>
        <ToggleRow checked={v.showAlien} onChange={(x) => set({ showAlien: x })} label={t("pShowAlien")} sub={t("pShowAlienSub")} />
        <ToggleRow checked={v.visibility === "public"} onChange={(x) => set({ visibility: x ? "public" : "hidden" })} label={t("pVisible")} sub={t("pVisibleSub")} />
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={() => void save()} disabled={busy || !v.stageName.trim()} data-testid="dp-save">{profile ? t("save") : t("activate")}</Button>
      </div>
    </Section>
  );
}
