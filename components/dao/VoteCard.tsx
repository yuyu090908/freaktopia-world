"use client";

import { Tx, useTx } from "@/components/i18n/Tx";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth/client";
import { DaoAvatar } from "./DaoAvatar";

import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, CheckCircle2, Clock, Hash, ShieldAlert, Users, Vote } from "lucide-react";
import { AlienAvatar } from "@/components/cards/Cards";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button, Progress } from "@/components/ui/primitives";
import { daoApi } from "@/lib/dao/client";
import { METHOD_LABEL, usd } from "@/lib/dao/meta";
import { toast } from "@/lib/store";
import type { DJ } from "@/lib/types";
import { cn, fmtDate } from "@/lib/utils";
import { ConceptRender } from "./ConceptRender";
import type { VoteDto } from "./DaoContext";
import { useDao } from "./DaoContext";
import { Gate, timeLeft } from "./DaoUi";

/**
 * Ballot with large candidate visuals, an explicit confirmation step and a receipt.
 * Supports single choice and yes/no/abstain (priority) plus multiple and ranked.
 */
export function VoteCard({ vote, title, onVoted, compact = false }: { vote: VoteDto; title: string; onVoted?: () => void; compact?: boolean }) {
  const tx = useTx();
  const tu = useTranslations("dao");
  const { home, eventId, setJoinOpen } = useDao();
  const [choice, setChoice] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{ hash: string; held: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const me = vote.me;
  const account = useAuth((s) => s.me);
  const td = useTranslations("dao");
  const open = vote.status === "open";
  const voted = !!me?.ballot || !!receipt;
  const canPick = open && !!me?.eligible && !voted && !!home?.me?.can.vote;
  const total = vote.counts ? Object.values(vote.counts).reduce((a, b) => a + b, 0) : 0;
  const result = vote.result;
  const visual = vote.options.some((o) => o.concept);

  const toggle = (id: string) => {
    if (!canPick) return;
    if (vote.method === "single" || vote.method === "yes_no_abstain") setChoice([id]);
    else if (vote.method === "multiple") setChoice((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < vote.maxChoices ? [...c, id] : c));
    else setChoice((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  };

  const submit = async () => {
    setBusy(true);
    setErr(null);
    const r = await daoApi<{ receipt: { hash: string; held: boolean }; xp: number }>(`${eventId}/votes/${vote.id}/ballot`, { method: "POST", json: { choice, proposalVersion: vote.proposalVersion } });
    setBusy(false);
    if (!r.ok) {
      setErr(r.error.message);
      return;
    }
    setReceipt(r.data.receipt);
    if (r.data.xp) toast({ title: tu("xpDaoXp", { xp: r.data.xp }), body: tu("voteRecorded"), tone: "success" });
    onVoted?.();
  };

  const label = (id: string) => vote.options.find((o) => o.id === id)?.label ?? id;

  return (
    <article id={vote.id} aria-labelledby={`${vote.id}-t`} className="neon scroll-mt-32 rounded-[26px] border bg-surface/95 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider">
        <span className={cn("rounded-full px-2.5 py-1 text-ink", open ? "bg-acid" : "bg-mute")}>{open ? tu("votingOpen") : vote.status === "closed" ? tu("closed") : tu("scheduled")}</span>
        <span className="text-mute"><Tx>{METHOD_LABEL[vote.method]}</Tx></span>
        {open && (
          <span className="inline-flex items-center gap-1 text-orange">
            <Clock className="size-3.5" aria-hidden /> {timeLeft(vote.endAt - Date.now())}
          </span>
        )}
      </div>
      <h3 id={`${vote.id}-t`} className="mt-2 text-xl uppercase leading-tight sm:text-2xl">
        <Link href={`/dao/${eventId}/proposals/${vote.proposalId}`} className="inline-flex min-h-11 items-center hover:text-acid">
          {title}
        </Link>
      </h3>

      {/* Options */}
      <fieldset className="mt-3" disabled={!canPick}>
        <legend className="sr-only">{tu("optionsForTitle", { title })}</legend>
        <div className={cn("grid gap-3", visual ? (compact ? "sm:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-3") : "sm:grid-cols-3")}>
          {vote.options.map((o) => {
            const on = choice.includes(o.id);
            const mine = (receipt ? choice : me?.ballot?.choice ?? []).includes(o.id);
            const count = result ? result.tally[o.id] ?? 0 : vote.counts?.[o.id] ?? null;
            const denom = result ? Math.max(1, result.turnout) : Math.max(1, total);
            const winner = result?.winner === o.id;
            const rank = vote.method === "ranked" ? choice.indexOf(o.id) + 1 : 0;
            return (
              <label key={o.id} className={cn("relative block cursor-pointer overflow-hidden rounded-2xl border-2 bg-ink/60 transition-colors", on ? "border-acid shadow-[0_0_20px_-6px_rgba(182,240,92,0.8)]" : "border-line", !canPick && "cursor-default", winner && "border-acid")}>
                <input type={vote.method === "multiple" || vote.method === "ranked" ? "checkbox" : "radio"} name={vote.id} value={o.id} checked={on} onChange={() => toggle(o.id)} className="peer sr-only" aria-label={o.label} />
                {o.concept?.photo && (
                  <ConceptRender photoUrl={o.concept.photo.url} zone={o.concept.photo.stageZone} ceilingY={o.concept.photo.ceilingY} spec={o.concept.current.spec} title={tu("labelConceptRender", { label: o.label })} showLabel />
                )}
                {o.dj && (
                  <div className="flex items-center gap-3 p-3">
                    <AlienAvatar look={o.dj.look as DJ["look"]} size={56} />
                    <div className="min-w-0 text-sm text-mute">{o.dj.genres.join(" · ")}<br />{o.dj.city}</div>
                  </div>
                )}
                <div className="flex items-start justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="font-display text-lg uppercase leading-tight"><Tx>{o.label}</Tx></div>
                    {o.concept && <div className="mt-0.5 text-[12px] text-mute">{tu("aiEstUsdUsd2By", { usd: usd(o.concept.current.estimate.low), usd2: usd(o.concept.current.estimate.high), creatorHandle: o.concept.creatorHandle })}</div>}
                  </div>
                  <span aria-hidden className={cn("mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-extrabold", on ? "border-acid bg-acid text-ink" : "border-cream/40")}>
                    {rank > 0 ? rank : on ? "✓" : ""}
                  </span>
                </div>
                {count !== null && (
                  <div className="px-3 pb-3">
                    <Progress value={count / denom} label={`${tx(o.label)}: ${Math.round((count / denom) * 100)}%`} className="h-2.5" color={winner ? "#B6F05C" : "#A276E9"} />
                    <div className="mt-1 flex justify-between text-[11px] font-bold text-mute">
                      <span>{Math.round((count / denom) * 100)}%{winner ? tu("winner") : ""}</span>
                      <span>{tu("countVotes", { count })}</span>
                    </div>
                  </div>
                )}
                {mine && <span className="absolute right-2 top-2 rounded-full bg-acid px-2 py-0.5 text-[10px] font-extrabold uppercase text-ink">{tu("yourVote")}</span>}
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Facts */}
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
        <div className="rounded-xl bg-surface-2 p-2"><dt className="text-mute">{tu("participation")}</dt><dd className="font-extrabold">{Math.round((result ? result.turnout / Math.max(1, result.eligible) : vote.participation) * 100)}% <span className="font-normal text-mute">{tu("quorumRound", { round: Math.round(vote.quorum * 100) })}</span></dd></div>
        <div className="rounded-xl bg-surface-2 p-2"><dt className="text-mute">{tu("eligibleVoters")}</dt><dd className="font-extrabold"><Users className="mr-1 inline size-3" aria-hidden />{vote.snapshot.eligible}</dd></div>
        <div className="rounded-xl bg-surface-2 p-2"><dt className="text-mute">{tu("snapshot")}</dt><dd className="font-extrabold">{fmtDate(new Date(vote.snapshot.takenAt).toISOString(), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</dd></div>
        <div className="rounded-xl bg-surface-2 p-2"><dt className="text-mute">{tu("threshold")}</dt><dd className="font-extrabold">{Math.round(vote.threshold * 100)}% · v{vote.proposalVersion}</dd></div>
      </dl>

      {/* Status / actions */}
      <div className="mt-3 space-y-2">
        {result && (
          <p className={cn("rounded-2xl border p-3 text-sm", result.outcome === "APPROVED" ? "border-acid/50 bg-acid/10" : "border-coral/50 bg-coral/10")}>
            <b>{tu("resultOutcome", { outcome: result.outcome })}</b> {tu("turnoutTurnoutEligible", { turnout: result.turnout, eligible: result.eligible })}
            {!result.quorumMet && tu("quorumNotMet")}
            {result.heldBallots > 0 && tu("heldballotsHeldBallotsExcluded", { heldBallots: result.heldBallots })}
            <span className="mt-1 flex items-center gap-1 break-all font-mono text-[10px] text-mute"><Hash className="size-3 shrink-0" aria-hidden />{result.resultHash}</span>
          </p>
        )}
        {open && !home?.me && <Gate reason={tu("connectAWalletAndStake")} action={<Button size="sm" onClick={() => setJoinOpen(true)}>{tu("joinDao")}</Button>} />}
        {open && home?.me && !home.me.staked && <Gate reason={tu("stakeTheMinimumToVote")} action={<Button size="sm" onClick={() => setJoinOpen(true)}>{tu("stake")}</Button>} />}
        {open && me && !me.eligible && home?.me?.staked && (
          <Gate reason={tu("youreNotInThisVotes")}>{tu("youJoinedAfterVotingOpened")}</Gate>
        )}
        {open && account && !account.user.emailVerified && (
          <Gate reason={td("verifiedRequired")} />
        )}
        {(voted || receipt) && (
          <p role="status" className="flex items-start gap-2 rounded-2xl border border-acid/50 bg-acid/10 p-3 text-sm">
            {account?.alien ? (
              <span className="relative shrink-0" data-testid="dao-voter-badge">
                <DaoAvatar handle={account.alien.name} mine size={36} />
                <span className="absolute -bottom-1 -right-1 rounded-full bg-acid px-1 text-[8px] font-black uppercase text-ink">{td("votingBadge")}</span>
              </span>
            ) : (
              <BadgeCheck className="mt-0.5 size-4 shrink-0 text-acid" aria-hidden />
            )}
            <span>
              {tu("voteRecorded2")} <b>{(receipt ? choice : me?.ballot?.choice ?? []).map(label).join(" → ")}</b>{tu("ballotsAreFinalOnePer")}
              <span className="mt-1 block break-all font-mono text-[10px] text-mute">{tu("receiptHash", { hash: receipt?.hash ?? me?.ballot?.hash ?? "" })}</span>
              {(receipt?.held || me?.ballot?.held) && <span className="mt-1 flex gap-1 text-coral"><ShieldAlert className="size-4" aria-hidden /> {tu("heldForDuplicateAccountReview")}</span>}
            </span>
          </p>
        )}
        {canPick && (
          <Button className="w-full sm:w-auto" disabled={!choice.length || (account ? !account.user.emailVerified : false)} onClick={() => setConfirm(true)}>
            <Vote className="size-5" aria-hidden /> {tu("reviewVote")}
          </Button>
        )}
        {open && <p className="text-[11px] text-mute">{td("avatarNoPower")}</p>}
        <Link href={`/dao/${eventId}/proposals/${vote.proposalId}#audit`} className="inline-flex min-h-11 items-center text-[13px] font-bold text-mute underline-offset-4 hover:underline">
          {tu("auditTrailProposal")}
        </Link>
      </div>

      <BottomSheet open={confirm} onClose={() => { setConfirm(false); }} title={tu("confirmYourVote")}>
        {!receipt ? (
          <div className="space-y-4">
            <p className="text-sm text-mute">{title}</p>
            <ol className="space-y-2">
              {choice.map((c, i) => (
                <li key={c} className="flex items-center gap-3 rounded-2xl border-2 border-acid bg-acid/10 p-3 font-display text-lg uppercase">
                  {vote.method === "ranked" && <span className="text-acid">{i + 1}.</span>}
                  {label(c)}
                </li>
              ))}
            </ol>
            <ul className="space-y-1 text-[13px] text-mute">
              <li>{tu("oneAccountOneVoteStake")}</li>
              <li>{tu("ballotsAreFinalAndCannot")}</li>
              <li>{tu("youVoteOnProposalVersion", { proposalVersion: vote.proposalVersion })}</li>
            </ul>
            {err && <p role="alert" className="rounded-2xl border border-coral/50 bg-coral/10 p-3 text-sm">{err}</p>}
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setConfirm(false)}>{tu("back")}</Button>
              <Button className="flex-1" onClick={submit} disabled={busy}>{busy ? tu("submitting") : tu("submitVote")}</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-center">
            <CheckCircle2 className="mx-auto size-12 text-acid" aria-hidden />
            <p className="font-display text-2xl uppercase">{tu("voteSubmitted")}</p>
            <p className="break-all font-mono text-[11px] text-mute">{receipt.hash}</p>
            <Button className="w-full" onClick={() => setConfirm(false)}>{tu("done")}</Button>
          </div>
        )}
      </BottomSheet>
    </article>
  );
}
