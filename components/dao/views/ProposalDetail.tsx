"use client";

import { Tx, useTx } from "@/components/i18n/Tx";
import { useTranslations } from "next-intl";
import { DaoAvatar } from "@/components/dao/DaoAvatar";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleHelp, ClipboardCheck, ExternalLink, Hash, ShieldCheck, XCircle } from "lucide-react";
import { Button, ButtonLink, DemoNotice } from "@/components/ui/primitives";
import { LoadingSkeleton } from "@/components/ui/States";
import { Field, Textarea } from "@/components/forms/Fields";
import { daoApi, useDaoQuery } from "@/lib/dao/client";
import { FEASIBILITY_LABEL, METHOD_LABEL, STATE_META, usd } from "@/lib/dao/meta";
import type { FeasibilityItem, ProposalState } from "@/lib/dao/types";
import { toast } from "@/lib/store";
import { cn, fmtDate } from "@/lib/utils";
import { useDao } from "../DaoContext";
import { CategoryTag, Gate, LifecycleTracker, StateTag, ago } from "../DaoUi";
import { VoteCard } from "../VoteCard";
import type { ProposalDto } from "./ProposalsView";

const NEEDS_REASON: ProposalState[] = ["CANCELLED", "RE_REVIEW"];
const STATUS_ICON = { pass: CheckCircle2, warn: AlertTriangle, fail: XCircle, needs_human: CircleHelp } as const;
const STATUS_COLOR = { pass: "text-acid", warn: "text-orange", fail: "text-coral", needs_human: "text-blue" } as const;

export function ProposalDetail() {
  const tx = useTx();
  const tu = useTranslations("dao");
  const { proposalId } = useParams<{ proposalId: string }>();
  const { eventId, reload: reloadHome, setJoinOpen, home } = useDao();
  const { state, reload } = useDaoQuery<{ proposal: ProposalDto; transitions: ProposalState[]; versions: { version: number; title: string; description: string; proposedChange: string; estimatedCost: number; createdAt: number; note?: string }[]; canVote: boolean; isStaff: boolean; isOrganizer: boolean }>(`${eventId}/proposals/${proposalId}`);
  const audit = useDaoQuery<{ chainValid: boolean; receipts: { voter: string; hash: string; castAt: number; held: boolean }[]; snapshot: { hash: string; eligible: number; excluded: number; takenAt: number }; result: { resultHash: string } | null }>(state.status === "ok" && state.data.proposal.vote ? `${eventId}/votes/${state.data.proposal.vote.id}/audit` : null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  if (state.status === "loading") return <LoadingSkeleton variant="page" />;
  if (state.status === "error") return <Gate reason={state.error.message} action={<ButtonLink href={`/dao/${eventId}/proposals`} size="sm">{tu("allProposals")}</ButtonLink>} />;
  const { proposal: p, transitions, versions, isOrganizer } = state.data;
  const refresh = async () => {
    await reload(true);
    await reloadHome(true);
    await audit.reload(true);
  };
  const act = async (path: string, json?: unknown, label = "Updated") => {
    setBusy(path);
    const r = await daoApi(`${eventId}/proposals/${p.id}/${path}`, { method: "POST", json: json ?? {} });
    setBusy(null);
    if (!r.ok) return toast({ title: tu("notAllowed"), body: r.error.message, tone: "error" });
    toast({ title: label, tone: "success" });
    setReason("");
    await refresh();
  };
  const signed = new Set(p.feasibility?.signoffs.map((s) => s.role));

  return (
    <article aria-labelledby="prop-h" className="space-y-6">
      <Link href={`/dao/${eventId}/proposals`} className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-mute hover:text-cream"><ArrowLeft className="size-4" aria-hidden /> {tu("proposals")}</Link>
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StateTag state={p.state} />
          <CategoryTag c={p.category} />
          <span className="text-[12px] font-bold uppercase text-mute"><Tx>{METHOD_LABEL[p.method]}</Tx> · v{p.current.version}</span>
        </div>
        <h1 id="prop-h" className="text-[30px] uppercase leading-[0.95] sm:text-5xl">{p.current.title}</h1>
        <p className="flex flex-wrap items-center gap-1 text-[13px] text-mute"><DaoAvatar handle={p.authorHandle} mine={p.authorUid === home?.me?.uid} size={22} />{tu("byAuthorhandleAgoDiscussionDiscussio", { authorHandle: p.authorHandle, ago: ago(p.createdAt), discussionDays: p.discussionDays, votingDays: p.votingDays })}</p>
        <LifecycleTracker state={p.state} />
      </header>

      {p.executionReport && (
        <section aria-label={tu("organizerReport")} className={cn("rounded-[22px] border-2 p-4", p.executionReport.status === "cannot_execute" ? "border-coral bg-coral/10" : "border-acid/60 bg-acid/10")}>
          <h2 className="text-lg uppercase">{p.executionReport.status === "cannot_execute" ? tu("organizerReportCannotExecute") : p.executionReport.status === "done" ? tu("organizerReportDone") : tu("organizerReportExecuting")}</h2>
          <p className="mt-1">{p.executionReport.message}</p>
          <p className="mt-1 text-[12px] text-mute">{fmtDate(new Date(p.executionReport.at).toISOString(), { month: "short", day: "numeric", year: "numeric" })}</p>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="desc-h" className="neon rounded-[22px] border bg-surface/90 p-4">
            <h2 id="desc-h" className="text-lg uppercase">{tu("description")}</h2>
            <p className="mt-2 whitespace-pre-wrap">{p.current.description}</p>
            <h3 className="mt-4 text-sm font-extrabold uppercase text-acid">{tu("proposedChange")}</h3>
            <p className="mt-1 whitespace-pre-wrap">{p.current.proposedChange}</p>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-surface-2 p-2"><dt className="text-[11px] uppercase text-mute">{tu("estimatedCost")}</dt><dd className="font-extrabold">{usd(p.current.estimatedCost)}</dd></div>
              <div className="rounded-xl bg-surface-2 p-2"><dt className="text-[11px] uppercase text-mute">{tu("options")}</dt><dd className="font-extrabold">{p.current.options.map((o) => o.label).join(" / ")}</dd></div>
            </dl>
            {p.current.documents.length > 0 && (
              <ul className="mt-3 space-y-1">
                {p.current.documents.map((d, i) => (
                  <li key={i}><a href={d.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-11 items-center gap-1 font-bold text-blue underline">{d.name}<ExternalLink className="size-3.5" aria-hidden /></a></li>
                ))}
              </ul>
            )}
            {p.current.attachments.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{p.current.attachments.map((a) => <img key={a} src={`/api/dao/media/${a}`} alt={tu("proposalAttachment")} className="max-h-48 rounded-xl" />)}</div>}
            {p.discussionId && <Link href={`/dao/${eventId}/discussion?thread=${p.discussionId}`} className="mt-3 inline-flex min-h-11 items-center font-bold text-acid hover:underline">{tu("joinTheDiscussion")}</Link>}
          </section>

          {p.vote && <VoteCard vote={p.vote} title={p.current.title} onVoted={refresh} />}

          {p.feasibility && (
            <section aria-labelledby="feas-h" className="neon rounded-[22px] border bg-surface/90 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="feas-h" className="text-lg uppercase">{tu("feasibilityCheck")}</h2>
                <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase text-ink", p.feasibility.overall === "feasible" ? "bg-acid" : p.feasibility.overall === "conditional" ? "bg-orange" : "bg-coral")}>{p.feasibility.overall.replace("_", " ")}</span>
              </div>
              <DemoNotice className="mt-3">{tu("aiAutomatedChecksAreAdvisory")}</DemoNotice>
              <ul className="mt-3 divide-y divide-line">
                {p.feasibility.checks.map((c) => {
                  const Icon = STATUS_ICON[c.status as keyof typeof STATUS_ICON];
                  return (
                    <li key={c.item} className="flex gap-3 py-2.5">
                      <Icon className={cn("mt-0.5 size-5 shrink-0", STATUS_COLOR[c.status as keyof typeof STATUS_COLOR])} aria-hidden />
                      <div className="min-w-0 text-sm">
                        <b><Tx>{FEASIBILITY_LABEL[c.item as FeasibilityItem]}</Tx></b> <span className="text-[11px] uppercase text-mute">{c.status.replace("_", " ")}</span>
                        <p className="text-mute">{c.reason}</p>
                        {c.alternative && <p className="mt-0.5 text-cream">{tu("alternativeAlternative", { alternative: c.alternative })}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <h3 className="mt-3 text-sm font-extrabold uppercase">{tu("humanSignOffs")}</h3>
              <ul className="mt-2 grid gap-2 sm:grid-cols-3">
                {(["organizer", "venue_manager", "specialist"] as const).map((r) => {
                  const s = p.feasibility!.signoffs.find((x) => x.role === r);
                  return (
                    <li key={r} className={cn("rounded-xl border p-2 text-sm", s ? "border-acid/50 bg-acid/10" : "border-line")}>
                      <b className="capitalize">{r.replace("_", " ")}</b>
                      <p className="text-[12px] text-mute">{s ? tu("signedFmtdateValue", { fmtDate: fmtDate(new Date(s.at).toISOString()), value: s.demoStandIn ? tu("demoStandIn") : "" }) : tu("pending")}</p>
                      {!s && isOrganizer && p.state === "FEASIBILITY_CHECK" && p.feasibility!.overall !== "not_feasible" && (
                        <Button size="sm" variant="ghost" className="mt-1 w-full" disabled={!!busy} onClick={() => act("signoff", { role: r }, "Sign-off recorded")}>{tu("recordSignOff")}</Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <aside className="min-w-0 space-y-6">
          {/* Actions */}
          <section aria-labelledby="act-h" className="neon rounded-[22px] border bg-surface/90 p-4">
            <h2 id="act-h" className="text-lg uppercase">{tu("nextActions")}</h2>
            {!home?.me && <Gate reason={tu("signInAndStakeTo")} action={<Button size="sm" onClick={() => setJoinOpen(true)}>{tu("joinDao")}</Button>} />}
            {isOrganizer && p.state === "FEASIBILITY_CHECK" && (
              <Button className="mt-3 w-full" variant="purple" disabled={!!busy} onClick={() => act("feasibility", {}, "Feasibility check ran")}>
                <ClipboardCheck className="size-5" aria-hidden /> {p.feasibility ? tu("reRunFeasibilityCheck") : tu("runFeasibilityCheck")}
              </Button>
            )}
            {transitions.length > 0 ? (
              <div className="mt-3 space-y-3">
                {transitions.some((t) => NEEDS_REASON.includes(t)) || transitions.includes("CANCELLED") ? (
                  <Field id="t-reason" label={tu("reasonRequiredForCancelRe")} hint={tu("shownPubliclyToTheCommunity")}>
                    <Textarea id="t-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                  </Field>
                ) : null}
                {transitions.map((t) => (
                  <Button key={t} className="w-full" variant={t === "CANCELLED" ? "coral" : t === "RE_REVIEW" ? "ghost" : "primary"} disabled={!!busy} onClick={() => act("transition", { to: t, reason: reason || undefined }, `Moved to ${tx(STATE_META[t].label)}`)}>
                    {t === "VOTING" ? tu("openVotingTakesSnapshot") : t === "CANCELLED" ? tu("cancelWithReason") : tu("moveToLabel", { label: STATE_META[t].label })}
                  </Button>
                ))}
              </div>
            ) : (
              home?.me && <p className="mt-2 text-sm text-mute">{tu("noActionForYourRole")}</p>
            )}
            <p className="mt-3 text-[12px] text-mute">{tu("voteResultsApprovedRejectedExpired")}</p>
          </section>

          {/* History */}
          <section aria-labelledby="hist-h">
            <h2 id="hist-h" className="text-lg uppercase">{tu("history")}</h2>
            <ol className="mt-2 space-y-2 border-l-2 border-line pl-3">
              {p.history.map((h, i) => (
                <li key={i} className="text-sm">
                  <b><Tx>{STATE_META[h.from].label}</Tx> → <Tx>{STATE_META[h.to].label}</Tx></b>
                  <span className="block text-[12px] text-mute">{fmtDate(new Date(h.at).toISOString(), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · {h.actorUid === "system" ? tu("voteEngine") : tu("member2")}</span>
                  {h.reason && <span className="block text-[13px]">“{h.reason}”</span>}
                </li>
              ))}
            </ol>
          </section>

          {versions.length > 1 && (
            <section aria-labelledby="ver-h">
              <h2 id="ver-h" className="text-lg uppercase">{tu("versions")}</h2>
              <ul className="mt-2 space-y-1 text-sm">{versions.map((v) => <li key={v.version}>v{v.version} · {fmtDate(new Date(v.createdAt).toISOString())} · {usd(v.estimatedCost)}</li>)}</ul>
            </section>
          )}

          {p.vote && (
            <section id="audit" aria-labelledby="audit-h" className="scroll-mt-32 rounded-[22px] border border-line p-4">
              <h2 id="audit-h" className="flex items-center gap-2 text-lg uppercase"><ShieldCheck className="size-5 text-acid" aria-hidden /> {tu("auditTrail")}</h2>
              {audit.state.status === "ok" ? (
                <div className="mt-2 space-y-2 text-[12px]">
                  <p>{tu("receiptHashChain")} <b className={audit.state.data.chainValid ? "text-acid" : "text-coral"}>{audit.state.data.chainValid ? tu("valid") : tu("broken")}</b></p>
                  <p className="break-all font-mono text-mute"><Hash className="mr-1 inline size-3" aria-hidden />{tu("snapshotHash", { hash: audit.state.data.snapshot.hash })}</p>
                  <p className="text-mute">{tu("eligibleEligibleExcludedExcludedAt", { eligible: audit.state.data.snapshot.eligible, excluded: audit.state.data.snapshot.excluded, length: audit.state.data.receipts.length })}</p>
                  {audit.state.data.result && <p className="break-all font-mono text-mute">{tu("resultResulthash", { resultHash: audit.state.data.result.resultHash })}</p>}
                </div>
              ) : (
                <p className="mt-2 text-sm text-mute">{tu("loading")}</p>
              )}
            </section>
          )}
        </aside>
      </div>
    </article>
  );
}
