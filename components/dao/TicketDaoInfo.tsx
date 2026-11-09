"use client";

import Link from "next/link";
import { Landmark } from "lucide-react";
import { useDaoQuery } from "@/lib/dao/client";
import type { DaoSummaryDto } from "./EventDaoPanel";

/** DAO decisions confirmed by the organizer, shown next to a ticket. Nothing renders without a DAO. */
export function TicketDaoInfo({ eventId }: { eventId: string }) {
  const { state } = useDaoQuery<DaoSummaryDto | null>(`${eventId}/summary`);
  if (state.status !== "ok" || !state.data) return null;
  const d = state.data;
  return (
    <div className="mt-2 rounded-2xl border border-purple/40 bg-surface-2 p-3 text-[13px]" data-testid="ticket-dao">
      <div className="flex items-center gap-1.5 font-extrabold uppercase text-purple"><Landmark className="size-4" aria-hidden />Community DAO</div>
      {d.confirmed.length ? (
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {d.confirmed.map((c) => <li key={c.id}><Link href={`/dao/${eventId}/proposals/${c.id}`} className="underline-offset-2 hover:underline">{c.title}</Link> <span className="text-mute">({c.state === "COMPLETED" ? "done" : "confirmed"})</span></li>)}
        </ul>
      ) : (
        <p className="mt-1 text-mute">No organizer-confirmed DAO decisions yet.</p>
      )}
      {d.activeVote && <Link href={`/dao/${eventId}/proposals/${d.activeVote.proposalId}`} className="mt-1 inline-flex min-h-11 items-center font-bold text-acid">Voting now: {d.activeVote.title} →</Link>}
    </div>
  );
}
