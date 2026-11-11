"use client";

/**
 * MP3 upload in seven steps: 1 choose → 2 check in the browser → 3 details → 4 rights & who can listen →
 * 5 upload straight to storage (signed URL, progress, cancel, retry) → 6 server check of the stored file →
 * 7 private (ready) or sent to staff review. Nothing is published automatically.
 */
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, FileAudio, RotateCcw, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { StepProgress } from "@/components/forms/Fields";
import { useMusicError, useMusicPost } from "@/components/music/shared";
import { usePlayerMaybe } from "@/components/music/PlayerProvider";
import { durationOf, id3Size, inspectHead } from "@/lib/music/mp3";
import { rightsProblems } from "@/lib/music/rules";
import { toast } from "@/lib/store";
import { fmtDuration } from "@/components/music/shared";
import { MetaFields, RightsFields, emptyRights, patchOf, type TrackFormValue } from "./TrackForm";

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;
interface Checked { durationSec: number; bitrate: number; sampleRate: number; channels: number }
interface Created { track: { id: string }; upload: { url: string; method: "PUT"; headers: Record<string, string>; expiresAt: string; mode: string } | null }

/** Peaks for the waveform, from the file itself (Web Audio). Skipped for very large files to spare the phone. */
async function peaksOf(file: File, bars = 160): Promise<number[]> {
  if (file.size > 60 * 1024 * 1024 || typeof AudioContext === "undefined") return [];
  try {
    const ctx = new AudioContext();
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    const ch = buf.getChannelData(0);
    const step = Math.max(1, Math.floor(ch.length / bars));
    const out: number[] = [];
    for (let i = 0; i < bars; i++) {
      let m = 0;
      for (let j = i * step; j < Math.min(ch.length, (i + 1) * step); j += 16) m = Math.max(m, Math.abs(ch[j]));
      out.push(m);
    }
    void ctx.close();
    const max = Math.max(...out, 0.01);
    return out.map((x) => Math.round((x / max) * 100) / 100);
  } catch {
    return [];
  }
}

export function Uploader({ maxFileBytes, storageMode, onDone }: { maxFileBytes: number; storageMode: string; onDone: () => void }) {
  const t = useTranslations("music");
  const msg = useMusicError();
  const post = useMusicPost();
  const player = usePlayerMaybe();
  const input = useRef<HTMLInputElement>(null);
  const xhr = useRef<XMLHttpRequest | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [checked, setChecked] = useState<Checked | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [trackId, setTrackId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [result, setResult] = useState<{ status: string; durationSec: number | null } | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [v, setV] = useState<TrackFormValue>({ title: "", type: "original_mix", genre: "Tech House", bpm: null, musicalKey: null, description: "", recordedAt: null, releaseAt: null, coverId: null, rights: emptyRights, visibility: "public", downloadable: false });
  const set = (p: Partial<TrackFormValue>) => setV((x) => ({ ...x, ...p }));

  const reset = () => {
    xhr.current?.abort();
    setStep(1); setFile(null); setChecked(null); setProblem(null); setTrackId(null); setProgress(0); setUploadErr(null); setResult(null); setPeaks([]); setProblems([]);
  };

  // ---- 1 + 2: choose and check in the browser (the server checks again on the stored file)
  const choose = async (f: File | undefined) => {
    if (!f) return;
    reset();
    setFile(f);
    setStep(2);
    if (!/\.mp3$/i.test(f.name) || (f.type && !["audio/mpeg", "audio/mp3"].includes(f.type))) return setProblem("FILE_TYPE");
    if (f.size > maxFileBytes) return setProblem("FILE_TOO_LARGE");
    if (f.size < 1024) return setProblem("FILE_EMPTY");
    let head = new Uint8Array(await f.slice(0, 524_288).arrayBuffer());
    const tag = id3Size(head);
    if (tag > 0 && tag + 4096 > head.length) {
      const after = new Uint8Array(await f.slice(tag, tag + 262_144).arrayBuffer());
      const merged = new Uint8Array(tag + after.length);
      merged.set(head.subarray(0, Math.min(tag, head.length)));
      merged.set(after, tag);
      head = merged;
    }
    const h = inspectHead(head);
    if (!h.ok) return setProblem(h.error);
    setChecked({ durationSec: durationOf(h, f.size), bitrate: h.codec.bitrateKbps, sampleRate: h.codec.sampleRate, channels: h.codec.channels });
    set({ title: f.name.replace(/\.mp3$/i, "").slice(0, 100) });
    void peaksOf(f).then(setPeaks);
  };

  // ---- draft: the record with its details, before (or without) the file transfer
  const ensureTrack = async () => {
    if (trackId) {
      const ok = await post(`tracks/${trackId}`, { ...patchOf(v), waveform: peaks });
      return ok ? { id: trackId, upload: null } : null;
    }
    const c = await post<Created>("uploads", { fileName: file!.name, size: file!.size, mime: "audio/mpeg", title: v.title });
    if (!c) return null;
    setTrackId(c.track.id);
    if (!(await post(`tracks/${c.track.id}`, { ...patchOf(v), waveform: peaks }))) return null;
    return { id: c.track.id, upload: c.upload };
  };

  const saveDraft = async () => {
    setBusy(true);
    const r = await ensureTrack();
    setBusy(false);
    if (r) {
      toast({ title: t("draftSaved"), tone: "success" });
      onDone();
    }
  };

  // ---- 5: PUT straight to storage with progress; cancel and retry
  const send = (id: string, up: NonNullable<Created["upload"]>) =>
    new Promise<boolean>((resolve) => {
      const x = new XMLHttpRequest();
      xhr.current = x;
      x.open(up.method, up.url);
      for (const [k, val] of Object.entries(up.headers)) x.setRequestHeader(k, val);
      x.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
      x.onload = () => resolve(x.status >= 200 && x.status < 300);
      x.onerror = () => resolve(false);
      x.onabort = () => resolve(false);
      x.send(file!);
      void id;
    });

  const upload = async () => {
    const problemsNow = v.visibility === "private" ? [] : rightsProblems(v.type, v.rights);
    setProblems(problemsNow);
    if (problemsNow.length) return toast({ title: t("rightsIncomplete"), tone: "error" });
    setBusy(true);
    setUploadErr(null);
    setStep(5);
    const r = await ensureTrack();
    if (!r) {
      setBusy(false);
      setStep(4);
      return;
    }
    let up = r.upload;
    if (!up) {
      const renewed = await post<{ upload: Created["upload"] }>(`tracks/${r.id}/renew`, {});
      up = renewed?.upload ?? null;
    }
    if (!up) {
      setBusy(false);
      setUploadErr("STORAGE_NOT_CONFIGURED");
      return;
    }
    setProgress(0);
    const okPut = await send(r.id, up);
    if (!okPut) {
      setBusy(false);
      setUploadErr(xhr.current?.status === 0 && progress < 100 ? "UPLOAD_INTERRUPTED" : "UPLOAD_FAILED");
      return;
    }
    // ---- 6: the server checks the stored file
    setStep(6);
    const done = await post<{ track: { processingStatus: string; processingError: string | null; durationSec: number | null } }>(`tracks/${r.id}/complete`, {}, { quiet: true });
    if (!done || done.track.processingStatus !== "ready") {
      setBusy(false);
      setUploadErr(done?.track.processingError ?? "PROCESSING_FAILED");
      return;
    }
    // ---- 7: private, or staff review (never published automatically)
    const sub = await post<{ track: { publicationStatus: string } }>(`tracks/${r.id}/submit`, { visibility: v.visibility });
    setBusy(false);
    setResult({ status: sub?.track.publicationStatus ?? "draft", durationSec: done.track.durationSec });
    setStep(7);
    onDone();
  };

  const cancel = () => {
    xhr.current?.abort();
    setUploadErr("UPLOAD_CANCELLED");
    setBusy(false);
  };

  const labels = [t("step1"), t("step2"), t("step3"), t("step4"), t("step5"), t("step6"), t("step7")];
  return (
    <div className="space-y-4" data-testid="uploader">
      <StepProgress step={step - 1} total={7} labels={labels} />
      {storageMode === "local" && <p className="rounded-xl bg-surface-2 p-2 text-xs text-mute" data-testid="local-storage-note">{t("localStorageNote")}</p>}

      {(step === 1 || step === 2) && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); void choose(e.dataTransfer.files?.[0]); }}
          className={`flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed p-6 text-center ${drag ? "border-acid bg-acid/10" : "border-line"}`}
          data-testid="dropzone"
        >
          <UploadCloud className="size-10 text-acid" aria-hidden />
          <p className="font-bold">{t("dropHere")}</p>
          <p className="text-xs text-mute">{t("dropHint", { mb: Math.round(maxFileBytes / 1024 / 1024) })}</p>
          <input ref={input} type="file" accept=".mp3,audio/mpeg" className="sr-only" id="mp3-input" data-testid="mp3-input" onChange={(e) => void choose(e.target.files?.[0])} />
          <Button type="button" onClick={() => input.current?.click()}>{t("chooseFile")}</Button>
        </div>
      )}

      {step === 2 && file && (
        <div className="rounded-2xl bg-surface-2 p-3 text-sm" data-testid="file-check">
          <div className="flex items-center gap-2 font-bold"><FileAudio className="size-5" aria-hidden /> {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</div>
          {problem ? (
            <p role="alert" className="mt-2 font-bold text-coral" data-testid="file-problem">{msg(problem)}</p>
          ) : checked ? (
            <>
              <p className="mt-2 text-acid"><CheckCircle2 className="mr-1 inline size-4" aria-hidden />{t("fileLooksOk", { duration: fmtDuration(checked.durationSec), kbps: checked.bitrate, khz: (checked.sampleRate / 1000).toFixed(1) })}</p>
              <p className="text-xs text-mute">{t("serverChecksAgain")}</p>
              <div className="mt-3 flex justify-end"><Button onClick={() => setStep(3)} data-testid="to-details">{t("next")}</Button></div>
            </>
          ) : (
            <p className="mt-2 text-mute" role="status">{t("checking")}</p>
          )}
        </div>
      )}

      {step === 3 && (
        <>
          <MetaFields v={v} set={set} />
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep(2)}>{t("back")}</Button>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={busy} onClick={() => void saveDraft()} data-testid="save-draft">{t("saveDraft")}</Button>
              <Button onClick={() => setStep(4)} disabled={!v.title.trim()} data-testid="to-rights">{t("next")}</Button>
            </div>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <RightsFields v={v} set={set} problems={problems} />
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep(3)}>{t("back")}</Button>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={busy} onClick={() => void saveDraft()}>{t("saveDraft")}</Button>
              <Button onClick={() => void upload()} disabled={busy} data-testid="start-upload">{t("uploadNow")}</Button>
            </div>
          </div>
        </>
      )}

      {(step === 5 || step === 6) && (
        <div className="space-y-3 rounded-2xl bg-surface-2 p-4" data-testid="upload-progress">
          <div className="flex items-center justify-between text-sm font-bold">
            <span>{step === 5 ? t("uploading") : t("processing")}</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-ink" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={t("uploading")}>
            <div className="h-full bg-acid transition-[width]" style={{ width: `${progress}%` }} />
          </div>
          {uploadErr ? (
            <div className="space-y-2">
              <p role="alert" className="text-sm font-bold text-coral" data-testid="upload-error">{msg(uploadErr)}</p>
              <div className="flex gap-2">
                <Button onClick={() => void upload()} data-testid="retry-upload"><RotateCcw className="size-4" aria-hidden /> {t("retry")}</Button>
                <Button variant="ghost" onClick={reset}>{t("startOver")}</Button>
              </div>
            </div>
          ) : (
            step === 5 && <Button variant="ghost" onClick={cancel} data-testid="cancel-upload"><X className="size-4" aria-hidden /> {t("cancel")}</Button>
          )}
        </div>
      )}

      {step === 7 && result && trackId && (
        <div className="space-y-3 rounded-2xl border border-acid/50 p-4" data-testid="upload-done">
          <p className="font-bold text-acid"><CheckCircle2 className="mr-1 inline size-5" aria-hidden />{t("uploadVerified", { duration: fmtDuration(result.durationSec) })}</p>
          <p className="text-sm" data-testid="upload-outcome">{result.status === "pending_review" ? t("sentForReview") : result.status === "private" ? t("keptPrivate") : t(`pub.${result.status}`)}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => player?.play([{ id: trackId, title: v.title, coverId: v.coverId, durationSec: result.durationSec, waveform: peaks, liked: false, saved: false, likes: 0 }], 0)} data-testid="preview-track">{t("preview")}</Button>
            <Button variant="ghost" onClick={reset}>{t("uploadAnother")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
