"use client";

import { create } from "zustand";
import { useDemo } from "@/lib/store";
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

/**
 * The avatar to draw for "me" anywhere in the app (LIVE chat, festival floor, tickets, DAO…).
 * Signed in: always the account alien and display name, never a second random alien.
 * Signed out: the browser-local demo avatar.
 */
export function useMyAvatar(): { look: AlienLook; name: string; alienName: string; account: boolean; publicId: string | null } {
  const me = useAuth((s) => s.me);
  const demoLook = useDemo((s) => s.profile.look);
  const demoName = useDemo((s) => s.profile.avatarName);
  if (me?.alien) return { look: me.alien.look, name: me.profile.displayName ?? me.alien.name, alienName: me.alien.name, account: true, publicId: me.alien.publicId };
  return { look: demoLook, name: demoName, alienName: demoName, account: false, publicId: null };
}
