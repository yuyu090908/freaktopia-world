/**
 * Voting engine.
 * - Eligibility is frozen in a snapshot when voting opens: accounts (not wallets)
 *   whose verified stake met the minimum at that instant. Stake added later never
 *   changes an open vote.
 * - Weight is always 1 per account (stake size is ignored).
 * - One ballot per account per vote (also enforced by a unique index in SQL).
 * - Ballots from accounts flagged as possible duplicates are recorded but held,
 *   and excluded from the tally until a moderator clears the flag.
 * - Receipts form a hash chain; the final result hash covers every receipt.
 */
import { sha256, stableJson } from "./hash";
import { DAO_RULES } from "./meta";
import type { BallotReceipt, DaoMembership, DaoVote, EligibilitySnapshot, StakePosition, VoteOption, VoteResult, VotingMethod } from "./types";

export function takeSnapshot(
  daoId: string,
  positions: StakePosition[],
  members: DaoMembership[],
  minimumStake: number,
  at: number,
  id: string,
): EligibilitySnapshot {
  const byUid = new Map<string, number>();
  for (const p of positions) {
    if (p.daoId !== daoId || p.status !== "locked" || p.stakedAt > at || p.lockedUntil < at) continue;
    // Several wallets of one account are summed for the minimum, but still one voter.
    byUid.set(p.uid, (byUid.get(p.uid) ?? 0) + p.amount);
  }
  const eligible: string[] = [];
  const excluded: { uid: string; reason: string }[] = [];
  const memberIds = new Set(members.filter((m) => m.daoId === daoId).map((m) => m.uid));
  for (const [uid, amount] of [...byUid.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const m = members.find((x) => x.uid === uid && x.daoId === daoId);
    if (!memberIds.has(uid)) excluded.push({ uid, reason: "NOT_A_MEMBER" });
    else if (amount < minimumStake) excluded.push({ uid, reason: "BELOW_MINIMUM_STAKE" });
    else if (m?.suspendedUntil && m.suspendedUntil > at) excluded.push({ uid, reason: "SUSPENDED" });
    else eligible.push(uid);
  }
  const hash = sha256(stableJson({ daoId, at, minimumStake, eligible, excluded }));
  return { id, daoId, takenAt: at, minimumStake, eligible, excluded, hash };
}

export type BallotError =
  | "VOTE_NOT_OPEN"
  | "VOTE_CLOSED"
  | "NOT_IN_SNAPSHOT"
  | "ALREADY_VOTED"
  | "INVALID_CHOICE";

export function validateChoice(method: VotingMethod, options: VoteOption[], maxChoices: number, choice: string[]): boolean {
  const ids = new Set(options.map((o) => o.id));
  if (!choice.length || new Set(choice).size !== choice.length || choice.some((c) => !ids.has(c))) return false;
  switch (method) {
    case "single":
    case "yes_no_abstain":
      return choice.length === 1;
    case "multiple":
      return choice.length <= Math.max(1, maxChoices);
    case "ranked":
      return choice.length >= 1 && choice.length <= options.length;
  }
}

export function castBallot(
  vote: DaoVote,
  existing: BallotReceipt[],
  uid: string,
  choice: string[],
  now: number,
  opts: { flagged: boolean; id: string },
): { ok: true; receipt: BallotReceipt } | { ok: false; code: BallotError } {
  if (now < vote.startAt || vote.status === "scheduled") return { ok: false, code: "VOTE_NOT_OPEN" };
  if (now >= vote.endAt || vote.status === "closed") return { ok: false, code: "VOTE_CLOSED" };
  if (!vote.snapshot.eligible.includes(uid)) return { ok: false, code: "NOT_IN_SNAPSHOT" };
  const mine = existing.filter((b) => b.voteId === vote.id);
  if (mine.some((b) => b.uid === uid)) return { ok: false, code: "ALREADY_VOTED" };
  if (!validateChoice(vote.method, vote.options, vote.maxChoices, choice)) return { ok: false, code: "INVALID_CHOICE" };
  const prevHash = mine.at(-1)?.hash ?? vote.snapshot.hash;
  const body = { voteId: vote.id, uid, choice, castAt: now, held: opts.flagged, prevHash, version: vote.proposalVersion };
  return { ok: true, receipt: { id: opts.id, voteId: vote.id, uid, choice, castAt: now, held: opts.flagged, prevHash, hash: sha256(stableJson(body)) } };
}

/** Recomputes the chain; returns the index of the first broken receipt or -1. */
export function verifyChain(vote: DaoVote, receipts: BallotReceipt[]): number {
  let prev = vote.snapshot.hash;
  const mine = receipts.filter((r) => r.voteId === vote.id);
  for (let i = 0; i < mine.length; i++) {
    const r = mine[i];
    const body = { voteId: r.voteId, uid: r.uid, choice: r.choice, castAt: r.castAt, held: r.held, prevHash: prev, version: vote.proposalVersion };
    if (r.prevHash !== prev || r.hash !== sha256(stableJson(body))) return i;
    prev = r.hash;
  }
  return -1;
}

function instantRunoff(options: VoteOption[], ballots: string[][]) {
  let alive = new Set(options.map((o) => o.id));
  const rounds: Record<string, number>[] = [];
  const total = ballots.filter((b) => b.length).length;
  for (let guard = 0; guard < options.length; guard++) {
    const count: Record<string, number> = Object.fromEntries([...alive].map((id) => [id, 0]));
    let active = 0;
    for (const b of ballots) {
      const top = b.find((c) => alive.has(c));
      if (top) {
        count[top]++;
        active++;
      }
    }
    rounds.push(count);
    const sorted = Object.entries(count).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (!sorted.length) break;
    if (sorted[0][1] * 2 > active || alive.size <= 1) return { winner: sorted[0][0], rounds, share: total ? sorted[0][1] / active : 0 };
    const min = Math.min(...sorted.map(([, v]) => v));
    const losers = sorted.filter(([, v]) => v === min).map(([k]) => k);
    // Eliminate the lowest (ties: the last by id so results are deterministic).
    const drop = losers.sort().at(-1)!;
    alive = new Set([...alive].filter((x) => x !== drop));
  }
  const last = rounds.at(-1) ?? {};
  const w = Object.entries(last).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return { winner: w?.[0] ?? null, rounds, share: 0 };
}

export function tally(vote: DaoVote, receipts: BallotReceipt[], now: number): VoteResult {
  const mine = receipts.filter((r) => r.voteId === vote.id);
  const counted = mine.filter((r) => !r.held && vote.snapshot.eligible.includes(r.uid));
  const held = mine.filter((r) => r.held).length;
  const eligible = vote.snapshot.eligible.length;
  const tallyMap: Record<string, number> = Object.fromEntries(vote.options.map((o) => [o.id, 0]));
  let rounds: Record<string, number>[] | undefined;
  let winner: string | null = null;
  let passed = false;
  const quorumMet = eligible > 0 && counted.length / eligible >= vote.quorum;

  if (vote.method === "ranked") {
    for (const r of counted) if (r.choice[0]) tallyMap[r.choice[0]] += DAO_RULES.voteWeight;
    const irv = instantRunoff(vote.options, counted.map((r) => r.choice));
    rounds = irv.rounds;
    winner = irv.winner;
    passed = !!winner && irv.share >= vote.threshold;
  } else {
    for (const r of counted) for (const c of r.choice) tallyMap[c] += DAO_RULES.voteWeight;
    if (vote.method === "yes_no_abstain") {
      const yes = tallyMap.yes ?? 0;
      const no = tallyMap.no ?? 0;
      passed = yes + no > 0 && yes / (yes + no) >= vote.threshold;
      winner = passed ? "yes" : "no";
    } else {
      const sorted = Object.entries(tallyMap).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      const tie = sorted.length > 1 && sorted[0][1] === sorted[1][1];
      winner = sorted[0] && sorted[0][1] > 0 && !tie ? sorted[0][0] : null;
      const denom = vote.method === "multiple" ? counted.length : counted.length;
      passed = !!winner && denom > 0 && tallyMap[winner] / denom >= vote.threshold;
    }
  }
  const outcome: VoteResult["outcome"] = !quorumMet ? "EXPIRED" : passed ? "APPROVED" : "REJECTED";
  const base = {
    finalizedAt: now,
    eligible,
    turnout: counted.length,
    heldBallots: held,
    quorumMet,
    passed: quorumMet && passed,
    winner: quorumMet ? winner : null,
    tally: tallyMap,
    rounds,
    outcome,
  };
  const resultHash = sha256(stableJson({ ...base, snapshot: vote.snapshot.hash, receipts: mine.map((r) => r.hash) }));
  return { ...base, resultHash };
}

/** Live (unofficial) counts for an open vote. */
export function liveCounts(vote: DaoVote, receipts: BallotReceipt[]) {
  const t: Record<string, number> = Object.fromEntries(vote.options.map((o) => [o.id, 0]));
  let n = 0;
  for (const r of receipts) {
    if (r.voteId !== vote.id || r.held) continue;
    n++;
    if (vote.method === "ranked") t[r.choice[0]]++;
    else for (const c of r.choice) t[c]++;
  }
  return { counts: t, ballots: n, participation: vote.snapshot.eligible.length ? n / vote.snapshot.eligible.length : 0 };
}
