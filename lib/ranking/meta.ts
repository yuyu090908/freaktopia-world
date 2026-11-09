/** UI labels and helpers for rankings (client-safe). */
import type { EventMetrics, RankedEntry, RankingCategory, RankingPeriod } from "./types";

export const CATEGORY_META: Record<RankingCategory, { label: string; ja: string; color: string; metric: string }> = {
  popular: { label: "Most popular", ja: "有効なユニーク応援者数", color: "#B6F05C", metric: "Supporters" },
  trending: { label: "Trending", ja: "応援者の増加数と増加率（平滑化）", color: "#FF625C", metric: "Growth" },
  tickets: { label: "Tickets sold", ja: "有効な販売済みチケット枚数", color: "#55BCEB", metric: "Tickets sold" },
  funded: { label: "Most funded", ja: "確保済みの開催資金（USD換算）", color: "#FFAD5B", metric: "Secured" },
  attended: { label: "Most attended", ja: "確認済みユニーク来場者数（開催後）", color: "#A276E9", metric: "Checked in" },
  live: { label: "Live now", ja: "LIVE状態と在場確認があるイベント", color: "#FF625C", metric: "Present now" },
  dj_wanted: { label: "DJ wanted", ja: "DJ応募を受付中のイベント", color: "#A276E9", metric: "Supporters" },
  after_party: { label: "After party", ja: "アフターパーティーの販売数", color: "#55BCEB", metric: "AP tickets" },
  for_you: { label: "For you", ja: "あなたの好みに合うイベント（非公開）", color: "#B6F05C", metric: "Match" },
};

export const PUBLIC_CATEGORIES: RankingCategory[] = ["popular", "trending", "tickets", "funded", "attended", "live", "dj_wanted", "after_party"];

export const PERIOD_LABEL: Record<RankingPeriod, string> = { "24h": "24 hours", "7d": "7 days", "30d": "30 days", all: "All time" };

export const fmtNum = (n: number) => n.toLocaleString("en-US");
export const fmtUsd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
export const fmtPct = (r: number) => `+${Math.round(r * 100)}%`;

export function primaryLabel(e: RankedEntry, category: RankingCategory) {
  const v = e.primary.value;
  switch (e.primary.key) {
    case "funding_usd":
      return { value: fmtUsd(v), label: "secured" };
    case "growth_rate":
      return { value: fmtPct(v), label: `${fmtNum(e.metrics.new_supporters)} new` };
    case "new_supporters":
      return { value: fmtNum(v), label: "new supporters" };
    case "after_party_sold":
      return { value: fmtNum(v), label: "after-party tickets" };
    case "match":
      return { value: `${v}`, label: "match points" };
    default:
      return { value: fmtNum(v), label: CATEGORY_META[category].metric.toLowerCase() };
  }
}

/** Secondary metrics shown on a card, chosen per category (never all at once). */
export function secondaryMetrics(category: RankingCategory, m: EventMetrics): { key: string; label: string; value: string }[] {
  const all = {
    supporters: { key: "supporters", label: "Supporters", value: fmtNum(m.supporters_count) },
    tickets: { key: "tickets", label: "Tickets", value: fmtNum(m.tickets_sold) },
    checkin: { key: "checkin", label: "Checked in", value: fmtNum(m.checked_in_count) },
    growth: { key: "growth", label: "Growth", value: fmtPct(m.growth_rate) },
    present: { key: "present", label: "Present now", value: fmtNum(m.currently_present_count) },
    interested: { key: "interested", label: "Interested", value: fmtNum(m.interested_count) },
  };
  const pick: Record<RankingCategory, (keyof typeof all)[]> = {
    popular: ["tickets", "growth"],
    trending: ["supporters", "tickets"],
    tickets: ["supporters", "growth"],
    funded: ["supporters", "tickets"],
    attended: ["tickets", "supporters"],
    live: ["checkin", "tickets"],
    dj_wanted: ["tickets", "growth"],
    after_party: ["supporters", "tickets"],
    for_you: ["supporters", "growth"],
  };
  return pick[category].map((k) => all[k]);
}
