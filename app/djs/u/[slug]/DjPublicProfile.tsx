"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { AlertTriangle, CalendarDays, ExternalLink, MapPin, Mic2, Play, Send } from "lucide-react";
import { AlienAvatar } from "@/components/cards/Cards";
import { Button } from "@/components/ui/primitives";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Tabs } from "@/components/ui/Tabs";
import { Field, Select, Textarea, Input, ToggleRow } from "@/components/forms/Fields";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { usePlayerMaybe } from "@/components/music/PlayerProvider";
import { TrackRow, ShareButton, toPlayer } from "@/components/music/TrackActions";
import { BOOKING_COLORS, imageUrl, useMusic, useMusicPost, type TrackDto } from "@/components/music/shared";
import { TermsForm } from "@/app/profile/dj/Bookings";
import { useAuth } from "@/lib/auth/client";
import type { AlienLook } from "@/lib/types";
import type { BookingTerms } from "@/lib/music/types";

export interface ProfileRes {
  profile: {
    userId: string; slug: string; stageName: string; bio: string; country: string; city: string; genres: string[]; yearsExperience: number; equipment: string; regions: string[];
    bookingStatus: "open" | "limited" | "closed"; links: { label: string; url: string }[]; pastEvents: string[]; imageId: string | null; look: AlienLook | null; createdAt: string; contactPolicy: string;
  };
  tracks: TrackDto[];
  playlists: { id: string; title: string; description: string; visibility: string; count: number; coverId: string | null }[];
  availability: { day: string; status: "available" | "tentative" | "unavailable" }[];
  gigs: { id: string; name: string; city: string; country: string; at: string }[];
  viewer: { isOwner: boolean; signedIn: boolean; organizer: boolean; canBook: boolean; canContact: boolean; events: { id: string; name: string; city: string; country: string; venue: string; startAt: string; endAt: string; genres: string[] }[] };
}

type Tab = "music" | "playlists" | "calendar" | "gigs" | "about";

export function DjPublicProfile({ slug, initial }: { slug: string; initial: ProfileRes | null }) {
  const t = useTranslations("music");
  const f = useFormatter();
  const href = useLocalHref();
  const player = usePlayerMaybe();
  const { data, error } = useMusic<ProfileRes>(`/api/music/djs/${encodeURIComponent(slug)}`, initial);
  const [tab, setTab] = useState<Tab>("music");
  const [sheet, setSheet] = useState<"booking" | "inquiry" | null>(null);
  if (error) return <p role="alert" className="p-6 text-center text-sm text-coral">{t("loadError")}</p>;
  if (!data) return <div className="m-4 h-60 animate-pulse rounded-3xl bg-surface" aria-busy="true" />;
  const p = data.profile;
  const img = imageUrl(p.imageId);
  const bc = BOOKING_COLORS[p.bookingStatus];
  return (
    <div className="mx-auto max-w-5xl pb-16 md:px-6">
      <header className="relative overflow-hidden px-4 pt-6 md:px-0" data-testid="dj-header">
        <div className="flex flex-wrap items-center gap-4">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt="" width={112} height={112} className="size-28 rounded-full border-[3px] border-acid object-cover" />
          ) : p.look ? (
            <AlienAvatar look={p.look} size={112} ring="#C1FF53" />
          ) : (
            <span className="inline-flex size-28 items-center justify-center rounded-full border-[3px] border-acid bg-surface"><Mic2 className="size-10 text-acid" aria-hidden /></span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold uppercase tracking-widest text-acid">{t("djKicker")}</p>
            <h1 className="font-display text-4xl uppercase leading-none md:text-6xl" data-testid="dj-name">{p.stageName}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mute">
              {(p.city || p.country) && <span><MapPin className="mr-1 inline size-4" aria-hidden />{[p.city, p.country].filter(Boolean).join(", ")}</span>}
              {p.genres.length > 0 && <span>{p.genres.join(" · ")}</span>}
            </p>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold uppercase" style={{ borderColor: bc, color: bc }} data-testid="booking-badge">
              <span className="size-2 rounded-full" style={{ background: bc }} aria-hidden />{t(`booking.${p.bookingStatus}`)}
            </span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {data.tracks.length > 0 && (
            <Button onClick={() => player?.play(data.tracks.map(toPlayer), 0)} data-testid="play-all"><Play className="size-4" aria-hidden /> {t("playAll")}</Button>
          )}
          {data.viewer.isOwner ? (
            <Link href={href("/profile/dj")} className="inline-flex min-h-11 items-center rounded-full border-2 border-line px-5 text-sm font-extrabold uppercase">{t("editInStudio")}</Link>
          ) : (
            <>
              {data.viewer.canBook && <Button variant="coral" onClick={() => setSheet("booking")} data-testid="request-booking"><CalendarDays className="size-4" aria-hidden /> {t("requestBooking")}</Button>}
              {data.viewer.canContact && <Button variant="secondary" onClick={() => setSheet("inquiry")} data-testid="contact-dj"><Send className="size-4" aria-hidden /> {t("contactDj")}</Button>}
              {!data.viewer.signedIn && <Link href={href(`/login?returnTo=${encodeURIComponent(`/djs/u/${p.slug}`)}`)} className="inline-flex min-h-11 items-center rounded-full border-2 border-line px-5 text-sm font-extrabold uppercase">{t("signInToBook")}</Link>}
              {data.viewer.signedIn && !data.viewer.canBook && !data.viewer.canContact && <p className="text-sm text-mute" data-testid="cannot-contact">{p.bookingStatus === "closed" ? t("notTakingBookings") : t("contactOrganizersOnly")}</p>}
            </>
          )}
          <ShareButton path={`/djs/u/${p.slug}`} title={p.stageName} />
        </div>
      </header>

      <div className="mt-6 px-4 md:px-0">
        <Tabs label={p.stageName} tabs={(["music", "playlists", "calendar", "gigs", "about"] as Tab[]).map((x) => ({ id: x, label: t(`ptab.${x}`) }))} active={tab} onChange={setTab}>
          {tab === "music" &&
            (data.tracks.length === 0 ? (
              <p className="text-sm text-mute">{t("noPublicTracks")}</p>
            ) : (
              <ul className="space-y-2" data-testid="dj-tracks">
                {data.tracks.map((tr, i) => <li key={tr.id}><TrackRow track={tr} list={data.tracks} index={i} hideOwner /></li>)}
              </ul>
            ))}
          {tab === "playlists" &&
            (data.playlists.length === 0 ? (
              <p className="text-sm text-mute">{t("noPlaylists")}</p>
            ) : (
              <ul className="grid gap-2 md:grid-cols-2">
                {data.playlists.map((pl) => (
                  <li key={pl.id}><Link href={href(`/music/playlists/${pl.id}`)} className="block rounded-2xl bg-surface-2 p-3 hover:outline hover:outline-acid"><b className="block truncate">{pl.title}</b><span className="text-xs text-mute">{t("nTracks", { n: pl.count })}</span></Link></li>
                ))}
              </ul>
            ))}
          {tab === "calendar" && <PublicCalendar days={data.availability} />}
          {tab === "gigs" && (
            <div className="space-y-4">
              <section>
                <h3 className="mb-2 text-sm font-extrabold uppercase">{t("confirmedGigs")}</h3>
                {data.gigs.length === 0 ? <p className="text-sm text-mute">{t("noGigs")}</p> : (
                  <ul className="space-y-2" data-testid="gigs">{data.gigs.map((g) => <li key={g.id} className="rounded-2xl bg-surface-2 p-3 text-sm"><b>{g.name}</b> · {g.city} · {f.dateTime(new Date(g.at), { dateStyle: "medium" })}</li>)}</ul>
                )}
              </section>
              {p.pastEvents.length > 0 && (
                <section>
                  <h3 className="mb-1 text-sm font-extrabold uppercase">{t("selfDeclaredPast")}</h3>
                  <p className="mb-2 text-xs text-mute">{t("selfDeclaredNote")}</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm">{p.pastEvents.map((e) => <li key={e}>{e}</li>)}</ul>
                </section>
              )}
            </div>
          )}
          {tab === "about" && (
            <div className="space-y-3 text-sm">
              {p.bio && <p className="whitespace-pre-wrap">{p.bio}</p>}
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-mute">{t("pYears")}</dt><dd>{p.yearsExperience}</dd>
                {p.equipment && (<><dt className="text-mute">{t("pEquipment")}</dt><dd>{p.equipment}</dd></>)}
                {p.regions.length > 0 && (<><dt className="text-mute">{t("pRegions")}</dt><dd>{p.regions.join(", ")}</dd></>)}
              </dl>
              {p.links.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {p.links.map((l) => <li key={l.url}><a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line px-4 font-bold"><ExternalLink className="size-4" aria-hidden />{l.label}</a></li>)}
                </ul>
              )}
            </div>
          )}
        </Tabs>
      </div>
      {sheet && <BookingSheet kind={sheet} slug={p.slug} stageName={p.stageName} events={data.viewer.events} onClose={() => setSheet(null)} />}
    </div>
  );
}

function PublicCalendar({ days }: { days: ProfileRes["availability"] }) {
  const t = useTranslations("music");
  const f = useFormatter();
  const shown = days.filter((d) => d.status !== "unavailable").slice(0, 60);
  return (
    <div>
      <p className="mb-2 text-xs text-mute">{t("publicCalendarNote")}</p>
      {shown.length === 0 ? <p className="text-sm text-mute">{t("noOpenDates")}</p> : (
        <ul className="flex flex-wrap gap-2" data-testid="public-days">
          {shown.map((d) => (
            <li key={d.day} className="rounded-full border px-3 py-1 text-xs font-bold" style={{ borderColor: d.status === "available" ? "#B6F05C" : "#FFAD5B", color: d.status === "available" ? "#B6F05C" : "#FFAD5B" }} data-status={d.status}>
              {f.dateTime(new Date(`${d.day}T12:00:00Z`), { month: "short", day: "numeric", weekday: "short", timeZone: "UTC" })} · {t(`day.${d.status}`)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BookingSheet({ kind, slug, stageName, events, onClose }: { kind: "booking" | "inquiry"; slug: string; stageName: string; events: ProfileRes["viewer"]["events"]; onClose: () => void }) {
  const t = useTranslations("music");
  const post = useMusicPost();
  const href = useLocalHref();
  const me = useAuth((s) => s.me);
  const start = new Date(Date.now() + 30 * 86_400_000);
  start.setUTCHours(22, 0, 0, 0);
  const [eventId, setEventId] = useState<string>(events[0]?.id ?? "");
  const [ev, setEv] = useState({ name: "", city: "", country: "", venue: "", genres: "" });
  const [listPublicly, setListPublicly] = useState(false);
  const [terms, setTerms] = useState<BookingTerms>({ feeAmount: 0, currency: "USD", performanceStart: start.toISOString(), performanceEnd: new Date(start.getTime() + 2 * 3_600_000).toISOString(), setMinutes: 120, travel: "", accommodation: "", equipment: "", notes: "" });
  const [message, setMessage] = useState("");
  const [conflicts, setConflicts] = useState<{ kind: string; day: string }[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Picking an existing event fills in its details (the server fills them again from the event itself).
  useEffect(() => {
    const e = events.find((x) => x.id === eventId);
    if (!e) return;
    setEv({ name: e.name, city: e.city, country: e.country, venue: e.venue, genres: e.genres.join(", ") });
    setTerms((x) => ({ ...x, performanceStart: e.startAt, performanceEnd: new Date(Math.min(Date.parse(e.endAt), Date.parse(e.startAt) + 2 * 3_600_000)).toISOString() }));
  }, [eventId, events]);
  useEffect(() => {
    if (kind !== "booking") return;
    const id = setTimeout(async () => {
      const r = await fetch(`/api/music/djs/${encodeURIComponent(slug)}/conflicts?start=${encodeURIComponent(terms.performanceStart)}&end=${encodeURIComponent(terms.performanceEnd)}`, { cache: "no-store" });
      if (r.ok) setConflicts((await r.json()).conflicts ?? []);
    }, 300);
    return () => clearTimeout(id);
  }, [kind, slug, terms.performanceStart, terms.performanceEnd]);
  const send = async () => {
    setBusy(true);
    const r = await post<{ booking: { id: string } }>("bookings", {
      kind, djSlug: slug, eventId: kind === "booking" && eventId ? eventId : null,
      event: { name: ev.name, city: ev.city, country: ev.country, venue: ev.venue, genres: ev.genres.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8), listPublicly },
      ...(kind === "booking" ? { terms } : {}),
      message: message.trim(), send: true,
    });
    setBusy(false);
    if (r) setDone(r.booking.id);
  };
  if (done)
    return (
      <BottomSheet open onClose={onClose} title={kind === "booking" ? t("requestBooking") : t("contactDj")}>
        <div className="space-y-3 text-center" data-testid="booking-sent">
          <p className="font-bold text-acid">{t("requestSent", { name: stageName })}</p>
          <p className="text-sm text-mute">{t("requestSentSub")}</p>
          <Link href={href(`/profile/dj?tab=bookings&b=${done}`)} className="inline-flex min-h-11 items-center font-bold text-acid underline">{t("openThread")}</Link>
        </div>
      </BottomSheet>
    );
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={kind === "booking" ? t("requestBookingTo", { name: stageName }) : t("contactDjTo", { name: stageName })}
      footer={<div className="flex justify-end"><Button disabled={busy || !message.trim() || (kind === "booking" && !ev.name.trim()) || !me?.user.emailVerified} onClick={() => void send()} data-testid="send-booking">{t("send")}</Button></div>}
    >
      <div className="space-y-3" data-testid="booking-form">
        {kind === "booking" && (
          <>
            {events.length > 0 && (
              <Field id="bk-ev" label={t("fromEvent")} hint={t("fromEventHint")}>
                <Select id="bk-ev" value={eventId} onChange={(e) => setEventId(e.target.value)} data-testid="bk-event">
                  {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  <option value="">{t("otherEvent")}</option>
                </Select>
              </Field>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <Field id="bk-name" label={t("eventName")}><Input id="bk-name" value={ev.name} maxLength={100} disabled={!!eventId} onChange={(e) => setEv({ ...ev, name: e.target.value })} data-testid="bk-name" /></Field>
              <Field id="bk-venue" label={t("venue")} optional><Input id="bk-venue" value={ev.venue} maxLength={100} disabled={!!eventId} onChange={(e) => setEv({ ...ev, venue: e.target.value })} /></Field>
              <Field id="bk-city" label={t("pCity")}><Input id="bk-city" value={ev.city} maxLength={60} disabled={!!eventId} onChange={(e) => setEv({ ...ev, city: e.target.value })} /></Field>
              <Field id="bk-country" label={t("pCountry")} optional><Input id="bk-country" value={ev.country} maxLength={60} disabled={!!eventId} onChange={(e) => setEv({ ...ev, country: e.target.value })} /></Field>
              <div className="md:col-span-2"><Field id="bk-genres" label={t("pGenres")} optional><Input id="bk-genres" value={ev.genres} maxLength={200} disabled={!!eventId} onChange={(e) => setEv({ ...ev, genres: e.target.value })} /></Field></div>
            </div>
            <TermsForm terms={terms} onChange={setTerms} />
            {conflicts.length > 0 ? (
              <p role="alert" className="flex gap-2 rounded-xl border border-orange/50 bg-orange/10 p-2 text-sm" data-testid="conflict-warning">
                <AlertTriangle className="size-4 shrink-0 text-orange" aria-hidden />{t("conflictWarnRequester")}
              </p>
            ) : (
              <p className="text-xs text-mute">{t("noConflictNote")}</p>
            )}
            <ToggleRow checked={listPublicly} onChange={setListPublicly} label={t("listPublicly")} sub={t("listPubliclySub")} />
          </>
        )}
        <Field id="bk-msg" label={t("message")} hint={kind === "inquiry" ? t("inquiryHint") : undefined}><Textarea id="bk-msg" value={message} maxLength={2000} onChange={(e) => setMessage(e.target.value)} data-testid="bk-message" /></Field>
        <p className="text-xs text-mute">{t("contactPrivacy")}</p>
      </div>
    </BottomSheet>
  );
}
