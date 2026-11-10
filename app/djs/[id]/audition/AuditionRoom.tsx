"use client";

import { type Tu } from "@/lib/i18n/tu";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Eye, Heart, Pause, Play, RotateCcw, Send, Star, UserPlus, Check } from "lucide-react";
import type { DJ } from "@/lib/types";
import { AlienG } from "@/components/art/Alien";
import { AlienAvatar } from "@/components/cards/Cards";
import { Button, Card, DemoBadge, DemoNotice, Tag } from "@/components/ui/primitives";
import { grantXp, toast, uid, useDemo, useHydrated } from "@/lib/store";
import { compact, cn } from "@/lib/utils";

const SEED_COMMENTS = (tu: Tu) => ([
  { id: "c1", name: "goo_gremlin", text: tu("thisTransitionIsPureSlime"), at: "" },
  { id: "c2", name: "orbit_kid", text: tu("bpmGoingUpUpUp"), at: "" },
  { id: "c3", name: "fuzzball99", text: tu("bookThemForKimchiCosmos"), at: "" },
]);
const DURATION = 30 * 60;

export function AuditionRoom({ dj }: { dj: DJ }) {
  const tu = useTranslations("djs");
  useHydrated();
  const [left, setLeft] = useState(DURATION);
  const [running, setRunning] = useState(true);
  const [viewers, setViewers] = useState(1240 + dj.rank * 37);
  const [text, setText] = useState("");
  const likes = useDemo((s) => s.likes[dj.id] ?? 0);
  const like = useDemo((s) => s.like);
  const myVote = useDemo((s) => s.votes[dj.id] ?? 0);
  const vote = useDemo((s) => s.vote);
  const comments = useDemo((s) => s.comments[dj.id]) ?? [];
  const addComment = useDemo((s) => s.addComment);
  const username = useDemo((s) => s.profile.username);
  const fav = useDemo((s) => s.favorites.includes(dj.id));
  const toggleFav = useDemo((s) => s.toggleFavorite);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setLeft((l) => (l > 0 ? l - 1 : 0));
      setViewers((v) => Math.max(200, v + Math.round((Math.random() - 0.45) * 12)));
    }, 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [comments.length]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const all = [...SEED_COMMENTS(tu), ...comments];

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    addComment(dj.id, { id: uid("c"), name: username, text: text.trim().slice(0, 200), at: new Date().toISOString() });
    setText("");
  };

  return (
    <div className="mx-auto max-w-6xl md:px-6 md:pt-6">
      <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-6 [&>*]:min-w-0">
        <div>
          {/* Player */}
          <div className="relative aspect-video overflow-hidden bg-[#120f1c] md:rounded-[28px] md:border-[3px] md:border-ink" role="img" aria-label={tu("demoAuditionStreamPlaceholderFor", { name: dj.name })}>
            <svg viewBox="0 0 320 180" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
              {[["#B6F05C", 0, 20, 160, 120], ["#FF625C", 320, 20, 160, 120], ["#A276E9", 0, 60, 200, 130], ["#55BCEB", 320, 60, 120, 130]].map(([c, x1, y1, x2, y2], i) => (
                <line key={i} x1={x1 as number} y1={y1 as number} x2={x2 as number} y2={y2 as number} stroke={c as string} strokeWidth={2.5} opacity={running ? 0.8 : 0.3}>
                  {running && <animate attributeName="x2" values={`${x2};${(x2 as number) + 40};${x2}`} dur={`${2 + i * 0.4}s`} repeatCount="indefinite" />}
                </line>
              ))}
              <g transform="translate(108 30) scale(0.52)" className={running ? "animate-bob" : ""}>
                <AlienG look={dj.look} />
              </g>
              <path d="M70 128 L250 128 L240 180 L80 180 Z" fill="#FFAD5B" stroke="#080808" strokeWidth={4} />
              <rect x="64" y="120" width="192" height="12" rx="4" fill="#262626" stroke="#080808" strokeWidth={4} />
            </svg>
            <div className="absolute left-3 top-3 flex items-center gap-1.5">
              <Tag color={running ? "#FF625C" : "#2a2a2a"} dark={running}>{running ? tu("onAir") : tu("paused")}</Tag>
              <DemoBadge label={tu("demoStream")} className="bg-ink/85" />
            </div>
            <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-bold" aria-live="off"><Eye className="size-3.5" aria-hidden />{compact(viewers)}</div>
            <div className="absolute bottom-3 left-3 rounded-xl bg-ink/85 px-3 py-1.5 font-display text-2xl tabular-nums" aria-label={tu("timeLeftMmMinutesSs", { mm, ss })}>{mm}:{ss}</div>
            <div className="absolute bottom-3 right-3 flex gap-2">
              <button type="button" onClick={() => setRunning((r) => !r)} aria-label={running ? tu("pauseTimer") : tu("resumeTimer")} className="inline-flex size-11 items-center justify-center rounded-full bg-cream text-ink">
                {running ? <Pause className="size-5" /> : <Play className="size-5" />}
              </button>
              <button type="button" onClick={() => { setLeft(DURATION); setRunning(true); }} aria-label={tu("restart30MinuteTimer")} className="inline-flex size-11 items-center justify-center rounded-full bg-ink/80 text-cream">
                <RotateCcw className="size-5" />
              </button>
            </div>
          </div>
          <div className="h-2 w-full bg-line md:mt-2 md:rounded-full" aria-hidden>
            <div className="h-full bg-acid md:rounded-full" style={{ width: `${((DURATION - left) / DURATION) * 100}%` }} />
          </div>

          {/* DJ + actions */}
          <div className="flex items-center gap-3 px-4 pt-4 md:px-0">
            <AlienAvatar look={dj.look} size={56} ring={dj.look.accent} />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl uppercase"><Link href={`/djs/${dj.id}`} className="hover:text-acid">{dj.name}</Link></h1>
              <div className="text-sm text-mute">{tu("n30MinAuditionJoinValue", { join: dj.genres.join(" / "), value: dj.bpm[0], value2: dj.bpm[1] })}</div>
            </div>
            <Button size="sm" variant={fav ? "secondary" : "coral"} onClick={() => { const on = toggleFav(dj.id); toast({ title: on ? tu("following") : tu("unfollowed"), tone: on ? "success" : "default" }); }} aria-pressed={fav}>
              {fav ? <Check className="size-4" aria-hidden /> : <UserPlus className="size-4" aria-hidden />} {fav ? tu("following") : tu("follow")}
            </Button>
          </div>

          <div className="mt-4 grid gap-3 px-4 sm:grid-cols-2 md:px-0">
            <Card className="flex items-center justify-between gap-3 p-4">
              <div>
                <div className="text-xs font-bold uppercase text-mute">{tu("likes")}</div>
                <div className="font-display text-2xl" aria-live="polite">{compact(2300 + dj.followers / 100 + likes)}</div>
              </div>
              <Button variant="coral" onClick={() => like(dj.id)} aria-label={tu("likeThisAudition")}><Heart className="size-5" aria-hidden /> {tu("like")}</Button>
            </Card>
            <Card className="p-4">
              <div className="text-xs font-bold uppercase text-mute">{tu("yourVote")}</div>
              <div className="mt-1 flex gap-1" role="radiogroup" aria-label={tu("voteFrom1To5")}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={myVote === n} aria-label={tu("stars", { n })} onClick={() => { if (!myVote) grantXp(20, "Voted in an audition"); vote(dj.id, n); }} className="inline-flex size-11 items-center justify-center">
                    <Star className={cn("size-7", n <= myVote ? "fill-orange text-orange" : "text-mute")} />
                  </button>
                ))}
              </div>
            </Card>
          </div>
          <DemoNotice className="mx-4 mt-4 md:mx-0">{tu("liveStreamingIsNotConnected")}</DemoNotice>
        </div>

        {/* Comments */}
        <section aria-labelledby="chat-h" className="mt-6 px-4 lg:mt-0 lg:px-0">
          <div className="flex h-[420px] flex-col rounded-3xl border border-line bg-surface lg:h-full lg:max-h-[640px]">
            <h2 id="chat-h" className="border-b border-line px-4 py-3 text-xl uppercase">{tu("comments")}</h2>
            <ul ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
              {all.map((c) => (
                <li key={c.id} className="text-sm"><span className="font-bold text-acid">@{c.name}</span> <span className="text-cream/90">{c.text}</span></li>
              ))}
            </ul>
            <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
              <label htmlFor="cmt" className="sr-only">{tu("writeAComment")}</label>
              <input id="cmt" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} enterKeyHint="send" placeholder={tu("saySomethingNice")} className="h-12 min-w-0 flex-1 rounded-full border-2 border-line bg-ink px-4 outline-none focus:border-acid" />
              <button type="submit" aria-label={tu("sendComment")} className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-acid text-ink disabled:opacity-40" disabled={!text.trim()}>
                <Send className="size-5" />
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
