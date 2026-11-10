/**
 * In-app event alerts (Phase 1). Alerts are derived from the events a user
 * follows; nothing is sent outside the app. A push/email channel can be added
 * later behind the same AlertType + consent model (event_alert_subscriptions).
 */
import type { FreakEvent } from "./types";
import { getAfterParty } from "./data";

export const ALERT_TYPES = ["top10", "tickets_on_sale", "tickets_low", "dj_open", "after_party", "confirmed", "cancelled"] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_LABELS: Record<AlertType, { en: string }> = {
  top10: { en: "Enters the TOP 10" },
  tickets_on_sale: { en: "Tickets on sale" },
  tickets_low: { en: "Tickets running low" },
  dj_open: { en: "DJ applications open" },
  after_party: { en: "After party announced" },
  confirmed: { en: "Event confirmed" },
  cancelled: { en: "Event cancelled" },
};

export interface AppAlert {
  id: string;
  type: AlertType;
  eventId: string;
  eventName: string;
  /** English; shown through the "labels" namespace (see lib/i18n/labels.ts). */
  label: string;
  title: string;
  body: string;
}

export function deriveAlerts(events: FreakEvent[], top10: Set<string>, prefs: Record<AlertType, boolean>): AppAlert[] {
  const out: AppAlert[] = [];
  const add = (type: AlertType, e: FreakEvent, body: string) => {
    if (prefs[type]) out.push({ id: `${type}:${e.id}`, type, eventId: e.id, eventName: e.name, label: ALERT_LABELS[type].en, title: `${e.name}: ${ALERT_LABELS[type].en}`, body });
  };
  for (const e of events) {
    if (top10.has(e.id)) add("top10", e, "An event you follow entered the WORLD RANKING TOP 10.");
    if (e.status === "confirmed" || e.status === "live") add("tickets_on_sale", e, "Tickets are on sale (demo).");
    const apLow = e.afterPartyId ? (getAfterParty(e.afterPartyId)?.seatsLeft ?? 99) <= 15 : false;
    const low = e.tickets.some((t) => t.remaining > 0 && t.remaining <= 30) || apLow;
    if (low && e.status !== "ended") add("tickets_low", e, "Some tickets are running low.");
    if (e.djRecruiting) add("dj_open", e, "DJ applications are open.");
    if (e.afterPartyId) add("after_party", e, "The official after party has been announced.");
    if (e.status === "confirmed") add("confirmed", e, "The event is confirmed.");
  }
  return out;
}
