"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Disc3, EyeOff, Eye, Star, Ticket, Trash2, Upload } from "lucide-react";
import { Alien } from "@/components/art/Alien";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { Field, Select, Textarea } from "@/components/forms/Fields";
import { Button, DemoBadge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { Section, fileToBase64, useWhen } from "@/components/ops/shared";
import { PassCard } from "@/components/party/PassCard";
import { THEME_COLORS, useParty, usePartyPost, type PlanetState, type Theme } from "@/components/party/shared";
import { useAuth } from "@/lib/auth/client";
import { toast } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { AlienLook } from "@/lib/types";

type Vis = "public" | "attendees" | "hidden";
interface MediaItem { id: string; kind: "official" | "attendee"; type: "image" | "video"; caption: string; visibility: Vis; hiddenByOrganizer: boolean; mine: boolean; at: string }
interface EventData {
  event: { id: string; name: string; city: string; country: string; venueName: string; startAt: string; endAt: string; timezone: string; genres: string[]; level: number; theme: Theme; demo: boolean };
  owner: { publicId: string | null; name: string | null };
  state: PlanetState;
  figures: { attendance: number | null; guests: number | null; rating: number | null; reviewCount: number; minQr: number };
  djs: string[];
  reviews: { rating: number; text: string; at: string; mine: boolean; author: { publicId: string | null; name: string | null; look: AlienLook | null } | null }[];
  media: { official: MediaItem[]; attendee: MediaItem[] };
  my: { status: "going" | "checked_in" | "cancelled" | null; counted: boolean; isTeam: boolean; canManage: boolean; canReview: boolean; canUpload: boolean; canRsvp: boolean; myReview: { rating: number; text: string } | null };
}

export function Memories({ handle, eventId }: { handle: string; eventId: string }) {
  const t = useTranslations("party");
  const href = useLocalHref();
  const status = useAuth((s) => s.status);
  const { data, error, reload } = useParty<EventData>(status === "loading" ? null : `/api/party/events/${eventId}`);
  return (
    <div className="mx-auto max-w-5xl pb-24 md:px-6">
      <div className="px-4 pt-4 md:px-0 md:pt-6">
        <Link href={href(`/u/${handle}/world`)} className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-mute hover:text-cream" data-testid="back-to-world">
          <ArrowLeft className="size-4" aria-hidden /> {t("backToWorld")}
        </Link>
      </div>
      <div className="px-4 md:px-0">
        {error ? <EmptyState title={t("eventNotFound")} body={t("eventNotFoundBody")} /> : !data ? <div className="h-72 animate-pulse rounded-3xl bg-surface" /> : <Inner d={data} reload={reload} />}
      </div>
    </div>
  );
}

function Inner({ d, reload }: { d: EventData; reload: () => Promise<void> }) {
  const t = useTranslations("party");
  const when = useWhen();
  const post = usePartyPost();
  const status = useAuth((s) => s.status);
  const href = useLocalHref();
  const [busy, setBusy] = useState(false);
  const [pass, setPass] = useState(false);
  const c = THEME_COLORS[d.event.theme];
  const e = d.event;
  const run = async (path: string, body: unknown, msg: string) => {
    setBusy(true);
    const r = await post(path, body, msg);
    setBusy(false);
    if (r) await reload();
    return r;
  };
  return (
    <div className="space-y-4">
      <header className="relative overflow-hidden rounded-[32px] border-[3px] border-ink p-5" style={{ background: `radial-gradient(circle at 85% 20%, ${c.glow}55, transparent 45%), ${c.base}` }}>
        <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold uppercase tracking-wider" style={{ color: c.glow }}>
          <span>{t(`theme.${e.theme}`)}</span>
          <span className="rounded-full bg-ink/60 px-2 py-0.5 text-cream" data-testid="event-state">{t(`state.${d.state}`)}</span>
          {e.demo && <DemoBadge />}
        </div>
        <h1 className="mt-1 text-[32px] uppercase leading-none sm:text-5xl" data-testid="memories-title">{e.name}</h1>
        <p className="mt-2 text-sm font-bold">
          {when(e.startAt, e.timezone)} · {e.city}{e.venueName ? ` · ${e.venueName}` : ""}
        </p>
        <p className="text-sm">{e.genres.join(" · ")} · L{e.level}</p>
        {d.owner.name && (
          <p className="mt-1 text-sm">
            {t("hostedBy")} {d.owner.publicId ? <Link className="font-extrabold underline" href={href(`/u/${d.owner.publicId}`)}>{d.owner.name}</Link> : d.owner.name}
          </p>
        )}
      </header>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fig k={t("verifiedAttendance")} v={d.figures.attendance ?? "—"} testid="fig-attendance" />
        <Fig k={t("guests")} v={d.figures.guests ?? "—"} />
        <Fig k={t("rating")} v={d.figures.rating !== null ? d.figures.rating.toFixed(1) : "—"} />
        <Fig k={t("reviewCount")} v={d.figures.reviewCount} />
      </dl>
      <p className="text-xs text-mute">
        {d.state === "unverified" ? t("unverifiedExplain", { n: d.figures.minQr }) : d.state === "upcoming" ? t("upcomingExplain") : d.state === "cancelled" ? t("cancelledExplain") : t("verifiedExplain")}
      </p>

      {(d.my.canRsvp || d.my.status) && (
        <Section title={t("yourAttendance")} id="my-att">
          <p className="text-sm" data-testid="my-status">{t(`myStatus.${d.my.status ?? "none"}`)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {status !== "signedIn" ? (
              <Link href={href(`/login?returnTo=${encodeURIComponent(location.pathname)}`)} className="inline-flex min-h-11 items-center rounded-full bg-acid px-4 text-sm font-extrabold uppercase text-ink">{t("signInToRsvp")}</Link>
            ) : d.my.status === "going" ? (
              <>
                <Button onClick={() => setPass((x) => !x)} data-testid="show-pass"><Ticket className="size-4" aria-hidden /> {t("myPass")}</Button>
                {d.my.canRsvp && <Button variant="ghost" disabled={busy} onClick={() => run(`events/${e.id}/cancel`, {}, t("rsvpCancelled"))} data-testid="rsvp-cancel">{t("cancelRsvp")}</Button>}
              </>
            ) : d.my.canRsvp ? (
              <Button disabled={busy || e.demo} onClick={() => run(`events/${e.id}/rsvp`, {}, t("rsvpDone"))} data-testid="rsvp">{t("rsvp")}</Button>
            ) : null}
          </div>
          {pass && d.my.status === "going" && <PassCard eventId={e.id} />}
          <p className="mt-2 text-xs text-mute">{t("rsvpNote")}</p>
        </Section>
      )}

      {d.djs.length > 0 && (
        <Section title={t("djs")} id="djs">
          <ul className="flex flex-wrap gap-2">
            {d.djs.map((n) => (
              <li key={n} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1 text-sm font-bold"><Disc3 className="size-4 text-acid" aria-hidden /> {n}</li>
            ))}
          </ul>
        </Section>
      )}

      <MediaSection title={t("officialMedia")} items={d.media.official} empty={t("noOfficial")} canManage={d.my.canManage} reload={reload} testid="media-official" />
      <MediaSection title={t("attendeeMedia")} items={d.media.attendee} empty={t("noAttendeeMedia")} canManage={d.my.canManage} reload={reload} testid="media-attendee" />
      {d.my.canUpload && <Uploader eventId={e.id} official={d.my.canManage} reload={reload} />}

      <Section title={t("reviews")} id="reviews">
        {d.my.canReview && <ReviewForm eventId={e.id} mine={d.my.myReview} reload={reload} />}
        {!d.my.canReview && d.my.isTeam && <p className="mb-3 text-xs text-mute">{t("teamCannotReview")}</p>}
        {d.reviews.length === 0 ? (
          <p className="text-sm text-mute">{t("noReviews")}</p>
        ) : (
          <ul className="space-y-2" data-testid="review-list">
            {d.reviews.map((r, i) => (
              <li key={i} className="flex gap-3 rounded-2xl bg-ink p-3">
                {r.author?.look ? <Alien look={r.author.look} className="size-10 shrink-0 rounded-xl bg-surface-2" /> : <span className="size-10 shrink-0 rounded-xl bg-surface-2" aria-hidden />}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <span>{r.author ? (r.author.publicId ? <Link href={href(`/u/${r.author.publicId}`)} className="hover:text-acid">{r.author.name}</Link> : r.author.name) : t("anonymousAttendee")}</span>
                    <span className="text-acid" aria-label={t("starsN", { n: r.rating })}>{"★".repeat(r.rating)}<span className="text-mute">{"★".repeat(5 - r.rating)}</span></span>
                  </div>
                  {r.text && <p className="text-sm text-cream/90">{r.text}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-mute">{t("reviewsVerifiedOnly")}</p>
      </Section>
    </div>
  );
}

function Fig({ k, v, testid }: { k: string; v: string | number; testid?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3" data-testid={testid}>
      <dt className="text-[10px] font-extrabold uppercase tracking-wider text-mute">{k}</dt>
      <dd className="font-display text-3xl">{v}</dd>
    </div>
  );
}

function MediaSection({ title, items, empty, canManage, reload, testid }: { title: string; items: MediaItem[]; empty: string; canManage: boolean; reload: () => Promise<void>; testid: string }) {
  const t = useTranslations("party");
  const post = usePartyPost();
  return (
    <Section title={title} id={testid}>
      {items.length === 0 ? (
        <p className="text-sm text-mute">{empty}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid={testid}>
          {items.map((m) => (
            <li key={m.id} className={cn("overflow-hidden rounded-2xl border border-line bg-ink", m.hiddenByOrganizer && "opacity-60")} data-testid="media-item">
              {m.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/party/media/${m.id}`} alt={m.caption || t("mediaAlt")} loading="lazy" className="aspect-square w-full object-cover" />
              ) : (
                <video src={`/api/party/media/${m.id}`} controls preload="metadata" className="aspect-square w-full bg-black object-cover" aria-label={m.caption || t("mediaAlt")} />
              )}
              <div className="space-y-1 p-2 text-xs">
                {m.caption && <p className="font-bold">{m.caption}</p>}
                {(m.mine || canManage) && (
                  <div className="flex flex-wrap items-center gap-1">
                    {m.mine && (
                      <select
                        aria-label={t("visibility")}
                        value={m.visibility}
                        onChange={async (e) => (await post(`media/${m.id}/update`, { visibility: e.target.value }, t("saved"))) && reload()}
                        className="min-h-9 rounded-full border border-line bg-surface px-2 text-xs"
                        data-testid="media-visibility"
                      >
                        {(["public", "attendees", "hidden"] as const).map((v) => <option key={v} value={v}>{t(`vis.${v}`)}</option>)}
                      </select>
                    )}
                    {canManage && m.kind === "attendee" && !m.mine && (
                      <button type="button" className="inline-flex min-h-9 items-center gap-1 rounded-full border border-line px-2" onClick={async () => (await post(`media/${m.id}/update`, { hiddenByOrganizer: !m.hiddenByOrganizer }, t("saved"))) && reload()}>
                        {m.hiddenByOrganizer ? <Eye className="size-3.5" aria-hidden /> : <EyeOff className="size-3.5" aria-hidden />} {m.hiddenByOrganizer ? t("unhide") : t("hide")}
                      </button>
                    )}
                    {(m.mine || (canManage && m.kind === "official")) && (
                      <button type="button" className="inline-flex min-h-9 items-center gap-1 rounded-full border border-orange/50 px-2 text-orange" onClick={async () => (await post(`media/${m.id}/delete`, {}, t("deleted"))) && reload()} data-testid="media-delete">
                        <Trash2 className="size-3.5" aria-hidden /> {t("delete")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Uploader({ eventId, official, reload }: { eventId: string; official: boolean; reload: () => Promise<void> }) {
  const t = useTranslations("party");
  const post = usePartyPost();
  const file = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [vis, setVis] = useState<Vis>("public");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const f = file.current?.files?.[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) {
      toast({ title: t("err.TOO_LARGE"), tone: "error" });
      return;
    }
    setBusy(true);
    const data = await fileToBase64(f);
    const r = await post(`events/${eventId}/media`, { mime: f.type, data, caption: caption || undefined, visibility: vis }, t("uploaded"));
    setBusy(false);
    if (r) {
      setCaption("");
      if (file.current) file.current.value = "";
      await reload();
    }
  };
  return (
    <Section title={official ? t("uploadOfficial") : t("uploadMine")} id="upload">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("file")} id="mfile" hint={t("fileHint")}>
          <input ref={file} id="mfile" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" className="block w-full text-sm file:mr-2 file:min-h-11 file:rounded-full file:border-0 file:bg-acid file:px-4 file:font-extrabold file:text-ink" data-testid="media-file" />
        </Field>
        <Field label={t("visibility")} id="mvis">
          <Select id="mvis" value={vis} onChange={(e) => setVis(e.target.value as Vis)}>
            {(["public", "attendees", "hidden"] as const).map((v) => <option key={v} value={v}>{t(`vis.${v}`)}</option>)}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label={t("caption")} id="mcap" optional>
            <Textarea id="mcap" rows={2} maxLength={200} value={caption} onChange={(e) => setCaption(e.target.value)} />
          </Field>
        </div>
      </div>
      <Button className="mt-3" disabled={busy} onClick={send} data-testid="media-upload"><Upload className="size-4" aria-hidden /> {t("upload")}</Button>
      <p className="mt-2 text-xs text-mute">{t("uploadRules")}</p>
    </Section>
  );
}

function ReviewForm({ eventId, mine, reload }: { eventId: string; mine: { rating: number; text: string } | null; reload: () => Promise<void> }) {
  const t = useTranslations("party");
  const post = usePartyPost();
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [text, setText] = useState(mine?.text ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <div className="mb-4 rounded-2xl border border-line p-3" data-testid="review-form">
      <div className="text-sm font-extrabold uppercase">{mine ? t("editReview") : t("writeReview")}</div>
      <div className="mt-2 flex gap-1" role="radiogroup" aria-label={t("rating")}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={t("starsN", { n })} onClick={() => setRating(n)} className="flex size-11 items-center justify-center" data-testid={`star-${n}`}>
            <Star className={cn("size-7", n <= rating ? "fill-acid text-acid" : "text-mute")} aria-hidden />
          </button>
        ))}
      </div>
      <Textarea aria-label={t("reviewText")} rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} className="mt-2" />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          disabled={busy || rating < 1}
          onClick={async () => {
            setBusy(true);
            if (await post(`events/${eventId}/review`, { rating, text }, t("reviewSaved"))) await reload();
            setBusy(false);
          }}
          data-testid="review-submit"
        >
          {t("saveReview")}
        </Button>
        {mine && (
          <Button variant="ghost" disabled={busy} onClick={async () => (await post(`events/${eventId}/review/delete`, {}, t("deleted"))) && reload()}>
            {t("deleteReview")}
          </Button>
        )}
      </div>
    </div>
  );
}
