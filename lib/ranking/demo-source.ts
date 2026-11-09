/**
 * DEMO data source. Generates deterministic raw activity records
 * (supports, tickets, scans, presence, payments) for the sample events so the
 * real engine has something to aggregate. Everything here is fictional and
 * every event carries isDemo: true.
 */
import { AFTER_PARTIES, ARCHIVE_EVENTS, EVENTS } from "@/lib/data";
import type { FreakEvent } from "@/lib/types";
import { DEMO_FX } from "./config";
import type { Currency, EventActivity, PaymentRecord, RankableEvent, SupporterRecord, TicketRecord } from "./types";
import type { RankingSource } from "./source";

/** Demo clock: the sample data is built around this moment. */
export const DEMO_AS_OF = Date.parse("2026-11-09T12:00:00Z");

const DAY = 86400000;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LOCAL_CURRENCY: Record<string, Currency> = { Japan: "JPY", UK: "GBP", Germany: "EUR", Spain: "EUR", Netherlands: "EUR", Iceland: "EUR", Georgia: "EUR" };

export function toRankable(e: FreakEvent): RankableEvent {
  const ap = e.afterPartyId ? AFTER_PARTIES.find((a) => a.id === e.afterPartyId) : undefined;
  return {
    id: e.id,
    name: e.name,
    city: e.city,
    country: e.country,
    lat: e.lat,
    lng: e.lng,
    approximateLocation: e.status === "funding",
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    genres: e.genres,
    status: e.status,
    djRecruiting: e.djRecruiting,
    afterParty: ap ? { id: ap.id, name: ap.name, capacity: ap.capacity, sold: ap.capacity - ap.seatsLeft, price: ap.price } : undefined,
    minPrice: Math.min(...e.tickets.map((t) => t.price)),
    goal: e.goal,
    lineup: e.lineup,
    capacity: e.capacity,
    isDemo: true,
  };
}

/** Event-specific growth shape: <1 = most supporters arrived recently (trending). */
const SHAPE: Record<string, number> = { "tuk-tuk-trance": 0.12, "aurora-ooze": 0.15, "kawa-kaiju": 0.2, "void-jelly-rave": 0.22, "glass-noodle": 0.3 };

export function generateActivity(e: FreakEvent, asOf = DEMO_AS_OF): EventActivity {
  const r = rng(hash(e.id));
  const ended = e.status === "ended";
  const tEnd = ended ? Date.parse(e.endsAt) : asOf;
  const tStart = tEnd - (50 + Math.floor(r() * 40)) * DAY;
  const shape = SHAPE[e.id] ?? 0.8 + r() * 1.2;
  const at = () => tStart + (tEnd - tStart) * Math.pow(r(), shape);
  const ip = () => `ip-${Math.floor(r() * 1e9).toString(36)}`;

  /* supporters: exactly e.supporters unique valid users, plus noise to exclude */
  const supporters: SupporterRecord[] = [];
  for (let i = 0; i < e.supporters; i++) {
    supporters.push({ eventId: e.id, userId: `u-${e.id}-${i}`, walletAddress: r() < 0.2 ? `0x${hash(e.id + i).toString(16)}` : undefined, createdAt: at(), fraud: "clear", ipHash: ip() });
  }
  const dupes = Math.round(e.supporters * 0.03);
  for (let i = 0; i < dupes; i++) {
    const src = supporters[Math.floor(r() * e.supporters)];
    // same person, possibly another wallet: still one supporter
    supporters.push({ ...src, walletAddress: `0x${hash(src.userId + "w2").toString(16)}`, createdAt: Math.min(tEnd, src.createdAt + r() * 5 * DAY), ipHash: ip() });
  }
  const bots = Math.round(e.supporters * 0.02);
  for (let i = 0; i < bots; i++) supporters.push({ eventId: e.id, userId: `bot-${e.id}-${i}`, createdAt: at(), fraud: "bot", ipHash: ip() });
  const held = Math.round(e.supporters * 0.007);
  for (let i = 0; i < held; i++) supporters.push({ eventId: e.id, userId: `held-${e.id}-${i}`, createdAt: at(), fraud: "held", ipHash: ip() });
  if (e.id === "tuk-tuk-trance") {
    // A vote-stuffing burst from one IP: must be caught by burst detection.
    for (let i = 0; i < 60; i++) supporters.push({ eventId: e.id, userId: `burst-${i}`, createdAt: asOf - 3 * 3600000 + i * 4000, fraud: "clear", ipHash: "ip-burst-farm" });
  }

  const interests = Array.from({ length: Math.round(e.supporters * (1.3 + r())) }, (_, i) => ({ eventId: e.id, userId: `i-${e.id}-${i}`, createdAt: at() }));

  /* tickets */
  const ratio = e.status === "live" || ended ? 0.82 + r() * 0.15 : e.status === "confirmed" ? 0.3 + r() * 0.4 : 0.04 + r() * 0.18;
  const sold = Math.round(e.capacity * ratio);
  const kinds: TicketRecord["kind"][] = ["main", "main", "main", "allnight", "vip", "afterparty"];
  const tickets: TicketRecord[] = [];
  const saleEnd = Math.min(tEnd, Date.parse(e.startsAt));
  for (let i = 0; i < sold; i++) {
    tickets.push({ id: `t-${e.id}-${i}`, eventId: e.id, userId: `u-${e.id}-${i % Math.max(1, e.supporters)}`, kind: kinds[i % kinds.length], soldAt: Math.min(saleEnd, at()), status: "valid" });
  }
  const bad = Math.round(sold * 0.06);
  for (let i = 0; i < bad; i++) {
    const x = r();
    tickets.push({ id: `tx-${e.id}-${i}`, eventId: e.id, userId: `u-x-${i}`, kind: "main", soldAt: Math.min(saleEnd, at()), status: x < 0.7 ? "refunded" : x < 0.9 ? "void" : "fraud" });
  }

  /* check-ins & presence (live and ended only) */
  const checkIns: EventActivity["checkIns"] = [];
  const presence: EventActivity["presence"] = [];
  if (e.status === "live" || ended) {
    const doorsOpen = Date.parse(e.startsAt) - 2 * 3600000;
    const scanEnd = ended ? Date.parse(e.endsAt) : asOf;
    const showRate = 0.7 + r() * 0.2;
    tickets.forEach((t) => {
      if (r() > showRate) return;
      const scannedAt = doorsOpen + r() * Math.max(1, scanEnd - doorsOpen);
      checkIns.push({ eventId: e.id, ticketId: t.id, userId: t.userId, scannedAt });
      if (r() < 0.08) checkIns.push({ eventId: e.id, ticketId: t.id, userId: t.userId, scannedAt: scannedAt + 60000 }); // re-scan
      if (e.status === "live" && t.status === "valid") {
        const fresh = r() < 0.6;
        presence.push({ eventId: e.id, userId: t.userId, lastSeenAt: fresh ? asOf - r() * 10 * 60000 : asOf - (20 + r() * 120) * 60000, checkedOut: r() < 0.1, avatarPublic: r() < 0.35, profilePublic: r() < 0.95 });
      }
    });
  }

  /* payments: captured ≈ e.raised (USD) across currencies, plus non-captured noise */
  const payments: PaymentRecord[] = [];
  const local = LOCAL_CURRENCY[e.country] ?? "USD";
  let usd = 0;
  let n = 0;
  const pay = (status: PaymentRecord["status"], amountUsd: number) => {
    const cur: Currency = r() < 0.6 ? local : "USD";
    const rate = DEMO_FX.find((f) => f.currency === cur)!.usd;
    const amount = cur === "JPY" ? Math.round(amountUsd / rate) : Math.round((amountUsd / rate) * 100) / 100;
    payments.push({ id: `p-${e.id}-${n++}`, eventId: e.id, userId: `u-${e.id}-${n % Math.max(1, e.supporters)}`, amount, currency: cur, status, createdAt: at() });
    return amount * rate;
  };
  while (e.raised - usd >= 1) usd += pay("captured", Math.max(1, Math.min(e.raised - usd, 5 + Math.round(r() * 115))));
  const noise = Math.max(2, Math.round(n * 0.1));
  for (let i = 0; i < noise; i++) {
    const x = r();
    pay(x < 0.5 ? "pending" : x < 0.8 ? "refunded" : "expired", 10 + Math.round(r() * 80));
  }

  return { supporters, interests, tickets, checkIns, presence, payments };
}

let cache: { events: RankableEvent[]; activity: Map<string, EventActivity> } | null = null;

function build() {
  if (!cache) {
    const all = [...EVENTS, ...ARCHIVE_EVENTS];
    cache = { events: all.map(toRankable), activity: new Map(all.map((e) => [e.id, generateActivity(e)])) };
  }
  return cache;
}

export const demoSource: RankingSource = {
  mode: "demo",
  asOf: () => DEMO_AS_OF,
  fx: () => DEMO_FX,
  events: async () => build().events,
  activity: async (id) => build().activity.get(id) ?? null,
};
