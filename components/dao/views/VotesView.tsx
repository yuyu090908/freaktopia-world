"use client";

import { useTranslations } from "next-intl";
import { useDaoQuery } from "@/lib/dao/client";
import { LoadingSkeleton } from "@/components/ui/States";
import { useDao, type VoteDto } from "../DaoContext";
import { SubHead } from "../DaoUi";
import { VoteCard } from "../VoteCard";

export function VotesView() {
  const tu = useTranslations("dao");
  const { eventId, reload: reloadHome } = useDao();
  const { state, reload } = useDaoQuery<{ votes: (VoteDto & { proposal: { id: string; title: string; state: string; category: string } })[] }>(`${eventId}/votes`);
  if (state.status === "loading") return <LoadingSkeleton variant="list" />;
  if (state.status === "error") return <p role="alert">{state.error.message}</p>;
  const open = state.data.votes.filter((v) => v.status === "open");
  const closed = state.data.votes.filter((v) => v.status !== "open");
  const refresh = () => {
    void reload(true);
    void reloadHome(true);
  };
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[34px] uppercase leading-none sm:text-5xl">{tu("votes")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-mute">{tu("oneAccountOneVoteEligibility")}</p>
      </div>
      <section aria-labelledby="open-h">
        <SubHead id="open-h" title={tu("openLength", { length: open.length })} />
        <div className="space-y-4">
          {open.length ? open.map((v) => <VoteCard key={v.id} vote={v} title={v.proposal.title} onVoted={refresh} />) : <p className="text-sm text-mute">{tu("noOpenVotes")}</p>}
        </div>
      </section>
      <section aria-labelledby="closed-h">
        <SubHead id="closed-h" title={tu("closedLength", { length: closed.length })} />
        <div className="space-y-4">
          {closed.map((v) => (
            <VoteCard key={v.id} vote={v} title={v.proposal.title} compact />
          ))}
        </div>
      </section>
    </div>
  );
}
