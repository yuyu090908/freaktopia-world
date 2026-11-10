"use client";

import { Tx } from "@/components/i18n/Tx";

import { useTranslations } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import { afterPartyArt, eventArt, type ArtPick } from "@/lib/art";
import { ArrowRight, CalendarDays, Heart, MapPin, Users, Speaker, Clock, Ticket } from "lucide-react";
import type { AfterParty, DJ, FreakEvent, Venue } from "@/lib/types";
import { ExploreArt, VenueArt, type ExploreKind } from "@/components/art/Scenes";
import { Alien } from "@/components/art/Alien";
import { EventLevelBadge } from "@/components/event/EventLevelBadge";
import { EventProgress } from "@/components/event/EventProgress";
import { DemoBadge, Tag } from "@/components/ui/primitives";
import { useDemo, useEventStats } from "@/lib/store";
import { cn, compact, fmtDate, fmtTime, money } from "@/lib/utils";
import { getEvent } from "@/lib/data";

/* ---------------- Explore card ---------------- */
export function IllustratedCard({ href, title, sub, kind, color, art, big = false }: { href: string; title: string; sub: string; kind: ExploreKind; color: string; art?: ArtPick; big?: boolean }) {
  if (art) {
    return (
      <Link
        href={href}
        className={cn(
          "group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-[24px] border-2 text-cream transition-transform active:scale-[0.98] sm:aspect-[4/4.4]",
          big ? "w-[72vw] max-w-[300px] sm:w-[280px]" : "w-full",
        )}
        style={{ borderColor: color, boxShadow: `0 0 22px -8px ${color}` }}
      >
        <Image src={art.src} alt="" fill sizes="(min-width:1024px) 260px, (min-width:640px) 33vw, 50vw" className="object-cover transition-transform duration-500 group-hover:scale-105" style={{ objectPosition: art.pos }} />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-transparent" aria-hidden />
        <div className="relative p-3 pt-10">
          <div className="font-display text-[18px] uppercase leading-[0.95] drop-shadow-[0_2px_0_#080808] min-[400px]:text-[20px]">{title}</div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold leading-snug text-cream/85">{sub}</span>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink" style={{ background: color }} aria-hidden>
              <ArrowRight className="size-4" />
            </span>
          </div>
        </div>
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[26px] border-[3px] border-ink text-ink transition-transform active:scale-[0.98]",
        big ? "w-[72vw] max-w-[300px] sm:w-[280px]" : "w-full",
      )}
      style={{ background: color }}
    >
      <div className="halftone absolute inset-0 opacity-60" aria-hidden />
      <div className="relative px-3 pt-3">
        <ExploreArt kind={kind} className="mx-auto h-auto w-full max-w-[220px] transition-transform duration-300 group-hover:-rotate-2 group-hover:scale-105" />
      </div>
      <div className="relative mt-auto flex items-end justify-between gap-2 p-4 pt-1">
        <div className="min-w-0">
          <div className="font-display text-[22px] uppercase leading-none">{title}</div>
          <div className="mt-1 text-[13px] font-semibold leading-snug text-ink/75">{sub}</div>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-cream" aria-hidden>
          <ArrowRight className="size-5" />
        </span>
      </div>
    </Link>
  );
}

/** Raster cover for an event, with a soft bottom fade. */
export function EventCover({ id, sizes, priority = false, className }: { id: string; sizes: string; priority?: boolean; className?: string }) {
  const a = eventArt(id);
  return (
    <Image src={a.src} alt="" fill sizes={sizes} priority={priority} className={cn("object-cover", className)} style={{ objectPosition: a.pos }} />
  );
}

/* ---------------- Event card ---------------- */
export function EventCard({ event, className, wide = false }: { event: FreakEvent; className?: string; wide?: boolean }) {
  const tu = useTranslations("ui");
  const s = useEventStats(event);
  return (
    <article className={cn("flex flex-col overflow-hidden neon rounded-[26px] border bg-surface", wide ? "w-full" : "w-[80vw] max-w-[330px] sm:w-[320px]", className)}>
      <Link href={`/events/${event.id}`} className="relative block aspect-[5/3] overflow-hidden" aria-hidden="true" tabIndex={-1}>
        <EventCover id={event.id} sizes="(min-width:640px) 320px, 80vw" className="transition-transform duration-500 hover:scale-105" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-surface to-transparent" aria-hidden />
        {event.djRecruiting && event.status !== "live" && (
          <span className="absolute bottom-3 left-3 -rotate-3 rounded-xl border-2 border-ink bg-coral px-2.5 py-1 font-display text-[13px] uppercase text-ink shadow-[0_3px_0_#080808]">{tu("eventOpen")}</span>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <EventLevelBadge level={s.level} long />
          {event.status === "live" && <Tag color="#FF625C" dark>{tu("demoLive")}</Tag>}
        </div>
        <DemoBadge className="absolute right-3 top-3 bg-ink" />
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="text-[22px] uppercase leading-none">
            <Link href={`/events/${event.id}`} className="hover:text-acid">
              {event.name}
            </Link>
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-mute">
            <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{event.city}</span>
            <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" aria-hidden /><time dateTime={event.startsAt}>{fmtDate(event.startsAt, { month: "short", day: "numeric", year: "numeric" })}</time></span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {event.genres.map((g) => (
            <Tag key={g}>{g}</Tag>
          ))}
          {event.djRecruiting && <Tag color="#A276E9" dark>{tu("djsWanted")}</Tag>}
        </div>
        <EventProgress supporters={s.supporters} raised={s.raised} goal={event.goal} compactView />
        <Link href={`/events/${event.id}`} className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-coral font-extrabold uppercase text-ink shadow-[0_4px_0_0_#9b2f2b] hover:bg-[#ff7a75]">
          {tu("viewDetails")} <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

/* ---------------- Compact event row ---------------- */
export function EventRow({ event }: { event: FreakEvent }) {
  const tu = useTranslations("ui");
  const s = useEventStats(event);
  return (
    <Link href={`/events/${event.id}`} className="flex gap-3 rounded-3xl border border-line bg-surface p-3 hover:border-cream/30">
      <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-2xl sm:w-28">
        <EventCover id={event.id} sizes="112px" />
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <EventLevelBadge level={s.level} />
          {event.status === "live" && <Tag color="#FF625C" dark>{tu("demoLive")}</Tag>}
          {event.djRecruiting && <Tag color="#A276E9" dark>{tu("djsWanted")}</Tag>}
        </div>
        <h3 className="mt-2 truncate text-lg uppercase leading-none">{event.name}</h3>
        <div className="mt-1.5 truncate text-[13px] text-mute">
          {event.city} · {fmtDate(event.startsAt)} · {event.genres.join(" / ")}
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-[13px] font-semibold">
          <span className="inline-flex items-center gap-1"><Users className="size-3.5" aria-hidden />{compact(s.supporters)}</span>
          <span className="text-mute">{tu("roundFunded", { round: Math.round((s.raised / event.goal) * 100) })}</span>
        </div>
      </div>
    </Link>
  );
}

/* ---------------- Alien avatar ---------------- */
export function AlienAvatar({ look, size = 64, ring = "#2a2a2a", title, className }: { look: DJ["look"]; size?: number; ring?: string; title?: string; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px]", className)} style={{ width: size, height: size, borderColor: ring, background: "#1d1d22" }}>
      <Alien look={look} className="h-[92%] w-[92%] translate-y-[4%]" title={title} />
    </span>
  );
}

/* ---------------- DJ card ---------------- */
export function DJCard({ dj, className }: { dj: DJ; className?: string }) {
  const tu = useTranslations("ui");
  const fav = useDemo((s) => s.favorites.includes(dj.id));
  return (
    <article className={cn("relative flex w-[62vw] max-w-[240px] flex-col overflow-hidden neon rounded-[26px] border bg-surface sm:w-[230px]", className)}>
      <Link href={`/djs/${dj.id}`} className="relative block aspect-square" style={{ background: dj.look.accent }} tabIndex={-1} aria-hidden="true">
        <div className="halftone absolute inset-0" aria-hidden />
        <Alien look={dj.look} className="relative mx-auto h-full w-[86%] pt-3" />
        <span className="absolute left-3 top-3 rounded-full border-2 border-ink bg-cream px-2 py-0.5 font-display text-sm text-ink">#{dj.rank}</span>
        {fav && (
          <span className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-ink text-coral" aria-label={tu("favorite")}>
            <Heart className="size-4 fill-current" />
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-lg uppercase leading-none">
          <Link href={`/djs/${dj.id}`} className="hover:text-acid">{dj.name}</Link>
        </h3>
        <div className="mt-1.5 text-[13px] text-mute">{dj.city} · {dj.bpm[0]}–{dj.bpm[1]} BPM</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {dj.genres.map((g) => <Tag key={g}>{g}</Tag>)}
        </div>
        <div className="mt-3 text-[13px] font-semibold">{tu("compactFollowers", { compact: compact(dj.followers) })}</div>
      </div>
    </article>
  );
}

/* ---------------- Venue card ---------------- */
export function VenueCard({ venue, className }: { venue: Venue; className?: string }) {
  const tu = useTranslations("ui");
  return (
    <article className={cn("flex flex-col overflow-hidden neon rounded-[26px] border bg-surface", className)}>
      <div className="relative aspect-[5/3]">
        {venue.photos?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={venue.photos[0]} alt={tu("photoOf", { name: venue.name })} className="h-full w-full object-cover" />
        ) : (
          <VenueArt id={venue.id} palette={venue.palette} className="h-full w-full" label={tu("illustrationOf", { name: venue.name })} />
        )}
        {venue.isDemo ? <DemoBadge className="absolute right-3 top-3 bg-ink" /> : <Tag color="#B6F05C" dark className="absolute right-3 top-3">{tu("yourListing")}</Tag>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-xl uppercase leading-none">{venue.name}</h3>
        <div className="text-[13px] text-mute">{venue.city}{venue.country ? `, ${venue.country}` : ""}</div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-surface-2 p-2"><dt className="text-[10px] font-bold uppercase text-mute">{tu("capacity")}</dt><dd className="font-display">{venue.capacity.toLocaleString("en-US")}</dd></div>
          <div className="rounded-xl bg-surface-2 p-2"><dt className="text-[10px] font-bold uppercase text-mute">{tu("perHour")}</dt><dd className="font-display">{money(venue.hourlyRate)}</dd></div>
          <div className="rounded-xl bg-surface-2 p-2"><dt className="text-[10px] font-bold uppercase text-mute">{tu("freeDays")}</dt><dd className="font-display">{venue.availableDates.length}</dd></div>
        </dl>
        <div className="flex flex-wrap gap-1.5">
          {venue.amenities.slice(0, 3).map((a) => (
            <span key={a} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold"><Speaker className="size-3" aria-hidden /><Tx>{a}</Tx></span>
          ))}
          {venue.amenities.length > 3 && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold">+{venue.amenities.length - 3}</span>}
        </div>
        <Link href={`/venues/${venue.id}`} className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cream font-extrabold uppercase text-ink hover:bg-white">
          {tu("viewVenue")} <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

/* ---------------- After party card ---------------- */
export function AfterPartyCard({ party, className }: { party: AfterParty; className?: string }) {
  const tu = useTranslations("ui");
  const main = getEvent(party.eventId);
  const low = party.seatsLeft <= 15;
  return (
    <article className={cn("flex flex-col overflow-hidden neon rounded-[26px] border bg-surface", className)}>
      <div className="relative h-32 overflow-hidden" style={{ background: party.palette[0] }}>
        <Image src={afterPartyArt(party.id).src} alt="" fill sizes="(min-width:640px) 360px, 90vw" className="object-cover" style={{ objectPosition: afterPartyArt(party.id).pos }} />
        <div className="absolute inset-0 bg-gradient-to-t from-surface/80 to-transparent" aria-hidden />
        <div className="absolute left-3 top-3 flex gap-1.5">
          <Tag color="#080808">{tu("afterParty")}</Tag>
          {party.isDemo ? <DemoBadge className="bg-ink/80" /> : <Tag color="#B6F05C" dark>{tu("yours")}</Tag>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-xl uppercase leading-none">{party.name}</h3>
        {main && <div className="text-[13px] text-mute">{tu("after")} <Link className="font-semibold text-cream underline decoration-acid underline-offset-2" href={`/events/${main.id}`}>{main.name}</Link></div>}
        <ul className="space-y-1 text-[13px]">
          <li className="flex items-center gap-1.5"><MapPin className="size-3.5 text-mute" aria-hidden />{party.venueName}, {party.city}</li>
          <li className="flex items-center gap-1.5"><Clock className="size-3.5 text-mute" aria-hidden />{fmtDate(party.startsAt, { month: "short", day: "numeric" })} · {fmtTime(party.startsAt)}</li>
          <li className="flex items-center gap-1.5"><Ticket className="size-3.5 text-mute" aria-hidden />{money(party.price)} · <span className={low ? "font-bold text-coral" : ""}>{tu("seatsleftLeft", { seatsLeft: party.seatsLeft })}</span></li>
        </ul>
        <Link href={`/after-party/${party.id}`} className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cream font-extrabold uppercase text-ink hover:bg-white">
          {tu("viewDetails")} <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
