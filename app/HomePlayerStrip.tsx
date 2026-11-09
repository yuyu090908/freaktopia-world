"use client";

import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { Alien } from "@/components/art/Alien";
import { Progress } from "@/components/ui/primitives";
import { useDemo } from "@/lib/store";
import { userLevel } from "@/lib/levels";

export function HomePlayerStrip() {
  const profile = useDemo((s) => s.profile);
  const lv = userLevel(profile.xp);
  return (
    <div className="grid gap-4 rounded-[32px] border border-line bg-surface p-5 md:grid-cols-[auto_1fr_auto] md:items-center md:p-6">
      <div className="flex items-center gap-4">
        <div className="relative size-24 shrink-0 rounded-3xl bg-purple">
          <div className="halftone absolute inset-0 rounded-3xl" aria-hidden />
          <Alien look={profile.look} className="relative h-full w-full p-1" title={`Your alien, ${profile.avatarName}`} bob />
        </div>
        <div className="min-w-0">
          <h2 id="you" className="text-2xl uppercase">Your alien</h2>
          <div className="mt-1 truncate text-sm text-mute">@{profile.username} · {profile.avatarName}</div>
        </div>
      </div>
      <div className="min-w-0">
        <div className="mb-1.5 flex justify-between text-sm font-bold">
          <span>LV.{lv.level}</span>
          <span className="text-mute">{lv.intoLevel} / {lv.need} XP</span>
        </div>
        <Progress value={lv.pct} color="#A276E9" label="XP to next level" />
        <p className="ja mt-2 text-xs text-mute">イベントを応援・参加・作成するとXPがたまり、アバターがレベルアップします。</p>
      </div>
      <div className="flex flex-col gap-2 min-[420px]:flex-row md:flex-col">
        <Link href="/avatar" className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-purple px-5 font-extrabold uppercase text-ink">Customize <ArrowRight className="size-4" aria-hidden /></Link>
        <Link href="/quests" className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border-2 border-line px-5 font-extrabold uppercase"><Trophy className="size-4" aria-hidden /> Quests</Link>
      </div>
    </div>
  );
}
