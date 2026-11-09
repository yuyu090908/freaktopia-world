"use client";

import Link from "next/link";
import { Check, EyeOff, Globe2, Lock, Users } from "lucide-react";
import type { ReactNode } from "react";
import { CATEGORY_COLOR, CATEGORY_LABEL, LIFECYCLE_PATH, REACTION_META, STATE_META } from "@/lib/dao/meta";
import type { DiscussionCategory, ProposalState, ReactionKind } from "@/lib/dao/types";
import { cn } from "@/lib/utils";

export function StateTag({ state, className }: { state: ProposalState; className?: string }) {
  const m = STATE_META[state];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase leading-none tracking-wider text-ink", className)} style={{ background: m.color }}>
      {m.label}
    </span>
  );
}

export function CategoryTag({ c }: { c: DiscussionCategory }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] font-bold uppercase leading-none tracking-wider">
      <span className="size-2 rounded-full" style={{ background: CATEGORY_COLOR[c] }} aria-hidden />
      {CATEGORY_LABEL[c]}
    </span>
  );
}

export function VisibilityTag({ v }: { v: "public" | "members" | "private" }) {
  const Icon = v === "public" ? Globe2 : v === "members" ? Users : Lock;
  const label = v === "public" ? "Public" : v === "members" ? "Members only" : "Organizers only";
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider", v === "public" ? "text-mute" : v === "members" ? "text-blue" : "text-orange")}>
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}

export function HiddenTag() {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-coral">
      <EyeOff className="size-3.5" aria-hidden /> Hidden by moderation
    </span>
  );
}

export function LifecycleTracker({ state }: { state: ProposalState }) {
  const offPath = !LIFECYCLE_PATH.includes(state);
  const idx = offPath ? STATE_META[state].step : LIFECYCLE_PATH.indexOf(state);
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      <ol className="flex min-w-max items-center gap-1" aria-label="Proposal lifecycle">
        {LIFECYCLE_PATH.map((s, i) => {
          const done = i < idx || (!offPath && i === idx && s === "COMPLETED");
          const cur = !offPath && i === idx;
          return (
            <li key={s} className="flex items-center gap-1" aria-current={cur ? "step" : undefined}>
              <span className={cn("inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[10px] font-extrabold uppercase tracking-wider", cur ? "bg-acid text-ink" : done ? "bg-acid/25 text-acid" : "border border-line text-mute")}>
                {done && <Check className="size-3" aria-hidden />}
                {STATE_META[s].label}
              </span>
              {i < LIFECYCLE_PATH.length - 1 && <span className="h-0.5 w-3 bg-line" aria-hidden />}
            </li>
          );
        })}
      </ol>
      {offPath && (
        <p className="mt-2 text-sm">
          Current state: <StateTag state={state} />
        </p>
      )}
    </div>
  );
}

export function timeLeft(ms: number) {
  if (ms <= 0) return "ended";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  if (d > 0) return `${d}d ${h}h left`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m left`;
}

export const ago = (t: number) => {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export function ReactionBar({ reactions, mine, onToggle, disabled }: { reactions: Record<string, number>; mine: string[]; onToggle: (k: ReactionKind) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(REACTION_META) as ReactionKind[]).map((k) => {
        const on = mine.includes(k);
        return (
          <button
            key={k}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            aria-label={`${REACTION_META[k].label} (${reactions[k] ?? 0})`}
            onClick={() => onToggle(k)}
            className={cn("inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full border px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60", on ? "border-acid bg-acid/20" : "border-line bg-ink/50 hover:border-cream/50")}
          >
            <span aria-hidden>{REACTION_META[k].emoji}</span>
            {reactions[k] ? <span className="text-[12px]">{reactions[k]}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Explains why an action is locked and how to unlock it. */
export function Gate({ reason, children, action }: { reason: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div role="note" className="flex flex-col gap-3 rounded-2xl border border-purple/50 bg-purple/10 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-2">
        <Lock className="mt-0.5 size-4 shrink-0 text-purple" aria-hidden />
        <div>
          <p className="font-bold">{reason}</p>
          {children && <div className="mt-1 text-mute">{children}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function SubHead({ title, id, action, sub }: { title: string; id: string; action?: ReactNode; sub?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-2xl uppercase sm:text-3xl">
          {title}
        </h2>
        {sub && <p className="mt-1 text-sm text-mute">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-extrabold uppercase text-acid hover:underline">
      {children}
    </Link>
  );
}
