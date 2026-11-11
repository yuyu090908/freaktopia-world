"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Chip } from "@/components/ui/primitives";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { DjAvatar } from "./MusicArena";
import { useMusic, type DjCardDto } from "./shared";

type Board = "trending" | "liked" | "saved" | "booked" | "rising";
interface Res { board: Board; windowDays: number; ranking: { rank: number; value: number; plays30: number; listeners30: number; likes30: number; saves30: number; bookings30: number; dj: DjCardDto }[] }

/** DJ rankings on the existing RANKINGS page. The method is shown with the list; there is no paid placement. */
export function DjRankings() {
  const t = useTranslations("music");
  const href = useLocalHref();
  const [board, setBoard] = useState<Board>("trending");
  const { data } = useMusic<Res>(`/api/music/rankings?board=${board}`);
  return (
    <section id="dj-rankings" aria-labelledby="rk-dj" className="mt-12 px-4 md:px-0" data-testid="dj-rankings">
      <h2 id="rk-dj" className="text-[28px] uppercase sm:text-4xl">{t("djRankings")}</h2>
      <div className="rail mt-3 !gap-2 !px-0" role="group" aria-label={t("djRankings")}>
        {(["trending", "liked", "saved", "booked", "rising"] as Board[]).map((b) => <Chip key={b} active={board === b} onClick={() => setBoard(b)} aria-pressed={board === b} aria-label={`${t("djRankings")}: ${t(`board.${b}`)}`} data-testid={`board-${b}`}>{t(`board.${b}`)}</Chip>)}
      </div>
      <p className="mt-2 text-xs text-mute" data-testid="rank-method">{t(`boardMethod.${board}`)} {t("rankNoPaid")}</p>
      {!data ? (
        <div className="mt-3 h-24 animate-pulse rounded-3xl bg-surface" />
      ) : data.ranking.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-line p-4 text-sm text-mute" data-testid="rank-empty">{t("rankEmpty")}</p>
      ) : (
        <ol className="mt-3 overflow-hidden rounded-3xl border border-line">
          {data.ranking.map((r) => (
            <li key={r.dj.userId} className="border-b border-line bg-surface last:border-b-0">
              <Link href={href(`/djs/u/${r.dj.slug}`)} className="flex items-center gap-3 p-3">
                <span className="w-8 text-center font-display text-2xl text-acid">{r.rank}</span>
                <DjAvatar dj={r.dj} size={40} />
                <span className="min-w-0 flex-1"><b className="block truncate">{r.dj.stageName}</b><span className="block text-xs text-mute">{t("rankLine", { listeners: r.listeners30, likes: r.likes30, saves: r.saves30, bookings: r.bookings30 })}</span></span>
                <span className="text-sm font-bold tabular-nums">{r.value}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
