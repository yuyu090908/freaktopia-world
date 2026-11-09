"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin, Star, Users, Check, MessageSquare } from "lucide-react";
import { getVenue, EVENTS } from "@/lib/data";
import { toast, useDemo, useHydrated } from "@/lib/store";
import { VenueArt } from "@/components/art/Scenes";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button, ButtonLink, Card, DemoBadge, DemoNotice, Stat, Tag } from "@/components/ui/primitives";
import { Field, Input, Textarea } from "@/components/forms/Fields";
import { ErrorState, LoadingSkeleton } from "@/components/ui/States";
import { cn, money } from "@/lib/utils";

export function VenueDetail({ id }: { id: string }) {
  const ok = useHydrated();
  const mine = useDemo((s) => s.venues.find((v) => v.id === id));
  const venue = getVenue(id) ?? mine;
  const [date, setDate] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [hours, setHours] = useState(8);
  const [msg, setMsg] = useState("");
  if (!venue) return ok ? <ErrorState title="Venue not found" body="この会場は見つかりませんでした。" retry={<ButtonLink href="/venues">All venues</ButtonLink>} /> : <LoadingSkeleton variant="page" />;
  const events = EVENTS.filter((e) => e.venueId === venue.id);
  const days = venue.availableDates.slice(0, 21);

  return (
    <div className="mx-auto max-w-5xl md:px-6 md:pt-6">
      <div className="relative aspect-[5/3] overflow-hidden md:aspect-[5/2] md:rounded-[32px]">
        {venue.photos?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={venue.photos[0]} alt={`${venue.name}`} className="h-full w-full object-cover" />
        ) : (
          <VenueArt id={venue.id} palette={venue.palette} className="h-full w-full" label={`${venue.name} illustration`} />
        )}
        {venue.isDemo ? <DemoBadge label="Sample venue" className="absolute right-4 top-4 bg-ink/85" /> : <Tag color="#B6F05C" dark className="absolute right-4 top-4">Your listing</Tag>}
      </div>
      {venue.photos && venue.photos.length > 1 && (
        <div className="rail mt-3 md:!px-0">
          {venue.photos.slice(1).map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={p} alt={`${venue.name} photo ${i + 2}`} className="h-24 w-36 rounded-2xl object-cover" />
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
          <Stat label="Capacity" value={venue.capacity.toLocaleString("en-US")} />
          <Stat label="Per hour" value={money(venue.hourlyRate)} accent="#B6F05C" />
          <Stat label="Free days" value={venue.availableDates.length} accent="#55BCEB" />
        </div>

        <h2 className="mt-8 text-3xl uppercase">Equipment & facilities</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {venue.amenities.map((a) => <li key={a} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-sm font-semibold"><Check className="size-4 text-acid" aria-hidden />{a}</li>)}
        </ul>

        <h2 className="mt-8 text-3xl uppercase">Availability</h2>
        <p className="ja mt-1 text-sm text-mute">日付を選んで予約リクエスト（デモ）</p>
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7" role="radiogroup" aria-label="Available dates">
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
          {!days.length && <p className="col-span-full text-sm text-mute">No dates listed yet.</p>}
        </div>

        {events.length > 0 && (
          <>
            <h2 className="mt-8 text-3xl uppercase">Events here</h2>
            <ul className="mt-3 space-y-2">
              {events.map((e) => (
                <li key={e.id}><Link href={`/events/${e.id}`} className="flex min-h-12 items-center justify-between rounded-2xl border border-line bg-surface px-4 font-bold hover:border-cream/30">{e.name}<CalendarDays className="size-4 text-mute" aria-hidden /></Link></li>
              ))}
            </ul>
          </>
        )}

        <Card className="mt-8 p-4">
          <div className="flex items-center gap-2 font-bold"><Users className="size-4 text-purple" aria-hidden /> First event?</div>
          <p className="ja mt-1 text-sm text-mute">AIイベントプランナー（デモ）で、この会場に合う企画案を作れます。</p>
          <Link href={`/venues/planner?venue=${venue.id}`} className="mt-2 inline-flex min-h-11 items-center font-bold text-purple">Plan an event here →</Link>
        </Card>
      </div>

      <div className="h-24" aria-hidden />
      <div className="sticky-cta fixed inset-x-0 z-40 border-t border-line bg-ink/95 px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase text-mute">{date ? new Date(date + "T00:00:00Z").toDateString() : "Pick a date"}</div>
            <div className="font-display text-xl">{money(venue.hourlyRate)}<span className="text-sm text-mute"> /hour</span></div>
          </div>
          <Button onClick={() => (date ? setSheet(true) : toast({ title: "Pick a date first", body: "Choose an available date above." }))}>
            <MessageSquare className="size-4" aria-hidden /> Request
          </Button>
        </div>
      </div>

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Booking request" footer={
        <Button className="mb-1 w-full" onClick={() => { setSheet(false); toast({ title: "Request saved (demo)", body: `${venue.name} · ${date}. Nothing was sent.`, tone: "success" }); }}>Send request (demo)</Button>
      }>
        <div className="space-y-4">
          <p className="text-sm"><strong>{venue.name}</strong> · {date}</p>
          <Field id="hrs" label="Hours"><Input id="hrs" type="number" inputMode="numeric" min={1} max={24} value={hours} onChange={(e) => setHours(Math.max(1, Math.min(24, +e.target.value || 1)))} /></Field>
          <div className="flex justify-between rounded-2xl bg-surface-2 p-3 font-bold"><span>Estimated rental</span><span>{money(hours * venue.hourlyRate)}</span></div>
          <Field id="vmsg" label="Message" optional><Textarea id="vmsg" value={msg} onChange={(e) => setMsg(e.target.value)} /></Field>
          <DemoNotice>No booking is made and no message is sent in Phase 1.</DemoNotice>
        </div>
      </BottomSheet>
    </div>
  );
}
