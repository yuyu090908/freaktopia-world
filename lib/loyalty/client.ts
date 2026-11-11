"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/client";
import type { AlienLook } from "@/lib/types";
import type { FeeBreakdown, LoyaltyRules, Rank } from "./rules";

export const RANK_COLOR: Record<Rank, string> = { rookie: "#BDB5C8", explorer: "#66DFFF", raver: "#FF79CD", elite: "#B78BFF", legend: "#C1FF53" };

export interface FreakId {
  freakId: string | null;
  name: string | null;
  username: string | null;
  look: AlienLook | null;
  emailVerified: boolean;
  verifiedEvents: number;
  pendingEvents: number;
  excludedEvents: number;
  rank: Rank;
  discountPct: number;
  fullDiscountPending: boolean;
  next: { rank: Rank; min: number; remaining: number } | null;
  progress: number;
  cities: { city: string; country: string; count: number }[];
  cityCount: number;
  countryCount: number;
  history: { eventId: string; name: string; city: string; country: string; startAt: string; method: "qr" | "manual" }[];
  rules: LoyaltyRules;
  scheduled: { rules: LoyaltyRules; effectiveAt: string; notice: string } | null;
}

export interface Quote extends FeeBreakdown {
  signedIn: boolean;
  verifiedEvents: number;
  afterThisEvent: { rank: Rank; remaining: number } | null;
  quotedAt: string;
}

type Load<T> = { state: "loading" } | { state: "signedOut" } | { state: "error" } | { state: "ready"; data: T };

/** The signed-in person's FREAK ID, straight from the server (never computed in the browser). */
export function useFreakId(): Load<FreakId> {
  const status = useAuth((s) => s.status);
  const [v, setV] = useState<Load<FreakId>>({ state: "loading" });
  useEffect(() => {
    if (status === "loading") return;
    if (status === "signedOut") return setV({ state: "signedOut" });
    let live = true;
    fetch("/api/loyalty/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => live && setV({ state: "ready", data: j.freakId as FreakId }))
      .catch(() => live && setV({ state: "error" }));
    return () => {
      live = false;
    };
  }, [status]);
  return v;
}

/** Asks the server for the price breakdown. Used while choosing and again right before the order is stored. */
export async function fetchQuote(ticketsUsd: number): Promise<Quote | null> {
  try {
    const r = await fetch("/api/loyalty/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketsUsd }) });
    if (!r.ok) return null;
    return (await r.json()).quote as Quote;
  } catch {
    return null;
  }
}

/** The rules in force (public). */
export function useLoyaltyRules() {
  const [rules, setRules] = useState<LoyaltyRules | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/loyalty/rules")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && j && setRules(j.rules as LoyaltyRules))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return rules;
}
