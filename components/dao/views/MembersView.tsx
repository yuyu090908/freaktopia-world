"use client";

import { Tx } from "@/components/i18n/Tx";
import { useTranslations } from "next-intl";
import { DaoAvatar } from "@/components/dao/DaoAvatar";

import { useEffect, useState } from "react";
import { Search, ShieldAlert, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { LoadingSkeleton } from "@/components/ui/States";
import { useDaoQuery } from "@/lib/dao/client";
import { BADGE_META, ROLE_LABEL } from "@/lib/dao/meta";
import type { BadgeId, DaoRole } from "@/lib/dao/types";
import { useDao } from "../DaoContext";
import { ago } from "../DaoUi";

interface MembersDto {
  total: number;
  page: number;
  pageSize: number;
  flaggedCount?: number;
  members: { uid?: string; handle: string; roles: DaoRole[]; joinedAt: number; xp: number; badges: BadgeId[]; flagged?: string; isMe: boolean }[];
  canModerate: boolean;
  onePersonOneVote: string;
}

export function MembersView() {
  const tu = useTranslations("dao");
  const { eventId } = useDao();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => { setQuery(q.trim()); setPage(1); }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const { state } = useDaoQuery<MembersDto>(`${eventId}/members?q=${encodeURIComponent(query)}&page=${page}`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[34px] uppercase leading-none sm:text-5xl">{tu("members")}</h1>
        {state.status === "ok" && <p className="mt-2 text-sm text-mute">{tu("tolocalestringStakedMembersValue", { toLocaleString: state.data.total.toLocaleString("en-US"), value: state.data.flaggedCount !== undefined ? tu("flaggedcountFlaggedForReview", { flaggedCount: state.data.flaggedCount }) : "" })}</p>}
      </div>

      {state.status === "ok" && (
        <p className="flex gap-2 rounded-2xl border border-line bg-surface p-3 text-sm"><UserCheck className="size-5 shrink-0 text-acid" aria-hidden />{state.data.onePersonOneVote}</p>
      )}

      <label className="relative block">
        <span className="sr-only">{tu("searchMembers")}</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mute" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tu("searchByHandle")} className="min-h-12 w-full rounded-2xl border border-line bg-surface pl-9 pr-3" />
      </label>

      {state.status === "loading" && <LoadingSkeleton variant="list" />}
      {state.status === "error" && <p role="alert">{state.error.message}</p>}
      {state.status === "ok" && (
        <>
          <ul className="divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-surface">
            {state.data.members.map((m) => (
              <li key={m.uid ?? m.handle} className={`p-3 ${m.isMe ? "bg-acid/10" : ""}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <DaoAvatar handle={m.handle} mine={m.isMe} size={32} />
                  <span className="min-w-0 truncate font-bold">@{m.handle}{m.isMe && <span className="ml-1 text-acid">{tu("you")}</span>}</span>
                  {m.roles.filter((r) => r !== "member").map((r) => <span key={r} className="rounded-full bg-purple px-2 py-0.5 text-[11px] font-extrabold uppercase text-ink"><Tx>{ROLE_LABEL[r]}</Tx></span>)}
                  <span className="ml-auto text-sm text-mute">{m.xp} XP</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-mute">
                  <span>{tu("joinedAgo", { ago: ago(m.joinedAt) })}</span>
                  {m.badges.map((b) => <span key={b} className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase text-ink" style={{ background: BADGE_META[b].color }}><Tx>{BADGE_META[b].label}</Tx></span>)}
                </div>
                {m.flagged && <p className="mt-1 flex items-center gap-1 text-[12px] text-coral"><ShieldAlert className="size-4" aria-hidden />{tu("flaggedFlaggedBallotsHeld", { flagged: m.flagged })}</p>}
              </li>
            ))}
            {!state.data.members.length && <li className="p-4 text-sm text-mute">{tu("noMemberMatchesQuery", { query })}</li>}
          </ul>
          {state.data.total > state.data.pageSize && (
            <div className="flex items-center justify-between gap-2">
              <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{tu("previous")}</Button>
              <span className="text-sm text-mute">{tu("pagePageCeil", { page, ceil: Math.ceil(state.data.total / state.data.pageSize) })}</span>
              <Button size="sm" variant="ghost" disabled={page * state.data.pageSize >= state.data.total} onClick={() => setPage((p) => p + 1)}>{tu("next2")}</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
