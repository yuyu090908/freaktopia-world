"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Pencil, Play, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Field, Input, Select, Textarea } from "@/components/forms/Fields";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { Cover, usePlayerMaybe } from "@/components/music/PlayerProvider";
import { ShareButton, TrackRow, toPlayer } from "@/components/music/TrackActions";
import { fileToB64, useMusic, useMusicPost, type TrackDto } from "@/components/music/shared";

export interface PlaylistRes {
  playlist: { id: string; ownerId: string; title: string; description: string; visibility: "public" | "unlisted" | "private"; coverId: string | null; kind: string; owner?: { stageName: string; slug: string | null } };
  items: { itemId: string; position: number; track: TrackDto }[];
  hiddenCount: number;
  isOwner: boolean;
}

export function PlaylistPage({ id, initial }: { id: string; initial: PlaylistRes }) {
  const t = useTranslations("music");
  const post = useMusicPost();
  const player = usePlayerMaybe();
  const router = useRouter();
  const href = useLocalHref();
  const { data, reload } = useMusic<PlaylistRes>(`/api/music/playlists/${id}`, initial);
  const [items, setItems] = useState(initial.items);
  const [edit, setEdit] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (data && !dirty) setItems(data.items);
  }, [data, dirty]);
  const d = data ?? initial;
  const tracks = items.map((i) => i.track);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
    setDirty(true);
  };
  const saveOrder = async () => {
    const r = await post<PlaylistRes>(`playlists/${id}/order`, { itemIds: items.map((i) => i.itemId) }, { success: t("orderSaved") });
    if (r) {
      setDirty(false);
      setItems(r.items);
    } else void reload();
  };
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 md:px-6" data-testid="playlist-page">
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <Cover id={d.playlist.coverId} size={160} className="rounded-3xl" />
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-widest text-acid">{t("playlist")} · {t(`plVis.${d.playlist.visibility}`)}</p>
          <h1 className="font-display text-3xl uppercase leading-tight md:text-5xl" data-testid="playlist-title">{d.playlist.title}</h1>
          {d.playlist.owner && <p className="text-sm text-mute">{d.playlist.owner.stageName}</p>}
          {d.playlist.description && <p className="mt-1 whitespace-pre-wrap text-sm">{d.playlist.description}</p>}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {tracks.length > 0 && <Button onClick={() => player?.play(tracks.map(toPlayer), 0)} data-testid="playlist-play"><Play className="size-4" aria-hidden /> {t("playAll")}</Button>}
        {d.playlist.visibility !== "private" && <ShareButton path={`/music/playlists/${id}`} title={d.playlist.title} />}
        {d.isOwner && <Button variant="ghost" onClick={() => setEdit(true)} data-testid="playlist-edit"><Pencil className="size-4" aria-hidden /> {t("edit")}</Button>}
        {d.isOwner && dirty && <Button onClick={() => void saveOrder()} data-testid="save-order">{t("saveOrder")}</Button>}
      </div>
      {d.hiddenCount > 0 && <p className="mt-3 rounded-xl bg-surface-2 p-2 text-xs text-mute" data-testid="hidden-note">{t("hiddenInPlaylist", { n: d.hiddenCount })}</p>}
      {items.length === 0 ? (
        <p className="mt-6 text-sm text-mute">{t("emptyPlaylist")}</p>
      ) : (
        <ol className="mt-4 space-y-2" data-testid="playlist-items">
          {items.map((it, i) => (
            <li key={it.itemId} data-item-id={it.itemId}>
              <TrackRow
                track={it.track}
                list={tracks}
                index={i}
                extra={
                  d.isOwner ? (
                    <span className="flex shrink-0">
                      <button type="button" className="inline-flex size-11 items-center justify-center disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t("moveUp")} data-testid="move-up"><ArrowUp className="size-4" aria-hidden /></button>
                      <button type="button" className="inline-flex size-11 items-center justify-center disabled:opacity-30" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={t("moveDown")} data-testid="move-down"><ArrowDown className="size-4" aria-hidden /></button>
                      <button type="button" className="inline-flex size-11 items-center justify-center" onClick={async () => { if (await post(`playlists/${id}/items/${it.itemId}/delete`)) { setDirty(false); void reload(); } }} aria-label={t("removeFromPlaylist")} data-testid="remove-item"><Trash2 className="size-4" aria-hidden /></button>
                    </span>
                  ) : undefined
                }
              />
            </li>
          ))}
        </ol>
      )}
      {edit && (
        <EditPlaylist
          pl={d.playlist}
          onClose={() => setEdit(false)}
          onSaved={() => { setEdit(false); void reload(); }}
          onDeleted={() => router.push(href("/music/library"))}
        />
      )}
    </div>
  );
}

function EditPlaylist({ pl, onClose, onSaved, onDeleted }: { pl: PlaylistRes["playlist"]; onClose: () => void; onSaved: () => void; onDeleted: () => void }) {
  const t = useTranslations("music");
  const post = useMusicPost();
  const [v, setV] = useState({ title: pl.title, description: pl.description, visibility: pl.visibility, coverId: pl.coverId });
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={t("editPlaylist")}
      footer={
        <div className="flex justify-between gap-2">
          <Button variant="ghost" onClick={async () => { if (confirm(t("deletePlaylistConfirm")) && (await post(`playlists/${pl.id}/delete`))) onDeleted(); }}><Trash2 className="size-4" aria-hidden /> {t("delete")}</Button>
          <Button onClick={async () => { if (await post(`playlists/${pl.id}`, v, { success: t("saved") })) onSaved(); }} data-testid="playlist-save">{t("save")}</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Field id="pl-t" label={t("fTitle")}><Input id="pl-t" value={v.title} maxLength={80} onChange={(e) => setV({ ...v, title: e.target.value })} data-testid="playlist-title-input" /></Field>
        <Field id="pl-d" label={t("fDescription")} optional><Textarea id="pl-d" value={v.description} maxLength={500} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
        <Field id="pl-v" label={t("fVisibility")} hint={t("plVisHint")}>
          <Select id="pl-v" value={v.visibility} onChange={(e) => setV({ ...v, visibility: e.target.value as typeof v.visibility })} data-testid="playlist-vis">
            {(["public", "unlisted", "private"] as const).map((x) => <option key={x} value={x}>{t(`plVis.${x}`)}</option>)}
          </Select>
        </Field>
        <div className="flex items-center gap-3">
          <Cover id={v.coverId} size={64} />
          <Field id="pl-c" label={t("fCover")} optional hint={t("fCoverHint")}>
            <input id="pl-c" type="file" accept="image/png,image/jpeg,image/webp" className="block w-full text-sm" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const r = await post<{ image: { id: string } }>("images", { data: await fileToB64(f) }); if (r) setV({ ...v, coverId: r.image.id }); }} />
          </Field>
        </div>
      </div>
    </BottomSheet>
  );
}
