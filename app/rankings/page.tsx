import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/ui/States";
import { RankingsView } from "./RankingsView";
import { RankingArt } from "@/components/ranking/RankingArt";
import { rankingsGet } from "@/app/api/rankings/handler";
import { apiParams, readUrlState } from "@/lib/ranking/query";
import type { RankingResult } from "@/lib/ranking/types";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return {
  title: tu("rankingsTitle"),
  description: tu("rankingsDescription"),
};
}

/**
 * The title and art are rendered on the server, outside the Suspense boundary: RankingsView reads the URL
 * (useSearchParams) and renders on the client, which used to hold back the page's first large paint.
 */
export default async function RankingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const tu = await getTranslations("ranking");
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === "string") sp.set(k, v);
  const state = readUrlState(sp);
  // FOR YOU depends on the viewer's saved preferences (client side), so only public categories are pre-rendered.
  let initial: { query: string; data: RankingResult } | null = null;
  if (state.category !== "for_you") {
    const query = apiParams(state, 1);
    const res = await rankingsGet(new Request(`http://localhost/api/rankings?${query}`));
    if (res.ok) initial = { query, data: (await res.json()) as RankingResult };
  }
  return (
    <>
      <div className="mx-auto max-w-6xl md:px-6">
        <header className="px-4 pt-4 md:px-0 md:pt-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-acid">{tu("festivalDiscoveryEngine")}</p>
          <h1 className="mt-1 text-[32px] uppercase leading-[0.95] sm:text-[40px]">
            {tu("world")} <span className="text-acid glow-text">{tu("ranking")}</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-mute">{tu("text")}</p>
        </header>
        <div className="mx-4 mt-4 overflow-hidden rounded-[20px] border border-purple/50 bg-ink/60 md:mx-0">
          <RankingArt className="block h-auto w-full" />
        </div>
      </div>
      <div className="mt-5">
        <Suspense fallback={<LoadingSkeleton variant="list" />}>
          <RankingsView initial={initial} />
        </Suspense>
      </div>
    </>
  );
}
