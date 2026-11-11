"use client";

import { useTranslations } from "next-intl";
import { Field, Input, Select, Textarea, ToggleRow } from "@/components/forms/Fields";
import { DJ_GENRES, MUSICAL_KEYS } from "@/lib/music/genres";
import { THIRD_PARTY_TYPES, TRACK_TYPES, type RightsInfo, type TrackType, type TrackVisibility } from "@/lib/music/types";
import { fileToB64, useMusicPost } from "@/components/music/shared";
import { Cover } from "@/components/music/PlayerProvider";

export interface TrackFormValue {
  title: string;
  type: TrackType;
  genre: string;
  bpm: number | null;
  musicalKey: string | null;
  description: string;
  recordedAt: string | null;
  releaseAt: string | null;
  coverId: string | null;
  rights: RightsInfo;
  visibility: TrackVisibility;
  downloadable: boolean;
}

export const emptyRights: RightsInfo = { allOriginal: false, usesThirdParty: false, licensor: "", licenseRef: "", territories: "", licenseEnds: null, allowStreaming: false, allowDownload: false, documentId: null, statement: "" };

/** Step 3: what the track is. */
export function MetaFields({ v, set }: { v: TrackFormValue; set: (p: Partial<TrackFormValue>) => void }) {
  const t = useTranslations("music");
  const post = useMusicPost();
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field id="tf-title" label={t("fTitle")}><Input id="tf-title" value={v.title} maxLength={100} onChange={(e) => set({ title: e.target.value })} data-testid="tf-title" /></Field>
      <Field id="tf-type" label={t("fType")}>
        <Select id="tf-type" value={v.type} onChange={(e) => set({ type: e.target.value as TrackType })} data-testid="tf-type">
          {TRACK_TYPES.map((x) => <option key={x} value={x}>{t(`type.${x}`)}</option>)}
        </Select>
      </Field>
      <Field id="tf-genre" label={t("fGenre")}>
        <Select id="tf-genre" value={v.genre} onChange={(e) => set({ genre: e.target.value })} data-testid="tf-genre">
          {DJ_GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="tf-bpm" label={t("fBpm")} optional><Input id="tf-bpm" type="number" inputMode="numeric" min={40} max={220} value={v.bpm ?? ""} onChange={(e) => set({ bpm: e.target.value ? Math.round(Number(e.target.value)) : null })} data-testid="tf-bpm" /></Field>
        <Field id="tf-key" label={t("fKey")} optional>
          <Select id="tf-key" value={v.musicalKey ?? ""} onChange={(e) => set({ musicalKey: e.target.value || null })}>
            <option value="">—</option>
            {MUSICAL_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </Select>
        </Field>
      </div>
      <Field id="tf-rec" label={t("fRecorded")} optional><Input id="tf-rec" type="date" value={v.recordedAt ?? ""} onChange={(e) => set({ recordedAt: e.target.value || null })} /></Field>
      <Field id="tf-rel" label={t("fReleased")} optional><Input id="tf-rel" type="date" value={v.releaseAt ?? ""} onChange={(e) => set({ releaseAt: e.target.value || null })} /></Field>
      <div className="md:col-span-2">
        <Field id="tf-desc" label={t("fDescription")} optional><Textarea id="tf-desc" value={v.description} maxLength={2000} onChange={(e) => set({ description: e.target.value })} /></Field>
      </div>
      <div className="flex items-center gap-3 md:col-span-2">
        <Cover id={v.coverId} size={64} />
        <Field id="tf-cover" label={t("fCover")} optional hint={t("fCoverHint")}>
          <input
            id="tf-cover"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="block w-full text-sm"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const r = await post<{ image: { id: string } }>("images", { data: await fileToB64(f) });
              if (r) set({ coverId: r.image.id });
            }}
          />
        </Field>
      </div>
    </div>
  );
}

/** Step 4: rights (questions change with the type) and who can listen. */
export function RightsFields({ v, set, problems }: { v: TrackFormValue; set: (p: Partial<TrackFormValue>) => void; problems: string[] }) {
  const t = useTranslations("music");
  const post = useMusicPost();
  const r = v.rights;
  const setR = (p: Partial<RightsInfo>) => set({ rights: { ...r, ...p } });
  const forcedThirdParty = THIRD_PARTY_TYPES.includes(v.type);
  const thirdParty = forcedThirdParty || r.usesThirdParty || !r.allOriginal;
  const bad = (k: string) => (problems.includes(k) ? t(`rightsProblem.${k}`) : undefined);
  return (
    <div className="space-y-3">
      <p className="rounded-2xl border border-orange/40 bg-orange/10 p-3 text-sm" data-testid="rights-note">{t("rightsNote")}</p>
      {forcedThirdParty ? (
        <p className="rounded-2xl bg-surface-2 p-3 text-sm">{t("rightsTypeThirdParty", { type: t(`type.${v.type}`) })}</p>
      ) : (
        <>
          <ToggleRow checked={r.allOriginal} onChange={(x) => setR({ allOriginal: x, usesThirdParty: x ? false : r.usesThirdParty })} label={t("rAllOriginal")} sub={t("rAllOriginalSub")} />
          {!r.allOriginal && <ToggleRow checked={r.usesThirdParty} onChange={(x) => setR({ usesThirdParty: x })} label={t("rThirdParty")} sub={t("rThirdPartySub")} />}
        </>
      )}
      {bad("typeNeedsThirdParty") && <p role="alert" className="text-sm text-coral">{bad("typeNeedsThirdParty")}</p>}
      {thirdParty && (
        <div className="grid gap-3 rounded-2xl border border-line p-3 md:grid-cols-2" data-testid="rights-licence">
          <Field id="r-lic" label={t("rLicensor")} hint={t("rLicensorHint")} error={bad("licensor")}><Input id="r-lic" value={r.licensor} maxLength={200} onChange={(e) => setR({ licensor: e.target.value })} data-testid="r-licensor" /></Field>
          <Field id="r-ref" label={t("rLicenseRef")} hint={t("rLicenseRefHint")} error={bad("licenseRef")}><Input id="r-ref" value={r.licenseRef} maxLength={300} onChange={(e) => setR({ licenseRef: e.target.value })} data-testid="r-ref" /></Field>
          <Field id="r-ter" label={t("rTerritories")} hint={t("rTerritoriesHint")} error={bad("territories")}><Input id="r-ter" value={r.territories} maxLength={200} onChange={(e) => setR({ territories: e.target.value })} data-testid="r-territories" /></Field>
          <Field id="r-end" label={t("rEnds")} optional hint={t("rEndsHint")}><Input id="r-end" type="date" value={r.licenseEnds ?? ""} onChange={(e) => setR({ licenseEnds: e.target.value || null })} /></Field>
          <div className="md:col-span-2">
            <Field id="r-doc" label={t("rDocument")} optional hint={r.documentId ? t("rDocumentAttached") : t("rDocumentHint")}>
              <input
                id="r-doc"
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="block w-full text-sm"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const d = await post<{ document: { id: string } }>("rights-docs", { name: f.name, data: await fileToB64(f) });
                  if (d) setR({ documentId: d.document.id });
                }}
              />
            </Field>
          </div>
        </div>
      )}
      <ToggleRow checked={r.allowStreaming} onChange={(x) => setR({ allowStreaming: x })} label={t("rStreaming")} sub={t("rStreamingSub")} />
      {bad("allowStreaming") && <p role="alert" className="text-sm text-coral">{bad("allowStreaming")}</p>}
      <ToggleRow checked={r.allowDownload} onChange={(x) => { setR({ allowDownload: x }); if (!x) set({ downloadable: false }); }} label={t("rDownloadRight")} sub={t("rDownloadRightSub")} />
      {r.allowDownload && <ToggleRow checked={v.downloadable} onChange={(x) => set({ downloadable: x })} label={t("rDownloadOn")} sub={t("rDownloadOnSub")} />}
      <Field id="r-st" label={t("rStatement")} hint={t("rStatementHint")} error={bad("statement")}><Textarea id="r-st" value={r.statement} maxLength={1000} onChange={(e) => setR({ statement: e.target.value })} data-testid="r-statement" /></Field>
      <fieldset>
        <legend className="mb-1 text-sm font-bold">{t("fVisibility")}</legend>
        <div className="grid gap-2 md:grid-cols-2">
          {(["public", "unlisted", "audition", "private"] as TrackVisibility[]).map((x) => (
            <label key={x} className="flex min-h-12 cursor-pointer items-start gap-2 rounded-2xl border border-line p-3 has-[:checked]:border-acid">
              <input type="radio" name="tf-vis" value={x} checked={v.visibility === x} onChange={() => set({ visibility: x })} className="mt-1 accent-[var(--color-acid)]" data-testid={`vis-${x}`} />
              <span>
                <span className="block text-sm font-extrabold uppercase">{t(`vis.${x}`)}</span>
                <span className="block text-xs text-mute">{t(`visSub.${x}`)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export function patchOf(v: TrackFormValue) {
  return {
    ...(v.title.trim() ? { title: v.title.trim() } : {}), type: v.type, genre: v.genre, bpm: v.bpm, musicalKey: v.musicalKey, description: v.description, recordedAt: v.recordedAt,
    releaseAt: v.releaseAt, coverId: v.coverId, rights: v.rights, downloadable: v.downloadable && v.rights.allowDownload,
  };
}
