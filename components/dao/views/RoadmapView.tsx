"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, CircleDashed, Hammer, OctagonAlert, Trophy } from "lucide-react";
import { LoadingSkeleton } from "@/components/ui/States";
import { daoApi, useDaoQuery } from "@/lib/dao/client";
import { BADGE_META, GAME_LEVELS } from "@/lib/dao/meta";
import type { BadgeId, Milestone } from "@/lib/dao/types";
import { toast } from "@/lib/store";
import { fmtDate } from "@/lib/utils";
import { ConceptRender } from "../ConceptRender";
import { useDao, type ConceptDto } from "../DaoContext";
import { SubHead } from "../DaoUi";

interface RoadmapDto {
  level: 1 | 2 | 3 | 4 | 5;
  milestones: Milestone[];
  event: { name: string; startsAt: string; status: string };
  stageConcept: ConceptDto | null;
  leadingConcept: ConceptDto | null;
  leaderboard: { handle: string; xp: number; badges: BadgeId[] }[];
  canEdit: boolean;
}

const MS_STYLE: Record<Milestone["status"], { label: string; color: string; Icon: typeof Check }> = {
  todo: { label: "To do", color: "#8a8a8a", Icon: CircleDashed },
  doing: { label: "In progress", color: "#55BCEB", Icon: Hammer },
  done: { label: "Done", color: "#B6F05C", Icon: Check },
  blocked: { label: "Blocked", color: "#FF625C", Icon: OctagonAlert },
};

export function RoadmapView() {
  const { eventId } = useDao();
  const { state, reload } = useDaoQuery<RoadmapDto>(`${eventId}/roadmap`);
  const [busy, setBusy] = useState<string | null>(null);
  if (state.status === "loading") return <LoadingSkeleton variant="list" />;
  if (state.status === "error") return <p role="alert">{state.error.message}</p>;
  const r = state.data;
  const concept = r.stageConcept ?? r.leadingConcept;

  const setStatus = async (id: string, status: Milestone["status"]) => {
    setBusy(id);
    const res = await daoApi(`${eventId}/roadmap/${id}`, { method: "PATCH", json: { status } });
    setBusy(null);
    if (!res.ok) return toast({ title: "Not saved", body: res.error.message, tone: "error" });
    void reload(true);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[34px] uppercase leading-none sm:text-5xl">Roadmap</h1>
        <p className="mt-2 max-w-2xl text-sm text-mute">The Festival Build Game grows as the DAO makes decisions. It is a game view of community progress, not a record of real construction.</p>
      </div>

      <section aria-labelledby="game-h" className="neon rounded-[24px] border bg-surface p-4">
        <h2 id="game-h" className="flex items-center gap-2 text-xl uppercase"><Trophy className="size-5 text-acid" aria-hidden />Festival build game · LV.{r.level}</h2>
        <ol className="mt-4 grid grid-cols-5 gap-1.5" aria-label="Game levels">
          {GAME_LEVELS.map((g) => {
            const reached = g.level <= r.level;
            return (
              <li key={g.level} aria-current={g.level === r.level ? "step" : undefined} className={`rounded-xl p-2 text-center ${reached ? "bg-acid text-ink" : "border border-line text-mute"}`}>
                <div className="font-display text-xl leading-none">{g.level}</div>
                <div className="mt-1 truncate text-[10px] font-extrabold uppercase sm:text-[11px]">{g.key}</div>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-sm"><b>{GAME_LEVELS[r.level - 1].label}:</b> {GAME_LEVELS[r.level - 1].desc}</p>
        {r.level < 5 && <p className="text-sm text-mute">Next: {GAME_LEVELS[Math.min(4, r.level) as 0 | 1 | 2 | 3 | 4].desc}</p>}

        <div className="mt-4">
          {concept?.photo ? (
            <figure>
              <ConceptRender photoUrl={concept.photo.url} zone={concept.photo.stageZone} ceilingY={concept.photo.ceilingY} spec={r.level >= 3 || r.leadingConcept ? concept.current.spec : null} title={`${concept.name} on the build game stage`} showLabel className={r.level < 3 ? "opacity-80" : undefined} />
              <figcaption className="mt-2 text-[12px] text-mute">
                {r.stageConcept ? <>Winning design: <Link className="font-bold text-cream underline" href={`/dao/${eventId}/gallery#${concept.id}`}>{concept.name}</Link></> : <>Currently leading the vote: <Link className="font-bold text-cream underline" href={`/dao/${eventId}/gallery#${concept.id}`}>{concept.name}</Link> (not final)</>}
              </figcaption>
            </figure>
          ) : (
            <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-mute">No stage design has won a vote yet. The game stage stays empty until the community decides.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="ms-h">
        <SubHead id="ms-h" title="Production milestones" sub={r.canEdit ? "Organizer view: update status as work moves." : undefined} />
        <ol className="relative space-y-3 border-l-2 border-line pl-4">
          {r.milestones.map((m) => {
            const s = MS_STYLE[m.status];
            return (
              <li key={m.id} className="relative rounded-2xl border border-line bg-surface p-3">
                <span className="absolute -left-[27px] top-4 grid size-5 place-items-center rounded-full" style={{ background: s.color }} aria-hidden><s.Icon className="size-3 text-ink" /></span>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-bold">{m.title}</span>
                  <span className="text-[12px] text-mute">{fmtDate(new Date(m.due).toISOString())}</span>
                </div>
                <span className="text-[12px] font-extrabold uppercase" style={{ color: s.color }}>{s.label}</span>
                {m.note && <p className="mt-1 text-sm text-mute">{m.note}</p>}
                {r.canEdit && (
                  <label className="mt-2 flex items-center gap-2 text-sm">
                    <span className="text-mute">Status</span>
                    <select value={m.status} disabled={busy === m.id} onChange={(e) => setStatus(m.id, e.target.value as Milestone["status"])} className="min-h-11 rounded-xl border border-line bg-ink px-3">
                      {Object.entries(MS_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </label>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="lb-h">
        <SubHead id="lb-h" title="Top contributors (XP)" sub="XP comes from quality posts, votes and published designs. Daily caps and duplicate checks stop farming." />
        <ol className="divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-surface">
          {r.leaderboard.map((m, i) => (
            <li key={m.handle} className="flex items-center gap-3 p-3">
              <span className="font-display w-6 text-xl text-acid">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-bold">@{m.handle}</span>
              <span className="flex gap-1">{m.badges.slice(0, 3).map((b) => <span key={b} title={BADGE_META[b].label} className="size-3 rounded-full" style={{ background: BADGE_META[b].color }} />)}</span>
              <span className="text-sm text-mute">{m.xp} XP</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
