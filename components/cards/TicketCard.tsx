"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, CalendarDays, Gem, MapPin, QrCode, ShieldCheck } from "lucide-react";
import { TICKET_ART, type TicketTier } from "@/lib/art";
import { getEvent, getVenue } from "@/lib/data";
import type { DemoOrder, TicketKind } from "@/lib/types";
import { fmtDate, moneyCents } from "@/lib/utils";
import { DemoBadge } from "@/components/ui/primitives";

const TIER: Record<TicketKind, TicketTier> = { main: "basic", afterparty: "silver", allnight: "gold", vip: "vip" };

/**
 * A ticket in My Tickets: event, date, venue, grade, validity, entry QR and NFT status, each stated as it is.
 * Phase 1 orders are demo orders: the code is decorative (never valid at a door) and no NFT is minted.
 */
export function TicketCard({ order }: { order: DemoOrder }) {
  const t = useTranslations("tickets");
  const e = getEvent(order.eventId);
  const kind = order.lines[0]?.kind ?? "main";
  const art = TICKET_ART[TIER[kind]];
  const ended = e?.status === "ended";
  const venue = e ? getVenue(e.venueId)?.name : null;
  return (
    <article className="relative overflow-hidden rounded-[20px] border border-line bg-surface-2 focus-within:border-acid" data-testid="ticket-card">
      <div className="flex gap-3 p-3">
        <div className="relative aspect-[17/10] w-28 shrink-0 overflow-hidden rounded-xl sm:w-36" aria-hidden>
          <Image src={art.src} alt="" fill sizes="144px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5"><DemoBadge label={t("demoTicket")} /></div>
          <h3 className="mt-1 truncate text-[16px] uppercase leading-tight">
            <Link href={`/tickets/${order.id}`} className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline">{e?.name ?? order.eventId}</Link>
          </h3>
          {e && (
            <p className="mt-0.5 flex flex-wrap gap-x-3 text-[13px] text-mute">
              <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" aria-hidden />{fmtDate(e.startsAt, { month: "short", day: "numeric", year: "numeric" })}</span>
              {venue && <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="size-3.5 shrink-0" aria-hidden /><span className="truncate">{venue}</span></span>}
            </p>
          )}
          <p className="mt-1 text-[13px] font-bold">{order.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")} · {moneyCents(order.pricing?.totalCents ?? Math.round(order.total * 100))}</p>
        </div>
        <ArrowRight className="size-5 shrink-0 self-center text-mute" aria-hidden />
      </div>
      <dl className="grid grid-cols-1 gap-px border-t border-line bg-line text-[12px] min-[420px]:grid-cols-3">
        <div className="flex items-center gap-1.5 bg-surface-2 px-3 py-2">
          <ShieldCheck className="size-4 shrink-0 text-mute" aria-hidden />
          <dt className="sr-only">{t("validity")}</dt>
          <dd data-testid="ticket-validity">{ended ? t("expired") : t("validDemo")}</dd>
        </div>
        <div className="flex items-center gap-1.5 bg-surface-2 px-3 py-2">
          <QrCode className="size-4 shrink-0 text-mute" aria-hidden />
          <dt className="sr-only">{t("entryQr")}</dt>
          <dd>{t("qrDemo")}</dd>
        </div>
        <div className="flex items-center gap-1.5 bg-surface-2 px-3 py-2">
          <Gem className="size-4 shrink-0 text-mute" aria-hidden />
          <dt className="sr-only">NFT</dt>
          <dd data-testid="ticket-nft">{t("nftNotConnected")}</dd>
        </div>
      </dl>
    </article>
  );
}
