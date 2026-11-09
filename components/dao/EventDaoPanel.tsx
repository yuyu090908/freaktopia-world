"use client";

import Link from "next/link";
import { Gauge, Users, Vote } from "lucide-react";
import { ButtonLink } from "@/components/ui/primitives";
import { useDaoQuery } from "@/lib/dao/client";
import { GAME_LEVELS, STATUS_META } from "@/lib/dao/meta";
import type { DaoStatus } from "@/lib/dao/types";
import { compact } from "@/lib/utils";
import { timeLeft } from "./DaoUi";

export interface DaoSummaryDto {
  eventId: string;
  status: DaoStatus;
  members: number;
  staked: number;
  tokenSymbol: string;
  minimumStake: number;
  activeProposals: number;
  openVotes: number;
  participationRate: number;
  gameLevel: number;
  isDemo: boolean;
  activeVote: { id: string; proposalId: string; title: string; endAt: number; participation: number } | null;
  confirmed: { id: string; title: string; category: string; state: string }[];
}

/** COMMUNITY DAO block for the event detail page. Reads the public summary only. */
export function EventDaoPanel({ eventId, ended }: { eventId: string; ended?: boolean }) {
  const { state } = useDaoQuery<DaoSummaryDto | null>(`${eventId}/summary`);
  const base = `/dao/${eventId}`;
  if (state.status === "loading") return <div className="h-40 animate-pulse rounded-[22px] bg-surface" aria-hidden />;
  const d = state.status === "ok" ? state.data : null;
  if (!d) {
    return (
      <div className="rounded-[22px] border border-dashed border-line p-4 text-sm">
        <p className="text-mute">This event has no community DAO yet.{ended ? "" : " Organizers can start one so fans can propose and vote on the stage, lineup and after party."}</p>
        {!ended && <ButtonLink href={base} size="sm" className="mt-3">Start a DAO (demo)</ButtonLink>}
      </div>
    );
  }
  const st = STATUS_META[d.status];
  return (
    <div className="neon space-y-3 rounded-[22px] border bg-surface p-4" data-testid="event-dao-panel">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-ink" style={{ background: st.color }}>{st.label}</span>
        {d.isDemo && <span className="text-[11px] font-extrabold uppercase text-orange">Demo · no chain connected</span>}
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <span className="inline-flex items-center gap-1"><Users className="size-4 text-acid" aria-hidden />{compact(d.members)} members</span>
        <span className="inline-flex items-center gap-1"><Vote className="size-4 text-coral" aria-hidden />{d.activeProposals} proposals</span>
        <span className="inline-flex items-center gap-1"><Gauge className="size-4 text-orange" aria-hidden />{Math.round(d.participationRate * 100)}% vote</span>
      </div>
      {d.activeVote ? (
        <Link href={`${base}/proposals/${d.activeVote.proposalId}`} className="block rounded-2xl bg-surface-2 p-3 hover:ring-1 hover:ring-acid">
          <span className="text-[11px] font-extrabold uppercase text-acid">Voting now · {timeLeft(d.activeVote.endAt - Date.now())}</span>
          <span className="mt-1 block font-bold leading-snug">{d.activeVote.title}</span>
          <span className="text-[12px] text-mute">{Math.round(d.activeVote.participation * 100)}% of eligible members voted</span>
        </Link>
      ) : (
        <p className="text-sm text-mute">No vote open right now.</p>
      )}
      <p className="text-[12px] text-mute">Stake {d.minimumStake} {d.tokenSymbol} to join · 1 account = 1 vote · Build game LV.{d.gameLevel} {GAME_LEVELS[d.gameLevel - 1]?.key}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <ButtonLink href={base} className="flex-1">Open DAO / Join</ButtonLink>
        <ButtonLink href={`${base}/stage-designer`} variant="ghost" className="flex-1">AI Stage Designer</ButtonLink>
      </div>
    </div>
  );
}
