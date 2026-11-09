"use client";

import Link from "next/link";
import { Gauge, Sparkles, Users, Vote } from "lucide-react";
import { EventCover } from "@/components/cards/Cards";
import { Container, DemoNotice, PageTitle } from "@/components/ui/primitives";
import { LoadingSkeleton } from "@/components/ui/States";
import { EVENTS } from "@/lib/data";
import { useDaoQuery } from "@/lib/dao/client";
import { GAME_LEVELS, STATUS_META } from "@/lib/dao/meta";
import type { DaoStatus } from "@/lib/dao/types";
import { compact, fmtDate } from "@/lib/utils";

interface IndexDto {
  mode: string;
  daos: { eventId: string; status: DaoStatus; members: number; staked: number; tokenSymbol: string; activeProposals: number; openVotes: number; participationRate: number; gameLevel: number; isDemo: boolean; event: { name: string; city: string; country: string; startsAt: string } }[];
}

export function DaoIndexView() {
  const { state } = useDaoQuery<IndexDto>("");
  const withDao = state.status === "ok" ? new Set(state.data.daos.map((d) => d.eventId)) : new Set<string>();
  const without = EVENTS.filter((e) => e.status !== "ended" && !withDao.has(e.id));

  return (
    <Container className="space-y-8 pb-12 [&>*:not(:first-child)]:mx-4 md:[&>*:not(:first-child)]:mx-0">
      <PageTitle kicker="Community governance" title="Festival DAO" sub="Every festival can have its own DAO. Stake to join, talk it out, propose, vote one account = one vote, and design the stage over real venue photos with AI." />
      <DemoNotice>
        <b>Demo.</b> All DAOs, members, stakes and budgets here are sample data. No blockchain, token or payment is connected, and AI stage images are concepts, not construction plans.
      </DemoNotice>

      <ol className="grid gap-2 text-sm sm:grid-cols-4" aria-label="How it works">
        {["Connect a demo wallet and stake to join", "Discuss and write proposals", "Vote: 1 account = 1 vote, snapshot locked", "Design the stage with AI and build the festival"].map((t, i) => (
          <li key={t} className="flex gap-2 rounded-2xl border border-line bg-surface p-3"><span className="font-display text-xl text-acid">{i + 1}</span>{t}</li>
        ))}
      </ol>

      {state.status === "loading" && <LoadingSkeleton variant="cards" />}
      {state.status === "error" && <p role="alert">{state.error.message}</p>}
      {state.status === "ok" && (
        <section aria-labelledby="daos-h" className="space-y-3">
          <h2 id="daos-h" className="text-2xl uppercase">Active DAOs ({state.data.daos.length})</h2>
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {state.data.daos.map((d) => {
              const st = STATUS_META[d.status];
              return (
                <li key={d.eventId}>
                  <Link href={`/dao/${d.eventId}`} className="neon block overflow-hidden rounded-[22px] border bg-surface hover:border-acid">
                    <div className="relative aspect-[16/7] overflow-hidden">
                      <EventCover id={d.eventId} sizes="(min-width:1280px) 400px, (min-width:768px) 50vw, 100vw" />
                      <span className="absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-ink" style={{ background: st.color }}>{st.label}</span>
                    </div>
                    <div className="space-y-2 p-4">
                      <div className="font-display text-2xl uppercase leading-none">{d.event.name}</div>
                      <div className="text-[12px] text-mute">{d.event.city}, {d.event.country} · {fmtDate(d.event.startsAt)}</div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <span className="inline-flex items-center gap-1"><Users className="size-4 text-acid" aria-hidden />{compact(d.members)}</span>
                        <span className="inline-flex items-center gap-1"><Vote className="size-4 text-coral" aria-hidden />{d.openVotes} open</span>
                        <span className="inline-flex items-center gap-1"><Gauge className="size-4 text-orange" aria-hidden />{Math.round(d.participationRate * 100)}%</span>
                      </div>
                      <div className="text-[12px] text-mute">{d.activeProposals} active proposals · Build LV.{d.gameLevel} {GAME_LEVELS[d.gameLevel - 1].key}</div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {state.status === "ok" && without.length > 0 && (
        <section aria-labelledby="none-h" className="space-y-3">
          <h2 id="none-h" className="text-2xl uppercase">No DAO yet</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {without.slice(0, 12).map((e) => (
              <li key={e.id}>
                <Link href={`/dao/${e.id}`} className="flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-4 py-2 hover:border-acid">
                  <span className="min-w-0"><span className="block truncate font-bold">{e.name}</span><span className="text-[12px] text-mute">{e.city}</span></span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-extrabold uppercase text-acid"><Sparkles className="size-4" aria-hidden />Start</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Container>
  );
}
