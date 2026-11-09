"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useDaoQuery, type ApiError } from "@/lib/dao/client";
import type { ConceptSpec, DaoConfig, DaoRole, DaoStatus, ProposalState, VotingMethod, BadgeId, DiscussionCategory, ConceptVersion } from "@/lib/dao/types";

export interface ConceptDto {
  id: string;
  name: string;
  theme: string;
  creatorHandle: string;
  creatorUid: string;
  description: string;
  published: boolean;
  createdAt: number;
  photo: { id: string; url: string; stageZone: { x: number; y: number; w: number; h: number }; ceilingY: number; caption: string; generated: boolean } | null;
  current: ConceptVersion;
  versions: { version: number; instruction?: string; applied: string[]; ignored: string[]; createdAt: number; createdBy: string; spec: ConceptSpec; estimate: ConceptVersion["estimate"]; provider: string }[];
  comments: number;
  discussionId: string | null;
  proposal: { id: string; state: ProposalState; title: string } | null;
  vote: { id: string; status: string; winner: boolean | null } | null;
  isDemo: boolean;
}

export interface VoteDto {
  id: string;
  proposalId: string;
  proposalVersion: number;
  method: VotingMethod;
  options: { id: string; label: string; conceptId?: string; djId?: string; concept?: ConceptDto; dj?: { id: string; name: string; genres: string[]; city: string; look: unknown } }[];
  maxChoices: number;
  startAt: number;
  endAt: number;
  quorum: number;
  threshold: number;
  status: "scheduled" | "open" | "closed";
  snapshot: { takenAt: number; eligible: number; minimumStake: number; hash: string };
  participation: number;
  ballots: number;
  counts: Record<string, number> | null;
  result: { outcome: string; winner: string | null; tally: Record<string, number>; turnout: number; eligible: number; quorumMet: boolean; passed: boolean; heldBallots: number; resultHash: string; finalizedAt: number } | null;
  me: { eligible: boolean; ballot: { choice: string[]; castAt: number; hash: string; held: boolean } | null; reason: string | null } | null;
  proposal?: { id: string; title: string; state?: ProposalState; category: DiscussionCategory };
}

export interface DiscussionDto {
  id: string;
  category: DiscussionCategory;
  title: string;
  body: string;
  authorHandle: string;
  authorUid: string;
  createdAt: number;
  lastActivityAt: number;
  visibility: "public" | "members" | "private";
  pinned: boolean;
  locked: boolean;
  hidden: boolean;
  commentCount: number;
  reactions: Record<string, number>;
  myReactions: string[];
  attachments: { id: string; url: string }[];
  proposalIds: string[];
  conceptId?: string;
  djId?: string;
  reportCount?: number;
}

export interface HomeDto {
  mode: string;
  dao: { id: string; eventId: string; status: DaoStatus; description: string; config: DaoConfig; isDemo: boolean; createdAt: number };
  event: { id: string; name: string; city: string; country: string; startsAt: string; status: string; supporters: number; raised: number; goal: number; palette: string[]; venueId: string };
  summary: { members: number; staked: number; tokenSymbol: string; minimumStake: number; activeProposals: number; openVotes: number; participationRate: number; gameLevel: number };
  openVotes: VoteDto[];
  discussions: DiscussionDto[];
  concepts: ConceptDto[];
  progress: { done: number; total: number; next: { title: string; due: number } | null };
  reviewQueue: { id: string; title: string }[];
  me: null | {
    uid: string;
    member: boolean;
    staked: boolean;
    roles: DaoRole[];
    handle: string | null;
    xp: number;
    badges: BadgeId[];
    flagged: { reason: string } | null;
    position: { amount: number; status: string; lockedUntil: number; txHash?: string; source: string }[];
    can: { post: boolean; vote: boolean; propose: boolean; moderate: boolean; organize: boolean };
  };
  next: { key: string; label: string; href: string }[];
}

interface Ctx {
  eventId: string;
  state: ReturnType<typeof useDaoQuery<HomeDto>>["state"];
  home: HomeDto | null;
  reload: (quiet?: boolean) => Promise<void>;
  error: (ApiError & { httpStatus?: number }) | null;
  joinOpen: boolean;
  setJoinOpen: (v: boolean) => void;
}

const DaoCtx = createContext<Ctx | null>(null);

export function DaoProvider({ eventId, children }: { eventId: string; children: ReactNode }) {
  const { state, reload } = useDaoQuery<HomeDto>(eventId);
  const [joinOpen, setJoinOpen] = useState(false);
  return (
    <DaoCtx.Provider value={{ eventId, state, reload, joinOpen, setJoinOpen, home: state.status === "ok" ? state.data : null, error: state.status === "error" ? { ...state.error, httpStatus: state.httpStatus } : null }}>
      {children}
    </DaoCtx.Provider>
  );
}

export function useDao() {
  const c = useContext(DaoCtx);
  if (!c) throw new Error("useDao outside DaoProvider");
  return c;
}
