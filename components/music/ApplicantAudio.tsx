"use client";

import { useTranslations } from "next-intl";
import { Pause, Play } from "lucide-react";
import { usePlayerMaybe } from "./PlayerProvider";
import { toPlayer } from "./TrackActions";
import { fmtDuration, useMusic, type TrackDto } from "./shared";

interface Res { tracks?: Record<string, TrackDto[]>; profiles?: Record<string, { stageName: string; slug: string; city: string; genres: string[] }> }

/** Tracks attached to this event's applications, as this reviewer may play them (AUDITION ACCESS included). */
export function useApplicationAudio(eventId: string, any: boolean) {
  const { data } = useMusic<Res>(any ? `/api/music/events/${eventId}/application-tracks` : null);
  return data;
}

export function ApplicantAudio({ tracks }: { tracks: TrackDto[] }) {
  const t = useTranslations("music");
  const player = usePlayerMaybe();
  return (
    <ul className="mt-1 space-y-1" data-testid="applicant-tracks">
      {tracks.map((tr, i) => {
        const cur = player?.current?.id === tr.id;
        return (
          <li key={tr.id}>
            <button type="button" onClick={() => (cur ? player?.toggle() : player?.play(tracks.map(toPlayer), i))} className="flex min-h-11 w-full items-center gap-2 rounded-full bg-ink px-2 text-left text-xs" aria-label={t("playTrack", { title: tr.title })} data-testid="applicant-play">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-acid text-ink">{cur && player?.playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}</span>
              <span className="min-w-0 flex-1 truncate font-bold">{tr.title}</span>
              <span className="shrink-0 text-mute">{fmtDuration(tr.durationSec)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
