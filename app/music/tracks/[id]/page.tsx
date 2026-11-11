import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/auth/http";
import * as music from "@/lib/music/service";
import { TrackPage, type TrackRes } from "./TrackPage";

export const dynamic = "force-dynamic";

async function load(id: string, uid: string | null) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    return (await music.trackView(id, uid)) as unknown as TrackRes;
  } catch {
    return null;
  }
}

/** Share page: meta tags only for what anyone may hear (unlisted links are not indexed). */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const d = await load(id, null);
  const t = await getTranslations("music");
  if (!d) return { title: t("track"), robots: { index: false } };
  const by = d.track.owner?.stageName ?? "";
  return {
    title: `${d.track.title}${by ? ` · ${by}` : ""}`,
    description: d.track.description.slice(0, 160) || [d.track.genre, d.track.bpm ? `${d.track.bpm} BPM` : null, by].filter(Boolean).join(" · "),
    robots: d.track.visibility === "public" ? undefined : { index: false },
    openGraph: { title: d.track.title, type: "music.song", images: d.track.coverId ? [`/api/music/images/${d.track.coverId}`] : undefined },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser().catch(() => null);
  const initial = await load(id, user?.id ?? null);
  if (!initial) notFound();
  return <TrackPage id={id} initial={initial} />;
}
