"use client";

import { create } from "zustand";
import type { AlienIdentity } from "@/lib/alien/catalog";
import type { AlienLook } from "@/lib/types";
import type { AuthConfig } from "./config";
import type { PrivacyRecord, ProfileRecord } from "./types";

export interface MeAlien extends Omit<AlienIdentity, "seed"> {
  look: AlienLook;
}

export interface Me {
  user: { id: string; email: string; emailVerified: boolean; hasPassword: boolean; createdAt: string };
  profile: ProfileRecord;
  privacy: PrivacyRecord;
  alien: MeAlien | null;
  providers: string[];
  wallets: { address: string; chainId: number; linkedAt: string }[];
}

interface AuthState {
  status: "loading" | "signedOut" | "signedIn";
  me: Me | null;
  config: AuthConfig | null;
  refresh: () => Promise<Me | null>;
  set: (me: Me | null) => void;
}

/** Client view of the session (from /api/me). The session itself is an httpOnly cookie. */
export const useAuth = create<AuthState>((set) => ({
  status: "loading",
  me: null,
  config: null,
  async refresh() {
    try {
      const r = await fetch("/api/me", { cache: "no-store" });
      const j = await r.json();
      const me = j.signedIn ? (j as Me) : null;
      set({ status: me ? "signedIn" : "signedOut", me, config: j.config ?? null });
      return me;
    } catch {
      set({ status: "signedOut", me: null });
      return null;
    }
  },
  set: (me) => set({ me, status: me ? "signedIn" : "signedOut" }),
}));

/** POST/PATCH JSON to our own API. Errors come back as { error: { code } }. */
export async function api<T = Record<string, unknown>>(url: string, method: "POST" | "PATCH", body: unknown = {}): Promise<{ ok: true; data: T } | { ok: false; code: string; status: number; data: Record<string, unknown> }> {
  try {
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true, data: j as T };
    return { ok: false, code: j?.error?.code ?? "generic", status: r.status, data: j?.error ?? {} };
  } catch {
    return { ok: false, code: "generic", status: 0, data: {} };
  }
}
