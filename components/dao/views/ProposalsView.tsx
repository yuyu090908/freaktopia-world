"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Plus, Trash2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button, Chip, DemoNotice } from "@/components/ui/primitives";
import { EmptyState, LoadingSkeleton } from "@/components/ui/States";
import { Field, Input, Select, Textarea } from "@/components/forms/Fields";
import { daoApi, useDaoQuery } from "@/lib/dao/client";
import { CATEGORY_LABEL, METHOD_LABEL, STATE_META, usd } from "@/lib/dao/meta";
import { DISCUSSION_CATEGORIES, type DiscussionCategory, type ProposalState, type VotingMethod } from "@/lib/dao/types";
import { DJS } from "@/lib/data";
import { toast } from "@/lib/store";
import { useDao, type ConceptDto, type VoteDto } from "../DaoContext";
import { CategoryTag, Gate, StateTag, ago } from "../DaoUi";
import { ImagePicker } from "./DiscussionView";

export interface ProposalDto {
  id: string;
  category: DiscussionCategory;
  state: ProposalState;
  authorHandle: string;
  authorUid: string;
  createdAt: number;
  method: VotingMethod;
  discussionDays: number;
  votingDays: number;
  current: { version: number; title: string; description: string; proposedChange: string; estimatedCost: number; options: { id: string; label: string; conceptId?: string; djId?: string }[]; attachments: string[]; documents: { name: string; url?: string }[] };
  versionCount: number;
  history: { from: ProposalState; to: ProposalState; at: number; actorUid: string; reason?: string }[];
  discussionId: string | null;
  feasibility: null | { at: number; overall: string; advisoryOnly: true; checks: { item: string; status: string; reason: string; alternative?: string }[]; signoffs: { role: string; uid: string; at: number; note?: string; demoStandIn?: boolean }[] };
  executionReport: null | { at: number; status: string; message: string };
  concepts: ConceptDto[];
  vote: VoteDto | null;
  isDemo: boolean;
}

const GROUPS: [string, ProposalState[]][] = [
  ["Active", ["DISCUSSION", "REVIEW", "RE_REVIEW", "VOTING"]],
  ["Delivery", ["APPROVED", "FEASIBILITY_CHECK", "ORGANIZER_CONFIRMATION", "EXECUTION"]],
  ["Done", ["COMPLETED", "REJECTED", "EXPIRED", "CANCELLED"]],
  ["Drafts", ["DRAFT"]],
];

export function ProposalsView() {
  return (
    <Suspense fallback={<LoadingSkeleton variant="list" />}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const { eventId, setJoinOpen } = useDao();
  const params = useSearchParams();
  const router = useRouter();
  const [group, setGroup] = useState("Active");
  const [form, setForm] = useState(params.get("new") === "1");
  const { state, reload } = useDaoQuery<{ proposals: ProposalDto[]; canCreate: boolean }>(`${eventId}/proposals`);
  useEffect(() => setForm(params.get("new") === "1"), [params]);
  const close = () => {
    setForm(false);
    router.replace(`/dao/${eventId}/proposals`, { scroll: false });
  };
  if (state.status === "loading") return <LoadingSkeleton variant="list" />;
  if (state.status === "error") return <p role="alert">{state.error.message}</p>;
  const list = state.data.proposals.filter((p) => GROUPS.find(([g]) => g === group)![1].includes(p.state));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[34px] uppercase leading-none sm:text-5xl">Proposals</h1>
          <p className="mt-2 max-w-2xl text-sm text-mute">Draft → Discussion → Review → Voting → Approved/Rejected → Feasibility check → Organizer confirmation → Execution → Completed.</p>
        </div>
        {state.data.canCreate ? (
          <Button onClick={() => setForm(true)}><Plus className="size-5" aria-hidden /> New proposal</Button>
        ) : null}
      </div>
      {!state.data.canCreate && <Gate reason="Only staked members can create proposals." action={<Button size="sm" onClick={() => setJoinOpen(true)}>Join DAO</Button>} />}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0" role="group" aria-label="Proposal groups">
        {GROUPS.map(([g, states]) => (
          <Chip key={g} active={group === g} onClick={() => setGroup(g)}>
            {g} ({state.data.proposals.filter((p) => states.includes(p.state)).length})
          </Chip>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyState title="Nothing here" body="No proposals in this stage." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((p) => (
            <li key={p.id}>
              <Link href={`/dao/${eventId}/proposals/${p.id}`} className="neon flex h-full flex-col rounded-[22px] border bg-surface/90 p-4 hover:border-acid">
                <div className="flex flex-wrap items-center gap-2">
                  <StateTag state={p.state} />
                  <CategoryTag c={p.category} />
                </div>
                <h2 className="mt-2 text-lg font-extrabold normal-case leading-snug [font-family:var(--font-sans)]">{p.current.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-mute">{p.current.description}</p>
                <div className="mt-auto flex flex-wrap gap-x-3 pt-3 text-[12px] text-mute">
                  <span>@{p.authorHandle}</span>
                  <span>{ago(p.createdAt)}</span>
                  <span>{METHOD_LABEL[p.method]}</span>
                  {p.current.estimatedCost > 0 && <span>{usd(p.current.estimatedCost)}</span>}
                  {p.vote?.status === "open" && <span className="font-extrabold text-acid">{Math.round(p.vote.participation * 100)}% voted</span>}
                  {p.versionCount > 1 && <span>v{p.current.version}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <ProposalForm open={form} onClose={close} onCreated={(id) => { void reload(true); router.push(`/dao/${eventId}/proposals/${id}`); }} />
    </div>
  );
}

function ProposalForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { eventId, home } = useDao();
  const gallery = useDaoQuery<{ concepts: ConceptDto[] }>(open ? `${eventId}/gallery` : null);
  // Prefill from links elsewhere on the site (DJ Arena "Nominate", After party "Propose", Venue "Stage designer").
  const params = useSearchParams();
  const preCat = params.get("cat");
  const preDj = DJS.find((d) => d.id === params.get("dj"));
  const [f, setF] = useState({
    title: (params.get("title") ?? (preDj ? `Nominate ${preDj.name} for the lineup` : "")).slice(0, 120),
    description: "",
    category: ((DISCUSSION_CATEGORIES as readonly string[]).includes(preCat ?? "") ? preCat : preDj ? "dj_lineup" : "stage_design") as DiscussionCategory,
    proposedChange: "",
    estimatedCost: 0,
    method: "yes_no_abstain" as VotingMethod,
    discussionDays: 3,
    votingDays: 7,
  });
  const [options, setOptions] = useState<{ label: string; conceptId?: string; djId?: string }[]>([]);
  const [conceptIds, setConceptIds] = useState<string[]>([]);
  const [docs, setDocs] = useState<{ name: string; url: string }[]>([]);
  const [images, setImages] = useState<{ id: string; url: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (submitNow: boolean) => {
    setBusy(true);
    setErr(null);
    const r = await daoApi<{ proposal: { id: string }; xp: number }>(`${eventId}/proposals`, {
      method: "POST",
      json: { ...f, options: f.method === "yes_no_abstain" ? [] : options.filter((o) => o.label.trim()), conceptIds, documents: docs.filter((d) => d.name && d.url), attachments: images.map((i) => i.id), submit: submitNow },
    });
    setBusy(false);
    if (!r.ok) return setErr(r.error.issues?.map((i) => `${i.path}: ${i.message}`).join(" · ") || r.error.message);
    toast({ title: submitNow ? "Proposal opened for discussion" : "Draft saved", body: r.data.xp ? `+${r.data.xp} DAO XP` : undefined, tone: "success" });
    onCreated(r.data.proposal.id);
  };
  const concepts = gallery.state.status === "ok" ? gallery.state.data.concepts : [];
  return (
    <BottomSheet open={open} onClose={onClose} title="New proposal" className="md:max-w-2xl">
      <div className="space-y-4">
        <Field id="p-title" label="Title"><Input id="p-title" value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={120} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="p-cat" label="Category">
            <Select id="p-cat" value={f.category} onChange={(e) => set("category", e.target.value as DiscussionCategory)}>
              {DISCUSSION_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </Select>
          </Field>
          <Field id="p-event" label="Event"><Input id="p-event" value={home?.event.name ?? ""} readOnly /></Field>
        </div>
        <Field id="p-desc" label="Description" hint="Why this matters (20+ characters)"><Textarea id="p-desc" rows={4} value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <Field id="p-change" label="Proposed change" hint="Exactly what should change if approved"><Textarea id="p-change" rows={2} value={f.proposedChange} onChange={(e) => set("proposedChange", e.target.value)} /></Field>
        <Field id="p-cost" label="Estimated cost (USD)" hint="Your estimate; the treasury and feasibility check verify it later">
          <Input id="p-cost" type="number" min={0} value={f.estimatedCost} onChange={(e) => set("estimatedCost", Number(e.target.value))} />
        </Field>
        <Field id="p-method" label="Voting method">
          <Select id="p-method" value={f.method} onChange={(e) => set("method", e.target.value as VotingMethod)}>
            {(["yes_no_abstain", "single", "multiple", "ranked"] as VotingMethod[]).map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}{m === "multiple" || m === "ranked" ? " (beta)" : ""}</option>)}
          </Select>
        </Field>
        {f.method !== "yes_no_abstain" && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-bold">Voting options</legend>
            {concepts.length > 0 && (
              <div className="space-y-1">
                <p className="text-[12px] text-mute">Add stage concepts from the gallery as options:</p>
                <div className="flex flex-wrap gap-2">
                  {concepts.slice(0, 8).map((c) => {
                    const on = conceptIds.includes(c.id);
                    return (
                      <Chip key={c.id} active={on} onClick={() => {
                        setConceptIds((x) => (on ? x.filter((y) => y !== c.id) : [...x, c.id]));
                        setOptions((o) => (on ? o.filter((y) => y.conceptId !== c.id) : [...o, { label: c.name, conceptId: c.id }]));
                      }}>{c.name}</Chip>
                    );
                  })}
                </div>
              </div>
            )}
            {f.category === "dj_lineup" && (
              <div className="flex flex-wrap gap-2">
                {DJS.slice(0, 8).map((d) => {
                  const on = options.some((o) => o.djId === d.id);
                  return <Chip key={d.id} active={on} onClick={() => setOptions((o) => (on ? o.filter((y) => y.djId !== d.id) : [...o, { label: d.name, djId: d.id }]))}>{d.name}</Chip>;
                })}
              </div>
            )}
            {options.map((o, i) => (
              <div key={i} className="flex gap-2">
                <label className="sr-only" htmlFor={`opt-${i}`}>Option {i + 1}</label>
                <Input id={`opt-${i}`} value={o.label} onChange={(e) => setOptions((x) => x.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} />
                <button type="button" aria-label={`Remove option ${i + 1}`} className="inline-flex size-[52px] shrink-0 items-center justify-center rounded-2xl border-2 border-line" onClick={() => setOptions((x) => x.filter((_, j) => j !== i))}><Trash2 className="size-4" aria-hidden /></button>
              </div>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setOptions((x) => [...x, { label: "" }])}><Plus className="size-4" aria-hidden /> Add option</Button>
          </fieldset>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field id="p-dd" label="Discussion (days)"><Input id="p-dd" type="number" min={1} max={14} value={f.discussionDays} onChange={(e) => set("discussionDays", Number(e.target.value))} /></Field>
          <Field id="p-vd" label="Voting (days)"><Input id="p-vd" type="number" min={1} max={14} value={f.votingDays} onChange={(e) => set("votingDays", Number(e.target.value))} /></Field>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-bold">Supporting documents (links)</legend>
          {docs.map((d, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <Input aria-label={`Document ${i + 1} name`} placeholder="Name" value={d.name} onChange={(e) => setDocs((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} />
              <Input aria-label={`Document ${i + 1} URL`} placeholder="https://" value={d.url} onChange={(e) => setDocs((x) => x.map((y, j) => (j === i ? { ...y, url: e.target.value } : y)))} />
            </div>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setDocs((x) => [...x, { name: "", url: "" }])}><FileText className="size-4" aria-hidden /> Add document</Button>
        </fieldset>
        <ImagePicker onUploaded={(f2) => setImages((x) => [...x, ...f2].slice(0, 6))} label="Add images" />
        {images.length > 0 && <div className="flex flex-wrap gap-2">{images.map((i) => <img key={i.id} src={i.url} alt="Proposal image preview" className="size-16 rounded-lg object-cover" />)}</div>}
        <DemoNotice>Proposals are public. The organizer moves them to voting after review; vote results are set by the engine, not by people.</DemoNotice>
        {err && <p role="alert" className="text-sm text-coral">{err}</p>}
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => submit(false)} disabled={busy}>Save draft</Button>
          <Button className="flex-1" onClick={() => submit(true)} disabled={busy}>{busy ? "Saving…" : "Open for discussion"}</Button>
        </div>
        <p className="text-[12px] text-mute">States: {Object.keys(STATE_META).length} lifecycle states incl. cancelled, expired and re-review.</p>
      </div>
    </BottomSheet>
  );
}
