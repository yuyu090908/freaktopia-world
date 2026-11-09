/**
 * Proposal lifecycle state machine.
 * DRAFT → DISCUSSION → REVIEW → VOTING → APPROVED / REJECTED (/ EXPIRED when quorum fails)
 * → FEASIBILITY_CHECK → ORGANIZER_CONFIRMATION → EXECUTION → COMPLETED
 * plus CANCELLED, EXPIRED and RE_REVIEW (sent back for revision).
 */
import type { DaoRole, Proposal, ProposalState } from "./types";

type Actor = "author" | "organizer" | "moderator" | "system";

interface Rule {
  to: ProposalState;
  by: Actor[];
  needsReason?: boolean;
  /** Extra precondition, returns an error code or null. */
  check?: (p: Proposal, now: number) => string | null;
}

const DAY = 86_400_000;

const discussionDone = (p: Proposal, now: number) => {
  const entered = [...p.history].reverse().find((h) => h.to === "DISCUSSION")?.at ?? p.createdAt;
  return now - entered >= p.discussionDays * DAY ? null : "DISCUSSION_PERIOD_RUNNING";
};

export const TRANSITIONS: Record<ProposalState, Rule[]> = {
  DRAFT: [
    { to: "DISCUSSION", by: ["author"] },
    { to: "CANCELLED", by: ["author", "organizer"] },
  ],
  DISCUSSION: [
    // Authors must wait for the discussion period; organizers/moderators may fast-track (logged).
    { to: "REVIEW", by: ["author"], check: discussionDone },
    { to: "REVIEW", by: ["organizer", "moderator"] },
    { to: "CANCELLED", by: ["author", "organizer"], needsReason: true },
  ],
  REVIEW: [
    { to: "VOTING", by: ["organizer", "moderator"], check: (p) => (p.versions.at(-1)!.options.length >= 2 ? null : "NEEDS_TWO_OPTIONS") },
    { to: "RE_REVIEW", by: ["organizer", "moderator"], needsReason: true },
    { to: "CANCELLED", by: ["organizer"], needsReason: true },
  ],
  RE_REVIEW: [
    { to: "DISCUSSION", by: ["author", "organizer"] },
    { to: "CANCELLED", by: ["author", "organizer"], needsReason: true },
  ],
  VOTING: [
    // Only the vote engine moves a proposal out of VOTING (after the result is finalized).
    { to: "APPROVED", by: ["system"] },
    { to: "REJECTED", by: ["system"] },
    { to: "EXPIRED", by: ["system"] },
    { to: "CANCELLED", by: ["organizer"], needsReason: true },
  ],
  APPROVED: [
    { to: "FEASIBILITY_CHECK", by: ["organizer"] },
    { to: "CANCELLED", by: ["organizer"], needsReason: true },
  ],
  FEASIBILITY_CHECK: [
    {
      to: "ORGANIZER_CONFIRMATION",
      by: ["organizer"],
      check: (p) => {
        if (!p.feasibility) return "FEASIBILITY_NOT_RUN";
        if (p.feasibility.overall === "not_feasible") return "NOT_FEASIBLE";
        const roles = new Set(p.feasibility.signoffs.map((s) => s.role));
        return roles.has("organizer") && roles.has("venue_manager") && roles.has("specialist") ? null : "SIGNOFFS_MISSING";
      },
    },
    { to: "RE_REVIEW", by: ["organizer"], needsReason: true },
    { to: "CANCELLED", by: ["organizer"], needsReason: true },
  ],
  ORGANIZER_CONFIRMATION: [
    { to: "EXECUTION", by: ["organizer"] },
    // Cannot execute: must be explained publicly.
    { to: "CANCELLED", by: ["organizer"], needsReason: true },
  ],
  EXECUTION: [
    { to: "COMPLETED", by: ["organizer"] },
    { to: "CANCELLED", by: ["organizer"], needsReason: true },
  ],
  REJECTED: [{ to: "RE_REVIEW", by: ["author", "organizer"], needsReason: true }],
  EXPIRED: [{ to: "RE_REVIEW", by: ["author", "organizer"], needsReason: true }],
  COMPLETED: [],
  CANCELLED: [],
};

export function actorKinds(p: Proposal, uid: string, roles: DaoRole[]): Actor[] {
  const out: Actor[] = [];
  if (p.authorUid === uid) out.push("author");
  if (roles.includes("organizer")) out.push("organizer");
  if (roles.includes("moderator")) out.push("moderator");
  return out;
}

export interface TransitionCheck {
  ok: boolean;
  code?: string;
}

export function canTransition(p: Proposal, to: ProposalState, actors: Actor[], now: number, reason?: string): TransitionCheck {
  const rules = TRANSITIONS[p.state].filter((r) => r.to === to);
  if (!rules.length) return { ok: false, code: "INVALID_TRANSITION" };
  const allowed = rules.filter((r) => r.by.some((a) => actors.includes(a)));
  if (!allowed.length) return { ok: false, code: "FORBIDDEN_TRANSITION" };
  let lastErr = "FORBIDDEN_TRANSITION";
  for (const r of allowed) {
    if (r.needsReason && !(reason && reason.trim().length >= 10)) {
      lastErr = "REASON_REQUIRED";
      continue;
    }
    const err = r.check?.(p, now);
    if (err) {
      lastErr = err;
      continue;
    }
    return { ok: true };
  }
  return { ok: false, code: lastErr };
}

/** Next transitions this actor can see as buttons (preconditions not evaluated). */
export function availableTransitions(p: Proposal, actors: Actor[]): ProposalState[] {
  return [...new Set(TRANSITIONS[p.state].filter((r) => r.by.some((a) => actors.includes(a))).map((r) => r.to))];
}

export function applyTransition(p: Proposal, to: ProposalState, actorUid: string, now: number, reason?: string): Proposal {
  return { ...p, state: to, history: [...p.history, { from: p.state, to, at: now, actorUid, reason }] };
}

export const isTerminal = (s: ProposalState) => TRANSITIONS[s].length === 0;
