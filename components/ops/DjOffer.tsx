"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Send } from "lucide-react";
import { Select } from "@/components/forms/Fields";
import { Button } from "@/components/ui/primitives";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { useOps, useOpsPost } from "@/components/ops/shared";
import { useAuth } from "@/lib/auth/client";
import { DEMO_DJ_LISTING_ID } from "@/lib/ops/seed";
import type { OpsEvent, Requirement } from "@/lib/ops/types";

/**
 * Sends a real direct offer from one of the organizer's managed events to this DJ's performer listing.
 * Only shown when that listing exists (demo DJs exist on the demo store only) and the person manages an event.
 */
export function DjOffer({ djId, budget }: { djId: string; budget: number }) {
  const t = useTranslations("ops");
  const href = useLocalHref();
  const post = useOpsPost();
  const signedIn = useAuth((s) => s.status === "signedIn" && !!s.me?.user.emailVerified);
  const listingId = DEMO_DJ_LISTING_ID(djId);
  const listing = useOps<{ listing: { id: string; demo: boolean } }>(signedIn ? `/api/ops/listings/${listingId}` : null);
  const events = useOps<{ events: { event: OpsEvent; role: string }[] }>(signedIn ? "/api/ops/events" : null);
  const mine = (events.data?.events ?? []).filter((e) => e.role === "owner" || e.role === "manager").map((e) => e.event);
  const [eid, setEid] = useState("");
  const [sent, setSent] = useState(false);
  if (!signedIn || !listing.data || !mine.length) return null;
  const send = async () => {
    const id = eid || mine[0].id;
    const v = await fetch(`/api/ops/events/${id}`).then((r) => r.json());
    let req = (v?.view?.requirements as Requirement[] | undefined)?.find((r) => r.key === "dj_performer");
    if (!req) req = (await post<{ requirement: Requirement }>(`events/${id}/requirements`, { key: "dj_performer", quantity: 1 }))?.requirement;
    if (!req) return;
    if (await post(`events/${id}/openings`, { kind: "direct", requirementIds: [req.id], targetListingId: listingId, budgetUsd: budget }, t("sent"))) setSent(true);
  };
  return (
    <div className="space-y-2 rounded-2xl border border-acid/40 bg-acid/5 p-3" data-testid="dj-offer">
      <div className="text-sm font-bold">{t("offerFromEvent")}</div>
      <p className="text-xs text-mute">{t("offerFromEventSub")}</p>
      {sent ? (
        <Link href={href(`/events/manage/${eid || mine[0].id}?tab=resources`)} className="text-sm font-bold text-acid underline">{t("offerSentOpen")}</Link>
      ) : (
        <div className="flex gap-2">
          <label htmlFor="dj-offer-ev" className="sr-only">{t("chooseEvent")}</label>
          <Select id="dj-offer-ev" value={eid || mine[0].id} onChange={(e) => setEid(e.target.value)}>
            {mine.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
          <Button onClick={() => void send()} data-testid="dj-offer-send"><Send className="size-4" aria-hidden /> {t("send")}</Button>
        </div>
      )}
    </div>
  );
}
