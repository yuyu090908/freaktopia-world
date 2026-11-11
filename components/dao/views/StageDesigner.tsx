"use client";

import { Tx } from "@/components/i18n/Tx";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, History, ImageUp, Layers, RotateCcw, Send, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import { Button, Chip, DemoNotice } from "@/components/ui/primitives";
import { LoadingSkeleton } from "@/components/ui/States";
import { Field, Input, Select, StepProgress, Textarea } from "@/components/forms/Fields";
import { daoApi, useDaoQuery } from "@/lib/dao/client";
import { THEME_META, usd } from "@/lib/dao/meta";
import { STAGE_THEMES, type StageTheme, type VenuePhoto, type VenueSpec } from "@/lib/dao/types";
import { toast } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ConceptRender } from "../ConceptRender";
import { useDao, type ConceptDto } from "../DaoContext";
import { Gate } from "../DaoUi";
import { uploadImages } from "./DiscussionView";

type Photo = VenuePhoto & { url: string; generated: boolean };
interface StageHome {
  venue: VenueSpec;
  photos: Photo[];
  projects: { id: string; theme: StageTheme; concepts: ConceptDto[]; createdBy: string }[];
  provider: string;
  can: { upload: boolean; generate: boolean; edit: boolean; publish: boolean; verify: boolean };
  deny: { code: string; message: string } | null;
}

const EDIT_EXAMPLES = ["ステージ中央の宇宙人をもっと大きくしたい", "LEDスクリーンを左右に追加したい", "紫と緑の照明に変更したい", "予算を抑えたデザインにしたい"];

export function StageDesigner() {
  return (
    <Suspense fallback={<LoadingSkeleton variant="page" />}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const tu = useTranslations("dao");
  const { eventId, home, setJoinOpen } = useDao();
  const params = useSearchParams();
  const { state, reload } = useDaoQuery<StageHome>(`${eventId}/stage`);
  const [step, setStep] = useState(1);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [venue, setVenue] = useState<VenueSpec | null>(null);
  const [theme, setTheme] = useState<StageTheme>("alien_invasion");
  const [custom, setCustom] = useState("");
  const [count, setCount] = useState(4);
  const [concepts, setConcepts] = useState<ConceptDto[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (state.status !== "ok") return;
    setVenue((v) => v ?? state.data.venue);
    setPhotoId((p) => p ?? state.data.photos[0]?.id ?? null);
    const mine = state.data.projects.flatMap((p) => p.concepts).filter((c) => c.creatorUid === home?.me?.uid);
    if (!concepts.length && mine.length) setConcepts(mine);
  }, [state, home?.me?.uid]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const v = params.get("venue");
    if (v) setStep(1);
  }, [params]);

  if (state.status === "loading" || !venue) return <LoadingSkeleton variant="page" />;
  if (state.status === "error") return <p role="alert">{state.error.message}</p>;
  const data = state.data;
  const photo = data.photos.find((p) => p.id === photoId) ?? data.photos[0];
  const activeConcept = concepts.find((c) => c.id === active) ?? null;

  const generate = async () => {
    if (!photo) return;
    setBusy(true);
    setErr(null);
    const pr = await daoApi<{ project: { id: string } }>(`${eventId}/stage/projects`, { method: "POST", json: { venue, photoIds: [photo.id], theme, customTheme: theme === "custom" ? custom : undefined } });
    if (!pr.ok) {
      setBusy(false);
      return setErr(pr.error.issues?.map((i) => `${i.path}: ${i.message}`).join(" · ") || pr.error.message);
    }
    const g = await daoApi<{ concepts: ConceptDto[] }>(`${eventId}/stage/projects/${pr.data.project.id}/generate`, { method: "POST", json: { count, photoId: photo.id } });
    setBusy(false);
    if (!g.ok) return setErr(g.error.message);
    setConcepts(g.data.concepts);
    setActive(g.data.concepts[0]?.id ?? null);
    setCompare(g.data.concepts.slice(0, 2).map((c) => c.id));
    setStep(3);
    toast({ title: tu("lengthConceptsGenerated", { length: g.data.concepts.length }), body: tu("demoCompositorOnYourVenue"), tone: "success" });
  };
  const replace = (c: ConceptDto) => setConcepts((xs) => xs.map((x) => (x.id === c.id ? c : x)));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-acid">{tu("aiStageDesigner")}</p>
        <h1 className="text-[34px] uppercase leading-none sm:text-5xl">{tu("designTheStage")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-mute">{tu("startFromRealVenuePhotos")}</p>
      </div>
      <DemoNotice>
        <b>{data.provider === "demo-compositor" ? tu("demoCompositorNotAGenerative") : tu("imageModelConnected")}</b> {tu("conceptsAreDrawnAsLayers")} <b>{tu("aiConceptNotAConstruction")}</b>{tu("andBudgetsAreAiReference")}
      </DemoNotice>
      {!data.can.generate && (
        <Gate reason={tu("membersOrganizersAndVenueOwners")} action={<Button size="sm" onClick={() => setJoinOpen(true)}>{tu("joinDao")}</Button>}>
          {data.deny?.message}
        </Gate>
      )}

      <StepProgress step={step} total={5} labels={[tu("venue"), tu("theme"), tu("generate"), tu("gallery"), tu("edit")]} />
      <nav aria-label={tu("designerSteps")} className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
        {[tu("n1Venue"), tu("n2Theme"), tu("n3Concepts"), tu("n4Publish"), tu("n5Edit")].map((l, i) => (
          <Chip key={l} active={step === i + 1} onClick={() => setStep(i + 1)} disabled={i >= 2 && !concepts.length}>{l}</Chip>
        ))}
      </nav>

      {step === 1 && (
        <VenueStep data={data} photo={photo} setPhotoId={setPhotoId} venue={venue} setVenue={setVenue} onUploaded={async (id) => { await reload(true); setPhotoId(id); }} onNext={() => setStep(2)} />
      )}

      {step === 2 && (
        <section aria-labelledby="theme-h" className="space-y-4">
          <h2 id="theme-h" className="text-2xl uppercase">{tu("chooseATheme")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-label={tu("theme")}>
            {STAGE_THEMES.map((t) => {
              const m = THEME_META[t];
              const on = theme === t;
              return (
                <button key={t} type="button" role="radio" aria-checked={on} onClick={() => setTheme(t)} className={cn("rounded-[20px] border-2 p-3 text-left transition-colors", on ? "border-acid bg-acid/10" : "border-line bg-surface/80 hover:border-cream/50")}>
                  <div className="flex gap-1" aria-hidden>{m.palette.map((c) => <span key={c} className="h-6 flex-1 rounded-md" style={{ background: c }} />)}</div>
                  <div className="mt-2 font-display text-lg uppercase"><Tx>{m.label}</Tx></div>
                  <p className="text-[12px] text-mute"><Tx>{m.blurb}</Tx></p>
                </button>
              );
            })}
          </div>
          {theme === "custom" && (
            <Field id="custom-theme" label={tu("describeYourTheme")}><Input id="custom-theme" value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={200} placeholder={tu("eGDeepSeaBioluminescent")} /></Field>
          )}
          <Field id="count" label={tu("numberOfConcepts")}>
            <Select id="count" value={count} onChange={(e) => setCount(Number(e.target.value))}>{[3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</Select>
          </Field>
          {err && <p role="alert" className="text-sm text-coral">{err}</p>}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep(1)}>{tu("back")}</Button>
            <Button onClick={generate} disabled={busy || !data.can.generate || !photo}><Sparkles className="size-5" aria-hidden /> {busy ? tu("generating") : tu("generateCountConcepts", { count })}</Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section aria-labelledby="gen-h" className="space-y-5">
          <h2 id="gen-h" className="text-2xl uppercase">{tu("concepts")}</h2>
          <p className="text-sm text-mute">{tu("tapAConceptToInspect")}</p>
          <div className="grid gap-4 md:grid-cols-2">
            {concepts.map((c) => (
              <article key={c.id} className={cn("neon overflow-hidden rounded-[22px] border bg-surface", active === c.id && "border-acid")}>
                <button type="button" className="block w-full text-left" onClick={() => setActive(c.id)} aria-label={tu("inspectName", { name: c.name })}>
                  {c.photo && <ConceptRender photoUrl={c.photo.url} zone={c.photo.stageZone} ceilingY={c.photo.ceilingY} spec={c.current.spec} title={tu("conceptOf", { name: c.name })} />}
                </button>
                <div className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-xl uppercase">{c.name}</h3>
                    <label className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 text-sm font-bold">
                      <input type="checkbox" className="size-5 accent-acid" checked={compare.includes(c.id)} onChange={() => setCompare((x) => (x.includes(c.id) ? x.filter((y) => y !== c.id) : x.length < 3 ? [...x, c.id] : x))} />
                      {tu("compare")}
                    </label>
                  </div>
                  <p className="text-[13px] text-mute">{c.description}</p>
                  <p className="text-sm"><b>{tu("aiReferenceEstimate")}</b> {usd(c.current.estimate.low)}–{usd(c.current.estimate.high)}</p>
                </div>
              </article>
            ))}
          </div>
          {compare.length >= 2 && <CompareRow concepts={concepts.filter((c) => compare.includes(c.id))} />}
          {activeConcept && <BeforeAfter c={activeConcept} />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep(2)}>{tu("regenerate")}</Button>
            <Button onClick={() => setStep(4)}>{tu("nextPublish")}</Button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section aria-labelledby="pub-h" className="space-y-4">
          <h2 id="pub-h" className="text-2xl uppercase">{tu("publishToTheDaoGallery")}</h2>
          <p className="text-sm text-mute">{tu("publishedConceptsGetADiscussion")}</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {concepts.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface/80 p-2">
                <div className="w-32 shrink-0 overflow-hidden rounded-xl">{c.photo && <ConceptRender photoUrl={c.photo.url} zone={c.photo.stageZone} ceilingY={c.photo.ceilingY} spec={c.current.spec} title={tu("thumbnailOf", { name: c.name })} showLabel={false} />}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{c.name}</div>
                  {c.published ? (
                    <Link href={`/dao/${eventId}/gallery#${c.id}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-acid"><Check className="size-4" aria-hidden /> {tu("inGallery")}</Link>
                  ) : c.creatorUid === home?.me?.uid && data.can.publish ? (
                    <Button size="sm" onClick={async () => {
                      const r = await daoApi<{ concept: ConceptDto; xp: number }>(`${eventId}/stage/concepts/${c.id}/publish`, { method: "POST" });
                      if (!r.ok) return toast({ title: tu("notPublished"), body: r.error.message, tone: "error" });
                      replace(r.data.concept);
                      toast({ title: tu("publishedToGallery"), body: r.data.xp ? tu("xpDaoXpDesignerBadge", { xp: r.data.xp }) : undefined, tone: "success" });
                    }}><Send className="size-4" aria-hidden /> {tu("publish")}</Button>
                  ) : (
                    <p className="text-[12px] text-mute">{tu("onlyStakedCreatorsCanPublish")}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Button onClick={() => setStep(5)}>{tu("nextEdit")}</Button>
        </section>
      )}

      {step === 5 && (
        <EditStep concepts={concepts} active={activeConcept ?? concepts[0] ?? null} setActive={setActive} onChange={replace} canEdit={data.can.edit || data.can.generate} />
      )}
    </div>
  );
}

function VenueStep({ data, photo, setPhotoId, venue, setVenue, onUploaded, onNext }: { data: StageHome; photo: Photo | undefined; setPhotoId: (id: string) => void; venue: VenueSpec; setVenue: (v: VenueSpec) => void; onUploaded: (id: string) => void; onNext: () => void }) {
  const tu = useTranslations("dao");
  const { eventId } = useDao();
  const [pending, setPending] = useState<{ id: string; url: string } | null>(null);
  const [zone, setZone] = useState({ x: 0.3, y: 0.42, w: 0.4, h: 0.3 });
  const [ceiling, setCeiling] = useState(0.15);
  const [caption, setCaption] = useState("");
  const [basis, setBasis] = useState<"owner" | "licensed" | "organizer_contract">("owner");
  const [attest, setAttest] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof VenueSpec>(k: K, v: VenueSpec[K]) => setVenue({ ...venue, [k]: v });

  const register = async () => {
    if (!pending) return;
    setBusy(true);
    const r = await daoApi<{ photo: { id: string } }>(`${eventId}/stage/photos`, { method: "POST", json: { mediaId: pending.id, caption, stageZone: zone, ceilingY: ceiling, rightsBasis: basis, attest } });
    setBusy(false);
    if (!r.ok) return setMsg(r.error.issues?.map((i) => `${i.path}: ${i.message}`).join(" · ") || r.error.message);
    setPending(null);
    setAttest(false);
    toast({ title: tu("venuePhotoRegistered"), body: tu("usageRightsSelfAttestedAwaiting"), tone: "success" });
    onUploaded(r.data.photo.id);
  };

  return (
    <section aria-labelledby="venue-h" className="space-y-5">
      <h2 id="venue-h" className="text-2xl uppercase">{tu("n1VenuePhotosSpecs")}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label={tu("venuePhoto")}>
        {data.photos.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={photo?.id === p.id} onClick={() => setPhotoId(p.id)} className={cn("overflow-hidden rounded-2xl border-2 text-left", photo?.id === p.id ? "border-acid" : "border-line")}>
            <ZonePreview url={p.url} zone={p.stageZone} ceilingY={p.ceilingY} />
            <div className="p-2 text-[12px]">
              <div className="font-bold">{p.caption}</div>
              <div className="flex items-center gap-1 text-mute"><ShieldCheck className={cn("size-3.5", p.rights.status === "verified" ? "text-acid" : "text-orange")} aria-hidden />{tu("rightsReplaceValue", { replace: p.rights.status.replace("_", " "), value: p.generated ? tu("illustratedPlate") : "" })}</div>
            </div>
          </button>
        ))}
      </div>

      {data.can.upload ? (
        <div className="neon space-y-4 rounded-[22px] border bg-surface/90 p-4">
          <h3 className="flex items-center gap-2 text-lg uppercase"><ImageUp className="size-5 text-acid" aria-hidden />{tu("uploadVenuePhotos")}</h3>
          {!pending ? (
            <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line p-4 text-center hover:border-acid">
              <span className="font-bold">{tu("choosePhotosJpegPngWebp")}</span>
              <span className="text-[12px] text-mute">{tu("typeSizeAndDimensionsAre")}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={async (e) => {
                if (!e.target.files?.length) return;
                setBusy(true);
                setMsg(null);
                const r = await uploadImages(eventId, e.target.files, "venue", "members");
                setBusy(false);
                e.target.value = "";
                if (!r.ok) return setMsg(r.error.message);
                if (r.data.errors.length) setMsg(r.data.errors.map((x) => `${x.name}: ${x.message}`).join(" "));
                if (r.data.files[0]) setPending(r.data.files[0]);
              }} />
            </label>
          ) : (
            <div className="space-y-3">
              <p className="text-sm">{tu("dragOnThePhotoTo")}</p>
              <ZoneEditor url={pending.url} zone={zone} onZone={setZone} ceilingY={ceiling} />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {(["x", "y", "w", "h"] as const).map((k) => (
                  <label key={k} className="text-[12px] font-bold">
                    {tu("zoneTouppercaseRound", { toUpperCase: k.toUpperCase(), round: Math.round(zone[k] * 100) })}
                    <input type="range" min={k === "w" || k === "h" ? 5 : 0} max={100} value={Math.round(zone[k] * 100)} onChange={(e) => setZone((z) => ({ ...z, [k]: Number(e.target.value) / 100 }))} className="mt-1 w-full accent-acid" />
                  </label>
                ))}
                <label className="text-[12px] font-bold">
                  {tu("rigLineRound", { round: Math.round(ceiling * 100) })}
                  <input type="range" min={0} max={60} value={Math.round(ceiling * 100)} onChange={(e) => setCeiling(Number(e.target.value) / 100)} className="mt-1 w-full accent-purple" />
                </label>
              </div>
              <Field id="ph-cap" label={tu("caption")}><Input id="ph-cap" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={tu("mainHallFromTheBar")} /></Field>
              <Field id="ph-basis" label={tu("yourRightToUseThis")}>
                <Select id="ph-basis" value={basis} onChange={(e) => setBasis(e.target.value as typeof basis)}>
                  <option value="owner">{tu("iOwnManageTheVenue")}</option>
                  <option value="licensed">{tu("iHaveALicenceOr")}</option>
                  <option value="organizer_contract">{tu("organizerContractWithTheVenue")}</option>
                </Select>
              </Field>
              <label className="flex min-h-11 items-start gap-3 text-sm">
                <input type="checkbox" className="mt-1 size-5 accent-acid" checked={attest} onChange={(e) => setAttest(e.target.checked)} />
                <span>{tu("iConfirmIOwnOr")}</span>
              </label>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setPending(null)}>{tu("cancel")}</Button>
                <Button onClick={register} disabled={busy || !attest || caption.trim().length < 3}>{tu("registerPhoto")}</Button>
              </div>
            </div>
          )}
          {msg && <p role="alert" className="text-sm text-coral">{msg}</p>}
        </div>
      ) : (
        <p className="rounded-2xl border border-line p-3 text-sm text-mute">{tu("onlyTheVenueOwnerOr")} <Link className="underline" href={`/dao/${eventId}/settings`}>{tu("settings")}</Link>.)</p>
      )}

      <details className="neon rounded-[22px] border bg-surface/90 p-4" open>
        <summary className="cursor-pointer text-lg font-extrabold uppercase">{tu("venueDetails")}</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field id="v-name" label={tu("venueName")}><Input id="v-name" value={venue.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field id="v-loc" label={tu("location")}><Input id="v-loc" value={venue.location} onChange={(e) => set("location", e.target.value)} /></Field>
          <Field id="v-set" label={tu("indoorOutdoor")}><Select id="v-set" value={venue.setting} onChange={(e) => set("setting", e.target.value as VenueSpec["setting"])}><option value="indoor">{tu("indoor")}</option><option value="outdoor">{tu("outdoor")}</option></Select></Field>
          <Field id="v-cap" label={tu("capacity")}><Input id="v-cap" type="number" value={venue.capacity} onChange={(e) => set("capacity", Number(e.target.value))} /></Field>
          <Field id="v-sw" label={tu("stageWidthM")}><Input id="v-sw" type="number" value={venue.stageWidthM} onChange={(e) => set("stageWidthM", Number(e.target.value))} /></Field>
          <Field id="v-sd" label={tu("stageDepthM")}><Input id="v-sd" type="number" value={venue.stageDepthM} onChange={(e) => set("stageDepthM", Number(e.target.value))} /></Field>
          <Field id="v-ch" label={tu("ceilingHeightM")} hint={tu("n0OpenAir")}><Input id="v-ch" type="number" value={venue.ceilingHeightM} onChange={(e) => set("ceilingHeightM", Number(e.target.value))} /></Field>
          <Field id="v-pw" label={tu("availablePowerKw")}><Input id="v-pw" type="number" value={venue.powerKw} onChange={(e) => set("powerKw", Number(e.target.value))} /></Field>
          <Field id="v-bud" label={tu("productionBudgetUsd")}><Input id="v-bud" type="number" value={venue.budgetUsd} onChange={(e) => set("budgetUsd", Number(e.target.value))} /></Field>
          <Field id="v-eq" label={tu("existingEquipment")} hint={tu("commaSeparated")}><Input id="v-eq" value={venue.existingEquipment.join(", ")} onChange={(e) => set("existingEquipment", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} /></Field>
          <div className="sm:col-span-2">
            <Field id="v-safe" label={tu("safetyRestrictions")} hint={tu("onePerLineEG")}>
              <Textarea id="v-safe" rows={3} value={venue.safetyRestrictions.join("\n")} onChange={(e) => set("safetyRestrictions", e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} />
            </Field>
          </div>
        </div>
      </details>
      <Button onClick={onNext} disabled={!photo}>{tu("nextTheme")}</Button>
    </section>
  );
}

function ZonePreview({ url, zone, ceilingY }: { url: string; zone: { x: number; y: number; w: number; h: number }; ceilingY: number }) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden bg-ink">
      <img src={url} alt="" className="absolute inset-0 size-full object-cover" />
      <div className="absolute border-2 border-dashed border-acid bg-acid/10" style={{ left: `${zone.x * 100}%`, top: `${zone.y * 100}%`, width: `${zone.w * 100}%`, height: `${zone.h * 100}%` }} aria-hidden />
      <div className="absolute inset-x-0 border-t-2 border-dashed border-purple" style={{ top: `${ceilingY * 100}%` }} aria-hidden />
    </div>
  );
}

function ZoneEditor({ url, zone, onZone, ceilingY }: { url: string; zone: { x: number; y: number; w: number; h: number }; onZone: (z: { x: number; y: number; w: number; h: number }) => void; ceilingY: number }) {
  const tu = useTranslations("dao");
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  return (
    <div
      ref={ref}
      className="relative aspect-[16/10] touch-none select-none overflow-hidden rounded-2xl border-2 border-line bg-ink"
      onPointerDown={(e) => {
        start.current = pos(e);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const p = pos(e);
        const s = start.current;
        onZone({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.max(0.05, Math.abs(p.x - s.x)), h: Math.max(0.05, Math.abs(p.y - s.y)) });
      }}
      onPointerUp={() => (start.current = null)}
      aria-label={tu("stageZoneEditorDragTo")}
      role="application"
    >
      <img src={url} alt={tu("uploadedVenuePhoto")} className="pointer-events-none absolute inset-0 size-full object-cover" />
      <div className="pointer-events-none absolute border-2 border-acid bg-acid/15" style={{ left: `${zone.x * 100}%`, top: `${zone.y * 100}%`, width: `${zone.w * 100}%`, height: `${zone.h * 100}%` }}>
        <span className="absolute -top-6 left-0 rounded bg-acid px-1.5 text-[11px] font-extrabold uppercase text-ink">{tu("stageZone")}</span>
      </div>
      <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-purple" style={{ top: `${ceilingY * 100}%` }}>
        <span className="absolute left-2 top-0.5 text-[11px] font-extrabold uppercase text-purple">{tu("rigLine")}</span>
      </div>
    </div>
  );
}

function CompareRow({ concepts }: { concepts: ConceptDto[] }) {
  const tu = useTranslations("dao");
  const rows: [string, (c: ConceptDto) => string][] = [
    [tu("layout"), (c) => c.current.spec.layout],
    [tu("ledScreens"), (c) => `${c.current.spec.ledScreens}${c.current.spec.ledSides ? " + sides" : ""}`],
    [tu("beamsLasers"), (c) => `${c.current.spec.beams} / ${c.current.spec.lasers ? "yes" : "no"}`],
    [tu("aliens"), (c) => `${c.current.spec.alienCount} × ${c.current.spec.alienScale}`],
    [tu("booth"), (c) => c.current.spec.booth],
    [tu("haze"), (c) => `${Math.round(c.current.spec.haze * 100)}%`],
    [tu("aiEstimate2"), (c) => `${usd(c.current.estimate.low)}–${usd(c.current.estimate.high)}`],
  ];
  return (
    <section aria-labelledby="cmp-h" className="space-y-3">
      <h3 id="cmp-h" className="flex items-center gap-2 text-xl uppercase"><Layers className="size-5 text-acid" aria-hidden />{tu("sideBySide")}</h3>
      <div className={cn("grid gap-3", concepts.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
        {concepts.map((c) => (
          <div key={c.id} className="overflow-hidden rounded-2xl border border-line">
            {c.photo && <ConceptRender photoUrl={c.photo.url} zone={c.photo.stageZone} ceilingY={c.photo.ceilingY} spec={c.current.spec} title={tu("nameCompare", { name: c.name })} />}
            <div className="p-2 font-display uppercase">{c.name}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[480px] text-sm">
          <thead><tr className="bg-surface-2"><th scope="col" className="p-2 text-left">{tu("spec")}</th>{concepts.map((c) => <th key={c.id} scope="col" className="p-2 text-left">{c.name}</th>)}</tr></thead>
          <tbody>{rows.map(([k, f]) => <tr key={k} className="border-t border-line"><th scope="row" className="p-2 text-left font-bold text-mute">{k}</th>{concepts.map((c) => <td key={c.id} className="p-2">{f(c)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

export function BeforeAfter({ c }: { c: ConceptDto }) {
  const tu = useTranslations("dao");
  const [v, setV] = useState(50);
  if (!c.photo) return null;
  return (
    <section aria-label={tu("beforeAndAfterName", { name: c.name })} className="space-y-2">
      <h3 className="text-xl uppercase">{tu("beforeAfterName", { name: c.name })}</h3>
      <div className="relative overflow-hidden rounded-2xl border border-line">
        <ConceptRender photoUrl={c.photo.url} zone={c.photo.stageZone} ceilingY={c.photo.ceilingY} spec={c.current.spec} title={tu("afterOf", { name: c.name })} />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - v}% 0 0)` }} aria-hidden>
          <ConceptRender photoUrl={c.photo.url} zone={c.photo.stageZone} ceilingY={c.photo.ceilingY} spec={null} title={tu("originalVenuePhoto")} />
          <span className="absolute bottom-2 left-2 rounded-full bg-ink/80 px-2 py-0.5 text-[11px] font-extrabold uppercase">{tu("original")}</span>
        </div>
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-acid" style={{ left: `${v}%` }} aria-hidden />
      </div>
      <label className="block text-sm font-bold">
        {tu("revealOriginalPhotoV", { v })}
        <input type="range" min={0} max={100} value={v} onChange={(e) => setV(Number(e.target.value))} className="mt-1 w-full accent-acid" />
      </label>
    </section>
  );
}

function EditStep({ concepts, active, setActive, onChange, canEdit }: { concepts: ConceptDto[]; active: ConceptDto | null; setActive: (id: string) => void; onChange: (c: ConceptDto) => void; canEdit: boolean }) {
  const tu = useTranslations("dao");
  const { eventId } = useDao();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const prev = useMemo(() => (active && active.versions.length > 1 ? active.versions[active.versions.length - 2] : null), [active]);
  if (!active) return <p className="text-sm text-mute">{tu("generateConceptsFirst")}</p>;
  const send = async (body: { instruction?: string; revertTo?: number }) => {
    setBusy(true);
    setMsg(null);
    const r = await daoApi<{ concept: ConceptDto }>(`${eventId}/stage/concepts/${active.id}/edit`, { method: "POST", json: body });
    setBusy(false);
    if (!r.ok) return setMsg(r.error.message);
    onChange(r.data.concept);
    setText("");
    const v = r.data.concept.current;
    toast({ title: tu("versionVersionCreated", { version: v.version }), body: v.applied.join(" · "), tone: "success" });
  };
  return (
    <section aria-labelledby="edit-h" className="space-y-4">
      <h2 id="edit-h" className="text-2xl uppercase">{tu("n5EditWithWords")}</h2>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0" role="group" aria-label={tu("conceptToEdit")}>
        {concepts.map((c) => <Chip key={c.id} active={active.id === c.id} onClick={() => setActive(c.id)}>{c.name}</Chip>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-[12px] font-extrabold uppercase text-mute">{tu("currentVVersion", { version: active.current.version })}</p>
          {active.photo && <ConceptRender photoUrl={active.photo.url} zone={active.photo.stageZone} ceilingY={active.photo.ceilingY} spec={active.current.spec} title={`${active.name} v${active.current.version}`} className="rounded-2xl" />}
          <p className="text-sm"><b>{tu("aiReferenceEstimate")}</b> {usd(active.current.estimate.low)}–{usd(active.current.estimate.high)}</p>
        </div>
        {prev && active.photo && (
          <div className="space-y-2">
            <p className="text-[12px] font-extrabold uppercase text-mute">{tu("previousVVersion", { version: prev.version })}</p>
            <ConceptRender photoUrl={active.photo.url} zone={active.photo.stageZone} ceilingY={active.photo.ceilingY} spec={prev.spec} title={`${active.name} v${prev.version}`} className="rounded-2xl" />
            <p className="text-sm"><b>{tu("aiReferenceEstimate")}</b> {usd(prev.estimate.low)}–{usd(prev.estimate.high)}</p>
          </div>
        )}
      </div>
      {canEdit ? (
        <div className="neon space-y-3 rounded-[22px] border bg-surface p-4">
          <div className="flex flex-wrap gap-2">
            {EDIT_EXAMPLES.map((x) => <Chip key={x} onClick={() => setText(x)}>{x}</Chip>)}
          </div>
          <Field id="edit-text" label={tu("describeTheChange")} hint={tu("japaneseOrEnglishTheOriginal")}>
            <Textarea id="edit-text" rows={2} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          {msg && <p role="alert" className="text-sm text-coral">{msg}</p>}
          <Button onClick={() => send({ instruction: text })} disabled={busy || text.trim().length < 3}><Wand2 className="size-5" aria-hidden /> {busy ? tu("applying") : tu("applyChange")}</Button>
        </div>
      ) : (
        <Gate reason={tu("onlyStakedMembersCanPost")} />
      )}
      <section aria-labelledby="hist2-h">
        <h3 id="hist2-h" className="flex items-center gap-2 text-lg uppercase"><History className="size-5" aria-hidden />{tu("generationHistory")}</h3>
        <ol className="mt-2 space-y-2">
          {[...active.versions].reverse().map((v) => (
            <li key={v.version} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line p-3 text-sm">
              <div className="min-w-0">
                <b>v{v.version}</b> {v.instruction ? `“${v.instruction}”` : tu("generated")}
                {v.applied.length > 0 && <span className="block text-[12px] text-acid">{v.applied.join(" · ")}</span>}
                {v.ignored.length > 0 && <span className="block text-[12px] text-orange">{tu("notAppliedJoin", { join: v.ignored.join(" · ") })}</span>}
                <span className="block text-[12px] text-mute">{v.provider} · {usd(v.estimate.low)}–{usd(v.estimate.high)}</span>
              </div>
              {v.version !== active.current.version && canEdit && (
                <Button size="sm" variant="ghost" onClick={() => send({ revertTo: v.version })} disabled={busy}><RotateCcw className="size-4" aria-hidden /> {tu("restore")}</Button>
              )}
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
