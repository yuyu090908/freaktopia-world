/** Client-safe labels, colours and tunables for the FESTIVAL DAO. */
import type {
  BadgeId,
  DaoRole,
  DaoStatus,
  DiscussionCategory,
  FeasibilityItem,
  ProposalState,
  ReactionKind,
  StageTheme,
  VotingMethod,
} from "./types";

export const DEMO_CHAIN = { id: 31337, name: "FREAKTOPIA DEMO CHAIN (not a real network)" } as const;

/** Placeholder addresses on the demo chain. No contract is deployed at these addresses. */
export const DEMO_TOKEN = "0xF7EA00000000000000000000000000000000F7EA" as const;
export const DEMO_STAKING = "0x5A4E0000000000000000000000000000000005A4" as const;

export const DAO_RULES = {
  /** Votes never scale with stake: every eligible account has weight 1. */
  voteWeight: 1,
  maxUploadBytes: 8 * 1024 * 1024,
  maxPhotosPerUpload: 8,
  maxAttachmentBytes: 4 * 1024 * 1024,
  allowedMime: ["image/jpeg", "image/png", "image/webp"] as const,
  minPostChars: 20,
  minCommentChars: 2,
  autoHideReports: 3,
  nonceTtlMs: 5 * 60_000,
  sessionTtlMs: 7 * 86_400_000,
  /** Payment approvals: amount thresholds (USD) → approvals and roles needed. */
  approvalTiers: [
    { below: 2_000, approvals: 1, roles: ["organizer"] as DaoRole[] },
    { below: 10_000, approvals: 2, roles: ["organizer", "treasurer"] as DaoRole[] },
    { below: Infinity, approvals: 3, roles: ["organizer", "treasurer", "moderator"] as DaoRole[] },
  ],
  xp: {
    discussion: 10,
    comment: 3,
    proposal: 25,
    vote: 15,
    concept: 30,
    edit: 5,
    dailyCap: 150,
    cooldownMs: { comment: 20_000, discussion: 60_000, concept: 30_000, edit: 15_000, proposal: 120_000, vote: 0 },
  },
} as const;

export const STATUS_META: Record<DaoStatus, { label: string; color: string }> = {
  forming: { label: "Forming", color: "#FFAD5B" },
  active: { label: "DAO Active", color: "#B6F05C" },
  building: { label: "Building", color: "#55BCEB" },
  festival: { label: "Festival", color: "#FF625C" },
  archived: { label: "Archived", color: "#b9b5ab" },
};

export const CATEGORY_LABEL: Record<DiscussionCategory, string> = {
  stage_design: "Stage Design",
  lighting: "Lighting",
  dj_lineup: "DJ Lineup",
  music_direction: "Music Direction",
  venue_layout: "Venue Layout",
  decoration: "Decoration",
  food_drinks: "Food & Drinks",
  after_party: "After Party",
  budget: "Budget",
  general: "General Discussion",
};

export const CATEGORY_COLOR: Record<DiscussionCategory, string> = {
  stage_design: "#B6F05C",
  lighting: "#A276E9",
  dj_lineup: "#FF625C",
  music_direction: "#55BCEB",
  venue_layout: "#FFAD5B",
  decoration: "#B6F05C",
  food_drinks: "#FFAD5B",
  after_party: "#A276E9",
  budget: "#55BCEB",
  general: "#F5F2EA",
};

export const REACTION_META: Record<ReactionKind, { emoji: string; label: string }> = {
  fire: { emoji: "🔥", label: "Fire" },
  alien: { emoji: "👽", label: "Alien" },
  heart: { emoji: "💚", label: "Love" },
  think: { emoji: "🤔", label: "Hmm" },
  nope: { emoji: "🙅", label: "Nope" },
};

export const STATE_META: Record<ProposalState, { label: string; color: string; step: number }> = {
  DRAFT: { label: "Draft", color: "#b9b5ab", step: 0 },
  DISCUSSION: { label: "Discussion", color: "#55BCEB", step: 1 },
  REVIEW: { label: "Review", color: "#FFAD5B", step: 2 },
  RE_REVIEW: { label: "Re-review", color: "#FFAD5B", step: 2 },
  VOTING: { label: "Voting", color: "#B6F05C", step: 3 },
  APPROVED: { label: "Approved", color: "#B6F05C", step: 4 },
  REJECTED: { label: "Rejected", color: "#FF625C", step: 4 },
  EXPIRED: { label: "Expired", color: "#b9b5ab", step: 4 },
  FEASIBILITY_CHECK: { label: "Feasibility check", color: "#A276E9", step: 5 },
  ORGANIZER_CONFIRMATION: { label: "Organizer confirmation", color: "#A276E9", step: 6 },
  EXECUTION: { label: "Execution", color: "#55BCEB", step: 7 },
  COMPLETED: { label: "Completed", color: "#B6F05C", step: 8 },
  CANCELLED: { label: "Cancelled", color: "#FF625C", step: 8 },
};

export const LIFECYCLE_PATH: ProposalState[] = [
  "DRAFT",
  "DISCUSSION",
  "REVIEW",
  "VOTING",
  "APPROVED",
  "FEASIBILITY_CHECK",
  "ORGANIZER_CONFIRMATION",
  "EXECUTION",
  "COMPLETED",
];

export const METHOD_LABEL: Record<VotingMethod, string> = {
  single: "Single choice",
  yes_no_abstain: "Yes / No / Abstain",
  multiple: "Multiple choice",
  ranked: "Ranked choice",
};

export const THEME_META: Record<StageTheme, { label: string; palette: [string, string, string]; blurb: string }> = {
  alien_invasion: { label: "Alien Invasion", palette: ["#B6F05C", "#A276E9", "#FF625C"], blurb: "Saucers over the booth, tractor-beam lighting, giant slime visitors." },
  cyber_rave: { label: "Cyber Rave", palette: ["#55BCEB", "#FF4FD8", "#B6F05C"], blurb: "Grid LED walls, laser fans and chrome-wrapped DJ pod." },
  psychedelic_jungle: { label: "Psychedelic Jungle", palette: ["#B6F05C", "#FFAD5B", "#FF4FD8"], blurb: "UV vines, mushroom lamps and a living canopy over the floor." },
  underground_warehouse: { label: "Underground Warehouse", palette: ["#FF625C", "#FFAD5B", "#F5F2EA"], blurb: "Raw strobes, sodium haze, crates and pipes, no frills." },
  cosmic_portal: { label: "Cosmic Portal", palette: ["#A276E9", "#55BCEB", "#F5F2EA"], blurb: "A ring portal behind the booth with orbiting light orbs." },
  mutant_carnival: { label: "Mutant Carnival", palette: ["#FF625C", "#FFAD5B", "#B6F05C"], blurb: "Striped arches, bulb lights and a tentacled ringmaster booth." },
  neon_industrial: { label: "Neon Industrial", palette: ["#B6F05C", "#55BCEB", "#FF625C"], blurb: "Neon tubes on steel trusses, pipes and hard-edged beams." },
  custom: { label: "Custom Theme", palette: ["#B6F05C", "#A276E9", "#55BCEB"], blurb: "Describe your own theme." },
};

export const FEASIBILITY_LABEL: Record<FeasibilityItem, string> = {
  budget: "Budget",
  capacity: "Venue capacity",
  structural: "Structural safety",
  electrical: "Electrical capacity",
  fire: "Fire safety",
  exits: "Emergency exits",
  sound: "Sound restrictions",
  permits: "Local permits",
  suppliers: "Supplier availability",
  schedule: "Installation schedule",
};

export const BADGE_META: Record<BadgeId, { label: string; desc: string; color: string }> = {
  community: { label: "Community Badge", desc: "5 substantive comments or threads", color: "#55BCEB" },
  designer: { label: "Designer Badge", desc: "Published a stage concept to the gallery", color: "#B6F05C" },
  voter: { label: "Voting Achievement", desc: "Voted in 3 DAO votes", color: "#A276E9" },
  founder: { label: "Festival Founder", desc: "Joined while the DAO was forming", color: "#FFAD5B" },
  cosmetic_antenna: { label: "DAO Antenna (avatar)", desc: "Alien avatar cosmetic at 100 DAO XP", color: "#FF625C" },
};

export const ROLE_LABEL: Record<DaoRole, string> = {
  member: "Member",
  moderator: "Moderator",
  organizer: "Organizer",
  treasurer: "Treasurer",
  venue_owner: "Venue owner",
};

export const GAME_LEVELS = [
  { level: 1, key: "IDEA", label: "Idea", desc: "DAO formed around the event idea." },
  { level: 2, key: "VENUE", label: "Venue", desc: "Venue photos registered with usage rights." },
  { level: 3, key: "DESIGN", label: "Design", desc: "A stage design won a DAO vote." },
  { level: 4, key: "BUILD", label: "Build", desc: "Organizer confirmed and build milestones started." },
  { level: 5, key: "FESTIVAL", label: "Festival", desc: "The festival is live or completed." },
] as const;

export const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
