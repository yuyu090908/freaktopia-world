"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Clock, Landmark, MapPin, Ticket, Users } from "lucide-react";
import { getAfterParty, getDJ, getEvent } from "@/lib/data";
import { useDemo, useHydrated } from "@/lib/store";
import { AlienAvatar } from "@/components/cards/Cards";
import { ButtonLink, Card, DemoBadge, Progress, Stat, Tag } from "@/components/ui/primitives";
import { ErrorState, LoadingSkeleton } from "@/components/ui/States";
import { fmtDateLong, fmtTime, money } from "@/lib/utils";

export function AfterPartyDetail({ id }: { id: string }) {
  const tu = useTranslations("afterParty");
  const ok = useHydrated();
  const mine = useDemo((s) => s.afterParties.find((a) => a.id === id));
  const p = getAfterParty(id) ?? mine;
  if (!p) return ok ? <ErrorState title={tu("notFound")} body={tu("text")} retry={<ButtonLink href="/after-party">{tu("allAfterParties")}</ButtonLink>} /> : <LoadingSkeleton variant="page" />;
  const main = getEvent(p.eventId);
  const sold = p.capacity - p.seatsLeft;

  return (
    <div className="mx-auto max-w-3xl md:px-6 md:pt-6">
      <div className="relative h-56 overflow-hidden md:rounded-[32px]" style={{ background: p.palette[0] }}>
        <div className="halftone absolute inset-0" aria-hidden />
        <svg viewBox="0 0 400 220" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
          <circle cx="320" cy="70" r="50" fill="#F5F2EA" stroke="#080808" strokeWidth="6" />
          <circle cx="342" cy="56" r="44" fill={p.palette[0]} />
          <path d="M0 220 Q80 120 160 170 T320 150 T400 160 V220 Z" fill={p.palette[1]} stroke="#080808" strokeWidth="6" />
          {[60, 120, 200].map((x, i) => <path key={x} d={`M${x} ${40 + i * 18} l5 -12 l5 12 l12 5 l-12 5 l-5 12 l-5 -12 l-12 -5 Z`} fill="#080808" />)}
        </svg>
        <div className="absolute left-4 top-4 flex gap-1.5"><Tag color="#080808">{tu("afterParty")}</Tag>{p.isDemo ? <DemoBadge className="bg-ink/85" /> : <Tag color="#B6F05C" dark>{tu("yours")}</Tag>}</div>
      </div>
      <div className="px-4 pt-5 md:px-0">
        <h1 className="text-[40px] uppercase sm:text-6xl">{p.name}</h1>
        {main && <p className="mt-2 text-mute">{tu("officialAfterPartyOf")} <Link href={`/events/${main.id}`} className="font-bold text-cream underline decoration-acid underline-offset-4">{main.name}</Link></p>}
        <ul className="mt-4 space-y-2">
          <li className="flex items-center gap-2"><MapPin className="size-4 text-mute" aria-hidden />{p.venueName}, {p.city}</li>
          <li className="flex items-center gap-2"><Clock className="size-4 text-mute" aria-hidden />{fmtDateLong(p.startsAt)} · {fmtTime(p.startsAt)} – {fmtTime(p.endsAt)}</li>
        </ul>
        <p className="mt-4 text-cream/85">{p.description}</p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <Stat label={tu("ticket")} value={money(p.price)} accent="#B6F05C" />
          <Stat label={tu("seatsLeft")} value={p.seatsLeft} accent={p.seatsLeft < 20 ? "#FF625C" : "#F5F2EA"} />
          <Stat label={tu("capacity")} value={p.capacity} />
        </div>
        <div className="mt-3"><Progress value={sold / p.capacity} color="#55BCEB" label={tu("soldOfCapacitySpotsTaken", { sold, capacity: p.capacity })} /></div>

        <h2 className="mt-8 text-3xl uppercase">DJs</h2>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {p.djIds.map((id) => {
            const d = getDJ(id);
            return d ? (
              <li key={id}><Link href={`/djs/${id}`} className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-2.5"><AlienAvatar look={d.look} size={44} /><span className="truncate text-sm font-extrabold">{d.name}</span></Link></li>
            ) : null;
          })}
          {!p.djIds.length && <li className="text-sm text-mute">{tu("lineupTba")}</li>}
        </ul>

        <Card className="mt-8 flex items-center gap-3 p-4">
          <Users className="size-6 text-purple" aria-hidden />
          <p className="text-sm">{tu("mainEventTicketHoldersGet")}</p>
        </Card>
        {main && (
          <ButtonLink href={`/events/${main.id}/tickets`} size="lg" className="mt-5 w-full"><Ticket className="size-5" aria-hidden /> {tu("getAfterPartyTicket")}</ButtonLink>
        )}
        {main && main.status !== "ended" && (
          <ButtonLink href={`/dao/${main.id}/proposals?new=1&cat=after_party&title=${encodeURIComponent(`After party idea: ${p.name}`)}`} variant="purple" className="mt-3 w-full" data-testid="ap-propose">
            <Landmark className="size-5" aria-hidden /> {tu("proposeInTheEventDao")}
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
