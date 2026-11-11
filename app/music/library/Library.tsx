"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button, PageTitle } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Input } from "@/components/forms/Fields";
import { SignInGate } from "@/components/ops/shared";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { TrackRow } from "@/components/music/TrackActions";
import { useMusic, useMusicPost, type TrackDto } from "@/components/music/shared";

interface Res { saved: TrackDto[]; liked: TrackDto[]; playlists: { id: string; title: string; visibility: string; count: number; kind: string }[] }
type Tab = "saved" | "liked" | "playlists";

/** The listener's library: saved tracks (for later), liked tracks, and playlists (same model as DJ playlists). */
export function Library() {
  const t = useTranslations("music");
  return (
    <div className="mx-auto max-w-4xl pb-16 md:px-6">
      <PageTitle kicker={t("libraryKicker")} title={t("myLibrary")} sub={t("librarySub")} />
      <div className="px-4 md:px-0">
        <SignInGate returnTo="/music/library"><Inner /></SignInGate>
      </div>
    </div>
  );
}

function Inner() {
  const t = useTranslations("music");
  const href = useLocalHref();
  const post = useMusicPost();
  const { data, reload } = useMusic<Res>("/api/music/me/library");
  const [tab, setTab] = useState<Tab>("saved");
  const [title, setTitle] = useState("");
  if (!data) return <div className="h-40 animate-pulse rounded-3xl bg-surface" aria-busy="true" />;
  const list = (ts: TrackDto[], empty: string) =>
    ts.length === 0 ? <p className="text-sm text-mute">{empty}</p> : <ul className="space-y-2">{ts.map((tr, i) => <li key={tr.id}><TrackRow track={tr} list={ts} index={i} /></li>)}</ul>;
  return (
    <Tabs label={t("myLibrary")} tabs={(["saved", "liked", "playlists"] as Tab[]).map((x) => ({ id: x, label: t(`lib.${x}`) }))} active={tab} onChange={setTab}>
      {tab === "saved" && <div data-testid="lib-saved">{list(data.saved, t("noSaved"))}</div>}
      {tab === "liked" && <div data-testid="lib-liked">{list(data.liked, t("noLiked"))}</div>}
      {tab === "playlists" && (
        <div className="space-y-3">
          <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!title.trim()) return; if (await post("playlists", { title: title.trim(), visibility: "private" }, { success: t("playlistCreated") })) { setTitle(""); void reload(); } }}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder={t("newPlaylistName")} aria-label={t("newPlaylistName")} data-testid="new-playlist-name" />
            <Button type="submit" disabled={!title.trim()} data-testid="create-playlist"><Plus className="size-4" aria-hidden /> {t("create")}</Button>
          </form>
          {data.playlists.length === 0 ? <p className="text-sm text-mute">{t("noPlaylists")}</p> : (
            <ul className="grid gap-2 md:grid-cols-2" data-testid="lib-playlists">
              {data.playlists.map((p) => (
                <li key={p.id}>
                  <Link href={href(`/music/playlists/${p.id}`)} className="block rounded-2xl bg-surface-2 p-3 hover:outline hover:outline-acid" data-testid="lib-playlist">
                    <b className="block truncate">{p.title}</b>
                    <span className="text-xs text-mute">{t(`plVis.${p.visibility}`)} · {t("nTracks", { n: p.count })}{p.kind === "dj" ? ` · ${t("onDjProfile")}` : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Tabs>
  );
}
