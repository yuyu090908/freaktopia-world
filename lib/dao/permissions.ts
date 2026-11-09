/**
 * Access control for the FESTIVAL DAO. Every API handler calls these; the UI
 * uses the same answers only to decide what to show.
 */
import type { DaoMembership, DaoRole, Discussion, MediaObject, Visibility } from "./types";

export interface Principal {
  uid: string | null;
  /** Verified stake meets the DAO minimum right now. */
  staked: boolean;
  membership: DaoMembership | null;
  roles: DaoRole[];
}

export const ANON: Principal = { uid: null, staked: false, membership: null, roles: [] };

export type Action =
  | "read_public"
  | "read_members"
  | "read_private"
  | "post"
  | "comment"
  | "react"
  | "report"
  | "create_proposal"
  | "vote"
  | "moderate"
  | "transition_admin"
  | "upload_venue_photo"
  | "verify_venue_rights"
  | "generate_concept"
  | "edit_concept"
  | "publish_concept"
  | "request_payment"
  | "approve_payment"
  | "manage_settings"
  | "feasibility";

const isStaff = (p: Principal) => p.roles.includes("organizer") || p.roles.includes("moderator");

export function can(p: Principal, action: Action): boolean {
  const member = !!p.uid && !!p.membership && p.staked && !(p.membership.suspendedUntil && p.membership.suspendedUntil > Date.now());
  switch (action) {
    case "read_public":
      return true;
    case "read_members":
      return member || isStaff(p);
    case "read_private":
      return isStaff(p);
    case "post":
    case "comment":
    case "react":
    case "create_proposal":
    case "vote":
    case "edit_concept":
    case "publish_concept":
      // Wallet connection alone is never enough: a verified stake is required.
      return member;
    case "generate_concept":
      return member || p.roles.includes("organizer") || p.roles.includes("venue_owner");
    case "report":
      return !!p.uid;
    case "moderate":
    case "transition_admin":
      return isStaff(p);
    case "upload_venue_photo":
      return !!p.uid && (p.roles.includes("organizer") || p.roles.includes("venue_owner"));
    case "verify_venue_rights":
    case "manage_settings":
    case "feasibility":
      return p.roles.includes("organizer");
    case "request_payment":
      return p.roles.includes("organizer") || p.roles.includes("treasurer");
    case "approve_payment":
      return p.roles.includes("organizer") || p.roles.includes("treasurer") || p.roles.includes("moderator");
  }
}

export function canSee(p: Principal, v: Visibility) {
  return v === "public" ? true : v === "members" ? can(p, "read_members") : can(p, "read_private");
}

export function canSeeDiscussion(p: Principal, d: Discussion) {
  if (!canSee(p, d.visibility)) return false;
  return !d.hidden || isStaff(p) || d.authorUid === p.uid;
}

export function canSeeMedia(p: Principal, m: MediaObject) {
  return canSee(p, m.visibility) || m.ownerUid === p.uid;
}

/** Why an action is not allowed, for the UI and 403 bodies. */
export function denyReason(p: Principal, action: Action): { code: string; message: string } {
  if (!p.uid) return { code: "WALLET_REQUIRED", message: "Connect a wallet and sign in first." };
  if (["post", "comment", "react", "create_proposal", "vote", "edit_concept", "publish_concept", "read_members"].includes(action)) {
    if (!p.membership || !p.staked) return { code: "STAKE_REQUIRED", message: "Stake the minimum amount to join this DAO. A connected wallet alone is not membership." };
    if (p.membership.suspendedUntil && p.membership.suspendedUntil > Date.now()) return { code: "SUSPENDED", message: "Your DAO account is temporarily suspended by a moderator." };
  }
  return { code: "FORBIDDEN", message: "Your role cannot do this." };
}
