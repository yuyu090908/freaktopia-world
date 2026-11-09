"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Flag, ImagePlus, Lock, MessagesSquare, Pin, Plus, Reply, Search, Shield } from "lucide-react";
import { AlienAvatar } from "@/components/cards/Cards";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button, Chip } from "@/components/ui/primitives";
import { EmptyState, LoadingSkeleton } from "@/components/ui/States";
import { Field, Input, Select, Textarea } from "@/components/forms/Fields";
import { daoApi, useDaoQuery } from "@/lib/dao/client";
import { CATEGORY_LABEL } from "@/lib/dao/meta";
import { DISCUSSION_CATEGORIES, type DiscussionCategory, type ReactionKind } from "@/lib/dao/types";
import { toast } from "@/lib/store";
import type { DJ } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ConceptRender } from "../ConceptRender";
import { useDao, type ConceptDto, type DiscussionDto } from "../DaoContext";
import { CategoryTag, Gate, HiddenTag, ReactionBar, StateTag, VisibilityTag, ago } from "../DaoUi";

export function DiscussionView() {
  return (
    <Suspense fallback={<LoadingSkeleton variant="list" />}>
      <Inner />
    </Suspense>
  );
}

export async function uploadImages(eventId: string, files: FileList | File[], purpose: "attachment" | "venue", visibility?: string) {
  const f = new FormData();
  f.append("purpose", purpose);
  if (visibility) f.append("visibility", visibility);
  for (const file of Array.from(files)) f.append("file", file);
  return daoApi<{ files: { id: string; url: string }[]; errors: { name: string; message: string }[] }>(`${eventId}/media`, { method: "POST", body: f });
}

function Inner() {
  const { eventId, home, setJoinOpen } = useDao();
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const thread = params.get("thread");
  const [cat, setCat] = useState<DiscussionCategory | "">((params.get("category") as DiscussionCategory) ?? "");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [debounced, setDebounced] = useState(q);
  const [compose, setCompose] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  const qs = new URLSearchParams();
  if (cat) qs.set("category", cat);
  if (debounced) qs.set("q", debounced);
  const { state, reload } = useDaoQuery<{ discussions: DiscussionDto[]; canPost: boolean; restricted: number; deny: { code: string; message: string } | null }>(`${eventId}/discussions?${qs}`);

  useEffect(() => {
    const p = new URLSearchParams(params.toString());
    cat ? p.set("category", cat) : p.delete("category");
    debounced ? p.set("q", debounced) : p.delete("q");
    const next = `${path}${p.toString() ? `?${p}` : ""}`;
    if (next !== `${path}${params.toString() ? `?${params}` : ""}`) router.replace(next, { scroll: false });
  }, [cat, debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  if (thread) return <Thread id={thread} onBack={() => router.push(`${path}${cat ? `?category=${cat}` : ""}`)} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[34px] uppercase leading-none sm:text-5xl">Discussion</h1>
          <p className="mt-2 text-sm text-mute">Anyone can read public threads. Posting, replying and reacting need a verified stake.</p>
        </div>
        {state.status === "ok" && state.data.canPost ? (
          <Button onClick={() => setCompose(true)}><Plus className="size-5" aria-hidden /> New thread</Button>
        ) : null}
      </div>
      {state.status === "ok" && !state.data.canPost && (
        <Gate reason={state.data.deny?.code === "WALLET_REQUIRED" ? "Read-only: sign in and stake to post." : "Read-only: stake the minimum to post."} action={<Button size="sm" onClick={() => setJoinOpen(true)}>Join DAO</Button>}>
          {state.data.deny?.message}
        </Gate>
      )}
      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search discussions</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-mute" aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search threads and comments" className="h-12 w-full rounded-full border-2 border-line bg-ink pl-12 pr-4 text-base outline-none focus:border-acid" />
        </label>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Categories">
        <Chip active={!cat} onClick={() => setCat("")}>All</Chip>
        {DISCUSSION_CATEGORIES.map((c) => (
          <Chip key={c} active={cat === c} onClick={() => setCat(cat === c ? "" : c)}>{CATEGORY_LABEL[c]}</Chip>
        ))}
      </div>
      {state.status === "loading" && <LoadingSkeleton variant="list" />}
      {state.status === "error" && <p role="alert">{state.error.message}</p>}
      {state.status === "ok" && (
        <>
          {state.data.discussions.length === 0 ? (
            <EmptyState title="No threads here yet" body="Try another category or start the first thread." />
          ) : (
            <ul className="space-y-3">
              {state.data.discussions.map((d) => (
                <li key={d.id}>
                  <Link href={`${path}?thread=${d.id}`} className={cn("neon block rounded-[22px] border bg-surface/90 p-4 hover:border-acid", d.pinned && "border-orange/60")}>
                    <div className="flex flex-wrap items-center gap-2">
                      {d.pinned && <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase text-orange"><Pin className="size-3.5" aria-hidden />Pinned</span>}
                      <CategoryTag c={d.category} />
                      <VisibilityTag v={d.visibility} />
                      {d.locked && <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase text-mute"><Lock className="size-3.5" aria-hidden />Locked</span>}
                      {d.hidden && <HiddenTag />}
                      {d.proposalIds.length > 0 && <span className="text-[11px] font-extrabold uppercase text-purple">Proposal</span>}
                    </div>
                    <h2 className="mt-2 text-lg font-extrabold normal-case leading-snug [font-family:var(--font-sans)]">{d.title}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-mute">{d.body}</p>
                    <div className="mt-2 flex flex-wrap gap-x-3 text-[12px] text-mute">
                      <span>@{d.authorHandle}</span>
                      <span>{ago(d.lastActivityAt)}</span>
                      <span><MessagesSquare className="mr-1 inline size-3.5" aria-hidden />{d.commentCount}</span>
                      <span>🔥 {d.reactions.fire ?? 0}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {state.data.restricted > 0 && <p className="text-center text-[13px] text-mute">{state.data.restricted} members-only or organizer topics are hidden for your access level.</p>}
        </>
      )}
      <Composer open={compose} onClose={() => setCompose(false)} onCreated={(id) => { setCompose(false); void reload(true); router.push(`${path}?thread=${id}`); }} staff={!!home?.me?.can.moderate} />
    </div>
  );
}

function Composer({ open, onClose, onCreated, staff }: { open: boolean; onClose: () => void; onCreated: (id: string) => void; staff: boolean }) {
  const { eventId } = useDao();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<DiscussionCategory>("general");
  const [visibility, setVisibility] = useState<"public" | "members" | "private">("public");
  const [attachments, setAttachments] = useState<{ id: string; url: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setErr(null);
    const r = await daoApi<{ discussion: { id: string }; xp: number }>(`${eventId}/discussions`, { method: "POST", json: { title, body, category, visibility, attachments: attachments.map((a) => a.id) } });
    setBusy(false);
    if (!r.ok) return setErr(r.error.issues?.map((i) => `${i.path}: ${i.message}`).join(" · ") || r.error.message);
    toast({ title: "Thread posted", body: r.data.xp ? `+${r.data.xp} DAO XP` : "No XP (anti-spam rules)", tone: "success" });
    setTitle("");
    setBody("");
    setAttachments([]);
    onCreated(r.data.discussion.id);
  };
  return (
    <BottomSheet open={open} onClose={onClose} title="New thread">
      <div className="space-y-4">
        <Field id="t-title" label="Title"><Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="t-cat" label="Category">
            <Select id="t-cat" value={category} onChange={(e) => setCategory(e.target.value as DiscussionCategory)}>
              {DISCUSSION_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </Select>
          </Field>
          <Field id="t-vis" label="Who can read">
            <Select id="t-vis" value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)}>
              <option value="public">Public</option>
              <option value="members">Members only</option>
              {staff && <option value="private">Organizers only</option>}
            </Select>
          </Field>
        </div>
        <Field id="t-body" label="Message" hint="At least 20 characters. Be kind; reports from 3 members hide a post for review.">
          <Textarea id="t-body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} />
        </Field>
        <ImagePicker onUploaded={(f) => setAttachments((a) => [...a, ...f].slice(0, 4))} />
        {attachments.length > 0 && (
          <ul className="flex flex-wrap gap-2">{attachments.map((a) => <li key={a.id}><img src={a.url} alt="Attachment preview" className="size-20 rounded-xl object-cover" /></li>)}</ul>
        )}
        {err && <p role="alert" className="text-sm text-coral">{err}</p>}
        <Button className="w-full" onClick={submit} disabled={busy}>{busy ? "Posting…" : "Post thread"}</Button>
      </div>
    </BottomSheet>
  );
}

export function ImagePicker({ onUploaded, label = "Attach images", purpose = "attachment" }: { onUploaded: (f: { id: string; url: string }[]) => void; label?: string; purpose?: "attachment" | "venue" }) {
  const { eventId } = useDao();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 border-dashed border-line px-4 text-sm font-bold hover:border-acid">
        <ImagePlus className="size-4" aria-hidden /> {busy ? "Uploading…" : label}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={async (e) => {
            if (!e.target.files?.length) return;
            setBusy(true);
            setMsg(null);
            const r = await uploadImages(eventId, e.target.files, purpose);
            setBusy(false);
            e.target.value = "";
            if (!r.ok) return setMsg(r.error.message);
            if (r.data.errors.length) setMsg(r.data.errors.map((x) => `${x.name}: ${x.message}`).join(" "));
            onUploaded(r.data.files);
          }}
        />
      </label>
      <p className="mt-1 text-[12px] text-mute">JPEG, PNG or WebP · checked on the server</p>
      {msg && <p role="alert" className="mt-1 text-sm text-coral">{msg}</p>}
    </div>
  );
}

interface CommentDto {
  id: string;
  parentId: string | null;
  authorHandle: string;
  authorUid: string;
  body: string;
  createdAt: number;
  hidden: boolean;
  reactions: Record<string, number>;
  myReactions: string[];
  attachments: { id: string; url: string }[];
  reportCount?: number;
}

function Thread({ id, onBack }: { id: string; onBack: () => void }) {
  const { eventId, setJoinOpen } = useDao();
  const { state, reload } = useDaoQuery<{ discussion: DiscussionDto; comments: CommentDto[]; proposals: { id: string; title: string; state: string }[]; concept: ConceptDto | null; dj: DJ | null; canComment: boolean; canModerate: boolean; deny: { code: string; message: string } | null }>(`${eventId}/discussions/${id}`);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<CommentDto | null>(null);
  const [att, setAtt] = useState<{ id: string; url: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.status === "loading") return <LoadingSkeleton variant="list" />;
  if (state.status === "error")
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" aria-hidden /> Threads</Button>
        <Gate reason={state.httpStatus === 404 ? "Thread not found." : state.error.message} action={state.httpStatus === 401 || state.error.code === "STAKE_REQUIRED" ? <Button size="sm" onClick={() => setJoinOpen(true)}>Join DAO</Button> : undefined} />
      </div>
    );
  const { discussion: d, comments } = state.data;
  const roots = comments.filter((c) => !c.parentId);
  const kids = (pid: string) => comments.filter((c) => c.parentId === pid);

  const react = async (targetType: "discussion" | "comment", tid: string, kind: ReactionKind) => {
    const r = await daoApi(`${eventId}/react`, { method: "POST", json: { targetType, id: tid, kind } });
    if (!r.ok) toast({ title: "Can’t react", body: r.error.message, tone: "error" });
    void reload(true);
  };
  const reportIt = async (targetType: "discussion" | "comment", tid: string) => {
    const r = await daoApi<{ hidden: boolean }>(`${eventId}/report`, { method: "POST", json: { targetType, id: tid, reason: "spam" } });
    toast(r.ok ? { title: "Reported", body: "Moderators will review it.", tone: "success" } : { title: "Couldn’t report", body: r.error.message, tone: "error" });
    void reload(true);
  };
  const mod = async (targetType: "discussion" | "comment", tid: string, action: string) => {
    const r = await daoApi(`${eventId}/moderate`, { method: "POST", json: { targetType, id: tid, action, reason: `Moderator action: ${action}` } });
    if (!r.ok) toast({ title: "Moderation failed", body: r.error.message, tone: "error" });
    void reload(true);
  };
  const send = async () => {
    setBusy(true);
    setErr(null);
    const r = await daoApi<{ xp: number }>(`${eventId}/discussions/${id}/comments`, { method: "POST", json: { body: text, parentId: replyTo?.id ?? null, attachments: att.map((a) => a.id) } });
    setBusy(false);
    if (!r.ok) return setErr(r.error.message);
    setText("");
    setReplyTo(null);
    setAtt([]);
    if (r.data.xp) toast({ title: `+${r.data.xp} DAO XP`, tone: "success" });
    void reload(true);
  };

  const CommentItem = ({ c, depth }: { c: CommentDto; depth: number }) => (
    <li className={cn("rounded-2xl border border-line bg-surface/80 p-3", depth && "ml-4 border-l-4 border-l-purple/60 sm:ml-8", c.hidden && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-mute">
        <b className="text-cream">@{c.authorHandle}</b> · {ago(c.createdAt)}
        {c.hidden && <HiddenTag />}
        {c.reportCount ? <span className="text-coral">{c.reportCount} reports</span> : null}
      </div>
      <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px]">{c.body}</p>
      {c.attachments.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{c.attachments.map((a) => <img key={a.id} src={a.url} alt="Comment attachment" className="max-h-48 rounded-xl" />)}</div>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <ReactionBar reactions={c.reactions} mine={c.myReactions} onToggle={(k) => react("comment", c.id, k)} disabled={!state.data.canComment} />
        {state.data.canComment && depth === 0 && (
          <button type="button" onClick={() => setReplyTo(c)} className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-bold text-mute hover:text-cream">
            <Reply className="size-4" aria-hidden /> Reply
          </button>
        )}
        <button type="button" onClick={() => reportIt("comment", c.id)} aria-label={`Report comment by ${c.authorHandle}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-mute hover:text-coral">
          <Flag className="size-4" aria-hidden />
        </button>
        {state.data.canModerate && (
          <button type="button" onClick={() => mod("comment", c.id, c.hidden ? "unhide" : "hide")} className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-bold text-orange">
            <Shield className="size-4" aria-hidden /> {c.hidden ? "Unhide" : "Hide"}
          </button>
        )}
      </div>
      {kids(c.id).length > 0 && <ul className="mt-2 space-y-2">{kids(c.id).map((k) => <CommentItem key={k.id} c={k} depth={1} />)}</ul>}
    </li>
  );

  return (
    <article aria-labelledby="thread-h" className="space-y-5">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" aria-hidden /> Threads</Button>
      <header className="neon rounded-[24px] border bg-surface/90 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryTag c={d.category} />
          <VisibilityTag v={d.visibility} />
          {d.pinned && <span className="text-[11px] font-extrabold uppercase text-orange">Pinned</span>}
          {d.locked && <span className="text-[11px] font-extrabold uppercase text-mute">Locked</span>}
          {d.hidden && <HiddenTag />}
        </div>
        <h1 id="thread-h" className="mt-2 text-2xl font-extrabold normal-case leading-tight [font-family:var(--font-sans)] sm:text-3xl">{d.title}</h1>
        <p className="mt-1 text-[12px] text-mute">@{d.authorHandle} · {ago(d.createdAt)}</p>
        <p className="mt-3 whitespace-pre-wrap break-words">{d.body}</p>
        {d.attachments.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{d.attachments.map((a) => <img key={a.id} src={a.url} alt="Thread attachment" className="max-h-64 rounded-xl" />)}</div>}
        {state.data.concept?.photo && (
          <Link href={`/dao/${eventId}/gallery#${state.data.concept.id}`} className="mt-3 block overflow-hidden rounded-2xl border border-line">
            <ConceptRender photoUrl={state.data.concept.photo.url} zone={state.data.concept.photo.stageZone} ceilingY={state.data.concept.photo.ceilingY} spec={state.data.concept.current.spec} title={`${state.data.concept.name} concept`} />
            <span className="block p-2 text-sm font-bold">Concept: {state.data.concept.name}</span>
          </Link>
        )}
        {state.data.dj && (
          <Link href={`/djs/${state.data.dj.id}`} className="mt-3 flex items-center gap-3 rounded-2xl border border-line p-2">
            <AlienAvatar look={state.data.dj.look} size={48} />
            <span className="font-bold">{state.data.dj.name}</span>
          </Link>
        )}
        {state.data.proposals.length > 0 && (
          <ul className="mt-3 space-y-1">
            {state.data.proposals.map((p) => (
              <li key={p.id}><Link href={`/dao/${eventId}/proposals/${p.id}`} className="inline-flex min-h-11 items-center gap-2 font-bold text-purple hover:underline">Linked proposal: {p.title} <StateTag state={p.state as never} /></Link></li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <ReactionBar reactions={d.reactions} mine={d.myReactions} onToggle={(k) => react("discussion", d.id, k)} disabled={!state.data.canComment} />
          <button type="button" onClick={() => reportIt("discussion", d.id)} className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-bold text-mute hover:text-coral"><Flag className="size-4" aria-hidden /> Report</button>
        </div>
        {state.data.canModerate && (
          <div className="mt-2 flex flex-wrap gap-2 border-t border-line pt-3">
            <span className="inline-flex items-center gap-1 text-[12px] font-extrabold uppercase text-orange"><Shield className="size-4" aria-hidden /> Moderation</span>
            <Button size="sm" variant="ghost" onClick={() => mod("discussion", d.id, d.pinned ? "unpin" : "pin")}>{d.pinned ? "Unpin" : "Pin"}</Button>
            <Button size="sm" variant="ghost" onClick={() => mod("discussion", d.id, d.locked ? "unlock" : "lock")}>{d.locked ? "Unlock" : "Lock"}</Button>
            <Button size="sm" variant="ghost" onClick={() => mod("discussion", d.id, d.hidden ? "unhide" : "hide")}>{d.hidden ? "Unhide" : "Hide"}</Button>
          </div>
        )}
      </header>

      <section aria-labelledby="comments-h">
        <h2 id="comments-h" className="mb-3 text-xl uppercase">{comments.length} comments</h2>
        <ul className="space-y-2">{roots.map((c) => <CommentItem key={c.id} c={c} depth={0} />)}</ul>
      </section>

      {state.data.canComment ? (
        <section aria-labelledby="reply-h" className="neon space-y-3 rounded-[24px] border bg-surface p-4">
          <h2 id="reply-h" className="text-lg uppercase">{replyTo ? `Reply to @${replyTo.authorHandle}` : "Add a comment"}</h2>
          {replyTo && <button type="button" className="min-h-11 text-sm text-mute underline" onClick={() => setReplyTo(null)}>Cancel reply</button>}
          <label htmlFor="cmt" className="sr-only">Comment</label>
          <Textarea id="cmt" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Share your idea…" maxLength={3000} />
          <ImagePicker onUploaded={(f) => setAtt((a) => [...a, ...f].slice(0, 2))} label="Add image" />
          {att.length > 0 && <div className="flex gap-2">{att.map((a) => <img key={a.id} src={a.url} alt="Attachment preview" className="size-16 rounded-lg object-cover" />)}</div>}
          {err && <p role="alert" className="text-sm text-coral">{err}</p>}
          <Button onClick={send} disabled={busy || text.trim().length < 2}>{busy ? "Sending…" : "Post comment"}</Button>
        </section>
      ) : (
        <Gate reason={d.locked ? "This thread is locked." : "Only staked members can comment."} action={!d.locked ? <Button size="sm" onClick={() => setJoinOpen(true)}>Join DAO</Button> : undefined}>
          {state.data.deny?.message}
        </Gate>
      )}
    </article>
  );
}
