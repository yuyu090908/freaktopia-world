"use client";

import Link from "next/link";
import { ArrowRight, Coins, Gauge, MessagesSquare, Sparkles, Trophy, Users, Vote } from "lucide-react";
import { Button, ButtonLink, DemoNotice, Progress, Stat } from "@/components/ui/primitives";
import { EventLevelBadge } from "@/components/event/EventLevelBadge";
import { levelFor } from "@/lib/levels";
import { BADGE_META, GAME_LEVELS, ROLE_LABEL, shortAddr } from "@/lib/dao/meta";
import { compact, fmtDate } from "@/lib/utils";
import { ConceptRender } from "../ConceptRender";
import { useDao } from "../DaoContext";
import { CategoryTag, MoreLink, SubHead, VisibilityTag, ago } from "../DaoUi";
import { VoteCard } from "../VoteCard";

export function DaoHome() {
  const { home, reload, setJoinOpen, eventId } = useDao();
  if (!home) return null;
  const { summary, me, event } = home;
  const base = `/dao/${eventId}`;
  const level = levelFor(event.supporters, event.raised);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-[34px] uppercase leading-none sm:text-5xl">DAO Home</h1>
        <p className="text-sm text-mute">{home.dao.description}</p>
      </div>

      {home.dao.isDemo && (
        <DemoNotice>
          <b>Demo DAO.</b> Members, votes, stakes and budgets are fictional sample data stored on the demo server (they may reset). No blockchain, token or payment is connected.
        </DemoNotice>
      )}

      {/* What to do next */}
      <section aria-labelledby="next-h" className="neon-acid rounded-[26px] border-2 bg-surface p-4">
        <h2 id="next-h" className="flex items-center gap-2 text-xl uppercase"><Sparkles className="size-5 text-acid" aria-hidden />Your next step</h2>
        <ul className="mt-3 space-y-2">
          {home.next.map((n) => (
            <li key={n.key}>
              {n.href === "#join" ? (
                <button type="button" onClick={() => setJoinOpen(true)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl bg-acid px-4 text-left font-extrabold text-ink">
                  {n.label} <ArrowRight className="size-5 shrink-0" aria-hidden />
                </button>
              ) : (
                <Link href={n.href} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-line bg-ink/50 px-4 font-bold hover:border-acid">
                  {n.label} <ArrowRight className="size-5 shrink-0 text-acid" aria-hidden />
                </Link>
              )}
            </li>
          ))}
        </ul>
        {home.reviewQueue.length > 0 && (
          <p className="mt-3 text-sm text-mute">
            Review queue (staff): {home.reviewQueue.map((r, i) => (
              <span key={r.id}>{i > 0 && ", "}<Link className="font-bold text-cream underline" href={`${base}/proposals/${r.id}`}>{r.title}</Link></span>
            ))}
          </p>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-8">
          {/* 1. Current votes */}
          <section aria-labelledby="votes-h">
            <SubHead id="votes-h" title="Voting now" action={<MoreLink href={`${base}/votes`}>All votes</MoreLink>} />
            {home.openVotes.length ? (
              <div className="space-y-4">
                {home.openVotes.map((v) => (
                  <VoteCard key={v.id} vote={v} title={v.proposal?.title ?? "Vote"} compact onVoted={() => reload(true)} />
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-line p-4 text-sm text-mute">No vote is open right now. Proposals in review open for voting when an organizer starts them.</p>
            )}
          </section>

          {/* 2. Latest stage designs */}
          <section aria-labelledby="designs-h">
            <SubHead id="designs-h" title="Latest stage designs" action={<MoreLink href={`${base}/gallery`}>Gallery</MoreLink>} />
            <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0">
              {home.concepts.slice(0, 4).map((c) => (
                <Link key={c.id} href={`${base}/gallery#${c.id}`} className="neon w-[78vw] max-w-[340px] shrink-0 snap-start overflow-hidden rounded-[22px] border bg-surface md:w-auto md:max-w-none">
                  {c.photo && <ConceptRender photoUrl={c.photo.url} zone={c.photo.stageZone} ceilingY={c.photo.ceilingY} spec={c.current.spec} title={`${c.name} stage concept`} showLabel />}
                  <div className="p-3">
                    <div className="font-display text-lg uppercase">{c.name}</div>
                    <div className="text-[12px] text-mute">by @{c.creatorHandle} · v{c.current.version} · {c.comments} comments</div>
                  </div>
                </Link>
              ))}
              <Link href={`${base}/stage-designer`} className="flex w-[60vw] max-w-[260px] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-acid/60 p-6 text-center font-extrabold uppercase text-acid md:w-auto md:max-w-none">
                <Sparkles className="size-8" aria-hidden /> Open AI Stage Designer
              </Link>
            </div>
          </section>

          {/* 3. Discussion */}
          <section aria-labelledby="disc-h">
            <SubHead id="disc-h" title="Discussion" action={<MoreLink href={`${base}/discussion`}>All threads</MoreLink>} />
            <ul className="divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-surface/80">
              {home.discussions.map((d) => (
                <li key={d.id}>
                  <Link href={`${base}/discussion?thread=${d.id}`} className="block p-3 hover:bg-surface-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CategoryTag c={d.category} />
                      {d.pinned && <span className="text-[11px] font-extrabold uppercase text-orange">Pinned</span>}
                      {d.visibility !== "public" && <VisibilityTag v={d.visibility} />}
                    </div>
                    <div className="mt-1.5 font-bold leading-snug">{d.title}</div>
                    <div className="mt-1 text-[12px] text-mute">@{d.authorHandle} · {ago(d.lastActivityAt)} · <MessagesSquare className="inline size-3" aria-hidden /> {d.commentCount}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="min-w-0 space-y-8">
          {/* 4. Membership */}
          <section aria-labelledby="member-h" className="neon rounded-[24px] border bg-surface/90 p-4">
            <h2 id="member-h" className="text-xl uppercase">Your membership</h2>
            {!me && (
              <div className="mt-3 space-y-3 text-sm text-mute">
                <p>Not signed in. Anyone can read public threads; posting, proposing and voting need a verified stake.</p>
                <Button className="w-full" onClick={() => setJoinOpen(true)}>Join DAO</Button>
              </div>
            )}
            {me && (
              <div className="mt-3 space-y-3 text-sm">
                <p className="text-mute">Signed in as <b className="text-cream">{me.handle ? `@${me.handle}` : shortAddr(me.uid)}</b></p>
                <p>
                  Status: {me.staked ? <b className="text-acid">Staked member</b> : <b className="text-orange">Not staked</b>}
                  {me.roles.filter((r) => r !== "member").map((r) => <span key={r} className="ml-2 rounded-full bg-purple px-2 py-0.5 text-[11px] font-extrabold uppercase text-ink">{ROLE_LABEL[r]}</span>)}
                </p>
                {me.position.map((p, i) => (
                  <p key={i} className="rounded-xl bg-surface-2 p-2 text-[12px] text-mute">
                    {p.amount} {summary.tokenSymbol} · {p.status} until {fmtDate(new Date(p.lockedUntil).toISOString(), { month: "short", day: "numeric" })} · {p.source === "demo-ledger" ? "demo ledger (no chain)" : "on-chain"}
                  </p>
                ))}
                {me.flagged && <p role="alert" className="rounded-xl border border-coral/50 bg-coral/10 p-2 text-[12px]">Flagged: {me.flagged.reason}. Ballots held for review.</p>}
                {!me.staked && <Button className="w-full" onClick={() => setJoinOpen(true)}>Stake to join</Button>}
                {me.badges.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5" aria-label="Your badges">
                    {me.badges.map((b) => (
                      <li key={b} className="rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase text-ink" style={{ background: BADGE_META[b].color }}>{BADGE_META[b].label}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          {/* Stats */}
          <section aria-labelledby="stats-h">
            <h2 id="stats-h" className="sr-only">DAO statistics</h2>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Members" value={<span className="inline-flex items-center gap-1"><Users className="size-4" aria-hidden />{compact(summary.members)}</span>} accent="#B6F05C" />
              <Stat label={`Staked (${summary.tokenSymbol})`} value={<span className="inline-flex items-center gap-1"><Coins className="size-4" aria-hidden />{compact(summary.staked)}</span>} accent="#55BCEB" />
              <Stat label="Active proposals" value={summary.activeProposals} accent="#A276E9" />
              <Stat label="Open votes" value={<span className="inline-flex items-center gap-1"><Vote className="size-4" aria-hidden />{summary.openVotes}</span>} accent="#FF625C" />
              <Stat label="Vote participation" value={<span className="inline-flex items-center gap-1"><Gauge className="size-4" aria-hidden />{Math.round(summary.participationRate * 100)}%</span>} accent="#FFAD5B" />
              <div className="min-w-0 rounded-2xl bg-surface-2 p-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-mute">Event level</div>
                <div className="mt-1"><EventLevelBadge level={level} /></div>
              </div>
            </div>
          </section>

          {/* 5. Progress */}
          <section aria-labelledby="prog-h" className="neon rounded-[24px] border bg-surface/90 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 id="prog-h" className="text-xl uppercase">Festival progress</h2>
              <MoreLink href={`${base}/roadmap`}>Roadmap</MoreLink>
            </div>
            <p className="mt-2 text-sm text-mute">Production milestones {home.progress.done}/{home.progress.total}</p>
            <Progress value={home.progress.done / Math.max(1, home.progress.total)} label="Production milestones done" className="mt-2" />
            {home.progress.next && <p className="mt-2 text-sm">Next: <b>{home.progress.next.title}</b> · {fmtDate(new Date(home.progress.next.due).toISOString())}</p>}
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-surface-2 p-3">
              <Trophy className="size-5 shrink-0 text-acid" aria-hidden />
              <div className="min-w-0 text-sm">
                <b>Build game LV.{summary.gameLevel} · {GAME_LEVELS[summary.gameLevel - 1].key}</b>
                <div className="text-[12px] text-mute">Game progress reflects DAO decisions, not real construction.</div>
              </div>
            </div>
          </section>

          <ButtonLink href={`${base}/proposals?new=1`} variant="purple" className="w-full">New proposal</ButtonLink>
        </aside>
      </div>
    </div>
  );
}
