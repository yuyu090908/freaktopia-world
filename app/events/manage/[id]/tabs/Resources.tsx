"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Ban, FileText, Handshake, Megaphone, Repeat, Search, Send, Star } from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/forms/Fields";
import { Button, DemoBadge } from "@/components/ui/primitives";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ConfirmSheet, Section, StatusPill, SuggestionBadge, useMoney, useOps, useOpsPost, useWhen } from "@/components/ops/shared";
import type { Agreement, Application, Listing, OpsEvent, Requirement } from "@/lib/ops/types";
import type { Candidate, TabProps, View } from "../ctx";
import { ApplicantAudio, useApplicationAudio } from "@/components/music/ApplicantAudio";

export function Resources(p: TabProps) {
  const { v } = p;
  return (
    <>
      {v.me.can.recruit && <ToSource {...p} />}
      {v.me.can.recruit && <Openings {...p} />}
      <Agreements {...p} />
      {v.me.can.recruit && <Reuse {...p} />}
    </>
  );
}

// ------------------------------------------------------------------ requirements still to source

function ToSource({ v, reload, eid }: TabProps) {
  const t = useTranslations("ops");
  const [open, setOpen] = useState<string | null>(null);
  const [call, setCall] = useState<Requirement | null>(null);
  const todo = v.requirements.filter((r) => ["needed", "recruiting", "proposed"].includes(r.status) && r.kind !== "permit");
  return (
    <Section title={t("toSource")} id="src-h" action={<SuggestionBadge />}>
      <p className="mb-3 text-sm text-mute">{t("matchingSub")}</p>
      {todo.length === 0 && <p className="text-sm text-mute">{t("allSourced")}</p>}
      <ul className="space-y-2" data-testid="to-source">
        {todo.map((r) => (
          <li key={r.id} className="rounded-2xl bg-surface-2 p-3" data-key={r.key}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 font-bold">
                {t(`req.${r.key}`)} <span className="text-mute">×{r.quantity}</span>
              </span>
              <StatusPill status={r.status} label={t(`status.${r.status}`)} />
              <Button size="sm" variant="secondary" onClick={() => setOpen(open === r.id ? null : r.id)} data-testid={`find-${r.key}`} aria-expanded={open === r.id}>
                <Search className="size-4" aria-hidden /> {t("findCandidates")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCall(r)} data-testid={`call-${r.key}`}>
                <Megaphone className="size-4" aria-hidden /> {t("openCall")}
              </Button>
            </div>
            {open === r.id && <Candidates eid={eid} req={r} reload={reload} />}
          </li>
        ))}
      </ul>
      {call && <OpenCallSheet v={v} eid={eid} req={call} onClose={() => setCall(null)} reload={reload} />}
    </Section>
  );
}

function Candidates({ eid, req, reload }: { eid: string; req: Requirement; reload: () => Promise<void> }) {
  const t = useTranslations("ops");
  const { data, loading } = useOps<{ eligible: Candidate[]; excluded: Candidate[] }>(`/api/ops/events/${eid}/candidates/${req.id}`);
  const [offer, setOffer] = useState<{ c: Candidate; kind: "direct" | "quote" } | null>(null);
  if (loading && !data) return <div className="mt-3 h-20 animate-pulse rounded-2xl bg-surface" />;
  if (!data) return null;
  return (
    <div className="mt-3 space-y-3" data-testid={`candidates-${req.key}`}>
      {data.eligible.length === 0 && <p className="text-sm text-mute">{t("noCandidates")}</p>}
      <ul className="space-y-2">
        {data.eligible.map((c) => (
          <CandidateRow key={c.listing.id} c={c} onOffer={(kind) => setOffer({ c, kind })} />
        ))}
      </ul>
      {data.excluded.length > 0 && (
        <details className="rounded-2xl border border-line p-3" data-testid="excluded">
          <summary className="min-h-11 cursor-pointer content-center text-sm font-bold">{t("excludedCount", { count: data.excluded.length })}</summary>
          <ul className="mt-2 space-y-2">
            {data.excluded.map((c) => (
              <li key={c.listing.id} className="text-sm" data-excluded={c.excluded.join(",")}>
                <span className="font-bold">{c.listing.title}</span> {c.listing.demo && <DemoBadge />}
                <div className="text-xs text-coral">{c.excluded.map((x) => t(`excl.${x}`)).join(" · ")}</div>
              </li>
            ))}
          </ul>
        </details>
      )}
      {offer && <OfferSheet eid={eid} req={req} c={offer.c} kind={offer.kind} onClose={() => setOffer(null)} reload={reload} />}
    </div>
  );
}

function CandidateRow({ c, onOffer }: { c: Candidate; onOffer: (kind: "direct" | "quote") => void }) {
  const t = useTranslations("ops");
  const money = useMoney();
  const parts = ["fit", "reliability", "cost", "distance", "logistics"] as const;
  return (
    <li className="rounded-2xl border border-line bg-ink/60 p-3" data-listing={c.listing.id}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 font-bold">
            <span className="truncate">{c.listing.title}</span>
            {c.listing.demo && <DemoBadge />}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-mute">
            {c.providerName && <span className="font-bold text-cream">{c.providerName}</span>}
            <span>{c.listing.city}</span>
            {c.distanceKm != null && <span>{t("km", { n: c.distanceKm })}</span>}
            <span>{money(c.listing.priceUsd)}</span>
            <span>{t("freeQty", { n: c.freeQuantity })}</span>
            <span className="inline-flex items-center gap-0.5"><Star className="size-3" aria-hidden /> {c.rating.average != null ? `${c.rating.average.toFixed(1)} (${c.rating.count})` : t("noReviews")}</span>
            {c.verified.filter((x) => x.status === "verified").map((x) => <span key={x.key} className="text-acid">✓ {t(`cred.${x.key}`)}</span>)}
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl text-acid tabular-nums">{c.score}</div>
          <div className="text-[10px] uppercase tracking-wider text-mute">{t("matchScore")}</div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1" aria-label={t("scoreParts")}>
        {parts.map((k) => (
          <div key={k} title={t(`part.${k}`)}>
            <div className="h-1.5 rounded-full bg-line"><div className="h-full rounded-full bg-blue" style={{ width: `${Math.round(c.parts[k] * 100)}%` }} /></div>
            <div className="mt-0.5 truncate text-[10px] text-mute">{t(`part.${k}`)}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onOffer("quote")} data-testid="request-quote">
          <FileText className="size-4" aria-hidden /> {t("requestQuote")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onOffer("direct")} data-testid="direct-offer">
          <Send className="size-4" aria-hidden /> {t("directOffer")}
        </Button>
      </div>
    </li>
  );
}

function OfferSheet({ eid, req, c, kind, onClose, reload }: { eid: string; req: Requirement; c: Candidate; kind: "direct" | "quote"; onClose: () => void; reload: () => Promise<void> }) {
  const t = useTranslations("ops");
  const post = useOpsPost();
  const [message, setMessage] = useState("");
  const [budget, setBudget] = useState<number | "">("");
  const send = async () => {
    const r = await post(`events/${eid}/openings`, { kind, requirementIds: [req.id], targetListingId: c.listing.id, message, budgetUsd: budget === "" ? null : budget }, t("sent"));
    if (r) {
      onClose();
      await reload();
    }
  };
  return (
    <BottomSheet open onClose={onClose} title={kind === "quote" ? t("requestQuote") : t("directOffer")} footer={<div className="flex justify-end"><Button onClick={() => void send()} data-testid="send-offer">{t("send")}</Button></div>}>
      <p className="text-sm">{t(kind === "quote" ? "quoteExplain" : "offerExplain", { name: c.listing.title, item: t(`req.${req.key}`) })}</p>
      {c.listing.demo && <p className="mt-2 text-sm text-orange">{t("demoProviderNote")}</p>}
      <div className="mt-3 space-y-3">
        <Field id="of-budget" label={t("budgetForThis")} optional><Input id="of-budget" type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value === "" ? "" : Number(e.target.value))} /></Field>
        <Field id="of-msg" label={t("message")} optional><Textarea id="of-msg" value={message} maxLength={2000} onChange={(e) => setMessage(e.target.value)} /></Field>
      </div>
    </BottomSheet>
  );
}

function OpenCallSheet({ v, eid, req, onClose, reload }: { v: View; eid: string; req: Requirement; onClose: () => void; reload: () => Promise<void> }) {
  const t = useTranslations("ops");
  const post = useOpsPost();
  const [ids, setIds] = useState<string[]>([req.id]);
  const [slots, setSlots] = useState(req.kind === "crew" && req.key === "dj_performer" ? req.quantity : 1);
  const [budget, setBudget] = useState<number | "">("");
  const [message, setMessage] = useState("");
  const others = v.requirements.filter((r) => r.id !== req.id && ["needed", "recruiting"].includes(r.status) && r.kind !== "permit");
  const send = async () => {
    if (await post(`events/${eid}/openings`, { kind: "open", requirementIds: ids, slots, budgetUsd: budget === "" ? null : budget, message }, t("published"))) {
      onClose();
      await reload();
    }
  };
  return (
    <BottomSheet open onClose={onClose} title={t("openCall")} footer={<div className="flex justify-end"><Button onClick={() => void send()} data-testid="publish-call">{t("publish")}</Button></div>}>
      <p className="text-sm text-mute">{t("openCallExplain")}</p>
      <div className="mt-3 space-y-3">
        <details className="rounded-2xl border border-line p-3">
          <summary className="min-h-11 cursor-pointer content-center text-sm font-bold">{t("packageCall", { count: ids.length })}</summary>
          <ul className="mt-2 space-y-1">
            {others.map((r) => (
              <li key={r.id}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" className="size-5 accent-acid" checked={ids.includes(r.id)} onChange={(e) => setIds(e.target.checked ? [...ids, r.id] : ids.filter((x) => x !== r.id))} />
                  {t(`req.${r.key}`)} ×{r.quantity}
                </label>
              </li>
            ))}
          </ul>
        </details>
        <div className="grid grid-cols-2 gap-3">
          <Field id="oc-slots" label={t("slots")}><Input id="oc-slots" type="number" min={1} max={50} value={slots} onChange={(e) => setSlots(Math.max(1, Number(e.target.value) || 1))} /></Field>
          <Field id="oc-budget" label={t("budgetForThis")} optional><Input id="oc-budget" type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value === "" ? "" : Number(e.target.value))} data-testid="call-budget" /></Field>
        </div>
        <Field id="oc-msg" label={t("message")} optional><Textarea id="oc-msg" value={message} maxLength={2000} onChange={(e) => setMessage(e.target.value)} /></Field>
      </div>
    </BottomSheet>
  );
}

// ------------------------------------------------------------------ openings and applications (compare + hire)

function Openings({ v, reload, eid }: TabProps) {
  const t = useTranslations("ops");
  const money = useMoney();
  const when = useWhen();
  const post = useOpsPost();
  const [hire, setHire] = useState<Application | null>(null);
  const audio = useApplicationAudio(eid, v.applications.some((a) => (a as Application & { trackIds?: string[] }).trackIds?.length));
  const listing = (id: string | null) => v.listings.find((l) => l.id === id);
  if (!v.openings.length) return null;
  return (
    <Section title={t("openingsTitle")} id="op-h">
      <ul className="space-y-4" data-testid="openings">
        {v.openings.map((o) => {
          const apps = v.applications.filter((a) => a.openingId === o.id).sort((a, b) => a.priceUsd - b.priceUsd);
          return (
            <li key={o.id} className="rounded-2xl bg-surface-2 p-3" data-kind={o.kind}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-extrabold uppercase">{t(`openingKind.${o.kind}`)}</span>
                <span className="min-w-0 flex-1 font-bold">{o.requirementIds.map((id) => t(`req.${v.requirements.find((r) => r.id === id)?.key ?? "venue_hire"}`)).join(" + ")}</span>
                <StatusPill status={o.status} label={t(`openingStatus.${o.status}`)} />
              </div>
              {o.targetListingId && (
                <div className="mt-1 text-xs text-mute">
                  {t("sentTo", { name: listing(o.targetListingId)?.title ?? "—" })} {listing(o.targetListingId)?.demo && <DemoBadge />}
                </div>
              )}
              {apps.length === 0 ? (
                <p className="mt-2 text-sm text-mute">{o.targetListingId && listing(o.targetListingId)?.demo ? t("demoNoReply") : t("noApplications")}</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm" data-testid="applications">
                    <thead className="text-[11px] uppercase tracking-wider text-mute">
                      <tr><th className="py-1 pr-2">{t("provider")}</th><th className="pr-2">{t("price")}</th><th className="pr-2">{t("offered")}</th><th className="pr-2">{t("proposal")}</th><th className="pr-2">{t("statusLabel")}</th><th /></tr>
                    </thead>
                    <tbody>
                      {apps.map((a) => (
                        <tr key={a.id} className="border-t border-line align-top">
                          <td className="py-2 pr-2 font-bold">
                            {audio?.profiles?.[a.id]?.stageName ?? listing(a.listingId)?.title ?? "—"}
                            {audio?.profiles?.[a.id] && <span className="block text-xs font-normal text-mute">{[audio.profiles[a.id].city, audio.profiles[a.id].genres.slice(0, 3).join(", ")].filter(Boolean).join(" · ")}</span>}
                            <span className="block text-[11px] font-normal text-mute">{when(a.createdAt, v.event.timezone, false)}</span>
                          </td>
                          <td className="pr-2 tabular-nums">{money(a.priceUsd)}</td>
                          <td className="pr-2 text-xs">{a.items.map((i) => `${t(`req.${i.key}`)} ×${i.quantity}${i.model ? ` (${i.model})` : ""}`).join(", ")}</td>
                          <td className="max-w-56 pr-2 text-xs">
                            {a.message && <p className="line-clamp-3">{a.message}</p>}
                            {a.portfolio && <p className="text-mute">{a.portfolio}</p>}
                            {a.availableFrom && <p className="text-mute">{when(a.availableFrom, v.event.timezone, false)} – {when(a.availableTo, v.event.timezone, false)}</p>}
                            {a.quoteDocumentId && <a className="font-bold text-acid underline" href={`/api/ops/documents/${a.quoteDocumentId}`}>{t("quoteFile")}</a>}
                            {audio?.tracks?.[a.id] && <ApplicantAudio tracks={audio.tracks[a.id]} />}
                          </td>
                          <td className="pr-2"><StatusPill status={a.status} label={t(`appStatus.${a.status}`)} /></td>
                          <td className="whitespace-nowrap">
                            {["submitted", "under_review", "shortlisted", "interview"].includes(a.status) && v.me.can.decide_applications && (
                              <div className="flex flex-wrap gap-1">
                                {a.status === "submitted" && <Button size="sm" variant="ghost" onClick={async () => { if (await post(`events/${eid}/applications/${a.id}/status`, { status: "under_review" })) await reload(); }} data-testid="app-review">{t("markUnderReview")}</Button>}
                                {["submitted", "under_review"].includes(a.status) && <Button size="sm" variant="ghost" onClick={async () => { if (await post(`events/${eid}/applications/${a.id}/status`, { status: "shortlisted" })) await reload(); }}>{t("shortlist")}</Button>}
                                {a.status === "shortlisted" && <Button size="sm" variant="ghost" onClick={async () => { if (await post(`events/${eid}/applications/${a.id}/status`, { status: "interview" })) await reload(); }} data-testid="app-interview">{t("markInterview")}</Button>}
                                <Button size="sm" variant="ghost" aria-label={t("reject")} onClick={async () => { if (await post(`events/${eid}/applications/${a.id}/status`, { status: "rejected" })) await reload(); }}><Ban className="size-4" aria-hidden /></Button>
                                <Button size="sm" onClick={() => setHire(a)} data-testid="hire">{t("hire")}</Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {hire && <HireSheet v={v} eid={eid} app={hire} onClose={() => setHire(null)} reload={reload} />}
    </Section>
  );
}

function HireSheet({ v, eid, app, onClose, reload }: { v: View; eid: string; app: Application; onClose: () => void; reload: () => Promise<void> }) {
  const t = useTranslations("ops");
  const post = useOpsPost();
  const money = useMoney();
  const [amount, setAmount] = useState(app.priceUsd);
  const [cancellation, setCancellation] = useState("");
  const [busy, setBusy] = useState(false);
  const l = v.listings.find((x) => x.id === app.listingId);
  return (
    <ConfirmSheet
      open
      onClose={onClose}
      title={t("hireTitle")}
      statement={t("hireStatement", { name: l?.title ?? "—", amount: money(amount) })}
      confirmLabel={t("hireConfirm")}
      busy={busy}
      onConfirm={async () => {
        setBusy(true);
        const r = await post(`events/${eid}/applications/${app.id}/accept`, { confirm: true, terms: { amountUsd: amount, cancellation } }, t("hired"));
        setBusy(false);
        if (r) {
          onClose();
          await reload();
        }
      }}
    >
      <p className="text-sm text-mute">{t("hireExplain")}</p>
      <Field id="h-amt" label={t("amount")}><Input id="h-amt" type="number" min={0} value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))} /></Field>
      <Field id="h-can" label={t("cancellationTerms")} optional><Textarea id="h-can" rows={2} value={cancellation} maxLength={1000} onChange={(e) => setCancellation(e.target.value)} /></Field>
    </ConfirmSheet>
  );
}

// ------------------------------------------------------------------ agreements (contract records with history)

function Agreements({ v, reload }: TabProps) {
  const t = useTranslations("ops");
  const money = useMoney();
  const when = useWhen();
  const post = useOpsPost();
  const [act, setAct] = useState<{ ag: Agreement; kind: "accept" | "cancel" | "pay" | "change" | "review" } | null>(null);
  if (!v.agreements.length) return null;
  const title = (ag: Agreement) => v.listings.find((l) => l.id === v.bookings.find((b) => b.id === ag.bookingId)?.listingId)?.title ?? "—";
  const paidOf = (ag: Agreement) => v.payments.filter((p) => p.agreementId === ag.id).reduce((a, p) => a + p.amountUsd, 0);
  const organizer = !!v.me.can.sign_agreement;
  return (
    <Section title={t("agreements")} id="ag-h">
      <p className="mb-3 text-sm text-mute">{t("agreementsSub")}</p>
      <ul className="space-y-3" data-testid="agreements">
        {v.agreements.map((ag) => {
          const mineAsProvider = ag.providerId === v.me.userId;
          const needsMe = (ag.status === "proposed" || ag.status === "changed") && ((mineAsProvider && !ag.providerAcceptedAt) || (organizer && !mineAsProvider && !ag.organizerAcceptedAt));
          return (
            <li key={ag.id} className="rounded-2xl bg-surface-2 p-3" data-status={ag.status}>
              <div className="flex flex-wrap items-center gap-2">
                <Handshake className="size-4 text-acid" aria-hidden />
                <span className="min-w-0 flex-1 font-bold">{title(ag)}</span>
                <span className="tabular-nums">{money(ag.terms.amountUsd)}</span>
                <StatusPill status={ag.status} label={t(`agStatus.${ag.status}`)} />
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-mute">
                <span>{t("organizerAccepted", { v: ag.organizerAcceptedAt ? when(ag.organizerAcceptedAt) : "—" })}</span>
                <span>{t("providerAccepted", { v: ag.providerAcceptedAt ? when(ag.providerAcceptedAt) : "—" })}</span>
                {organizer && <span>{t("paidOf", { paid: money(paidOf(ag)), total: money(ag.terms.amountUsd) })}</span>}
              </div>
              <details className="mt-1 text-xs">
                <summary className="cursor-pointer py-1 font-bold text-mute">{t("history", { count: ag.history.length })}</summary>
                <ol className="mt-1 space-y-0.5">
                  {ag.history.map((h, i) => (
                    <li key={i}>{when(h.at)} · {t(`agAction.${h.action}`)} · {money(h.terms.amountUsd)}</li>
                  ))}
                </ol>
              </details>
              <div className="mt-2 flex flex-wrap gap-2">
                {needsMe && <Button size="sm" onClick={() => setAct({ ag, kind: "accept" })} data-testid="accept-agreement">{t("acceptTerms")}</Button>}
                {(ag.status === "proposed" || ag.status === "agreed" || ag.status === "changed") && <Button size="sm" variant="ghost" onClick={() => setAct({ ag, kind: "change" })}>{t("changeTerms")}</Button>}
                {organizer && ag.status === "agreed" && <Button size="sm" variant="ghost" onClick={async () => { if (await post(`agreements/${ag.id}/complete`, { version: ag.version })) await reload(); }}>{t("markCompleted")}</Button>}
                {organizer && v.me.can.record_payment && ["agreed", "completed"].includes(ag.status) && paidOf(ag) < ag.terms.amountUsd && <Button size="sm" variant="ghost" onClick={() => setAct({ ag, kind: "pay" })} data-testid="record-payment">{t("recordPayment")}</Button>}
                {ag.status === "completed" && !v.reviews.some((r) => r.agreementId === ag.id && r.raterId === v.me.userId) && <Button size="sm" variant="ghost" onClick={() => setAct({ ag, kind: "review" })}>{t("writeReview")}</Button>}
                {!["cancelled", "completed"].includes(ag.status) && <Button size="sm" variant="ghost" className="text-coral" onClick={() => setAct({ ag, kind: "cancel" })}>{t("cancelAgreement")}</Button>}
              </div>
            </li>
          );
        })}
      </ul>
      {act && <AgreementAction v={v} ag={act.ag} kind={act.kind} label={title(act.ag)} onClose={() => setAct(null)} reload={reload} />}
    </Section>
  );
}

export function AgreementAction({ v, ag, kind, label, onClose, reload }: { v?: View; ag: Agreement; kind: "accept" | "cancel" | "pay" | "change" | "review"; label: string; onClose: () => void; reload: () => Promise<void> }) {
  const t = useTranslations("ops");
  const post = useOpsPost();
  const money = useMoney();
  const [amount, setAmount] = useState(kind === "pay" ? 0 : ag.terms.amountUsd);
  const [text, setText] = useState("");
  const [scores, setScores] = useState({ punctuality: 5, communication: 5, delivery: 5, quality: 5, overall: 5 });
  const done = async (r: unknown) => {
    if (r) {
      onClose();
      await reload();
    }
  };
  if (kind === "change" || kind === "review")
    return (
      <BottomSheet
        open
        onClose={onClose}
        title={kind === "change" ? t("changeTerms") : t("writeReview")}
        footer={
          <div className="flex justify-end">
            <Button
              data-testid="save-sheet"
              onClick={async () => done(kind === "change" ? await post(`agreements/${ag.id}/change`, { terms: { amountUsd: amount, ...(text ? { scope: text } : {}) }, version: ag.version }, t("saved")) : await post(`agreements/${ag.id}/review`, { scores, comment: text }, t("thanksReview")))}
            >
              {t("save")}
            </Button>
          </div>
        }
      >
        {kind === "change" ? (
          <div className="space-y-3">
            <p className="text-sm text-mute">{t("changeExplain")}</p>
            <Field id="c-amt" label={t("amount")}><Input id="c-amt" type="number" min={0} value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))} /></Field>
            <Field id="c-scope" label={t("scope")} optional><Textarea id="c-scope" rows={2} value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} /></Field>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-mute">{t("reviewExplain")}</p>
            {(Object.keys(scores) as (keyof typeof scores)[]).map((k) => (
              <Field key={k} id={`r-${k}`} label={t(`score.${k}`)}>
                <Select id={`r-${k}`} value={scores[k]} onChange={(e) => setScores({ ...scores, [k]: Number(e.target.value) })}>
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
                </Select>
              </Field>
            ))}
            <Field id="r-c" label={t("comment")} optional><Textarea id="r-c" rows={2} value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} /></Field>
          </div>
        )}
      </BottomSheet>
    );
  const statement = kind === "accept" ? t("acceptStatement", { name: label, amount: money(ag.terms.amountUsd) }) : kind === "cancel" ? t("cancelStatement", { name: label }) : t("payStatement", { amount: money(amount), name: label });
  return (
    <ConfirmSheet
      open
      onClose={onClose}
      title={kind === "accept" ? t("acceptTerms") : kind === "cancel" ? t("cancelAgreement") : t("recordPayment")}
      statement={statement}
      confirmLabel={kind === "accept" ? t("acceptTerms") : kind === "cancel" ? t("cancelAgreement") : t("recordPayment")}
      onConfirm={async () =>
        done(
          kind === "accept"
            ? await post(`agreements/${ag.id}/accept`, { confirm: true, version: ag.version }, t("saved"))
            : kind === "cancel"
              ? await post(`agreements/${ag.id}/cancel`, { confirm: true, version: ag.version, reason: text }, t("saved"))
              : await post(`events/${ag.eventId}/payments`, { agreementId: ag.id, amountUsd: amount, note: text, confirm: true }, t("saved")),
        )
      }
    >
      {kind === "accept" && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-mute">{t("amount")}</dt><dd>{money(ag.terms.amountUsd)}</dd>
          {ag.terms.scope && <><dt className="text-mute">{t("scope")}</dt><dd>{ag.terms.scope}</dd></>}
          {ag.terms.cancellation && <><dt className="text-mute">{t("cancellationTerms")}</dt><dd>{ag.terms.cancellation}</dd></>}
        </dl>
      )}
      {kind === "pay" && (
        <>
          <p className="text-sm text-orange">{t("paymentRecordOnly")}</p>
          <Field id="p-amt" label={t("amount")}><Input id="p-amt" type="number" min={1} value={amount || ""} onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))} data-testid="pay-amount" /></Field>
        </>
      )}
      {(kind === "cancel" || kind === "pay") && <Field id="a-note" label={kind === "cancel" ? t("reason") : t("note")} optional><Input id="a-note" value={text} maxLength={300} onChange={(e) => setText(e.target.value)} /></Field>}
      {v && null}
    </ConfirmSheet>
  );
}

// ------------------------------------------------------------------ event team reuse

function Reuse({ v, reload, eid }: TabProps) {
  const t = useTranslations("ops");
  const post = useOpsPost();
  const { data } = useOps<{ events: { event: OpsEvent }[] }>("/api/ops/events");
  const [from, setFrom] = useState("");
  const others = (data?.events ?? []).map((x) => x.event).filter((e) => e.id !== eid);
  if (!others.length) return null;
  return (
    <Section title={t("reuseTitle")} id="reuse-h">
      <p className="mb-3 text-sm text-mute">{t("reuseSub")}</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 basis-56">
          <Field id="reuse-from" label={t("reuseFrom")}>
            <Select id="reuse-from" value={from} onChange={(e) => setFrom(e.target.value)}>
              <option value="">—</option>
              {others.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          </Field>
        </div>
        <Button
          disabled={!from}
          onClick={async () => {
            const r = await post<{ openings: unknown[] }>(`events/${eid}/reuse`, { fromEventId: from });
            if (r) {
              const { toast } = await import("@/lib/store");
              toast({ title: t("reuseDone", { count: r.openings.length }), tone: "success" });
              await reload();
            }
          }}
        >
          <Repeat className="size-4" aria-hidden /> {t("reuseAction")}
        </Button>
      </div>
      {v && null}
    </Section>
  );
}

export type { Listing };
