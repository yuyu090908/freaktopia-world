import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/auth/http";
import * as music from "@/lib/music/service";
import { DjPublicProfile, type ProfileRes } from "./DjPublicProfile";

export const dynamic = "force-dynamic";

async function load(slug: string, uid: string | null) {
  try {
    return (await music.publicDjProfile(slug, uid)) as unknown as ProfileRes;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await load(slug, null);
  const tu = await getTranslations("seo");
  if (!d) return { title: tu("dj"), robots: { index: false } };
  const img = d.profile.imageId ? [`/api/music/images/${d.profile.imageId}`] : undefined;
  return {
    title: tu("djWithName", { name: d.profile.stageName }),
    description: d.profile.bio.slice(0, 160) || [d.profile.city, d.profile.genres.join(", ")].filter(Boolean).join(" · "),
    openGraph: { title: d.profile.stageName, type: "profile", images: img },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await currentUser().catch(() => null);
  const initial = await load(slug, user?.id ?? null);
  if (!initial) notFound();
  return <DjPublicProfile slug={slug} initial={initial} />;
}
