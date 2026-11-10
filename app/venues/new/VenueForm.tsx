"use client";

import { Tx } from "@/components/i18n/Tx";

import { type Tu } from "@/lib/i18n/tu";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Check, ImagePlus, Trash2 } from "lucide-react";
import { Field, Input, StepProgress, Textarea } from "@/components/forms/Fields";
import { Button, Chip, DemoNotice, PageTitle } from "@/components/ui/primitives";
import { LoadingSkeleton } from "@/components/ui/States";
import { grantXp, toast, useDemo, useHydrated } from "@/lib/store";
import type { Amenity } from "@/lib/types";
import { cn, money } from "@/lib/utils";

// Equipment values are data (stored on the venue); the UI shows them through tx() from the labels namespace.
const AMENITIES: Amenity[] = ["Funktion-One", "Void Acoustics", "CDJ-3000", "Technics 1200", "Lasers", "LED Wall", "Bar", "Kitchen", "Outdoor Area", "Green Room", "Step-free Access", "Coat Check"]; // i18n-ignore
const STEPS = ["stepDetails", "stepPhotos", "stepAddressPrice", "stepEquipment", "stepDatesPublish"] as const;

const stepSchemas = (tu: Tu) => ([
  z.object({ name: z.string().trim().min(2, tu("errVenueNameIsRequired")), city: z.string().trim().min(2, tu("errCityIsRequired")), description: z.string().trim().min(10, tu("errDescribeTheSpace10Characters")) }),
  z.object({}),
  z.object({ address: z.string().trim().min(4, tu("errAddressIsRequired")), capacity: z.number({ message: tu("capacityIsRequired") }).int().min(10, tu("errAtLeast10")), hourlyRate: z.number({ message: tu("priceIsRequired") }).min(1, tu("errSetAnHourlyPrice")) }),
  z.object({ amenities: z.array(z.string()).min(1, tu("errPickAtLeastOne")) }),
  z.object({ availableDates: z.array(z.string()).min(1, tu("errPickAtLeastOneAvailable")) }),
]);

/** Downscale an uploaded image so the demo can keep it in localStorage. */
function resize(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 560 / img.width);
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = rej;
    img.src = url;
  });
}

export function VenueForm() {
  const ok = useHydrated();
  return ok ? <Inner /> : <LoadingSkeleton variant="page" />;
}

function Inner() {
  const tu = useTranslations("venues");
  const router = useRouter();
  const d = useDemo((s) => s.venueDraft);
  const savedStep = useDemo((s) => s.venueDraftStep);
  const setD = useDemo((s) => s.setVenueDraft);
  const publish = useDemo((s) => s.publishVenue);
  const [step, setStep] = useState(savedStep);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dates = Array.from({ length: 28 }, (_, i) => new Date(Date.UTC(2026, 10, 10 + i)).toISOString().slice(0, 10));

  const validate = (s: number) => {
    const r = stepSchemas(tu)[s].safeParse(d);
    if (r.success) {
      setErrors({});
      return true;
    }
    const e: Record<string, string> = {};
    r.error.issues.forEach((i) => (e[String(i.path[0])] = i.message));
    setErrors(e);
    setTimeout(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus(), 0);
    return false;
  };
  const go = (n: number) => {
    if (n > step && !validate(step)) return;
    setStep(n);
    setD({}, n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const cur = d.photos ?? [];
    const room = 4 - cur.length;
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, room);
    try {
      const out = await Promise.all(picked.map(resize));
      setD({ photos: [...cur, ...out] });
    } catch {
      toast({ title: tu("couldntReadThatImage"), tone: "error" });
    }
  };
  const finish = () => {
    if (!validate(4)) return;
    const v = publish();
    if (v) {
      grantXp(100, tu("xpListedAVenue"));
      toast({ title: tu("venueListedDemo"), body: tu("savedInThisBrowserOnly"), tone: "success" });
      router.push(`/venues/${v.id}`);
    }
  };

  return (
    <div className="mx-auto max-w-2xl md:px-6">
      <PageTitle kicker={tu("venueMarket")} title={tu("listYourVenue")} sub={tu("n5")} />
      <StepProgress step={step} total={STEPS.length} labels={STEPS.map((s) => tu(s))} />
      <div className="mt-6 space-y-5 px-4 md:px-0">
        {step === 0 && (
          <>
            <Field id="vn" label={tu("venueName")} error={errors.name}><Input id="vn" value={d.name ?? ""} aria-invalid={!!errors.name} onChange={(e) => setD({ name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="vc" label={tu("city")} error={errors.city}><Input id="vc" autoComplete="address-level2" value={d.city ?? ""} aria-invalid={!!errors.city} onChange={(e) => setD({ city: e.target.value })} /></Field>
              <Field id="vco" label={tu("country")} optional><Input id="vco" autoComplete="country-name" value={d.country ?? ""} onChange={(e) => setD({ country: e.target.value })} /></Field>
            </div>
            <Field id="vd" label={tu("description")} error={errors.description}><Textarea id="vd" value={d.description ?? ""} aria-invalid={!!errors.description} onChange={(e) => setD({ description: e.target.value })} /></Field>
          </>
        )}
        {step === 1 && (
          <div>
            <p className="text-sm text-mute">{tu("upTo4PhotosImages")}</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {(d.photos ?? []).map((p, i) => (
                <div key={i} className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p} alt={tu("uploadedPhotoValue", { value: i + 1 })} className="h-full w-full object-cover" />
                  <button type="button" aria-label={tu("removePhotoValue", { value: i + 1 })} onClick={() => setD({ photos: (d.photos ?? []).filter((_, k) => k !== i) })} className="absolute right-1.5 top-1.5 inline-flex size-11 items-center justify-center rounded-full bg-ink/85"><Trash2 className="size-4" /></button>
                </div>
              ))}
              {(d.photos?.length ?? 0) < 4 && (
                <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line text-sm font-bold hover:border-acid focus-within:border-acid">
                  <ImagePlus className="size-7 text-acid" aria-hidden />
                  {tu("addPhotos")}
                  <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} />
                </label>
              )}
            </div>
          </div>
        )}
        {step === 2 && (
          <>
            <Field id="va" label={tu("address")} error={errors.address}><Input id="va" autoComplete="street-address" value={d.address ?? ""} aria-invalid={!!errors.address} onChange={(e) => setD({ address: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="vcap" label={tu("capacity")} error={errors.capacity}><Input id="vcap" type="number" inputMode="numeric" value={d.capacity ?? ""} aria-invalid={!!errors.capacity} onChange={(e) => setD({ capacity: e.target.value ? +e.target.value : undefined })} /></Field>
              <Field id="vrate" label={tu("priceHourUsd")} error={errors.hourlyRate}><Input id="vrate" type="number" inputMode="numeric" value={d.hourlyRate ?? ""} aria-invalid={!!errors.hourlyRate} onChange={(e) => setD({ hourlyRate: e.target.value ? +e.target.value : undefined })} /></Field>
            </div>
          </>
        )}
        {step === 3 && (
          <fieldset>
            <legend className="text-sm font-bold">{tu("equipmentFacilities")}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {AMENITIES.map((a) => {
                const on = (d.amenities ?? []).includes(a);
                return <Chip key={a} active={on} onClick={() => setD({ amenities: on ? (d.amenities ?? []).filter((x) => x !== a) : [...(d.amenities ?? []), a] })}><Tx>{a}</Tx></Chip>;
              })}
            </div>
            {errors.amenities && <p role="alert" className="mt-2 text-sm font-semibold text-coral">{errors.amenities}</p>}
          </fieldset>
        )}
        {step === 4 && (
          <>
            <fieldset>
              <legend className="text-sm font-bold">{tu("availableDatesNext4Weeks")}</legend>
              <div className="mt-2 grid grid-cols-7 gap-1.5">
                {dates.map((iso) => {
                  const on = (d.availableDates ?? []).includes(iso);
                  const dt = new Date(iso + "T00:00:00Z");
                  return (
                    <button key={iso} type="button" aria-pressed={on} aria-label={dt.toDateString()} onClick={() => setD({ availableDates: on ? (d.availableDates ?? []).filter((x) => x !== iso) : [...(d.availableDates ?? []), iso].sort() })} className={cn("flex min-h-12 flex-col items-center justify-center rounded-xl border-2 text-xs font-bold", on ? "border-acid bg-acid text-ink" : "border-line")}>
                      <span className="opacity-70">{dt.toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" })}</span>
                      {dt.getUTCDate()}
                    </button>
                  );
                })}
              </div>
              {errors.availableDates && <p role="alert" className="mt-2 text-sm font-semibold text-coral">{errors.availableDates}</p>}
            </fieldset>
            <dl className="divide-y divide-line rounded-3xl border border-line bg-surface text-sm">
              {[[tu("name"), d.name], [tu("city"), d.city], [tu("photos"), `${d.photos?.length ?? 0}`], [tu("capacity"), d.capacity], [tu("price"), d.hourlyRate ? `${money(d.hourlyRate)}/h` : ""], [tu("equipment"), (d.amenities ?? []).join(", ")], [tu("dates"), tu("datesSelected", { n: d.availableDates?.length ?? 0 })]].map(([k, v]) => (
                <div key={k as string} className="flex gap-3 p-3"><dt className="w-24 shrink-0 font-bold text-mute">{k}</dt><dd className="min-w-0">{String(v ?? "—") || "—"}</dd></div>
              ))}
            </dl>
            <DemoNotice>{tu("publishingSavesTheListingIn")}</DemoNotice>
          </>
        )}
        <div className="flex gap-3 pt-2">
          {step > 0 && <Button variant="ghost" onClick={() => go(step - 1)}><ArrowLeft className="size-4" aria-hidden /> {tu("back")}</Button>}
          {step < STEPS.length - 1 ? (
            <Button className="ml-auto flex-1 sm:flex-none" onClick={() => go(step + 1)}>{tu("next")} <ArrowRight className="size-4" aria-hidden /></Button>
          ) : (
            <Button className="ml-auto flex-1 sm:flex-none" onClick={finish}><Check className="size-4" aria-hidden /> {tu("publishListing")}</Button>
          )}
        </div>
      </div>
    </div>
  );
}
