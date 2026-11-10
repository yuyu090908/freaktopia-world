"use client";

import { Tx } from "@/components/i18n/Tx";

import { useTranslations } from "next-intl";
import { useState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin, Star, Users, Check, MessageSquare, Sparkles } from "lucide-react";
import { getVenue, EVENTS } from "@/lib/data";
import { toast, useDemo, useHydrated } from "@/lib/store";
import { VenueArt } from "@/components/art/Scenes";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button, ButtonLink, Card, DemoBadge, DemoNotice, Stat, Tag } from "@/components/ui/primitives";
import { Field, Input, Textarea } from "@/components/forms/Fields";
import { ErrorState, LoadingSkeleton } from "@/components/ui/States";
import { cn, money } from "@/lib/utils";

export function VenueDetail({ id }: { id: string }) {
  const tu = useTranslations("venues");
  const ok = useHydrated();
  const mine = useDemo((s) => s.venues.find((v) => v.id === id));
  const venue = getVenue(id) ?? mine;
  const [date, setDate] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [hours, setHours] = useState(8);
  const [msg, setMsg] = useState("");
  if (!venue) return ok ? <ErrorState title={tu("venueNotFound")} body={tu("text4")} retry={<ButtonLink href="/venues">{tu("allVenues")}</ButtonLink>} /> : <LoadingSkeleton variant="page" />;
  const events = EVENTS.filter((e) => e.venueId === venue.id);
  const days = venue.availableDates.slice(0, 21);

  return (
    <div className="mx-auto max-w-5xl md:px-6 md:pt-6">
      <div className="relative aspect-[5/3] overflow-hidden md:aspect-[5/2] md:rounded-[32px]">
        {venue.photos?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={venue.photos[0]} alt={`${venue.name}`} className="h-full w-full object-cover" />
        ) : (
          <VenueArt id={venue.id} palette={venue.palette} className="h-full w-full" label={tu("illustrationOf", { name: venue.name })} />
        )}
        {venue.isDemo ? <DemoBadge label={tu("sampleVenue")} className="absolute right-4 top-4 bg-ink/85" /> : <Tag color="#B6F05C" dark className="absolute right-4 top-4">{tu("yourListing")}</Tag>}
      </div>
      {venue.photos && venue.photos.length > 1 && (
        <div className="rail mt-3 md:!px-0">
          {venue.photos.slice(1).map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={p} alt={tu("photoNOf", { name: venue.name, n: i + 2 })} className="h-24 w-36 rounded-2xl object-cover" />
          ))}
        </div>
      )}
      <div className="px-4 pt-5 md:px-0">
        <h1 className="text-[40px] uppercase sm:text-6xl">{venue.name}</h1>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-mute">
          <span className="inline-flex items-center gap-1"><MapPin className="size-4" aria-hidden />{venue.address || venue.city}</span>
          {venue.rating > 0 && <span className="inline-flex items-center gap-1"><Star className="size-4 fill-orange text-orange" aria-hidden />{venue.rating}</span>}
        </div>
        <p className="mt-3 text-cream/85">{venue.description}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label={tu("capacity")} value={venue.capacity.toLocaleString("en-US")} />
          <Stat label={tu("perHour")} value={money(venue.hourlyRate)} accent="#B6F05C" />
          <Stat label={tu("freeDays")} value={venue.availableDates.length} accent="#55BCEB" />
        </div>

        <h2 className="mt-8 text-3xl uppercase">{tu("equipmentFacilities")}</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {venue.amenities.map((a) => <li key={a} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-sm font-semibold"><Check className="size-4 text-acid" aria-hidden /><Tx>{a}</Tx></li>)}
        </ul>

        <h2 className="mt-8 text-3xl uppercase">{tu("availability")}</h2>
        <p className="mt-1 text-sm text-mute">{tu("text5")}</p>
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7" role="radiogroup" aria-label={tu("availableDates")}>
          {days.map((d) => {
            const dt = new Date(d + "T00:00:00Z");
            return (
              <button key={d} type="button" role="radio" aria-checked={date === d} onClick={() => setDate(d)} className={cn("flex min-h-16 flex-col items-center justify-center rounded-2xl border-2", date === d ? "border-acid bg-acid text-ink" : "border-line bg-surface")}>
                <span className="text-[10px] font-bold uppercase">{dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</span>
                <span className="font-display text-lg leading-none">{dt.getUTCDate()}</span>
                <span className="text-[10px] font-bold uppercase">{dt.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}</span>
              </button>
            );
          })}
          {!days.length && <p className="col-span-full text-sm text-mute">{tu("noDatesListedYet")}</p>}
        </div>

        {events.length > 0 && (
          <>
            <h2 className="mt-8 text-3xl uppercase">{tu("eventsHere")}</h2>
            <ul className="mt-3 space-y-2">
              {events.map((e) => (
                <li key={e.id}><Link href={`/events/${e.id}`} className="flex min-h-12 items-center justify-between rounded-2xl border border-line bg-surface px-4 font-bold hover:border-cream/30">{e.name}<CalendarDays className="size-4 text-mute" aria-hidden /></Link></li>
              ))}
            </ul>
          </>
        )}

        <Card className="mt-8 border-acid/50 p-4" data-testid="venue-stage-designer">
          <div className="flex items-center gap-2 font-bold"><Sparkles className="size-4 text-acid" aria-hidden /> {tu("aiStageDesigner")}</div>
          <p className="mt-1 text-sm text-mute">{tu("designAStageOverThis")}</p>
          {(() => {
            const target = events.find((e) => e.status !== "ended");
            return (
              <Link href={target ? `/dao/${target.id}/stage-designer` : "/dao"} className="mt-2 inline-flex min-h-11 items-center font-bold text-acid">
                {target ? tu("openDesignerForName", { name: target.name }) : tu("pickAnEventDao")}
              </Link>
            );
          })()}
        </Card>

        <Card className="mt-4 p-4">
          <div className="flex items-center gap-2 font-bold"><Users className="size-4 text-purple" aria-hidden /> {tu("firstEvent")}</div>
          <p className="mt-1 text-sm text-mute">{tu("ai")}</p>
          <Link href={`/venues/planner?venue=${venue.id}`} className="mt-2 inline-flex min-h-11 items-center font-bold text-purple">{tu("planAnEventHere")}</Link>
        </Card>
      </div>

      <div className="h-24" aria-hidden />
      <div className="sticky-cta fixed inset-x-0 z-40 border-t border-purple/40 bg-ink px-4 py-3 shadow-[0_-10px_30px_-12px_rgba(162,118,233,0.5)]">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase text-mute">{date ? new Date(date + "T00:00:00Z").toDateString() : tu("pickADate")}</div>
            <div className="font-display text-xl">{money(venue.hourlyRate)}<span className="text-sm text-mute"> /hour</span></div>
          </div>
          <Button onClick={() => (date ? setSheet(true) : toast({ title: tu("pickADateFirst"), body: tu("chooseAnAvailableDateAbove") }))}>
            <MessageSquare className="size-4" aria-hidden /> {tu("request")}
          </Button>
        </div>
      </div>

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title={tu("bookingRequest")} footer={
        <Button className="mb-1 w-full" onClick={() => { setSheet(false); toast({ title: tu("requestSavedDemo"), body: tu("requestBodyDemo", { venue: venue.name, date: date ?? "" }), tone: "success" }); }}>{tu("sendRequestDemo")}</Button>
      }>
        <div className="space-y-4">
          <p className="text-sm"><strong>{venue.name}</strong> · {date}</p>
          <Field id="hrs" label={tu("hours")}><Input id="hrs" type="number" inputMode="numeric" min={1} max={24} value={hours} onChange={(e) => setHours(Math.max(1, Math.min(24, +e.target.value || 1)))} /></Field>
          <div className="flex justify-between rounded-2xl bg-surface-2 p-3 font-bold"><span>{tu("estimatedRental")}</span><span>{money(hours * venue.hourlyRate)}</span></div>
          <Field id="vmsg" label={tu("message")} optional><Textarea id="vmsg" value={msg} onChange={(e) => setMsg(e.target.value)} /></Field>
          <DemoNotice>{tu("noBookingIsMadeAnd")}</DemoNotice>
        </div>
      </BottomSheet>
    </div>
  );
}
