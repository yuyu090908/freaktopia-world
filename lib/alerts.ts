/**
 * In-app event alerts (Phase 1). Alerts are derived from the events a user
 * follows; nothing is sent outside the app. A push/email channel can be added
 * later behind the same AlertType + consent model (event_alert_subscriptions).
 */
import type { FreakEvent } from "./types";
import { getAfterParty } from "./data";

export const ALERT_TYPES = ["top10", "tickets_on_sale", "tickets_low", "dj_open", "after_party", "confirmed", "cancelled"] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_LABELS: Record<AlertType, { en: string; ja: string }> = {
  top10: { en: "Enters the TOP 10", ja: "フォロー中のイベントがTOP10入り" },
  tickets_on_sale: { en: "Tickets on sale", ja: "チケット販売開始" },
  tickets_low: { en: "Tickets running low", ja: "チケット残りわずか" },
  dj_open: { en: "DJ applications open", ja: "DJ募集開始" },
  after_party: { en: "After party announced", ja: "アフターパーティー公開" },
  confirmed: { en: "Event confirmed", ja: "開催確定" },
  cancelled: { en: "Event cancelled", ja: "イベント中止" },
};

export interface AppAlert {
  id: string;
  type: AlertType;
  eventId: string;
  title: string;
  body: string;
}

export function deriveAlerts(events: FreakEvent[], top10: Set<string>, prefs: Record<AlertType, boolean>): AppAlert[] {
  const out: AppAlert[] = [];
  const add = (type: AlertType, e: FreakEvent, body: string) => {
    if (prefs[type]) out.push({ id: `${type}:${e.id}`, type, eventId: e.id, title: `${e.name}: ${ALERT_LABELS[type].en}`, body });
  };
  for (const e of events) {
    if (top10.has(e.id)) add("top10", e, "フォロー中のイベントがWORLD RANKINGのTOP10に入りました。");
    if (e.status === "confirmed" || e.status === "live") add("tickets_on_sale", e, "チケットを購入できます（デモ）。");
    const apLow = e.afterPartyId ? (getAfterParty(e.afterPartyId)?.seatsLeft ?? 99) <= 15 : false;
    const low = e.tickets.some((t) => t.remaining > 0 && t.remaining <= 30) || apLow;
    if (low && e.status !== "ended") add("tickets_low", e, "残りわずかのチケットがあります。");
    if (e.djRecruiting) add("dj_open", e, "DJの応募を受け付けています。");
    if (e.afterPartyId) add("after_party", e, "公式アフターパーティーが公開されています。");
    if (e.status === "confirmed") add("confirmed", e, "開催が確定しました。");
  }
  return out;
}
