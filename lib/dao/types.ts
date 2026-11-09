/**
 * FESTIVAL DAO domain types.
 * These mirror the tables in db/migrations/0002_festival_dao.sql so a
 * production repository can return the same shapes as the demo store.
 * All timestamps are epoch milliseconds (UTC) in memory and timestamptz in SQL.
 */

export const DAO_ROLES = ["member", "moderator", "organizer", "treasurer", "venue_owner"] as const;
export type DaoRole = (typeof DAO_ROLES)[number];

export type DaoStatus = "forming" | "active" | "building" | "festival" | "archived";

export interface DaoConfig {
  /** ERC-20 staking token. Demo DAOs use a placeholder address on the demo chain. */
  tokenContract: `0x${string}`;
  /** Staking contract that locks the token (must be independently audited for production). */
  stakingContract: `0x${string}`;
  chainId: number;
  tokenSymbol: string;
  minimumStake: number;
  lockDurationDays: number;
  /** Fixed eligibility snapshot for DAO-wide decisions (each vote also takes its own snapshot). */
  eligibilitySnapshotAt: number;
  votingStartAt: number;
  votingEndAt: number;
  unstakingRules: string;
  /** Default quorum (share of eligible voters) and approval threshold for new votes. */
  defaultQuorum: number;
  defaultThreshold: number;
  discussionDays: number;
  votingDays: number;
}

export interface EventDao {
  id: string; // dao id
  eventId: string;
  status: DaoStatus;
  createdAt: number;
  organizerUid: string;
  config: DaoConfig;
  description: string;
  /** Demo DAOs are sample data and say so in the UI. */
  isDemo: boolean;
}

export interface StakePosition {
  id: string;
  daoId: string;
  uid: string;
  wallet: `0x${string}`;
  amount: number;
  stakedAt: number;
  lockedUntil: number;
  status: "locked" | "unlocking" | "withdrawn";
  /** Where the position was verified from. "demo-ledger" never touches a chain. */
  source: "demo-ledger" | "onchain";
  txHash?: string;
}

export interface DaoMembership {
  daoId: string;
  uid: string;
  handle: string;
  roles: DaoRole[];
  joinedAt: number;
  xp: number;
  badges: BadgeId[];
  /** Possible duplicate person (sybil heuristic). Ballots are held, XP frozen. */
  flagged?: { reason: string; at: number; cluster: string };
  suspendedUntil?: number;
  isDemo?: boolean;
}

/* ---------- discussion ---------- */

export const DISCUSSION_CATEGORIES = [
  "stage_design",
  "lighting",
  "dj_lineup",
  "music_direction",
  "venue_layout",
  "decoration",
  "food_drinks",
  "after_party",
  "budget",
  "general",
] as const;
export type DiscussionCategory = (typeof DISCUSSION_CATEGORIES)[number];

export type Visibility = "public" | "members" | "private";

export const REACTIONS = ["fire", "alien", "heart", "think", "nope"] as const;
export type ReactionKind = (typeof REACTIONS)[number];

export interface Discussion {
  id: string;
  daoId: string;
  category: DiscussionCategory;
  title: string;
  body: string;
  authorUid: string;
  authorHandle: string;
  createdAt: number;
  lastActivityAt: number;
  visibility: Visibility;
  pinned: boolean;
  locked: boolean;
  hidden: boolean;
  attachments: string[]; // media ids
  proposalIds: string[];
  reactions: Partial<Record<ReactionKind, string[]>>; // kind -> uids
  reports: { uid: string; reason: string; at: number }[];
  commentCount: number;
  /** Stage design concept being discussed, if any. */
  conceptId?: string;
  djId?: string;
}

export interface DaoComment {
  id: string;
  discussionId: string;
  parentId: string | null;
  authorUid: string;
  authorHandle: string;
  body: string;
  createdAt: number;
  attachments: string[];
  reactions: Partial<Record<ReactionKind, string[]>>;
  reports: { uid: string; reason: string; at: number }[];
  hidden: boolean;
}

/* ---------- proposals ---------- */

export const PROPOSAL_STATES = [
  "DRAFT",
  "DISCUSSION",
  "REVIEW",
  "VOTING",
  "APPROVED",
  "REJECTED",
  "FEASIBILITY_CHECK",
  "ORGANIZER_CONFIRMATION",
  "EXECUTION",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
  "RE_REVIEW",
] as const;
export type ProposalState = (typeof PROPOSAL_STATES)[number];

export const VOTING_METHODS = ["single", "yes_no_abstain", "multiple", "ranked"] as const;
export type VotingMethod = (typeof VOTING_METHODS)[number];

export interface VoteOption {
  id: string;
  label: string;
  /** Concept or DJ shown large on the ballot. */
  conceptId?: string;
  djId?: string;
  imageMediaId?: string;
}

export interface ProposalVersion {
  version: number;
  title: string;
  description: string;
  proposedChange: string;
  estimatedCost: number;
  options: VoteOption[];
  attachments: string[];
  documents: { name: string; mediaId?: string; url?: string }[];
  createdAt: number;
  authorUid: string;
  note?: string;
}

export interface ProposalTransition {
  from: ProposalState;
  to: ProposalState;
  at: number;
  actorUid: string;
  reason?: string;
}

export interface Proposal {
  id: string;
  daoId: string;
  eventId: string;
  category: DiscussionCategory;
  state: ProposalState;
  authorUid: string;
  authorHandle: string;
  createdAt: number;
  method: VotingMethod;
  discussionDays: number;
  votingDays: number;
  versions: ProposalVersion[];
  history: ProposalTransition[];
  discussionId?: string;
  voteId?: string;
  feasibility?: FeasibilityReport;
  /** Public explanation when the organizer cannot execute an approved result. */
  executionReport?: { at: number; byUid: string; status: "executing" | "cannot_execute" | "done"; message: string };
  conceptIds: string[];
  isDemo?: boolean;
}

/* ---------- votes ---------- */

export interface EligibilitySnapshot {
  id: string;
  daoId: string;
  takenAt: number;
  minimumStake: number;
  /** Eligible accounts (one entry per account, never per wallet). */
  eligible: string[];
  /** Accounts with a stake but excluded, and why. */
  excluded: { uid: string; reason: string }[];
  hash: string;
}

export interface DaoVote {
  id: string;
  daoId: string;
  proposalId: string;
  proposalVersion: number;
  method: VotingMethod;
  options: VoteOption[];
  maxChoices: number;
  startAt: number;
  endAt: number;
  quorum: number; // share of eligible voters (0..1)
  threshold: number; // approval threshold (0..1)
  snapshot: EligibilitySnapshot;
  status: "scheduled" | "open" | "closed";
  result?: VoteResult;
}

export interface BallotReceipt {
  id: string;
  voteId: string;
  uid: string;
  /** single/yes_no: [optionId]; multiple: optionIds; ranked: optionIds in preference order */
  choice: string[];
  castAt: number;
  /** Held = account flagged as possible duplicate; excluded from tally until cleared. */
  held: boolean;
  prevHash: string;
  hash: string;
}

export interface VoteResult {
  finalizedAt: number;
  eligible: number;
  turnout: number; // counted ballots
  heldBallots: number;
  quorumMet: boolean;
  passed: boolean;
  winner: string | null;
  tally: Record<string, number>;
  /** Ranked choice rounds (instant runoff). */
  rounds?: Record<string, number>[];
  outcome: "APPROVED" | "REJECTED" | "EXPIRED";
  resultHash: string;
}

/* ---------- media / venue / stage design ---------- */

export interface MediaObject {
  id: string;
  daoId: string;
  ownerUid: string;
  mime: "image/jpeg" | "image/png" | "image/webp" | "image/svg+xml";
  bytes: number;
  width?: number;
  height?: number;
  visibility: Visibility;
  createdAt: number;
  sha256: string;
  /** Seeded illustrations are generated, not uploaded. */
  generated?: boolean;
  label?: string;
}

export interface VenueSpec {
  venueId?: string;
  name: string;
  location: string;
  setting: "indoor" | "outdoor";
  capacity: number;
  stageWidthM: number;
  stageDepthM: number;
  ceilingHeightM: number;
  powerKw: number;
  existingEquipment: string[];
  budgetUsd: number;
  safetyRestrictions: string[];
}

export interface VenuePhoto {
  id: string;
  daoId: string;
  mediaId: string;
  caption: string;
  uploadedBy: string;
  uploadedAt: number;
  /** Normalised (0..1) area where a stage can be installed. */
  stageZone: { x: number; y: number; w: number; h: number };
  /** Horizon/ceiling line (0..1) used to aim the lighting rig. */
  ceilingY: number;
  rights: {
    attestedBy: string;
    attestedAt: number;
    basis: "owner" | "licensed" | "organizer_contract";
    status: "self_attested" | "verified" | "rejected";
    verifiedBy?: string;
  };
}

export const STAGE_THEMES = [
  "alien_invasion",
  "cyber_rave",
  "psychedelic_jungle",
  "underground_warehouse",
  "cosmic_portal",
  "mutant_carnival",
  "neon_industrial",
  "custom",
] as const;
export type StageTheme = (typeof STAGE_THEMES)[number];

export type BoothStyle = "ufo" | "pod" | "crate" | "skull" | "altar";
export type Installation = "tentacles" | "rings" | "vines" | "pipes" | "orbs" | "none";
export type Layout = "center" | "wide" | "split" | "arch" | "tower";

export interface ConceptSpec {
  layout: Layout;
  palette: [string, string, string];
  ledScreens: number; // 0..3 behind the booth
  ledSides: boolean;
  beams: number; // light beams from the rig
  lasers: boolean;
  alienScale: number; // 0.5..1.8
  alienCount: number; // 0..3
  booth: BoothStyle;
  speakerDeco: boolean;
  installation: Installation;
  haze: number; // 0..1
  pyroFx: boolean; // CO2 / flame effects
}

export interface BudgetLine {
  item: string;
  low: number;
  high: number;
}

export interface ConceptVersion {
  version: number;
  spec: ConceptSpec;
  instruction?: string;
  /** Instruction parts the editor understood / could not apply. */
  applied: string[];
  ignored: string[];
  createdAt: number;
  createdBy: string;
  provider: "demo-compositor" | "image-model";
  prompt: string;
  estimate: { low: number; high: number; lines: BudgetLine[]; basis: "ai_reference_estimate" };
}

export interface StageConcept {
  id: string;
  projectId: string;
  daoId: string;
  name: string;
  theme: StageTheme;
  creatorUid: string;
  creatorHandle: string;
  description: string;
  photoId: string; // venue photo used as the base
  versions: ConceptVersion[];
  published: boolean;
  createdAt: number;
  proposalId?: string;
  discussionId?: string;
  isDemo?: boolean;
}

export interface StageDesignProject {
  id: string;
  daoId: string;
  createdBy: string;
  createdAt: number;
  venue: VenueSpec;
  photoIds: string[];
  theme: StageTheme;
  customTheme?: string;
  conceptIds: string[];
}

/* ---------- feasibility ---------- */

export const FEASIBILITY_ITEMS = [
  "budget",
  "capacity",
  "structural",
  "electrical",
  "fire",
  "exits",
  "sound",
  "permits",
  "suppliers",
  "schedule",
] as const;
export type FeasibilityItem = (typeof FEASIBILITY_ITEMS)[number];

export interface FeasibilityCheckResult {
  item: FeasibilityItem;
  status: "pass" | "warn" | "fail" | "needs_human";
  reason: string;
  alternative?: string;
}

export interface FeasibilityReport {
  at: number;
  checks: FeasibilityCheckResult[];
  overall: "feasible" | "conditional" | "not_feasible";
  advisoryOnly: true;
  signoffs: { role: "organizer" | "venue_manager" | "specialist"; uid: string; at: number; note?: string; demoStandIn?: boolean }[];
}

/* ---------- treasury ---------- */

export type TreasuryAccountKind = "staking_escrow" | "event_budget" | "ticket_revenue" | "sponsors";

export interface TreasuryAccount {
  id: string;
  daoId: string;
  kind: TreasuryAccountKind;
  label: string;
  balance: number;
  currency: string;
  /** Staking escrow is principal held for stakers: never spendable. */
  spendable: boolean;
}

export interface BudgetItem {
  id: string;
  daoId: string;
  category: DiscussionCategory;
  label: string;
  allocated: number;
  proposalId?: string;
}

export interface PaymentRequest {
  id: string;
  daoId: string;
  budgetItemId: string;
  fromAccount: TreasuryAccountKind;
  payee: string;
  amount: number;
  memo: string;
  requestedBy: string;
  requestedAt: number;
  requiredApprovals: number;
  requiredRoles: DaoRole[];
  approvals: { uid: string; role: DaoRole; at: number }[];
  evidenceMediaIds: string[];
  status: "pending" | "approved" | "executed_demo" | "rejected";
  executedAt?: number;
}

/* ---------- roadmap / game ---------- */

export interface Milestone {
  id: string;
  daoId: string;
  title: string;
  due: number;
  status: "todo" | "doing" | "done" | "blocked";
  proposalId?: string;
  note?: string;
}

export const BADGES = ["community", "designer", "voter", "founder", "cosmetic_antenna"] as const;
export type BadgeId = (typeof BADGES)[number];

export interface ActivityLog {
  id: string;
  daoId: string;
  at: number;
  actorUid: string;
  action: string;
  target?: string;
  detail?: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

export interface ModerationLog {
  id: string;
  daoId: string;
  at: number;
  moderatorUid: string;
  action: "hide" | "unhide" | "pin" | "unpin" | "lock" | "unlock" | "suspend" | "clear_flag" | "auto_hide";
  target: string;
  reason: string;
}

/* ---------- session ---------- */

export interface DaoSession {
  uid: string;
  wallet: `0x${string}`;
  chainId: number;
  issuedAt: number;
  /** Demo-only role override, chosen in DAO settings. Ignored in production. */
  demoRoles?: Record<string, DaoRole[]>;
  /** Demo-only stake positions, signed by the server so they survive instance restarts. */
  demoStakes?: Record<string, { amount: number; at: number; tx: string }>;
  deviceId: string;
}
