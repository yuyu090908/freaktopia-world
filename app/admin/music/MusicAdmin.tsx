"use client";

/**
 * Staff only (OPS_ADMIN_EMAILS): rights review queue, copyright claims (takedown / dismiss / restore after a
 * counter-notice), reports, upload limits and the music audit log. "Approve" records that staff read the
 * uploader's rights statement and documents; no audio-recognition check exists and none is claimed.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, PageTitle } from "@/components/ui/primitives";
import { Field, Input } from "@/components/forms/Fields";
import { Section, SignInGate, StatusPill, useWhen } from "@/components/ops/shared";
import { usePlayerMaybe } from "@/components/music/PlayerProvider";
import { fmtDuration, useMusic, useMusicPost } from "@/components/music/shared";
import type { CopyrightClaim, MusicReport, MusicSettings, RightsInfo } from "@/lib/music/types";

interface Overview {
  settings: MusicSettings;
  storage: { mode: string; missing: string[]; reason: string | null };
  pending: { id: string; title: string; type: string; genre: string; durationSec: number | null; visibility: string; rights: RightsInfo; owner?: { stageName: string }; fileName: string; codec: { bitrateKbps: number; sampleRate: number } | null; sizeBytes: number; waveform: number[]; coverId: string | null }[];
  claims: CopyrightClaim[];
  reports: MusicReport[];
  audit: { id: string; actorId: string | null; action: string; reason: string; meta: Record<string, unknown>; at: string }[];
  counts: { tracks: number; published: number; failed: number };
}

export function MusicAdmin() {
  const t = useTranslations("musicAdmin");
  return (
    <div className="mx-auto max-w-5xl pb-24 md:px-6">
      <PageTitle kicker="DJ ARENA" title={t("title")} sub={t("sub")} />
      <div className="px-4 md:px-0">
        <SignInGate returnTo="/admin/music"><Inner /></SignInGate>
      </div>
    </div>
  );
}

function Inner() {
  const t = useTranslations("musicAdmin");
  const tm = useTranslations("music");
  const when = useWhen();
  const post = useMusicPost();
  const player = usePlayerMaybe();
  const { data, error, reload } = useMusic<Overview>("/api/music/admin");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<Partial<MusicSettings>>({});
  if (error) return <p role="alert" className="rounded-2xl border border-line p-4 text-sm">{error.status === 403 ? t("adminsOnly") : tm("loadError")}</p>;
  if (!data) return <div className="h-40 animate-pulse rounded-3xl bg-surface" aria-busy="true" />;
  const s = { ...data.settings, ...settings };
  return (
    <div className="space-y-4">
      <Section title={t("storage")} id="ma-st">
        <p className="text-sm" data-testid="admin-storage">{t(`storageMode.${data.storage.mode}`)}</p>
        {data.storage.missing.length > 0 && <p className="mt-1 font-mono text-xs">{data.storage.missing.join(", ")}</p>}
        <p className="mt-1 text-xs text-mute">{t("counts", data.counts)}</p>
      </Section>

      <Section title={t("reviewQueue", { n: data.pending.length })} id="ma-q">
        <p className="mb-3 text-xs text-mute">{t("reviewNote")}</p>
        {data.pending.length === 0 ? <p className="text-sm text-mute">{t("none")}</p> : (
          <ul className="space-y-3" data-testid="review-queue">
            {data.pending.map((tr) => (
              <li key={tr.id} className="rounded-2xl bg-surface-2 p-3 text-sm" data-testid="review-item" data-track-id={tr.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-base">{tr.title}</b>
                  <span className="text-mute">{tr.owner?.stageName} · {tm(`type.${tr.type}`)} · {tr.genre} · {fmtDuration(tr.durationSec)} · {tm(`vis.${tr.visibility}`)}</span>
                </div>
                <p className="text-xs text-mute">{tr.fileName} · {(tr.sizeBytes / 1024 / 1024).toFixed(1)} MB{tr.codec ? ` · ${tr.codec.bitrateKbps} kbps · ${tr.codec.sampleRate} Hz` : ""}</p>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                  <dt className="text-mute">{tm("rAllOriginal")}</dt><dd>{tr.rights.allOriginal ? "✓" : "—"}</dd>
                  <dt className="text-mute">{tm("rThirdParty")}</dt><dd>{tr.rights.usesThirdParty ? "✓" : "—"}</dd>
                  <dt className="text-mute">{tm("rLicensor")}</dt><dd>{tr.rights.licensor || "—"}</dd>
                  <dt className="text-mute">{tm("rLicenseRef")}</dt><dd>{tr.rights.licenseRef || "—"}</dd>
                  <dt className="text-mute">{tm("rTerritories")}</dt><dd>{tr.rights.territories || "—"}</dd>
                  <dt className="text-mute">{tm("rEnds")}</dt><dd>{tr.rights.licenseEnds ?? "—"}</dd>
                  <dt className="text-mute">{tm("rStreaming")}</dt><dd>{tr.rights.allowStreaming ? "✓" : "—"}</dd>
                  <dt className="text-mute">{tm("rDownloadRight")}</dt><dd>{tr.rights.allowDownload ? "✓" : "—"}</dd>
                  <dt className="text-mute">{tm("rStatement")}</dt><dd className="whitespace-pre-wrap">{tr.rights.statement}</dd>
                  <dt className="text-mute">{tm("rDocument")}</dt><dd>{tr.rights.documentId ? <a className="font-bold text-acid underline" href={`/api/music/rights-docs/${tr.rights.documentId}`}>{t("openDocument")}</a> : "—"}</dd>
                </dl>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => player?.play([{ id: tr.id, title: tr.title, coverId: tr.coverId, durationSec: tr.durationSec, waveform: tr.waveform, liked: false, saved: false, likes: 0 }], 0)}>{tm("play")}</Button>
                  <Input aria-label={t("note")} placeholder={t("note")} value={notes[tr.id] ?? ""} maxLength={1000} onChange={(e) => setNotes({ ...notes, [tr.id]: e.target.value })} className="!h-11 max-w-xs" data-testid="review-note" />
                  <Button size="sm" onClick={async () => { if (await post(`admin/tracks/${tr.id}/review`, { decision: "approve", note: notes[tr.id] ?? "" })) void reload(); }} data-testid="review-approve">{t("approve")}</Button>
                  <Button size="sm" variant="ghost" disabled={!(notes[tr.id] ?? "").trim()} onClick={async () => { if (await post(`admin/tracks/${tr.id}/review`, { decision: "reject", note: notes[tr.id] ?? "" })) void reload(); }} data-testid="review-reject">{t("reject")}</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("claims")} id="ma-c">
        {data.claims.length === 0 ? <p className="text-sm text-mute">{t("none")}</p> : (
          <ul className="space-y-3" data-testid="admin-claims">
            {data.claims.map((c) => (
              <li key={c.id} className="rounded-2xl bg-surface-2 p-3 text-sm" data-testid="admin-claim">
                <div className="flex flex-wrap items-center gap-2"><StatusPill status={c.status === "upheld" ? "critical" : c.status === "open" || c.status === "countered" ? "warning" : "done"} label={tm(`claim.${c.status}`)} /> <span className="text-xs text-mute">{when(c.createdAt)}</span></div>
                <p className="mt-1"><b>{c.claimantName}</b> ({c.claimantEmail}) · {c.work}</p>
                <p className="mt-1 whitespace-pre-wrap text-mute">{c.details}</p>
                {c.counter && <p className="mt-1 rounded-lg bg-ink p-2 text-xs"><b>{t("counterNotice")}:</b> {c.counter.statement}</p>}
                {c.resolution && <p className="mt-1 text-xs">{tm("staffNote", { note: c.resolution })}</p>}
                {["open", "countered", "upheld"].includes(c.status) && (
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <Input aria-label={t("resolution")} placeholder={t("resolution")} value={notes[c.id] ?? ""} maxLength={1000} onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })} className="!h-11 max-w-xs" data-testid="claim-resolution" />
                    {["open", "countered"].includes(c.status) && <Button size="sm" variant="coral" disabled={!(notes[c.id] ?? "").trim()} onClick={async () => { if (await post(`admin/claims/${c.id}`, { decision: "uphold", resolution: notes[c.id] })) void reload(); }} data-testid="claim-uphold">{t("uphold")}</Button>}
                    {c.status === "open" && <Button size="sm" variant="ghost" disabled={!(notes[c.id] ?? "").trim()} onClick={async () => { if (await post(`admin/claims/${c.id}`, { decision: "dismiss", resolution: notes[c.id] })) void reload(); }}>{t("dismiss")}</Button>}
                    {["countered", "upheld"].includes(c.status) && <Button size="sm" variant="ghost" disabled={!(notes[c.id] ?? "").trim()} onClick={async () => { if (await post(`admin/claims/${c.id}`, { decision: "restore", resolution: notes[c.id] })) void reload(); }} data-testid="claim-restore">{t("restore")}</Button>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("reports")} id="ma-r">
        {data.reports.length === 0 ? <p className="text-sm text-mute">{t("none")}</p> : (
          <ul className="space-y-2">{data.reports.map((r) => <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2 p-3 text-sm"><span className="flex-1">{r.targetType} · {r.reason} · {r.details}</span><Button size="sm" variant="ghost" onClick={async () => { if (await post(`admin/reports/${r.id}/close`)) void reload(); }}>{t("close")}</Button></li>)}</ul>
        )}
      </Section>

      <Section title={t("limits")} id="ma-s">
        <p className="mb-3 text-xs text-mute">{t("limitsNote")}</p>
        <div className="grid gap-3 md:grid-cols-5" data-testid="admin-settings">
          {(["maxFileMb", "maxDurationMin", "quotaMbPerUser", "uploadsPerDay", "strikeLimit"] as const).map((k) => (
            <Field key={k} id={`set-${k}`} label={t(`set.${k}`)}><Input id={`set-${k}`} type="number" value={s[k]} onChange={(e) => setSettings({ ...settings, [k]: Number(e.target.value) })} data-testid={`set-${k}`} /></Field>
          ))}
        </div>
        <div className="mt-3 flex justify-end"><Button onClick={async () => { if (await post("admin/settings", settings, { success: tm("saved") })) { setSettings({}); void reload(); } }} disabled={!Object.keys(settings).length} data-testid="save-settings">{tm("save")}</Button></div>
      </Section>

      <Section title={t("audit")} id="ma-a">
        <ol className="max-h-96 space-y-1 overflow-y-auto text-xs" data-testid="music-audit">
          {data.audit.map((a) => <li key={a.id} className="rounded-lg bg-surface-2 p-2"><span className="text-mute">{when(a.at)}</span> · <b>{a.action}</b> · {String(a.meta.entityType ?? "")} {String(a.meta.entityId ?? "").slice(0, 8)}{a.reason ? ` · ${a.reason}` : ""}</li>)}
        </ol>
      </Section>
    </div>
  );
}
