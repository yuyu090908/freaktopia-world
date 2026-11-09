import { describe, expect, it } from "vitest";
import { castBallot, liveCounts, takeSnapshot, tally, validateChoice, verifyChain } from "@/lib/dao/voting";
import { applyTransition, availableTransitions, canTransition } from "@/lib/dao/lifecycle";
import { ANON, can, canSee, denyReason, type Principal } from "@/lib/dao/permissions";
import { runFeasibility } from "@/lib/dao/feasibility";
import { approve, newRequest, summarize, tierFor, validateRequest } from "@/lib/dao/treasury";
import { badgesFor, xpFor, type XpEvent } from "@/lib/dao/game";
import { validateImage } from "@/lib/dao/upload";
import { applyInstruction, estimate, generateConceptSpecs, heightNeedM } from "@/lib/dao/stage";
import { detectSybils } from "@/lib/dao/sybil";
import type { BallotReceipt, BudgetItem, DaoMembership, DaoVote, EventDao, PaymentRequest, Proposal, StakePosition, TreasuryAccount, VenueSpec } from "@/lib/dao/types";

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 1);

const member = (uid: string, extra: Partial<DaoMembership> = {}): DaoMembership => ({ daoId: "d", uid, handle: uid, roles: ["member"], joinedAt: T0 - 30 * DAY, xp: 0, badges: [], ...extra });
const pos = (uid: string, amount: number, extra: Partial<StakePosition> = {}): StakePosition => ({ id: `p_${uid}_${amount}`, daoId: "d", uid, wallet: `0x${"1".repeat(40)}`, amount, stakedAt: T0 - 10 * DAY, lockedUntil: T0 + 30 * DAY, status: "locked", source: "demo-ledger", ...extra });

function makeVote(method: DaoVote["method"], eligible: string[], opts = ["a", "b", "c"], extra: Partial<DaoVote> = {}): DaoVote {
  const options = method === "yes_no_abstain" ? ["yes", "no", "abstain"].map((id) => ({ id, label: id })) : opts.map((id) => ({ id, label: id }));
  return {
    id: "v1",
    daoId: "d",
    proposalId: "p1",
    proposalVersion: 1,
    method,
    options,
    maxChoices: method === "multiple" ? 2 : 1,
    startAt: T0,
    endAt: T0 + 7 * DAY,
    quorum: 0.2,
    threshold: 0.5,
    snapshot: { id: "s", daoId: "d", takenAt: T0, minimumStake: 10, eligible, excluded: [], hash: "0".repeat(64) },
    status: "open",
    ...extra,
  };
}

function castAll(v: DaoVote, choices: [string, string[]][], flagged: string[] = []) {
  const receipts: BallotReceipt[] = [];
  choices.forEach(([uid, c], i) => {
    const r = castBallot(v, receipts, uid, c, T0 + (i + 1) * 1000, { flagged: flagged.includes(uid), id: `b${i}` });
    if (!r.ok) throw new Error(r.code);
    receipts.push(r.receipt);
  });
  return receipts;
}

describe("eligibility snapshot", () => {
  it("one entry per account, sums wallets, excludes non-members, low stakes, suspended and late stakers", () => {
    const members = [member("u1"), member("u2"), member("u3", { suspendedUntil: T0 + DAY }), member("u5")];
    const positions = [pos("u1", 6), pos("u1", 6, { id: "x", wallet: `0x${"2".repeat(40)}` }), pos("u2", 5), pos("u3", 50), pos("u4", 50), pos("u5", 50, { stakedAt: T0 + 1 })];
    const s = takeSnapshot("d", positions, members, 10, T0, "snap");
    expect(s.eligible).toEqual(["u1"]);
    expect(Object.fromEntries(s.excluded.map((e) => [e.uid, e.reason]))).toEqual({ u2: "BELOW_MINIMUM_STAKE", u3: "SUSPENDED", u4: "NOT_A_MEMBER" });
    expect(s.hash).toMatch(/^[0-9a-f]{64}$/);
    // Deterministic hash
    expect(takeSnapshot("d", positions, members, 10, T0, "snap").hash).toBe(s.hash);
  });
});

describe("ballots", () => {
  it("prevents double votes, non-snapshot voters, closed votes and invalid choices", () => {
    const v = makeVote("single", ["u1", "u2"]);
    const rs = castAll(v, [["u1", ["a"]]]);
    expect(castBallot(v, rs, "u1", ["b"], T0 + 5000, { flagged: false, id: "x" })).toEqual({ ok: false, code: "ALREADY_VOTED" });
    expect(castBallot(v, rs, "u9", ["a"], T0 + 5000, { flagged: false, id: "x" })).toEqual({ ok: false, code: "NOT_IN_SNAPSHOT" });
    expect(castBallot(v, rs, "u2", ["zzz"], T0 + 5000, { flagged: false, id: "x" })).toEqual({ ok: false, code: "INVALID_CHOICE" });
    expect(castBallot(v, rs, "u2", ["a"], v.endAt, { flagged: false, id: "x" })).toEqual({ ok: false, code: "VOTE_CLOSED" });
    expect(castBallot(v, rs, "u2", ["a"], T0 - 1, { flagged: false, id: "x" })).toEqual({ ok: false, code: "VOTE_NOT_OPEN" });
  });

  it("validates choices per method", () => {
    const opts = ["a", "b", "c"].map((id) => ({ id, label: id }));
    expect(validateChoice("single", opts, 1, ["a", "b"])).toBe(false);
    expect(validateChoice("multiple", opts, 2, ["a", "b"])).toBe(true);
    expect(validateChoice("multiple", opts, 2, ["a", "b", "c"])).toBe(false);
    expect(validateChoice("multiple", opts, 2, ["a", "a"])).toBe(false);
    expect(validateChoice("ranked", opts, 1, ["c", "a", "b"])).toBe(true);
  });

  it("hash-chains receipts and detects tampering", () => {
    const v = makeVote("single", ["u1", "u2", "u3"]);
    const rs = castAll(v, [["u1", ["a"]], ["u2", ["b"]], ["u3", ["a"]]]);
    expect(verifyChain(v, rs)).toBe(-1);
    const forged = rs.map((r, i) => (i === 1 ? { ...r, choice: ["a"] } : r));
    expect(verifyChain(v, forged)).toBe(1);
  });
});

describe("tally", () => {
  const voters = Array.from({ length: 10 }, (_, i) => `u${i}`);

  it("1 account = 1 vote; held ballots are excluded", () => {
    const v = makeVote("single", voters);
    const rs = castAll(v, [["u0", ["a"]], ["u1", ["a"]], ["u2", ["b"]], ["u3", ["b"]], ["u4", ["b"]]], ["u3", "u4"]);
    const r = tally(v, rs, v.endAt);
    expect(r.tally).toEqual({ a: 2, b: 1, c: 0 });
    expect(r.heldBallots).toBe(2);
    expect(r.turnout).toBe(3);
    expect(r.winner).toBe("a");
    expect(liveCounts(v, rs).ballots).toBe(3);
  });

  it("expires when quorum is not met", () => {
    const v = makeVote("single", voters, ["a", "b"], { quorum: 0.5 });
    const r = tally(v, castAll(v, [["u0", ["a"]]]), v.endAt);
    expect(r.quorumMet).toBe(false);
    expect(r.outcome).toBe("EXPIRED");
    expect(r.winner).toBeNull();
  });

  it("yes/no/abstain: abstain counts for quorum but not for the threshold", () => {
    const v = makeVote("yes_no_abstain", voters);
    const r = tally(v, castAll(v, [["u0", ["yes"]], ["u1", ["yes"]], ["u2", ["no"]], ["u3", ["abstain"]], ["u4", ["abstain"]]]), v.endAt);
    expect(r.outcome).toBe("APPROVED");
    const v2 = makeVote("yes_no_abstain", voters, [], { threshold: 0.7 });
    expect(tally(v2, castAll(v2, [["u0", ["yes"]], ["u1", ["yes"]], ["u2", ["no"]]]), v2.endAt).outcome).toBe("REJECTED");
  });

  it("single choice tie has no winner", () => {
    const v = makeVote("single", voters, ["a", "b"]);
    const r = tally(v, castAll(v, [["u0", ["a"]], ["u1", ["b"]]]), v.endAt);
    expect(r.winner).toBeNull();
    expect(r.outcome).toBe("REJECTED");
  });

  it("ranked choice uses instant runoff", () => {
    const v = makeVote("ranked", voters);
    // a: 4 first prefs, b: 3, c: 3 whose next pref is b → b wins after c is eliminated.
    const ballots: [string, string[]][] = [
      ["u0", ["a", "b", "c"]], ["u1", ["a", "b", "c"]], ["u2", ["a", "c", "b"]], ["u3", ["a", "c", "b"]],
      ["u4", ["b", "a", "c"]], ["u5", ["b", "a", "c"]], ["u6", ["b", "c", "a"]],
      ["u7", ["c", "b", "a"]], ["u8", ["c", "b", "a"]], ["u9", ["c", "b", "a"]],
    ];
    const r = tally(v, castAll(v, ballots), v.endAt);
    expect(r.winner).toBe("b");
    expect(r.rounds!.length).toBeGreaterThan(1);
  });

  it("result hash is reproducible", () => {
    const v = makeVote("single", voters);
    const rs = castAll(v, [["u0", ["a"]], ["u1", ["a"]], ["u2", ["b"]]]);
    expect(tally(v, rs, v.endAt).resultHash).toBe(tally(v, rs, v.endAt).resultHash);
  });
});

describe("proposal lifecycle", () => {
  const base = (state: Proposal["state"], extra: Partial<Proposal> = {}): Proposal => ({
    id: "p", daoId: "d", eventId: "e", category: "general", state, authorUid: "author", authorHandle: "a", createdAt: T0, method: "yes_no_abstain", discussionDays: 3, votingDays: 7,
    versions: [{ version: 1, title: "t", description: "d", proposedChange: "c", estimatedCost: 0, options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }], attachments: [], documents: [], createdAt: T0, authorUid: "author" }],
    history: [{ from: "DRAFT", to: "DISCUSSION", at: T0, actorUid: "author" }], conceptIds: [], ...extra,
  });

  it("authors wait for the discussion period; organizers may fast-track", () => {
    const p = base("DISCUSSION");
    expect(canTransition(p, "REVIEW", ["author"], T0 + DAY).code).toBe("DISCUSSION_PERIOD_RUNNING");
    expect(canTransition(p, "REVIEW", ["author"], T0 + 3 * DAY).ok).toBe(true);
    expect(canTransition(p, "REVIEW", ["organizer"], T0 + DAY).ok).toBe(true);
  });

  it("only the system closes a vote; cancel needs a reason", () => {
    const p = base("VOTING");
    expect(canTransition(p, "APPROVED", ["organizer"], T0).code).toBe("FORBIDDEN_TRANSITION");
    expect(canTransition(p, "APPROVED", ["system"], T0).ok).toBe(true);
    expect(canTransition(p, "CANCELLED", ["organizer"], T0, "short").code).toBe("REASON_REQUIRED");
    expect(canTransition(p, "CANCELLED", ["organizer"], T0, "Venue withdrew its permit.").ok).toBe(true);
    expect(canTransition(p, "COMPLETED", ["organizer"], T0).code).toBe("INVALID_TRANSITION");
  });

  it("feasibility gate needs a feasible report and all three sign-offs", () => {
    const report = { at: T0, checks: [], overall: "conditional" as const, advisoryOnly: true as const, signoffs: [{ role: "organizer" as const, uid: "o", at: T0 }] };
    expect(canTransition(base("FEASIBILITY_CHECK"), "ORGANIZER_CONFIRMATION", ["organizer"], T0).code).toBe("FEASIBILITY_NOT_RUN");
    expect(canTransition(base("FEASIBILITY_CHECK", { feasibility: report }), "ORGANIZER_CONFIRMATION", ["organizer"], T0).code).toBe("SIGNOFFS_MISSING");
    const all = { ...report, signoffs: [...report.signoffs, { role: "venue_manager" as const, uid: "v", at: T0 }, { role: "specialist" as const, uid: "s", at: T0 }] };
    expect(canTransition(base("FEASIBILITY_CHECK", { feasibility: all }), "ORGANIZER_CONFIRMATION", ["organizer"], T0).ok).toBe(true);
    expect(canTransition(base("FEASIBILITY_CHECK", { feasibility: { ...all, overall: "not_feasible" } }), "ORGANIZER_CONFIRMATION", ["organizer"], T0).code).toBe("NOT_FEASIBLE");
  });

  it("REVIEW → VOTING needs two options; terminal states have no exits; history is appended", () => {
    const one = base("REVIEW", { versions: [{ ...base("REVIEW").versions[0], options: [{ id: "a", label: "A" }] }] });
    expect(canTransition(one, "VOTING", ["organizer"], T0).code).toBe("NEEDS_TWO_OPTIONS");
    expect(availableTransitions(base("COMPLETED"), ["organizer", "author"])).toEqual([]);
    const next = applyTransition(base("DISCUSSION"), "REVIEW", "org", T0 + 1);
    expect(next.history.at(-1)).toMatchObject({ from: "DISCUSSION", to: "REVIEW", actorUid: "org" });
  });
});

describe("permissions", () => {
  const p = (extra: Partial<Principal>): Principal => ({ uid: "u1", staked: true, membership: member("u1"), roles: ["member"], ...extra });
  it("wallet alone is never enough to post or vote", () => {
    expect(can(ANON, "read_public")).toBe(true);
    expect(can(ANON, "post")).toBe(false);
    expect(denyReason(ANON, "post").code).toBe("WALLET_REQUIRED");
    expect(can(p({ staked: false }), "vote")).toBe(false);
    expect(denyReason(p({ staked: false }), "vote").code).toBe("STAKE_REQUIRED");
    expect(can(p({}), "vote")).toBe(true);
  });
  it("suspension, private visibility and staff-only actions", () => {
    expect(can(p({ membership: member("u1", { suspendedUntil: Date.now() + DAY }) }), "post")).toBe(false);
    expect(canSee(p({}), "members")).toBe(true);
    expect(canSee(p({}), "private")).toBe(false);
    expect(canSee(p({ roles: ["organizer"] }), "private")).toBe(true);
    expect(can(p({}), "moderate")).toBe(false);
    expect(can(p({ roles: ["treasurer"] }), "approve_payment")).toBe(true);
    expect(can(p({ roles: ["venue_owner"] }), "upload_venue_photo")).toBe(true);
    expect(can(p({}), "manage_settings")).toBe(false);
  });
});

const venue: VenueSpec = { name: "Hall", location: "Berlin", setting: "indoor", capacity: 1000, stageWidthM: 14, stageDepthM: 8, ceilingHeightM: 7, powerKw: 120, existingEquipment: [], budgetUsd: 60_000, safetyRestrictions: ["No haze (smoke detectors)", "No open flame"] };

describe("feasibility (advisory)", () => {
  it("always returns 10 items, flags budget, capacity, fire and power problems with alternatives", () => {
    const [c] = generateConceptSpecs("alien_invasion", 3, "seed", venue);
    const r = runFeasibility({ venue, spec: { ...c.spec, haze: 0.6, pyroFx: true }, estimatedCost: 90_000, expectedAttendance: 1500, eventStartsAt: T0 + 5 * DAY, now: T0, permits: [{ name: "Event licence", status: "pending" }], suppliers: [{ item: "LED", confirmed: false }] });
    expect(r.checks).toHaveLength(10);
    expect(r.advisoryOnly).toBe(true);
    const byItem = Object.fromEntries(r.checks.map((x) => [x.item, x]));
    expect(byItem.budget.status).toBe("fail");
    expect(byItem.capacity.status).toBe("fail");
    expect(byItem.fire.status).toBe("fail");
    expect(byItem.budget.alternative).toBeTruthy();
    expect(r.overall).toBe("not_feasible");
  });
  it("a modest plan is at most conditional (human checks remain)", () => {
    const r = runFeasibility({ venue, estimatedCost: 10_000, expectedAttendance: 500, eventStartsAt: T0 + 60 * DAY, now: T0, permits: [{ name: "Event licence", status: "granted" }], suppliers: [{ item: "Bar", confirmed: true }] });
    expect(r.overall).not.toBe("not_feasible");
  });
});

describe("treasury", () => {
  const accounts: TreasuryAccount[] = [
    { id: "a1", daoId: "d", kind: "staking_escrow", label: "Stakes", balance: 500_000, currency: "FRK", spendable: false },
    { id: "a2", daoId: "d", kind: "event_budget", label: "Budget", balance: 20_000, currency: "USD", spendable: true },
  ];
  const items: BudgetItem[] = [{ id: "b1", daoId: "d", category: "stage_design", label: "Stage", allocated: 15_000 }];
  it("staking principal is separate and never spendable", () => {
    expect(summarize(accounts, items, []).stakedTokens).toBe(500_000);
    expect(summarize(accounts, items, []).remaining).toBe(20_000);
    expect(validateRequest(100, "staking_escrow", "b1", accounts, items, [])).toBe("STAKE_FUNDS_LOCKED");
    expect(validateRequest(16_000, "event_budget", "b1", accounts, items, [])).toBe("OVER_BUDGET_ITEM");
    expect(validateRequest(100, "event_budget", "nope", accounts, items, [])).toBe("UNKNOWN_BUDGET_ITEM");
    expect(validateRequest(-1, "event_budget", "b1", accounts, items, [])).toBe("INVALID_AMOUNT");
    expect(validateRequest(5_000, "event_budget", "b1", accounts, items, [])).toBeNull();
  });
  it("approval tiers: large payments need several different people and roles, never the requester", () => {
    expect(tierFor(1_999).approvals).toBe(1);
    expect(tierFor(2_000).approvals).toBe(2);
    expect(tierFor(10_000).approvals).toBe(3);
    let pay: PaymentRequest = newRequest({ id: "pay", daoId: "d", budgetItemId: "b1", fromAccount: "event_budget", payee: "LED Co", amount: 12_000, memo: "LED", requestedBy: "org", requestedAt: T0, evidenceMediaIds: [] });
    expect(approve(pay, "org", ["organizer"], T0)).toEqual({ ok: false, code: "SELF_APPROVAL" });
    const r1 = approve(pay, "org2", ["organizer"], T0);
    if (!r1.ok) throw new Error();
    pay = r1.payment;
    expect(approve(pay, "org3", ["organizer"], T0)).toEqual({ ok: false, code: "ROLE_ALREADY_COVERED" });
    expect(approve(pay, "fan", ["member"], T0)).toEqual({ ok: false, code: "ROLE_NOT_REQUIRED" });
    const r2 = approve(pay, "tre", ["treasurer"], T0);
    if (!r2.ok) throw new Error();
    expect(r2.payment.status).toBe("pending");
    const r3 = approve(r2.payment, "mod", ["moderator"], T0);
    if (!r3.ok) throw new Error();
    expect(r3.payment.status).toBe("approved");
  });
});

describe("XP anti-spam and badges", () => {
  const m = member("u1");
  const ev = (e: Partial<XpEvent>): XpEvent => ({ uid: "u1", daoId: "d", action: "comment", at: T0, xp: 3, ...e });
  it("rejects short, duplicate, repeated, too-fast and flagged activity; caps daily XP", () => {
    expect(xpFor([], m, "discussion", T0, { length: 5 }).reason).toBe("TOO_SHORT");
    expect(xpFor([ev({ contentHash: "h" })], m, "comment", T0 + 60_000, { contentHash: "h", length: 40 }).reason).toBe("DUPLICATE_CONTENT");
    expect(xpFor([ev({ action: "vote", target: "v1", xp: 15 })], m, "vote", T0 + 1, { target: "v1" }).reason).toBe("ALREADY_AWARDED");
    expect(xpFor([ev({})], m, "comment", T0 + 1000, { length: 40 }).reason).toBe("COOLDOWN");
    expect(xpFor([], member("u1", { flagged: { reason: "x", at: T0, cluster: "c" } }), "vote", T0, { target: "v" }).reason).toBe("FLAGGED_ACCOUNT");
    const full = Array.from({ length: 10 }, (_, i) => ev({ action: "vote", target: `v${i}`, xp: 15, at: T0 + i }));
    expect(xpFor(full, m, "vote", T0 + 100, { target: "new" }).reason).toBe("DAILY_CAP");
    expect(xpFor([], m, "vote", T0, { target: "v" }).xp).toBe(15);
  });
  it("awards badges", () => {
    const log = [...Array.from({ length: 5 }, (_, i) => ev({ at: T0 + i * DAY })), ev({ action: "concept", xp: 30 }), ...[1, 2, 3].map((i) => ev({ action: "vote", target: `v${i}`, xp: 15 }))];
    const dao = { status: "active" } as EventDao;
    const b = badgesFor(member("u1", { xp: 120 }), log, dao, null);
    expect(b).toEqual(expect.arrayContaining(["community", "designer", "voter", "cosmetic_antenna"]));
    expect(b).not.toContain("founder");
  });
});

describe("sybil heuristics", () => {
  it("flags shared devices, funders and sign-up bursts from one network", () => {
    const flags = detectSybils([
      { uid: "a", wallets: ["0xA"], deviceId: "dev1", ipHash: "ip1", joinedAt: T0 },
      { uid: "b", wallets: ["0xB"], deviceId: "dev1", ipHash: "ip2", joinedAt: T0 + DAY },
      { uid: "c", wallets: ["0xC"], deviceId: "dev3", ipHash: "ip9", joinedAt: T0, fundingSource: "0xF" },
      { uid: "d", wallets: ["0xD"], deviceId: "dev4", ipHash: "ip8", joinedAt: T0, fundingSource: "0xf" },
      { uid: "e", wallets: ["0xE"], deviceId: "dev5", ipHash: "ip7", joinedAt: T0 },
      { uid: "f", wallets: ["0xF1"], deviceId: "dev6", ipHash: "ip7", joinedAt: T0 + 60_000 },
      { uid: "g", wallets: ["0xG"], deviceId: "dev7", ipHash: "ip7", joinedAt: T0 + 120_000 },
      { uid: "h", wallets: ["0xH"], deviceId: "dev8", ipHash: "ip6", joinedAt: T0 },
    ]);
    expect(flags.map((f) => f.uid).sort()).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
  });
});

describe("upload validation (magic bytes)", () => {
  const png = (w: number, h: number) => {
    const b = new Uint8Array(33);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    new DataView(b.buffer).setUint32(16, w);
    new DataView(b.buffer).setUint32(20, h);
    return b;
  };
  it("accepts a real PNG header and rejects spoofed / small / SVG / empty files", () => {
    expect(validateImage(png(1200, 800), "image/png")).toMatchObject({ ok: true, mime: "image/png", width: 1200, height: 800 });
    expect(validateImage(png(100, 100), "image/png")).toEqual({ ok: false, code: "IMAGE_TOO_SMALL" });
    expect(validateImage(png(1200, 800), "image/jpeg")).toEqual({ ok: false, code: "TYPE_MISMATCH" });
    expect(validateImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"), "image/svg+xml")).toEqual({ ok: false, code: "UNSUPPORTED_TYPE" });
    expect(validateImage(new Uint8Array(0), "image/png")).toEqual({ ok: false, code: "EMPTY_FILE" });
    expect(validateImage(png(1200, 800), "image/png", 10)).toEqual({ ok: false, code: "FILE_TOO_LARGE" });
  });
});

describe("AI stage designer", () => {
  it("generates 3-5 distinct concepts that respect a low ceiling and haze restrictions", () => {
    const low: VenueSpec = { ...venue, ceilingHeightM: 4.5 };
    const out = generateConceptSpecs("alien_invasion", 5, "s1", low);
    expect(out).toHaveLength(5);
    expect(new Set(out.map((c) => c.name)).size).toBe(5);
    for (const c of out) {
      expect(heightNeedM(c.spec)).toBeLessThanOrEqual(low.ceilingHeightM - 0.5);
      expect(c.spec.layout).not.toBe("tower");
      expect(c.spec.haze).toBe(0);
      expect(c.spec.pyroFx).toBe(false);
    }
    expect(generateConceptSpecs("cyber_rave", 9, "s", venue).length).toBeLessThanOrEqual(5);
    expect(generateConceptSpecs("cyber_rave", 1, "s", venue).length).toBeGreaterThanOrEqual(3);
  });

  it("parses Japanese and English edit instructions and reports what it ignored", () => {
    const [{ spec }] = generateConceptSpecs("alien_invasion", 3, "s2", venue);
    const jp = applyInstruction({ ...spec, alienCount: 1, ledSides: false }, "宇宙人をもっと大きく、左右にLEDスクリーンを追加して、全体を紫にしてください");
    expect(jp.spec.alienScale).toBeGreaterThan(spec.alienScale > 1.7 ? 0 : spec.alienScale);
    expect(jp.spec.ledSides).toBe(true);
    expect(jp.spec.palette[0]).toBe("#A276E9");
    expect(jp.applied.length).toBeGreaterThanOrEqual(3);
    const en = applyInstruction(spec, "remove the lasers. make it cheaper. order a pizza");
    expect(en.spec.lasers).toBe(false);
    expect(en.ignored.join(" ")).toMatch(/pizza/);
    const nothing = applyInstruction(spec, "hello there");
    expect(nothing.applied).toEqual([]);
  });

  it("budget estimates are labelled as AI reference estimates and grow with the build", () => {
    const [{ spec }] = generateConceptSpecs("alien_invasion", 3, "s3", venue);
    const small = estimate({ ...spec, ledScreens: 0, ledSides: false, lasers: false, alienCount: 0 }, venue);
    const big = estimate({ ...spec, ledScreens: 3, ledSides: true, lasers: true, alienCount: 3 }, venue);
    expect(small.basis).toBe("ai_reference_estimate");
    expect(big.low).toBeGreaterThan(small.low);
    expect(big.high).toBeGreaterThanOrEqual(big.low);
  });
});
