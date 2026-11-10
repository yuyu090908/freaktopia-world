"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { CalendarCheck, Heart, Landmark, MapPin, Pause, Play, Trophy, Users, Radio, Gauge } from "lucide-react";
import type { DJ } from "@/lib/types";
import { Alien } from "@/components/art/Alien";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button, ButtonLink, Card, DemoBadge, DemoNotice, Stat, Tag } from "@/components/ui/primitives";
import { Field, Input, Textarea } from "@/components/forms/Fields";
import { EVENTS } from "@/lib/data";
import { grantXp, toast, uid, useDemo } from "@/lib/store";
import { compact, money } from "@/lib/utils";
import { DjOffer } from "@/components/ops/DjOffer";

export function DJProfile({ dj }: { dj: DJ }) {
  const tu = useTranslations("djs");
  const fav = useDemo((s) => s.favorites.includes(dj.id));
  const toggle = useDemo((s) => s.toggleFavorite);
  const addBooking = useDemo((s) => s.addBooking);
  const [playing, setPlaying] = useState<number | null>(null);
  const [book, setBook] = useState(false);
  const [form, setForm] = useState({ eventName: "", date: "", budget: dj.bookingFrom, message: "" });
  const [err, setErr] = useState<string | null>(null);
  const upcoming = EVENTS.filter((e) => e.lineup.includes(dj.id));

  const follow = () => {
    const on = toggle(dj.id);
    toast({ title: on ? tu("followingName", { name: dj.name }) : tu("unfollowedName", { name: dj.name }), tone: on ? "success" : "default" });
    if (on) grantXp(10, tu("xpFollowedADj"));
  };

  const submitBooking = () => {
    if (!form.eventName.trim() || !form.date) {
      setErr("Add an event name and a date.");
      return;
    }
    addBooking({ id: uid("bk"), djId: dj.id, ...form, createdAt: new Date().toISOString() });
    setBook(false);
    setErr(null);
    toast({ title: tu("bookingRequestSaved"), body: tu("demoRequestToNameNo", { name: dj.name }), tone: "success" });
  };

  return (
    <div className="mx-auto max-w-5xl md:px-6">
      <section className="md:grid md:grid-cols-[380px_1fr] md:gap-8 md:pt-6" aria-labelledby="dj-name">
        <div className="relative aspect-square overflow-hidden md:rounded-[32px] md:border-[3px] md:border-ink" style={{ background: dj.look.accent }}>
          <div className="halftone absolute inset-0" aria-hidden />
          <Alien look={dj.look} className="relative mx-auto h-full w-[82%] pt-6" title={tu("nameAlienAvatar", { name: dj.name })} bob />
          <span className="absolute left-4 top-4 rounded-full border-[3px] border-ink bg-cream px-3 py-1 font-display text-ink">{tu("rankRank", { rank: dj.rank })}</span>
          <DemoBadge label={tu("sampleDj")} className="absolute right-4 top-4 bg-ink/85" />
        </div>
        <div className="px-4 pt-5 md:px-0">
          <h1 id="dj-name" className="text-[42px] uppercase sm:text-6xl">{dj.name}</h1>
          <div className="mt-2 flex items-center gap-1.5 text-mute"><MapPin className="size-4" aria-hidden />{dj.city}, {dj.country}</div>
          <div className="mt-3 flex flex-wrap gap-1.5">{dj.genres.map((g) => <Tag key={g}>{g}</Tag>)}</div>
          <p className="mt-4 leading-relaxed text-cream/85">{dj.bio}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label="BPM" value={`${dj.bpm[0]}–${dj.bpm[1]}`} accent="#B6F05C" />
            <Stat label={tu("followers")} value={compact(dj.followers + (fav ? 1 : 0))} />
            <Stat label={tu("votes")} value={compact(dj.votes)} accent="#FFAD5B" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <Button variant={fav ? "secondary" : "coral"} onClick={follow} aria-pressed={fav}>
              <Heart className={fav ? "size-4 fill-current" : "size-4"} aria-hidden /> {fav ? tu("following") : tu("follow")}
            </Button>
            <Button onClick={() => setBook(true)}><CalendarCheck className="size-4" aria-hidden /> {tu("booking")}</Button>
            <ButtonLink href={`/djs/${dj.id}/audition`} variant="ghost" className="col-span-2"><Radio className="size-4" aria-hidden /> {tu("watchAuditionDemo")}</ButtonLink>
            {(() => {
              const ev = EVENTS.find((e) => e.status !== "ended" && (e.auditionDjIds.includes(dj.id) || e.lineup.includes(dj.id))) ?? EVENTS.find((e) => e.status !== "ended");
              return ev ? (
                <ButtonLink href={`/dao/${ev.id}/proposals?new=1&dj=${dj.id}`} variant="purple" className="col-span-2" data-testid="dj-nominate">
                  <Landmark className="size-4" aria-hidden /> {tu("nominateInNameDao", { name: ev.name })}
                </ButtonLink>
              ) : null;
            })()}
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-8 px-4 md:grid-cols-2 md:px-0">
        <section aria-labelledby="mix-h">
          <h2 id="mix-h" className="text-3xl uppercase">{tu("mixSamples")}</h2>
          <ul className="mt-3 space-y-2">
            {dj.mixes.map((m, i) => (
              <li key={m.title} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                <button type="button" onClick={() => setPlaying(playing === i ? null : i)} aria-label={playing === i ? tu("pauseTitle", { title: m.title }) : tu("playTitleDemoPreview", { title: m.title })} className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-acid text-ink">
                  {playing === i ? <Pause className="size-5" /> : <Play className="size-5" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{m.title}</div>
                  <div className="text-xs text-mute">{tu("lengthCompactPlays", { length: m.length, compact: compact(m.plays) })}</div>
                  {playing === i && (
                    <div className="mt-1.5 flex h-5 items-end gap-0.5" aria-hidden>
                      {Array.from({ length: 28 }).map((_, k) => (
                        <span key={k} className="w-1 rounded-full bg-acid" style={{ height: `${20 + ((k * 37) % 80)}%`, animation: `bob ${0.6 + (k % 5) * 0.12}s ease-in-out infinite` }} />
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {playing !== null && <p className="mt-2 text-xs text-orange" role="status">{tu("visualPreviewOnlyAudioStreaming")}</p>}
        </section>

        <section aria-labelledby="gig-h">
          <h2 id="gig-h" className="text-3xl uppercase">{tu("appearances")}</h2>
          <ul className="mt-3 space-y-2">
            {upcoming.map((e) => (
              <li key={e.id}>
                <Link href={`/events/${e.id}`} className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-2 hover:border-cream/30">
                  <span className="min-w-0"><span className="block truncate font-bold">{e.name}</span><span className="text-xs text-mute">{tu("cityUpcoming", { city: e.city })}</span></span>
                  <Tag color="#B6F05C" dark>{tu("booked")}</Tag>
                </Link>
              </li>
            ))}
            {dj.gigs.map((g) => (
              <li key={g} className="flex min-h-12 items-center gap-2 rounded-2xl bg-surface-2 px-4 text-sm"><Trophy className="size-4 text-orange" aria-hidden />{g}</li>
            ))}
          </ul>
          <Card className="mt-4 flex items-center gap-3 p-4">
            <Gauge className="size-6 text-blue" aria-hidden />
            <div className="text-sm">{tu("bookingFrom")} <strong>{money(dj.bookingFrom)}</strong> {tu("perSetDemoRate")}</div>
          </Card>
        </section>
      </div>

      <BottomSheet open={book} onClose={() => setBook(false)} title={tu("bookingRequest")} footer={<Button className="mb-1 w-full" onClick={submitBooking}>{tu("sendRequestDemo")}</Button>}>
        <div className="space-y-4">
          <DjOffer djId={dj.id} budget={dj.bookingFrom} />
          <Field id="bk-event" label={tu("eventName")} error={err && !form.eventName ? err : undefined}>
            <Input id="bk-event" value={form.eventName} onChange={(e) => setForm({ ...form, eventName: e.target.value })} />
          </Field>
          <Field id="bk-date" label={tu("date")}>
            <Input id="bk-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field id="bk-budget" label={tu("budgetUsd")}>
            <Input id="bk-budget" type="number" inputMode="numeric" value={form.budget} onChange={(e) => setForm({ ...form, budget: +e.target.value })} />
          </Field>
          <Field id="bk-msg" label={tu("message")} optional>
            <Textarea id="bk-msg" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </Field>
          {err && <p role="alert" className="text-sm font-semibold text-coral">{err}</p>}
          <DemoNotice>{tu("theRequestIsSavedIn")}</DemoNotice>
          <div className="flex items-center gap-2 text-xs text-mute"><Users className="size-3.5" aria-hidden /> {tu("typicalReplyTime2Days")}</div>
        </div>
      </BottomSheet>
    </div>
  );
}
