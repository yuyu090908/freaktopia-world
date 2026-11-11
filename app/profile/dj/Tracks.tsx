"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ConfirmSheet, Section, StatusPill } from "@/components/ops/shared";
import { Field, Textarea } from "@/components/forms/Fields";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { usePlayerMaybe, Cover } from "@/components/music/PlayerProvider";
import { fmtDuration, useMusicPost } from "@/components/music/shared";
import { rightsProblems } from "@/lib/music/rules";
import type { AudioTrack, CopyrightClaim } from "@/lib/music/types";
import { MetaFields, RightsFields, patchOf, type TrackFormValue } from "./TrackForm";
import { Uploader } from "./Uploader";

export interface MeRes {
  tracks: (Omit<AudioTrack, "storageKey" | "playbackKey"> & { likes: number; saves: number; liked: boolean; saved: boolean })[];
  quota: { usedBytes: number; limitBytes: number; maxFileBytes: number; maxDurationMin: number };
  storage: { mode: "s3" | "local" | "off"; missing: string[]; reason: string | null; localMaxBytes: number };
  strikes: number;
  strikeLimit: number;
  claims: Omit<CopyrightClaim, "claimantEmail">[];
}

const PUB_COLOR: Record<string, string> = { draft: "#5a5a5a", private: "#55BCEB", pending_review: "#FFAD5B", published: "#B6F05C", rejected: "#FF625C", removed: "#FF625C" };

export function TracksPanel({ me, reload }: { me: MeRes; reload: () => void }) {
  const t = useTranslations("music");
  const [edit, setEdit] = useState<MeRes["tracks"][number] | null>(null);
  const [del, setDel] = useState<MeRes["tracks"][number] | null>(null);
  const post = useMusicPost();
  const player = usePlayerMaybe();
  const href = useLocalHref();
  const mb = (b: number) => `${(b / 1024 / 1024).toFixed(b < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  const maxFile = me.storage.mode === "local" ? Math.min(me.quota.maxFileBytes, me.storage.localMaxBytes) : me.quota.maxFileBytes;
  return (
    <div className="space-y-4">
      <Section title={t("uploadTitle")} id="up-h">
        {me.storage.mode === "off" ? (
          <div className="rounded-2xl border-2 border-dashed border-orange/50 p-4 text-sm" data-testid="storage-off">
            <p className="font-bold">{t("storageOff")}</p>
            <p className="mt-1 text-mute">{t("storageOffSub")}</p>
            <p className="mt-2 font-mono text-xs">{me.storage.missing.join(", ")}</p>
          </div>
        ) : me.strikes >= me.strikeLimit ? (
          <p role="alert" className="text-sm font-bold text-coral">{t("err.UPLOADS_SUSPENDED")}</p>
        ) : (
          <Uploader maxFileBytes={maxFile} storageMode={me.storage.mode} onDone={reload} />
        )}
        <p className="mt-3 text-xs text-mute" data-testid="quota">{t("quota", { used: mb(me.quota.usedBytes), limit: mb(me.quota.limitBytes), max: mb(maxFile), minutes: me.quota.maxDurationMin })}</p>
      </Section>

      <Section title={t("myTracks")} id="mt-h">
        {me.tracks.length === 0 ? (
          <p className="text-sm text-mute">{t("noTracksYet")}</p>
        ) : (
          <ul className="space-y-2" data-testid="my-tracks">
            {me.tracks.map((tr) => (
              <li key={tr.id} className="rounded-2xl bg-surface-2 p-3" data-testid="my-track" data-status={tr.publicationStatus}>
                <div className="flex items-center gap-3">
                  <Cover id={tr.coverId} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-extrabold">{tr.title}</div>
                    <div className="text-xs text-mute">{t(`type.${tr.type}`)} · {tr.genre} · {fmtDuration(tr.durationSec)} · {t(`vis.${tr.visibility}`)}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <StatusPill status={tr.processingStatus === "ready" ? "done" : tr.processingStatus === "failed" ? "critical" : "doing"} label={t(`proc.${tr.processingStatus}`)} />
                      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-extrabold uppercase" style={{ borderColor: PUB_COLOR[tr.publicationStatus], color: PUB_COLOR[tr.publicationStatus] }} data-testid="pub-status">{t(`pub.${tr.publicationStatus}`)}</span>
                      <span className="inline-flex items-center rounded-full border border-line px-2 py-0.5 text-[11px] font-bold" data-testid="rights-status">{t(`rights.${tr.rightsStatus}`)}</span>
                    </div>
                    {tr.processingError && <p className="mt-1 text-xs text-coral" role="alert">{t(`err.${tr.processingError}`)}</p>}
                    {tr.reviewNote && <p className="mt-1 text-xs text-mute">{t("staffNote", { note: tr.reviewNote })}</p>}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {tr.processingStatus === "ready" && (
                    <Button size="sm" variant="secondary" onClick={() => player?.play([{ id: tr.id, title: tr.title, coverId: tr.coverId, durationSec: tr.durationSec, waveform: tr.waveform, liked: tr.liked, saved: tr.saved, likes: tr.likes }], 0)} data-testid="my-track-play"><Play className="size-4" aria-hidden /> {t("preview")}</Button>
                  )}
                  {tr.publicationStatus !== "removed" && <Button size="sm" variant="ghost" onClick={() => setEdit(tr)} data-testid="my-track-edit"><Pencil className="size-4" aria-hidden /> {t("edit")}</Button>}
                  {tr.publicationStatus === "published" && <Link href={href(`/music/tracks/${tr.id}`)} className="inline-flex min-h-11 items-center px-3 text-sm font-bold text-acid underline">{t("openPage")}</Link>}
                  {tr.processingStatus === "ready" && ["draft", "rejected"].includes(tr.publicationStatus) && (
                    <Button size="sm" onClick={async () => { if (await post(`tracks/${tr.id}/submit`, { visibility: tr.visibility === "private" ? "public" : tr.visibility })) reload(); }}>{t("sendForReview")}</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setDel(tr)} aria-label={t("deleteTrack")} data-testid="my-track-delete"><Trash2 className="size-4" aria-hidden /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {me.claims.length > 0 && <ClaimsSection claims={me.claims} tracks={me.tracks} reload={reload} />}

      {edit && <EditSheet track={edit} onClose={() => setEdit(null)} reload={reload} />}
      <ConfirmSheet
        open={!!del}
        onClose={() => setDel(null)}
        title={t("deleteTrack")}
        statement={t("deleteStatement", { title: del?.title ?? "" })}
        confirmLabel={t("delete")}
        onConfirm={async () => {
          if (del && (await post(`tracks/${del.id}/delete`, {}, { success: t("deleted") }))) {
            setDel(null);
            reload();
          }
        }}
      />
    </div>
  );
}

function EditSheet({ track, onClose, reload }: { track: MeRes["tracks"][number]; onClose: () => void; reload: () => void }) {
  const t = useTranslations("music");
  const post = useMusicPost();
  const [v, setV] = useState<TrackFormValue>({
    title: track.title, type: track.type, genre: track.genre, bpm: track.bpm, musicalKey: track.musicalKey, description: track.description, recordedAt: track.recordedAt,
    releaseAt: track.releaseAt, coverId: track.coverId, rights: track.rights, visibility: track.visibility, downloadable: track.downloadable,
  });
  const [problems, setProblems] = useState<string[]>([]);
  const set = (p: Partial<TrackFormValue>) => setV((x) => ({ ...x, ...p }));
  const save = async (submit: boolean) => {
    const r = await post(`tracks/${track.id}`, { ...patchOf(v), ...(track.publicationStatus === "published" ? { visibility: v.visibility } : {}) });
    if (!r) return;
    if (submit) {
      const pr = v.visibility === "private" ? [] : rightsProblems(v.type, v.rights);
      setProblems(pr);
      if (pr.length) return;
      if (!(await post(`tracks/${track.id}/submit`, { visibility: v.visibility }))) return;
    }
    reload();
    onClose();
  };
  const canSubmit = track.processingStatus === "ready";
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={t("editTrack")}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => void save(false)} data-testid="edit-save">{t("saveDraft")}</Button>
          {canSubmit && <Button onClick={() => void save(true)} data-testid="edit-submit">{v.visibility === "private" ? t("keepPrivate") : track.rightsStatus === "staff_reviewed" ? t("applyVisibility") : t("sendForReview")}</Button>}
        </div>
      }
    >
      <div className="space-y-5">
        <MetaFields v={v} set={set} />
        <RightsFields v={v} set={set} problems={problems} />
      </div>
    </BottomSheet>
  );
}

function ClaimsSection({ claims, tracks, reload }: { claims: MeRes["claims"]; tracks: MeRes["tracks"]; reload: () => void }) {
  const t = useTranslations("music");
  const post = useMusicPost();
  const [text, setText] = useState<Record<string, string>>({});
  return (
    <Section title={t("claimsTitle")} id="cl-h">
      <ul className="space-y-3" data-testid="my-claims">
        {claims.map((c) => (
          <li key={c.id} className="rounded-2xl bg-surface-2 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <b>{tracks.find((x) => x.id === c.trackId)?.title ?? "—"}</b>
              <StatusPill status={c.status === "upheld" ? "critical" : c.status === "dismissed" || c.status === "restored" ? "done" : "warning"} label={t(`claim.${c.status}`)} />
            </div>
            <p className="mt-1 text-mute">{t("claimBy", { name: c.claimantName, work: c.work })}</p>
            {c.resolution && <p className="mt-1">{t("staffNote", { note: c.resolution })}</p>}
            {c.status === "upheld" && (
              <div className="mt-2 space-y-2">
                <Field id={`cn-${c.id}`} label={t("counterLabel")} hint={t("counterHint")}>
                  <Textarea id={`cn-${c.id}`} value={text[c.id] ?? ""} maxLength={3000} onChange={(e) => setText({ ...text, [c.id]: e.target.value })} />
                </Field>
                <Button size="sm" disabled={(text[c.id] ?? "").trim().length < 20} onClick={async () => { if (await post(`claims/${c.id}/counter`, { statement: text[c.id] }, { success: t("counterSent") })) reload(); }}>{t("sendCounter")}</Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}
