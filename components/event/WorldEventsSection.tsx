"use client";

/**
 * EVENTS → "World events": listings from connected, approved outside sources (lib/discovery), with the same
 * search and filters as FREAKTOPIA's own list. Each card says where it came from and when it was last verified,
 * and only links out (official page, the seller's tickets). No FREAKTOPIA ticket button, ever.
 * With no source connected the section says so and shows nothing else: no sample "world" events are invented.
 */
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { ExternalLink, MapPin, Mic2, Ticket, X } from "lucide-react";
import { useParty } from "@/components/party/shared";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import type { Locale } from "@/i18n/config";
import { appNow } from "@/lib/clock";
import { artistsMatching, filterUnified } from "@/lib/discovery/view";
import type { UnifiedEvent } from "@/lib/discovery/types";
import type { EventFilters } from "@/lib/filters";
import { formatEventDate } from "@/lib/i18n/format";
import { labelKey } from "@/lib/i18n/labels";
import { EXTERNAL_MARKER_LABEL, externalMarkerKind, externalMarkerSvg } from "@/lib/map/landmarks";

interface Res {
  events: UnifiedEvent[];
  connected: boolean;
  sources: { id: string; name: string; state: string; lastSuccessAt: string | null }[];
}

export function WorldEventsSection({ filters }: { filters: EventFilters }) {
  const t = useTranslations("discovery");
  const { data, error } = useParty<Res>("/api/discovery/events?limit=1000");
  const [artist, setArtist] = useState<{ id: string; name: string; source: string } | null>(null);
  const all = useMemo(() => data?.events ?? [], [data]);
  const list = useMemo(() => filterUnified(all, filters, appNow(), artist?.id), [all, filters, artist]);
  const artists = useMemo(() => (artist ? [] : artistsMatching(all, filters.q)), [all, filters.q, artist]);

  if (error) return <Shell count={null}><p className="text-sm text-danger" role="alert">{t("loadError")}</p></Shell>;
  if (!data) return <Shell count={null}><div className="h-16 animate-pulse rounded-2xl bg-surface-2" /></Shell>;
  if (!data.connected)
    return (
      <Shell count={null}>
        <p className="text-[13px] text-mute" data-testid="world-events-off">{t("notConnected")}</p>
      </Shell>
    );
  const asOf = data.sources.map((s) => s.lastSuccessAt).filter(Boolean).sort()[0];
  return (
    <Shell count={list.length} asOf={asOf ?? null}>
      {artists.length > 0 && (
        <div className="mb-3" data-testid="artist-matches">
          <p className="mb-1.5 text-[12px] font-bold uppercase text-mute">{t("artistsTitle")}</p>
          <div className="flex flex-wrap gap-2">
            {artists.map((a) => (
              <button key={a.id} type="button" onClick={() => setArtist({ id: a.id, name: a.name, source: a.source })} className="min-h-11 rounded-2xl border border-line bg-surface-2 px-3 py-1.5 text-left text-[13px] hover:border-cream/50" data-artist-id={a.id}>
                <b>{a.name}</b>
                <span className="block text-[11px] text-mute">{t("artistSub", { source: a.source, count: a.upcoming, cities: a.cities.slice(0, 3).join(", ") })}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {artist && (
        <p className="mb-3 flex flex-wrap items-center gap-2 text-[13px]" data-testid="artist-active">
          <Mic2 className="size-4 text-acid" aria-hidden /> {t("artistActive", { name: artist.name, source: artist.source })}
          <button type="button" onClick={() => setArtist(null)} className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 font-bold text-mute hover:text-cream">
            <X className="size-4" aria-hidden /> {t("artistClear")}
          </button>
        </p>
      )}
      {list.length === 0 ? (
        <p className="text-[13px] text-mute">{t("noMatches")}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2" data-testid="world-events-list">
          {list.slice(0, 60).map((e) => (
            <li key={e.id} className="flex">
              <WorldEventCard e={e} />
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

function Shell({ count, asOf, children }: { count: number | null; asOf?: string | null; children: React.ReactNode }) {
  const t = useTranslations("discovery");
  const locale = useLocale() as Locale;
  return (
    <section className="mx-4 mt-4 rounded-[20px] border border-line bg-surface p-4 md:mx-0" aria-labelledby="world-events" data-testid="world-events">
      <h2 id="world-events" className="text-[18px] uppercase">
        {t("title")} {count != null && <span className="text-mute">({count})</span>}
      </h2>
      <p className="mb-3 text-[13px] text-mute">
        {t("sub")}
        {asOf && <> · {t("asOf", { time: formatEventDate(locale, asOf, "UTC", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }) })}</>}
      </p>
      {children}
    </section>
  );
}

function WorldEventCard({ e }: { e: UnifiedEvent }) {
  const t = useTranslations("discovery");
  const tl = useTranslations("labels");
  const locale = useLocale() as Locale;
  const href = useLocalHref();
  const kind = externalMarkerKind(e.category);
  const date = formatEventDate(locale, e.startsAtUtc, e.venueTimezone ?? "UTC", e.timeTbd ? { month: "short", day: "numeric", weekday: "short" } : { month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
  const official = e.officialUrl ?? e.sourceUrl;
  return (
    <article className="flex w-full flex-col rounded-2xl border border-line bg-surface-2 p-3" data-testid="world-event-card" data-source={e.sourceName}>
      <div className="flex gap-3">
        <span className="size-12 shrink-0" aria-hidden dangerouslySetInnerHTML={{ __html: externalMarkerSvg(kind, e.locationPrecision !== "venue") }} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold uppercase">
            <span className="rounded-full border border-[#66DFFF] px-2 py-0.5 text-[#66DFFF]">{t("from", { source: e.sourceName })}</span>
            <span className="rounded-full bg-surface px-2 py-0.5">{tl(labelKey(EXTERNAL_MARKER_LABEL[kind]))}</span>
            {e.externalStatus === "postponed" || e.externalStatus === "rescheduled" ? <span className="rounded-full bg-coral/20 px-2 py-0.5 text-coral">{t(`status.${e.externalStatus}`)}</span> : null}
          </div>
          <h3 className="mt-1 text-[16px] font-extrabold leading-tight">{e.title}</h3>
          <p className="mt-0.5 text-[13px] text-mute">
            {date}
            {e.timeTbd ? ` · ${t("timeTbd")}` : ` (${t("localTime")})`}
          </p>
          <p className="text-[13px] text-mute">
            {[e.venueName, e.city].filter(Boolean).join(" · ")}
            {e.locationPrecision === "city" && ` (${t("approx")})`}
          </p>
          {e.lineup.length > 0 && <p className="mt-0.5 truncate text-[12px]">{e.lineup.map((a) => a.name).join(", ")}</p>}
          <p className="mt-1 text-[11px] text-mute" data-testid="world-event-verified">
            {t("verified", { time: formatEventDate(locale, e.lastVerifiedAt, "UTC", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }) })}
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {official && (
          <a href={official} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-acid px-4 text-[13px] font-extrabold uppercase text-ink">
            <ExternalLink className="size-4" aria-hidden /> {t("official")}
            <span className="sr-only"> ({t("newTab")})</span>
          </a>
        )}
        {e.ticketUrl && e.externalStatus !== "postponed" && (
          <a href={e.ticketUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-line px-4 text-[13px] font-extrabold uppercase">
            <Ticket className="size-4" aria-hidden /> {t("tickets")}
            <span className="sr-only"> ({t("newTab")})</span>
          </a>
        )}
        {e.latitude != null && (
          <Link href={href(`/world?event=${encodeURIComponent(e.id)}`)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold text-acid">
            <MapPin className="size-4" aria-hidden /> {t("onMap")}
          </Link>
        )}
      </div>
    </article>
  );
}
