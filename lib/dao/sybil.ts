/**
 * Duplicate-person (sybil) heuristics for "one person, one vote".
 *
 * LIMITATION: without identity verification (KYC or proof-of-personhood) no system can
 * guarantee one human = one vote. We approximate it: votes are per account (wallets
 * never add weight), one wallet can belong to only one account, and accounts that share
 * strong signals are flagged so their ballots are held for human review.
 */
import type { DaoMembership } from "./types";

export interface AccountSignals {
  uid: string;
  wallets: string[];
  deviceId: string;
  ipHash: string;
  joinedAt: number;
  /** Address that funded the wallet(s), when known from chain data. */
  fundingSource?: string;
}

export interface SybilFlag {
  uid: string;
  cluster: string;
  reason: string;
}

const JOIN_WINDOW_MS = 10 * 60_000;

export function detectSybils(accounts: AccountSignals[]): SybilFlag[] {
  const flags = new Map<string, SybilFlag>();
  const flag = (uids: string[], cluster: string, reason: string) => {
    if (uids.length < 2) return;
    for (const uid of uids) if (!flags.has(uid)) flags.set(uid, { uid, cluster, reason });
  };
  const group = <K>(key: (a: AccountSignals) => K | undefined) => {
    const m = new Map<K, AccountSignals[]>();
    for (const a of accounts) {
      const k = key(a);
      if (k === undefined || k === "") continue;
      m.set(k, [...(m.get(k) ?? []), a]);
    }
    return m;
  };
  // 1. Same wallet claimed by several accounts (should be impossible; treat as severe).
  const walletOwners = new Map<string, Set<string>>();
  for (const a of accounts) for (const w of a.wallets) walletOwners.set(w.toLowerCase(), (walletOwners.get(w.toLowerCase()) ?? new Set()).add(a.uid));
  for (const [w, owners] of walletOwners) flag([...owners], `wallet:${w.slice(0, 10)}`, "Same wallet linked to several accounts");
  // 2. Same device.
  for (const [d, list] of group((a) => a.deviceId)) flag(list.map((a) => a.uid), `device:${String(d).slice(0, 8)}`, "Several staking accounts from one device");
  // 3. Same funding source.
  for (const [f, list] of group((a) => a.fundingSource?.toLowerCase())) flag(list.map((a) => a.uid), `funder:${String(f).slice(0, 10)}`, "Wallets funded by the same address");
  // 4. Same network and joined within a short window.
  for (const [ip, list] of group((a) => a.ipHash)) {
    const sorted = [...list].sort((a, b) => a.joinedAt - b.joinedAt);
    const burst: AccountSignals[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const near = sorted.filter((b) => Math.abs(b.joinedAt - sorted[i].joinedAt) <= JOIN_WINDOW_MS);
      if (near.length >= 3) burst.push(...near);
    }
    flag([...new Set(burst.map((a) => a.uid))], `ip:${String(ip).slice(0, 8)}`, "3+ accounts joined from one network within 10 minutes");
  }
  return [...flags.values()];
}

export function applyFlags(members: DaoMembership[], flags: SybilFlag[], now: number): DaoMembership[] {
  const byUid = new Map(flags.map((f) => [f.uid, f]));
  return members.map((m) => {
    const f = byUid.get(m.uid);
    if (!f || m.flagged) return m;
    return { ...m, flagged: { reason: f.reason, cluster: f.cluster, at: now } };
  });
}
