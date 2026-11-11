"use client";

import { Tx } from "@/components/i18n/Tx";

import { useTranslations } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import { afterPartyArt, coverFor, type ArtPick, type CoverHint } from "@/lib/art";
import { ArrowRight, CalendarDays, Heart, MapPin, Users, Speaker, Clock, Ticket } from "lucide-react";
import type { AfterParty, DJ, FreakEvent, Venue } from "@/lib/types";
import { ExploreArt, VenueArt, type ExploreKind } from "@/components/art/Scenes";
import { Alien } from "@/components/art/Alien";
import { EventLevelBadge } from "@/components/event/EventLevelBadge";
import { DemoBadge, Tag } from "@/components/ui/primitives";
import { useDemo, useEventStats } from "@/lib/store";
import { cn, compact, fmtDate, fmtTime, money } from "@/lib/utils";
import { getEvent, getVenue } from "@/lib/data";
import { displayStatus, fromPrice, showsSupport } from "@/lib/event-status";
import { StatusBadge } from "@/components/ui/StatusBadge";

/* ---------------- City card (official city poster + live numbers in HTML) ---------------- */
export function CityCard({ art, href, count, genres, labels, className }: { art: import("@/lib/art").CityArt; href: string; count: number; genres: string[]; labels: { theme: string; events: string; none: string; cta: string; noneCta: string }; className?: string }) {
  return (
    <Link
      href={href}
      data-testid="city-card"
      data-city={art.id}
      className={cn("group flex flex-col overflow-hidden rounded-[24px] border-2 bg-surface transition-transform active:scale-[0.98]", className)}
      style={{ borderColor: `${art.accent}99` }}
    >
      <span className="relative block aspect-[4/5] overflow-hidden">
        <Image src={art.poster} alt={`${art.city}: ${labels.theme}`} fill sizes="(min-width:1024px) 230px, (min-width:640px) 30vw, 62vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
      </span>
      <span className="flex flex-1 flex-col gap-1 p-3">
        <span className="font-display text-lg uppercase leading-none">{art.city}</span>
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: art.accent }}>{labels.theme}</span>
        <span className="mt-1 text-[13px] font-semibold text-cream/90">{count ? labels.events : labels.none}</span>
        {genres.length > 0 && <span className="truncate text-[12px] text-mute">{genres.join(" / ")}</span>}
        <span className="mt-auto inline-flex min-h-10 items-center gap-1 pt-1 text-[13px] font-extrabold uppercase text-acid">
          {count ? labels.cta : labels.noneCta} <ArrowRight className="size-4" aria-hidden />
        </span>
      </span>
    </Link>
  );
}

/* ---------------- Explore card ---------------- */
export function IllustratedCard({ href, title, sub, kind, color, art, big = false, feature = false }: { href: string; title: string; sub: string; kind: ExploreKind; color: string; art?: ArtPick; big?: boolean; feature?: boolean }) {
  if (art) {
    return (
      <Link
        href={href}
        className={cn(
          "group relative flex flex-col justify-end overflow-hidden rounded-[24px] border-2 text-cream transition-transform active:scale-[0.98]",
          feature ? "col-span-2 aspect-[8/5] sm:aspect-[8/4.4]" : "aspect-[4/5] sm:aspect-[4/4.4]",
          big ? "w-[72vw] max-w-[300px] sm:w-[280px]" : "w-full",
        )}
        style={{ borderColor: color, boxShadow: `0 0 22px -8px ${color}` }}
      >
        <Image src={art.src} alt="" fill sizes={feature ? "(min-width:1024px) 540px, (min-width:640px) 66vw, 100vw" : "(min-width:1024px) 260px, (min-width:640px) 33vw, 50vw"} className="object-cover transition-transform duration-500 group-hover:scale-105" style={{ objectPosition: art.pos }} />
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
export function EventCover({ id, sizes, priority = false, className, hint, art }: { id: string; sizes: string; priority?: boolean; className?: string; hint?: CoverHint; art?: ArtPick }) {
  // Rule: organizer upload → city poster → genre art → shared scene (see lib/art.ts coverFor).
  const ev = hint ? null : getEvent(id);
  const a = art ?? coverFor(id, hint ?? (ev ? { city: ev.city, genres: ev.genres } : {}));
  return (
    <Image src={a.src} alt="" fill sizes={sizes} priority={priority} className={cn("object-cover", className)} style={{ objectPosition: a.pos }} />
  );
}

/* ---------------- Event card ----------------
 * Order (docs/DESIGN_SYSTEM.md): image → name → date → city/venue → genres → status → price or support → details.
 * The whole card is one link (the title's stretched link), so the tap target is the card, not a 34px line of text.
 * Price only when tickets are on sale; the support rate only while the event collects support. */
function EventFacts({ event, compactView = false }: { event: FreakEvent; compactView?: boolean }) {
  const tu = useTranslations("ui");
  const s = useEventStats(event);
  const status = displayStatus(event);
  const price = fromPrice(event);
  const venue = event.status === "funding" ? null : getVenue(event.venueId)?.name ?? null;
  return (
    <>
      <div className="mt-1.5 flex flex-col gap-0.5 text-[14px] text-mute">
        <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4 shrink-0" aria-hidden /><time dateTime={event.startsAt}>{fmtDate(event.startsAt, { month: "short", day: "numeric", year: "numeric" })}</time></span>
        <span className="inline-flex min-w-0 items-center gap-1.5"><MapPin className="size-4 shrink-0" aria-hidden /><span className="truncate">{event.city}{venue ? ` · ${venue}` : ""}</span></span>
      </div>
      {!compactView && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {event.genres.map((g) => <Tag key={g}>{g}</Tag>)}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={status} />
        {event.djRecruiting && status !== "completed" && <span className="inline-flex min-h-6 items-center rounded-full border border-purple/70 px-2.5 text-[12px] font-extrabold uppercase text-purple">{tu("djsWanted")}</span>}
        <DemoBadge />
      </div>
      {price != null && (
        <div className="mt-2 text-[15px] font-extrabold" data-testid="card-price">{tu("fromPrice", { price: money(price) })}</div>
      )}
      {showsSupport(event) && (
        <div className="mt-2" data-testid="card-support">
          <div className="flex items-center justify-between gap-2 text-[13px]">
            <span className="inline-flex items-center gap-1 font-semibold"><Users className="size-3.5" aria-hidden />{tu("supportersCount", { count: compact(s.supporters) })}</span>
            <span className="font-bold text-blue">{tu("roundFunded", { round: Math.min(999, Math.round((s.raised / event.goal) * 100)) })}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface" role="presentation">
            <div className="h-full rounded-full bg-blue" style={{ width: `${Math.min(100, (s.raised / event.goal) * 100)}%` }} />
          </div>
        </div>
      )}
    </>
  );
}

export function EventCard({ event, className, wide = false, art }: { event: FreakEvent; className?: string; wide?: boolean; art?: ArtPick }) {
  const tu = useTranslations("ui");
  const s = useEventStats(event);
  return (
    <article data-testid="event-card" className={cn("group relative flex flex-col overflow-hidden rounded-[20px] border border-line bg-surface-2 transition-colors hover:border-cream/40 focus-within:border-acid", wide ? "w-full" : "w-[80vw] max-w-[330px] sm:w-[320px]", className)}>
      <div className="relative aspect-video overflow-hidden" aria-hidden="true">
        <EventCover id={event.id} art={art} sizes="(min-width:1024px) 380px, (min-width:640px) 320px, 80vw" className="transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute left-3 top-3"><EventLevelBadge level={s.level} long /></div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-[18px] uppercase leading-tight">
          <Link href={`/events/${event.id}`} className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline">
            {event.name}
          </Link>
        </h3>
        <EventFacts event={event} />
        <span className="mt-auto inline-flex min-h-11 items-center gap-1 pt-3 text-[14px] font-extrabold uppercase text-acid" aria-hidden>
          {tu("viewDetails")} <ArrowRight className="size-4" />
        </span>
      </div>
    </article>
  );
}

/* ---------------- Compact event row (mobile list) ---------------- */
export function EventRow({ event, art }: { event: FreakEvent; art?: ArtPick }) {
  return (
    <article data-testid="event-row" className="relative flex gap-3 rounded-[20px] border border-line bg-surface-2 p-3 transition-colors hover:border-cream/40 focus-within:border-acid">
      <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-2xl sm:w-28" aria-hidden="true">
        <EventCover id={event.id} art={art} sizes="112px" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[16px] uppercase leading-tight">
          <Link href={`/events/${event.id}`} className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline">{event.name}</Link>
        </h3>
        <EventFacts event={event} compactView />
      </div>
    </article>
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
    <article className={cn("relative flex w-[62vw] max-w-[240px] flex-col overflow-hidden rounded-[20px] border border-line bg-surface-2 focus-within:border-acid sm:w-[230px]", className)}>
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
          <Link href={`/djs/${dj.id}`} className="outline-none after:absolute after:inset-0 after:content-[''] hover:text-acid focus-visible:underline">{dj.name}</Link>
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
