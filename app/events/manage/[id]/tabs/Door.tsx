"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, CameraOff, Film, Globe2, ScanLine } from "lucide-react";
import { Field, Input, ToggleRow } from "@/components/forms/Fields";
import { Button } from "@/components/ui/primitives";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { ConfirmSheet, Section, useWhen } from "@/components/ops/shared";
import { useParty, usePartyPost } from "@/components/party/shared";
import { useMyAvatar } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import type { TabProps } from "../ctx";

type ScanResult = "ok" | "duplicate" | "not_found" | "cancelled" | "not_entry_time" | "waitlist";
interface Door {
  published: boolean;
  canManage: boolean;
  entryOpensAt: string;
  entryClosesAt: string;
  going: number;
  waitlist: number;
  settings: { capacity: number | null; archives: { url: string; label: string; host: string }[]; highlights: string[] };
  media: { id: string; kind: "official" | "attendee"; type: "image" | "video"; caption: string }[];
  checkedIn: number;
  qr: number;
  manual: number;
  verified: boolean;
  minQr: number;
  guests: number;
  guestHistory: { at: string; by: string; count: number; reason: string }[];
  people: { userId: string; name: string | null; status: "going" | "waitlist" | "cancelled"; checkedInAt: string | null; method: "qr" | "manual" | null; history: { at: string; action: string; reason?: string }[] }[];
  recentScans: { at: string; result: ScanResult }[];
}

const RESULT_COLOR: Record<ScanResult, string> = { waitlist: "bg-orange text-ink", ok: "bg-acid text-ink", duplicate: "bg-orange text-ink", not_found: "bg-coral text-ink", cancelled: "bg-coral text-ink", not_entry_time: "bg-orange text-ink" };

/** Door check-in: publish to the world, scan passes (camera where the browser supports it, or type the code), fix mistakes with a reason. */
export function Door({ v, eid }: TabProps) {
  const t = useTranslations("party");
  const href = useLocalHref();
  const when = useWhen();
  const post = usePartyPost();
  const me = useMyAvatar();
  const { data, reload } = useParty<{ door: Door }>(`/api/party/door/${eid}`);
  const [code, setCode] = useState("");
  const [last, setLast] = useState<{ result: ScanResult; name: string | null } | null>(null);
  const [fix, setFix] = useState<{ userId: string; name: string | null; action: "confirm" | "revoke" } | null>(null);
  const [reason, setReason] = useState("");
  const [guests, setGuests] = useState<{ count: string; reason: string }>({ count: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const d = data?.door;

  const submit = async (raw: string) => {
    if (!raw.trim()) return;
    setBusy(true);
    const r = await post<{ result: ScanResult; attendee: { name: string | null } | null }>(`events/${eid}/checkin`, { code: raw.trim() });
    setBusy(false);
    if (r) {
      setLast({ result: r.result, name: r.attendee?.name ?? null });
      setCode("");
      await reload();
    }
  };

  if (!d) return <div className="h-64 animate-pulse rounded-3xl bg-surface" />;
  return (
    <div className="space-y-4">
      {d.canManage && (
        <Section title={t("publishTitle")} id="pub">
          <ToggleRow
            checked={d.published}
            onChange={async (on) => {
              const r = await post<{ notified: number }>(`events/${eid}/publish`, { published: on });
              if (r) await reload();
            }}
            label={t("publishLabel")}
            sub={t("publishSub")}
          />
          {d.published && me.publicId && (
            <Link href={href(`/u/${me.publicId}/world`)} className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-acid underline">
              <Globe2 className="size-4" aria-hidden /> {t("viewInWorld")}
            </Link>
          )}
        </Section>
      )}

      {d.canManage && <PartySettingsForm eid={eid} d={d} reload={reload} />}

      <Section title={t("doorTitle")} id="door">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["doorGoing", d.going],
            ["doorCheckedIn", d.checkedIn],
            ["doorQr", d.qr],
            ["doorManual", d.manual],
          ].map(([k, n]) => (
            <div key={k} className="rounded-2xl bg-ink p-3" data-testid={k}>
              <dt className="text-[10px] font-extrabold uppercase text-mute">{t(String(k))}</dt>
              <dd className="font-display text-3xl">{n}</dd>
            </div>
          ))}
        </dl>
        {d.waitlist > 0 && <p className="mt-2 text-xs font-bold text-orange" data-testid="door-waitlist">{t("waitlistCount", { n: d.waitlist })}</p>}
        <p className="mt-2 text-xs text-mute">
          {t("entryWindow", { from: when(d.entryOpensAt, v.event.timezone), to: when(d.entryClosesAt, v.event.timezone) })} · {d.verified ? t("doorVerified") : t("doorNotVerified", { n: d.minQr })}
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit(code);
              }}
              className="flex items-end gap-2"
            >
              <div className="min-w-0 flex-1">
                <Field label={t("passCode")} id="door-code" hint={t("passCodeHint")}>
                  <Input id="door-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" inputMode="text" data-testid="door-code" />
                </Field>
              </div>
              <Button type="submit" disabled={busy || !code.trim()} data-testid="door-submit"><ScanLine className="size-4" aria-hidden /> {t("checkIn")}</Button>
            </form>
            {last && (
              <div className={cn("mt-3 rounded-2xl p-3 text-sm font-extrabold uppercase", RESULT_COLOR[last.result])} role="status" data-testid="door-result" data-result={last.result}>
                {t(`scan.${last.result}`)}{last.name ? ` · ${last.name}` : ""}
              </div>
            )}
          </div>
          <Scanner onCode={(c) => void submit(c)} busy={busy} />
        </div>
      </Section>

      {d.people.length > 0 && (
        <Section title={t("doorList")} id="door-list">
          <ul className="divide-y divide-line" data-testid="door-people">
            {d.people.map((p) => (
              <li key={p.userId} className="flex min-h-12 flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block font-bold">{p.name ?? "—"}</span>
                  <span className="text-xs text-mute">
                    {p.status === "waitlist" ? t("myStatus.waitlist") : p.status === "cancelled" ? t("myStatus.cancelled") : p.checkedInAt ? `${t("myStatus.checked_in")} · ${p.method === "manual" ? t("methodManual") : "QR"} · ${when(p.checkedInAt, v.event.timezone)}` : t("myStatus.going")}
                  </span>
                  {p.history.filter((h) => h.reason).slice(-2).map((h, i) => (
                    <span key={i} className="block text-[11px] text-mute">{when(h.at, v.event.timezone)} · {t(`action.${h.action}`)} · {h.reason}</span>
                  ))}
                </span>
                {d.canManage && (
                  <span className="flex gap-2">
                    {(p.status === "going" || p.status === "waitlist") && !p.checkedInAt && <Button size="sm" variant="ghost" onClick={() => setFix({ userId: p.userId, name: p.name, action: "confirm" })} data-testid="manual-confirm">{t("confirmManually")}</Button>}
                    {p.checkedInAt && p.status !== "cancelled" && <Button size="sm" variant="ghost" onClick={() => setFix({ userId: p.userId, name: p.name, action: "revoke" })} data-testid="revoke">{t("revoke")}</Button>}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {d.canManage && (
        <Section title={t("guestsTitle")} id="guests">
          <p className="text-sm text-mute">{t("guestsBody", { n: d.guests })}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[120px_1fr_auto] sm:items-end">
            <Field label={t("guestsCount")} id="g-count">
              <Input id="g-count" type="number" min={0} inputMode="numeric" value={guests.count} onChange={(e) => setGuests({ ...guests, count: e.target.value })} />
            </Field>
            <Field label={t("reason")} id="g-reason">
              <Input id="g-reason" value={guests.reason} maxLength={300} onChange={(e) => setGuests({ ...guests, reason: e.target.value })} />
            </Field>
            <Button
              disabled={busy || guests.count === "" || guests.reason.trim().length < 5}
              onClick={async () => {
                if (await post(`events/${eid}/guests`, { count: Number(guests.count), reason: guests.reason }, t("saved"))) {
                  setGuests({ count: "", reason: "" });
                  await reload();
                }
              }}
            >
              {t("save")}
            </Button>
          </div>
          {d.guestHistory.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-mute">
              {d.guestHistory.slice(-5).reverse().map((h, i) => <li key={i}>{when(h.at, v.event.timezone)} · {h.count} · {h.reason}</li>)}
            </ul>
          )}
        </Section>
      )}

      <ConfirmSheet
        open={!!fix}
        onClose={() => {
          setFix(null);
          setReason("");
        }}
        title={fix?.action === "revoke" ? t("revoke") : t("confirmManually")}
        statement={fix?.action === "revoke" ? t("revokeStatement", { name: fix?.name ?? "—" }) : t("confirmStatement", { name: fix?.name ?? "—" })}
        confirmLabel={fix?.action === "revoke" ? t("revoke") : t("confirmManually")}
        busy={busy || reason.trim().length < 5}
        onConfirm={async () => {
          if (!fix) return;
          setBusy(true);
          const r = await post(`events/${eid}/${fix.action}`, { userId: fix.userId, reason, confirm: true }, t("saved"));
          setBusy(false);
          if (r) {
            setFix(null);
            setReason("");
            await reload();
          }
        }}
      >
        <Field label={t("reason")} id="fix-reason" hint={t("reasonHint")}>
          <Input id="fix-reason" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} data-testid="fix-reason" />
        </Field>
      </ConfirmSheet>
    </div>
  );
}

/** Free tickets (capacity + waitlist), links to recordings, and highlights picked by a person. */
function PartySettingsForm({ eid, d, reload }: { eid: string; d: Door; reload: () => Promise<void> }) {
  const t = useTranslations("party");
  const post = usePartyPost();
  const [cap, setCap] = useState(d.settings.capacity === null ? "" : String(d.settings.capacity));
  const [links, setLinks] = useState(d.settings.archives.length ? d.settings.archives.map((a) => ({ url: a.url, label: a.label })) : [{ url: "", label: "" }]);
  const [hl, setHl] = useState<string[]>(d.settings.highlights);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const r = await post(`events/${eid}/settings`, {
      capacity: cap.trim() === "" ? null : Number(cap),
      archives: links.filter((l) => l.url.trim()).map((l) => ({ url: l.url.trim(), label: l.label.trim() || undefined })),
      highlights: hl,
    }, t("saved"));
    setBusy(false);
    if (r) await reload();
  };
  return (
    <Section title={t("partySettings")} id="party-settings">
      <div className="space-y-4" data-testid="party-settings">
        <Field label={t("capacity")} id="ps-cap" hint={t("capacityHint")} optional>
          <Input id="ps-cap" type="number" min={1} inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value)} data-testid="ps-capacity" />
        </Field>
        <div>
          <div className="mb-1 text-sm font-bold">{t("archives")}</div>
          <p className="mb-2 text-xs text-mute">{t("archivesHint")}</p>
          {links.map((l, i) => (
            <div key={i} className="mb-2 grid gap-2 sm:grid-cols-[1fr_180px]">
              <Input aria-label={t("archiveUrl")} placeholder="https://www.youtube.com/…" value={l.url} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} data-testid={`ps-archive-${i}`} />
              <Input aria-label={t("archiveLabel")} placeholder={t("archiveLabel")} maxLength={60} value={l.label} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            </div>
          ))}
          {links.length < 5 && (
            <button type="button" className="min-h-11 text-sm font-bold text-acid underline" onClick={() => setLinks([...links, { url: "", label: "" }])}>
              {t("addLink")}
            </button>
          )}
        </div>
        <div>
          <div className="mb-1 text-sm font-bold">{t("highlights")}</div>
          <p className="mb-2 text-xs text-mute">{t("highlightsHint")}</p>
          {d.media.length === 0 ? (
            <p className="text-xs text-mute">{t("highlightsNone")}</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {d.media.map((m) => {
                const on = hl.includes(m.id);
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      disabled={!on && hl.length >= 6}
                      onClick={() => setHl(on ? hl.filter((x) => x !== m.id) : [...hl, m.id])}
                      className={cn("relative block w-full overflow-hidden rounded-xl border-2", on ? "border-acid" : "border-line")}
                      aria-label={m.caption || t("mediaAlt")}
                      data-testid="ps-highlight"
                    >
                      {m.type === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/party/media/${m.id}`} alt="" className="aspect-square w-full object-cover" />
                      ) : (
                        <span className="flex aspect-square w-full items-center justify-center bg-black"><Film className="size-6" aria-hidden /></span>
                      )}
                      {on && <span className="absolute right-1 top-1 rounded-full bg-acid px-1.5 text-[10px] font-black text-ink">{hl.indexOf(m.id) + 1}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <Button disabled={busy} onClick={save} data-testid="ps-save">{t("save")}</Button>
      </div>
    </Section>
  );
}

type Detector = { detect: (src: HTMLVideoElement) => Promise<string | null> };

/** The browser's built-in BarcodeDetector where it exists, otherwise jsQR on canvas frames (iPhone Safari, Firefox). */
async function makeDetector(): Promise<Detector> {
  const W = window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> } };
  if (W.BarcodeDetector) {
    const d = new W.BarcodeDetector({ formats: ["qr_code"] });
    return { detect: async (v) => (await d.detect(v).catch(() => []))[0]?.rawValue ?? null };
  }
  const jsQR = (await import("jsqr")).default;
  const cv = document.createElement("canvas");
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  return {
    detect: async (v) => {
      if (!v.videoWidth) return null;
      const scale = Math.min(1, 640 / v.videoWidth);
      cv.width = Math.round(v.videoWidth * scale);
      cv.height = Math.round(v.videoHeight * scale);
      ctx.drawImage(v, 0, 0, cv.width, cv.height);
      const img = ctx.getImageData(0, 0, cv.width, cv.height);
      return jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data ?? null;
    },
  };
}

/** Camera scanner. Where the browser has no camera access at all, we say so and keep code entry. */
function Scanner({ onCode, busy }: { onCode: (c: string) => void; busy: boolean }) {
  const t = useTranslations("party");
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [err, setErr] = useState(false);
  const lastCode = useRef<{ c: string; at: number } | null>(null);
  const cb = useRef(onCode);
  cb.current = onCode;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  useEffect(() => setSupported(typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia), []);
  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | null = null;
    let timer = 0;
    let stop = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stop || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const det = await makeDetector();
        const tick = async () => {
          if (stop || !video.current) return;
          if (!busyRef.current) {
            const c = await det.detect(video.current).catch(() => null);
            const now = Date.now();
            if (c && !(lastCode.current?.c === c && now - lastCode.current.at < 4000)) {
              lastCode.current = { c, at: now };
              cb.current(c);
            }
          }
          timer = window.setTimeout(tick, 300);
        };
        void tick();
      } catch {
        setErr(true);
        setOn(false);
      }
    })();
    return () => {
      stop = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((x) => x.stop());
    };
  }, [on]);
  if (supported === false) return <p className="rounded-2xl border border-dashed border-line p-3 text-xs text-mute">{t("scannerUnsupported")}</p>;
  return (
    <div>
      <Button variant="ghost" onClick={() => setOn((x) => !x)} data-testid="scanner-toggle">
        {on ? <CameraOff className="size-4" aria-hidden /> : <Camera className="size-4" aria-hidden />} {on ? t("scannerStop") : t("scannerStart")}
      </Button>
      {on && <video ref={video} muted playsInline className="mt-2 aspect-square w-full max-w-xs rounded-2xl bg-black object-cover" aria-label={t("scannerAlt")} />}
      {err && <p className="mt-2 text-xs text-orange">{t("scannerError")}</p>}
    </div>
  );
}
