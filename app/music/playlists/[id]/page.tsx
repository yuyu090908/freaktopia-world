import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/auth/http";
import * as music from "@/lib/music/service";
import { PlaylistPage, type PlaylistRes } from "./PlaylistPage";

export const dynamic = "force-dynamic";

async function load(id: string, uid: string | null) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    return (await music.playlistView(id, uid)) as unknown as PlaylistRes;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const d = await load(id, null);
  const t = await getTranslations("music");
  if (!d) return { title: t("playlist"), robots: { index: false } };
  return {
    title: d.playlist.title,
    description: d.playlist.description.slice(0, 160) || t("nTracks", { n: d.items.length }),
    robots: d.playlist.visibility === "public" ? undefined : { index: false },
    openGraph: { title: d.playlist.title, images: d.playlist.coverId ? [`/api/music/images/${d.playlist.coverId}`] : undefined },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser().catch(() => null);
  const initial = await load(id, user?.id ?? null);
  if (!initial) notFound();
  return <PlaylistPage id={id} initial={initial} />;
}
