"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Download, Flag, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Field, Input, Textarea } from "@/components/forms/Fields";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { Cover, usePlayerMaybe } from "@/components/music/PlayerProvider";
import { ReactButtons, ShareButton, toPlayer } from "@/components/music/TrackActions";
import { Waveform } from "@/components/music/Waveform";
import { fmtDuration, useMusic, useMusicPost, type DjCardDto, type TrackDto } from "@/components/music/shared";

export interface TrackRes {
  track: TrackDto & { isOwner: boolean; publicationStatus?: string; recordedAt: string | null; releaseAt: string | null };
  dj: DjCardDto | null;
  canDownload: boolean;
}

export function TrackPage({ id, initial }: { id: string; initial: TrackRes }) {
  const t = useTranslations("music");
  const f = useFormatter();
  const href = useLocalHref();
  const player = usePlayerMaybe();
  const { data } = useMusic<TrackRes>(`/api/music/tracks/${id}`, initial);
  const [claim, setClaim] = useState(false);
  const d = data ?? initial;
  const tr = d.track;
  const isCurrent = player?.current?.id === tr.id;
  const progress = isCurrent && player?.duration ? player.time / player.duration : 0;
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 md:px-6" data-testid="track-page">
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <Cover id={tr.coverId} size={176} className="rounded-3xl" />
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-widest text-acid">{t(`type.${tr.type}`)} · {tr.genre}</p>
          <h1 className="font-display text-3xl uppercase leading-tight md:text-5xl">{tr.title}</h1>
          {tr.owner && (tr.owner.slug ? <Link href={href(`/djs/u/${tr.owner.slug}`)} className="font-bold text-acid underline">{tr.owner.stageName}</Link> : <span>{tr.owner.stageName}</span>)}
          <p className="mt-1 text-sm text-mute">{[tr.bpm ? `${tr.bpm} BPM` : null, tr.musicalKey, fmtDuration(tr.durationSec), tr.releaseAt ? f.dateTime(new Date(`${tr.releaseAt}T12:00:00Z`), { dateStyle: "medium", timeZone: "UTC" }) : null].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button onClick={() => (isCurrent ? player?.toggle() : player?.play([toPlayer(tr)], 0))} data-testid="track-play">
          {isCurrent && player?.playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />} {isCurrent && player?.playing ? t("pause") : t("play")}
        </Button>
        <ReactButtons track={tr} />
        <ShareButton path={`/music/tracks/${tr.id}`} title={tr.title} />
        {d.canDownload && <a href={`/api/music/tracks/${tr.id}/download`} className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line px-4 text-sm font-bold"><Download className="size-4" aria-hidden />{t("download")}</a>}
      </div>
      <div className="mt-4">
        <Waveform peaks={tr.waveform} progress={progress} label={t("seek")} onSeek={isCurrent ? (x) => player?.seek(x * (player.duration || 0)) : undefined} />
      </div>
      {tr.isOwner && tr.publicationStatus && tr.publicationStatus !== "published" && <p className="mt-3 rounded-xl bg-orange/10 p-3 text-sm" role="status">{t("ownerOnlyNotice", { status: t(`pub.${tr.publicationStatus}`) })}</p>}
      {tr.description && <p className="mt-4 whitespace-pre-wrap text-sm">{tr.description}</p>}
      <p className="mt-4 text-xs text-mute" data-testid="rights-label">{tr.rightsStatus === "staff_reviewed" ? t("rightsReviewedLabel") : t("rightsUnreviewedLabel")}</p>
      <button type="button" onClick={() => setClaim(true)} className="mt-2 inline-flex min-h-11 items-center gap-1 text-xs font-bold text-mute underline" data-testid="open-claim"><Flag className="size-3.5" aria-hidden />{t("reportCopyright")}</button>
      {claim && <ClaimSheet trackId={tr.id} onClose={() => setClaim(false)} />}
    </div>
  );
}

function ClaimSheet({ trackId, onClose }: { trackId: string; onClose: () => void }) {
  const t = useTranslations("music");
  const post = useMusicPost();
  const [v, setV] = useState({ claimantName: "", claimantEmail: "", work: "", details: "", goodFaith: false });
  const [sent, setSent] = useState(false);
  return (
    <BottomSheet open onClose={onClose} title={t("reportCopyright")} footer={!sent ? <div className="flex justify-end"><Button disabled={!v.goodFaith || !v.claimantName || !v.claimantEmail || !v.work || !v.details} onClick={async () => { if (await post("claims", { trackId, ...v })) setSent(true); }} data-testid="send-claim">{t("send")}</Button></div> : undefined}>
      {sent ? <p className="font-bold text-acid" data-testid="claim-sent">{t("claimSent")}</p> : (
        <div className="space-y-3" data-testid="claim-form">
          <p className="text-sm text-mute">{t("claimIntro")}</p>
          <Field id="cl-n" label={t("claimName")}><Input id="cl-n" value={v.claimantName} maxLength={120} onChange={(e) => setV({ ...v, claimantName: e.target.value })} /></Field>
          <Field id="cl-e" label={t("claimEmail")} hint={t("claimEmailHint")}><Input id="cl-e" type="email" value={v.claimantEmail} maxLength={200} onChange={(e) => setV({ ...v, claimantEmail: e.target.value })} /></Field>
          <Field id="cl-w" label={t("claimWork")}><Input id="cl-w" value={v.work} maxLength={300} onChange={(e) => setV({ ...v, work: e.target.value })} /></Field>
          <Field id="cl-d" label={t("claimDetails")}><Textarea id="cl-d" value={v.details} maxLength={3000} onChange={(e) => setV({ ...v, details: e.target.value })} /></Field>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={v.goodFaith} onChange={(e) => setV({ ...v, goodFaith: e.target.checked })} className="mt-1 size-5 accent-[var(--color-acid)]" />{t("claimGoodFaith")}</label>
        </div>
      )}
    </BottomSheet>
  );
}
