"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Heart, MapPin, Users, Speaker, Clock, Ticket } from "lucide-react";
import type { AfterParty, DJ, FreakEvent, Venue } from "@/lib/types";
import { EventArt, ExploreArt, VenueArt, type ExploreKind } from "@/components/art/Scenes";
import { Alien } from "@/components/art/Alien";
import { EventLevelBadge } from "@/components/event/EventLevelBadge";
import { EventProgress } from "@/components/event/EventProgress";
import { DemoBadge, Tag } from "@/components/ui/primitives";
import { useDemo, useEventStats } from "@/lib/store";
import { cn, compact, fmtDate, fmtTime, money } from "@/lib/utils";
import { getEvent } from "@/lib/data";

/* ---------------- Explore card ---------------- */
export function IllustratedCard({ href, title, sub, kind, color, big = false }: { href: string; title: string; sub: string; kind: ExploreKind; color: string; big?: boolean }) {
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

/* ---------------- Event card ---------------- */
export function EventCard({ event, className, wide = false }: { event: FreakEvent; className?: string; wide?: boolean }) {
  const s = useEventStats(event);
  return (
    <article className={cn("flex flex-col overflow-hidden rounded-[26px] border border-line bg-surface", wide ? "w-full" : "w-[80vw] max-w-[330px] sm:w-[320px]", className)}>
      <Link href={`/events/${event.id}`} className="relative block aspect-[5/3] overflow-hidden" aria-hidden="true" tabIndex={-1}>
        <EventArt id={event.id} palette={event.palette} className="h-full w-full" label={`${event.name} cover art`} />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <EventLevelBadge level={s.level} long />
          {event.status === "live" && <Tag color="#FF625C" dark>● Live now</Tag>}
        </div>
        <DemoBadge className="absolute right-3 top-3 bg-ink/80" />
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
          {event.djRecruiting && <Tag color="#A276E9" dark>DJs wanted</Tag>}
        </div>
        <EventProgress supporters={s.supporters} raised={s.raised} goal={event.goal} compactView />
        <Link href={`/events/${event.id}`} className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cream font-extrabold uppercase text-ink hover:bg-white">
          View details <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

/* ---------------- Compact event row ---------------- */
export function EventRow({ event }: { event: FreakEvent }) {
  const s = useEventStats(event);
  return (
    <Link href={`/events/${event.id}`} className="flex gap-3 rounded-3xl border border-line bg-surface p-3 hover:border-cream/30">
      <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-2xl sm:w-28">
        <EventArt id={event.id} palette={event.palette} className="h-full w-full" />
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <EventLevelBadge level={s.level} />
          {event.status === "live" && <Tag color="#FF625C" dark>● Live</Tag>}
          {event.djRecruiting && <Tag color="#A276E9" dark>DJs wanted</Tag>}
        </div>
        <h3 className="mt-2 truncate text-lg uppercase leading-none">{event.name}</h3>
        <div className="mt-1.5 truncate text-[13px] text-mute">
          {event.city} · {fmtDate(event.startsAt)} · {event.genres.join(" / ")}
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-[13px] font-semibold">
          <span className="inline-flex items-center gap-1"><Users className="size-3.5" aria-hidden />{compact(s.supporters)}</span>
          <span className="text-mute">{Math.round((s.raised / event.goal) * 100)}% funded</span>
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
  const fav = useDemo((s) => s.favorites.includes(dj.id));
  return (
    <article className={cn("relative flex w-[62vw] max-w-[240px] flex-col overflow-hidden rounded-[26px] border border-line bg-surface sm:w-[230px]", className)}>
      <Link href={`/djs/${dj.id}`} className="relative block aspect-square" style={{ background: dj.look.accent }} tabIndex={-1} aria-hidden="true">
        <div className="halftone absolute inset-0" aria-hidden />
        <Alien look={dj.look} className="relative mx-auto h-full w-[86%] pt-3" />
        <span className="absolute left-3 top-3 rounded-full border-2 border-ink bg-cream px-2 py-0.5 font-display text-sm text-ink">#{dj.rank}</span>
        {fav && (
          <span className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-ink text-coral" aria-label="Favorite">
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
        <div className="mt-3 text-[13px] font-semibold">{compact(dj.followers)} followers</div>
      </div>
    </article>
  );
}

/* ---------------- Venue card ---------------- */
export function VenueCard({ venue, className }: { venue: Venue; className?: string }) {
  return (
    <article className={cn("flex flex-col overflow-hidden rounded-[26px] border border-line bg-surface", className)}>
      <div className="relative aspect-[5/3]">
        {venue.photos?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={venue.photos[0]} alt={`${venue.name} photo`} className="h-full w-full object-cover" />
        ) : (
          <VenueArt id={venue.id} palette={venue.palette} className="h-full w-full" label={`${venue.name} illustration`} />
        )}
        {venue.isDemo ? <DemoBadge className="absolute right-3 top-3 bg-ink/80" /> : <Tag color="#B6F05C" dark className="absolute right-3 top-3">Your listing</Tag>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-xl uppercase leading-none">{venue.name}</h3>
        <div className="text-[13px] text-mute">{venue.city}{venue.country ? `, ${venue.country}` : ""}</div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-surface-2 p-2"><dt className="text-[10px] font-bold uppercase text-mute">Capacity</dt><dd className="font-display">{venue.capacity.toLocaleString("en-US")}</dd></div>
          <div className="rounded-xl bg-surface-2 p-2"><dt className="text-[10px] font-bold uppercase text-mute">Per hour</dt><dd className="font-display">{money(venue.hourlyRate)}</dd></div>
          <div className="rounded-xl bg-surface-2 p-2"><dt className="text-[10px] font-bold uppercase text-mute">Free days</dt><dd className="font-display">{venue.availableDates.length}</dd></div>
        </dl>
        <div className="flex flex-wrap gap-1.5">
          {venue.amenities.slice(0, 3).map((a) => (
            <span key={a} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold"><Speaker className="size-3" aria-hidden />{a}</span>
          ))}
          {venue.amenities.length > 3 && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold">+{venue.amenities.length - 3}</span>}
        </div>
        <Link href={`/venues/${venue.id}`} className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cream font-extrabold uppercase text-ink hover:bg-white">
          View venue <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

/* ---------------- After party card ---------------- */
export function AfterPartyCard({ party, className }: { party: AfterParty; className?: string }) {
  const main = getEvent(party.eventId);
  const low = party.seatsLeft <= 15;
  return (
    <article className={cn("flex flex-col overflow-hidden rounded-[26px] border border-line bg-surface", className)}>
      <div className="relative h-28 overflow-hidden" style={{ background: party.palette[0] }}>
        <div className="halftone absolute inset-0" aria-hidden />
        <svg viewBox="0 0 300 110" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
          <circle cx="250" cy="40" r="34" fill="#F5F2EA" stroke="#080808" strokeWidth="5" />
          <circle cx="266" cy="30" r="30" fill={party.palette[0]} />
          <path d="M0 110 Q60 60 120 92 T240 80 T300 90 V110 Z" fill={party.palette[1]} stroke="#080808" strokeWidth="5" />
          <path d="M40 30 l4 -10 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 Z" fill="#080808" />
        </svg>
        <div className="absolute left-3 top-3 flex gap-1.5">
          <Tag color="#080808">After party</Tag>
          {party.isDemo ? <DemoBadge className="bg-ink/80" /> : <Tag color="#B6F05C" dark>Yours</Tag>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-xl uppercase leading-none">{party.name}</h3>
        {main && <div className="text-[13px] text-mute">After <Link className="font-semibold text-cream underline decoration-acid underline-offset-2" href={`/events/${main.id}`}>{main.name}</Link></div>}
        <ul className="space-y-1 text-[13px]">
          <li className="flex items-center gap-1.5"><MapPin className="size-3.5 text-mute" aria-hidden />{party.venueName}, {party.city}</li>
          <li className="flex items-center gap-1.5"><Clock className="size-3.5 text-mute" aria-hidden />{fmtDate(party.startsAt, { month: "short", day: "numeric" })} · {fmtTime(party.startsAt)}</li>
          <li className="flex items-center gap-1.5"><Ticket className="size-3.5 text-mute" aria-hidden />{money(party.price)} · <span className={low ? "font-bold text-coral" : ""}>{party.seatsLeft} left</span></li>
        </ul>
        <Link href={`/after-party/${party.id}`} className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cream font-extrabold uppercase text-ink hover:bg-white">
          View details <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
