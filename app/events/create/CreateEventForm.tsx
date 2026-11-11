"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Check, PartyPopper, Save, Sparkles } from "lucide-react";
import { Field, Input, Select, StepProgress, Textarea, ToggleRow } from "@/components/forms/Fields";
import { Button, Chip, DemoBadge, DemoNotice, PageTitle, Card, Tag } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { appNow } from "@/lib/clock";
import { GENRES, VENUES } from "@/lib/data";
import { grantXp, toast, useDemo, useHydrated } from "@/lib/store";
import { LoadingSkeleton } from "@/components/ui/States";
import { cn, money } from "@/lib/utils";
import type { EventDraft, Genre } from "@/lib/types";

const genreEnum = z.enum(GENRES as [Genre, ...Genre[]]);

const schema = z
  .object({
    name: z.string().trim().min(3, "errGiveYourEventAName").max(40, "errKeepItUnder40Characters"),
    genres: z.array(genreEnum).min(1, "errPickAtLeastOneGenre").max(3, "errPickUpTo3Genres"),
    city: z.string().trim().min(2, "errWhereIsItHappening"),
    date: z.string().min(1, "errChooseADate").refine((d) => d >= new Date(appNow()).toISOString().slice(0, 10), "errDateInPast"),
    startTime: z.string().min(1, "errStartTime"),
    endTime: z.string().min(1, "errEndTime"),
    capacity: z.coerce.number().int().min(20, "errAtLeast20People").max(100000, "errThatsAWholePlanet"),
    budget: z.coerce.number().min(0, "errBudgetCantBeNegative"),
    venueMode: z.enum(["select", "recruit"]),
    venueId: z.string().optional(),
    venueWish: z.string().optional(),
    djSlots: z.coerce.number().int().min(0).max(20),
    djGenres: z.array(genreEnum),
    djMinBpm: z.coerce.number().min(60).max(200),
    djMaxBpm: z.coerce.number().min(60).max(220),
    djFee: z.coerce.number().min(0),
    djNotes: z.string().max(400).optional(),
    tickets: z.array(z.object({ kind: z.enum(["main", "afterparty", "allnight", "vip"]), enabled: z.boolean(), price: z.coerce.number().min(0), quantity: z.coerce.number().int().min(0) })),
    afterParty: z.boolean(),
    afterPartyName: z.string().optional(),
    afterPartyVenue: z.string().optional(),
    afterPartyStart: z.string().optional(),
    afterPartyPrice: z.coerce.number().min(0).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.venueMode === "select" && !v.venueId) ctx.addIssue({ code: "custom", path: ["venueId"], message: "errChooseAVenueOrSwitch" });
    if (v.venueMode === "recruit" && !(v.venueWish ?? "").trim()) ctx.addIssue({ code: "custom", path: ["venueWish"], message: "errDescribeTheVenueYoureLooking" });
    if (v.djMaxBpm < v.djMinBpm) ctx.addIssue({ code: "custom", path: ["djMaxBpm"], message: "errMaxBpmMustBeAbove" });
    if (!v.tickets.some((t) => t.enabled)) ctx.addIssue({ code: "custom", path: ["tickets"], message: "errEnableAtLeastOneTicket" });
    if (v.afterParty && !(v.afterPartyName ?? "").trim()) ctx.addIssue({ code: "custom", path: ["afterPartyName"], message: "errNameYourAfterParty" });
  });

type FormValues = z.input<typeof schema>;

/** Five steps (docs/DESIGN_SYSTEM.md · Event create). The data model is unchanged; only the grouping is. */
const STEPS = ["stepBasics", "stepPlaceTime", "stepSizeBudget", "stepTicketsRecruit", "stepReview"] as const;
const STEP_FIELDS: (keyof FormValues)[][] = [
  ["name", "genres"],
  ["city", "date", "startTime", "endTime", "venueMode", "venueId", "venueWish"],
  ["capacity", "budget"],
  ["tickets", "djSlots", "djGenres", "djMinBpm", "djMaxBpm", "djFee", "djNotes", "afterParty", "afterPartyName", "afterPartyVenue", "afterPartyStart", "afterPartyPrice"],
  [],
];

const DEFAULTS: FormValues = {
  name: "",
  genres: [],
  city: "",
  date: "",
  startTime: "22:00",
  endTime: "05:00",
  capacity: 300,
  budget: 5000,
  venueMode: "select",
  venueId: "",
  venueWish: "",
  djSlots: 3,
  djGenres: [],
  djMinBpm: 120,
  djMaxBpm: 135,
  djFee: 300,
  djNotes: "",
  tickets: [
    { kind: "main", enabled: true, price: 25, quantity: 250 },
    { kind: "afterparty", enabled: false, price: 15, quantity: 80 },
    { kind: "allnight", enabled: false, price: 35, quantity: 100 },
    { kind: "vip", enabled: false, price: 70, quantity: 20 },
  ],
  afterParty: false,
  afterPartyName: "",
  afterPartyVenue: "",
  afterPartyStart: "05:00",
  afterPartyPrice: 15,
};

const TICKET_NAMES = { main: "Main Event", afterparty: "After Party", allnight: "All Night Pass", vip: "VIP" };

export function CreateEventForm() {
  const ok = useHydrated();
  if (!ok) return <LoadingSkeleton variant="page" />;
  return <Inner />;
}

function Inner() {
  const tu = useTranslations("events");
  /** Form errors are translation keys (see the schema above); anything else is shown as is. */
  const msg = (m?: string) => (m ? (tu.has(m) ? tu(m) : m) : undefined);
  const router = useRouter();
  const draft = useDemo((s) => s.eventDraft);
  const savedStep = useDemo((s) => s.eventDraftStep);
  const setDraft = useDemo((s) => s.setEventDraft);
  const publish = useDemo((s) => s.publishEvent);
  const reset = useDemo((s) => s.resetEventDraft);
  const [step, setStep] = useState(Math.min(savedStep, STEPS.length - 1));
  const [done, setDone] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { ...DEFAULTS, ...(draft as Partial<FormValues>) },
    mode: "onTouched",
  });
  const { register, control, handleSubmit, trigger, watch, formState: { errors }, setValue, getValues } = form;
  const { fields } = useFieldArray({ control, name: "tickets" });

  // Persist every change to the demo draft (localStorage)
  useEffect(() => {
    const sub = watch((v) => setDraft(v as Partial<EventDraft>));
    return () => sub.unsubscribe();
  }, [watch, setDraft]);

  const go = async (dir: 1 | -1) => {
    if (dir === 1) {
      const valid = await trigger(STEP_FIELDS[step] as never, { shouldFocus: true });
      if (!valid) return;
    }
    const next = Math.max(0, Math.min(STEPS.length - 1, step + dir));
    setStep(next);
    setDraft({}, next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onSubmit = handleSubmit((v) => {
    setDraft(v as unknown as Partial<EventDraft>);
    const ev = publish();
    if (ev) {
      grantXp(120, tu("xpPublishedYourFirstEvent"));
      setDone(ev.name);
    }
  }, () => toast({ title: tu("someStepsNeedAttention"), body: tu("checkTheHighlightedFields"), tone: "error" }));

  const v = watch();

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <PartyPopper className="mx-auto size-14 text-acid" aria-hidden />
        <h1 className="mt-4 text-4xl uppercase">{tu("doneIsLiveDemo", { done })}</h1>
        <p className="mt-3 text-mute">{tu("text4")}</p>
        <div className="mt-6 grid gap-3">
          <Button onClick={() => router.push("/dashboard?role=organizer")} size="lg">{tu("openOrganizerDashboard")}</Button>
          <Button variant="ghost" onClick={() => { setDone(null); setStep(0); form.reset(DEFAULTS); }}>{tu("createAnother")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl md:px-6">
      <PageTitle kicker={tu("createEvent")} title={tu("startARave")} sub={tu("n7")} />
      <StepProgress step={step} total={STEPS.length} labels={STEPS.map((s) => tu(s))} />

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5 px-4 md:px-0">
        {step === 0 && (
          <>
            <Field id="name" label={tu("eventName")} error={msg(errors.name?.message)} hint={tu("neonSlimeSummit")}>
              <Input id="name" autoComplete="off" placeholder={tu("eGGalacticGooGathering")} aria-invalid={!!errors.name} {...register("name")} />
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-sm font-bold">{tu("genres")} <span className="font-semibold text-mute">{tu("upTo3")}</span></legend>
              <Controller
                control={control}
                name="genres"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-2">
                    {GENRES.map((g) => (
                      <Chip key={g} active={field.value.includes(g)} onClick={() => field.onChange(field.value.includes(g) ? field.value.filter((x) => x !== g) : [...field.value, g])}>
                        {g}
                      </Chip>
                    ))}
                  </div>
                )}
              />
              {errors.genres && <p role="alert" className="text-sm font-semibold text-coral">{msg(errors.genres.message)}</p>}
            </fieldset>
          </>
        )}

        {step === 1 && (
          <>
            <Field id="city" label={tu("city")} error={msg(errors.city?.message)}>
              <Input id="city" autoComplete="address-level2" placeholder={tu("tokyo")} list="city-list" aria-invalid={!!errors.city} {...register("city")} />
            </Field>
            <datalist id="city-list">{Array.from(new Set(VENUES.map((x) => x.city))).map((c) => <option key={c} value={c} />)}</datalist>
          </>
        )}

        {step === 1 && (
          <>
            <Field id="date" label={tu("date")} error={msg(errors.date?.message)}>
              <Input id="date" type="date" min={new Date(appNow()).toISOString().slice(0, 10)} aria-invalid={!!errors.date} {...register("date")} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="startTime" label={tu("starts")} error={msg(errors.startTime?.message)}>
                <Input id="startTime" type="time" {...register("startTime")} />
              </Field>
              <Field id="endTime" label={tu("ends")} error={msg(errors.endTime?.message)}>
                <Input id="endTime" type="time" {...register("endTime")} />
              </Field>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Field id="capacity" label={tu("expectedAttendance")} error={msg(errors.capacity?.message)}>
              <Input id="capacity" type="number" inputMode="numeric" {...register("capacity")} />
            </Field>
            <Field id="budget" label={tu("budgetUsd")} hint={tu("dj")} error={msg(errors.budget?.message)}>
              <Input id="budget" type="number" inputMode="numeric" {...register("budget")} />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={tu("venueOption")}>
              {(["select", "recruit"] as const).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={v.venueMode === m} onClick={() => setValue("venueMode", m)} className={cn("min-h-14 rounded-2xl border-2 px-3 font-bold", v.venueMode === m ? "border-acid bg-acid/10" : "border-line")}>
                  {m === "select" ? tu("chooseAVenue") : tu("recruitAVenue")}
                </button>
              ))}
            </div>
            {v.venueMode === "select" ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-bold">{tu("availableVenuesDemo")}</legend>
                {[...VENUES].sort((a, b) => Number(b.city.toLowerCase() === (v.city ?? "").trim().toLowerCase()) - Number(a.city.toLowerCase() === (v.city ?? "").trim().toLowerCase())).map((x) => (
                  <label key={x.id} className={cn("flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 p-3", v.venueId === x.id ? "border-acid bg-acid/10" : "border-line")}>
                    <input type="radio" value={x.id} {...register("venueId")} className="size-5 accent-acid" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{x.name}</span>
                      <span className="block text-xs text-mute">{tu("cityCapCapacityMoneyH", { city: x.city, capacity: x.capacity, money: money(x.hourlyRate) })}</span>
                    </span>
                  </label>
                ))}
                {errors.venueId && <p role="alert" className="text-sm font-semibold text-coral">{msg(errors.venueId.message)}</p>}
              </fieldset>
            ) : (
              <Field id="venueWish" label={tu("whatKindOfVenueDo")} error={msg(errors.venueWish?.message)} hint={tu("text5")}>
                <Textarea id="venueWish" placeholder={tu("warehouseFor500PeopleLate")} {...register("venueWish")} />
              </Field>
            )}
            <Link href="/venues/planner" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-purple"><Sparkles className="size-4" aria-hidden /> {tu("notSureTryTheAi")}</Link>
          </>
        )}

        {step === 3 && (
          <>
            <Field id="djSlots" label={tu("openDjSlots")} error={msg(errors.djSlots?.message)}>
              <Input id="djSlots" type="number" inputMode="numeric" {...register("djSlots")} />
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-sm font-bold">{tu("wantedGenres")}</legend>
              <Controller control={control} name="djGenres" render={({ field }) => (
                <div className="flex flex-wrap gap-2">
                  {GENRES.map((g) => (
                    <Chip key={g} active={field.value.includes(g)} onClick={() => field.onChange(field.value.includes(g) ? field.value.filter((x) => x !== g) : [...field.value, g])}>{g}</Chip>
                  ))}
                </div>
              )} />
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <Field id="djMinBpm" label={tu("minBpm")} error={msg(errors.djMinBpm?.message)}><Input id="djMinBpm" type="number" inputMode="numeric" {...register("djMinBpm")} /></Field>
              <Field id="djMaxBpm" label={tu("maxBpm")} error={msg(errors.djMaxBpm?.message)}><Input id="djMaxBpm" type="number" inputMode="numeric" {...register("djMaxBpm")} /></Field>
            </div>
            <Field id="djFee" label={tu("feePerSetUsd")} error={msg(errors.djFee?.message)}><Input id="djFee" type="number" inputMode="numeric" {...register("djFee")} /></Field>
            <Field id="djNotes" label={tu("notesForApplicants")} optional><Textarea id="djNotes" placeholder={tu("n30MinAuditionRequiredBring")} {...register("djNotes")} /></Field>
          </>
        )}

        {step === 3 && (
          <fieldset className="space-y-3">
            <legend className="text-sm font-bold">{tu("ticketTypes")}</legend>
            {fields.map((f, i) => (
              <Card key={f.id} className="p-4">
                <Controller control={control} name={`tickets.${i}.enabled`} render={({ field }) => (
                  <ToggleRow checked={field.value} onChange={field.onChange} label={TICKET_NAMES[f.kind]} />
                )} />
                {v.tickets?.[i]?.enabled && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Field id={`tp${i}`} label={tu("priceUsd")}><Input id={`tp${i}`} type="number" inputMode="decimal" {...register(`tickets.${i}.price`)} /></Field>
                    <Field id={`tq${i}`} label={tu("quantity")}><Input id={`tq${i}`} type="number" inputMode="numeric" {...register(`tickets.${i}.quantity`)} /></Field>
                  </div>
                )}
              </Card>
            ))}
            {msg(errors.tickets?.root?.message) || msg(errors.tickets?.message) ? <p role="alert" className="text-sm font-semibold text-coral">{msg(errors.tickets?.root?.message) ?? msg(errors.tickets?.message)}</p> : null}
          </fieldset>
        )}

        {step === 3 && (
          <>
            <Controller control={control} name="afterParty" render={({ field }) => (
              <ToggleRow checked={field.value} onChange={field.onChange} label={tu("addAnAfterParty")} sub={tu("text6")} />
            )} />
            {v.afterParty && (
              <>
                <Field id="afterPartyName" label={tu("afterPartyName")} error={msg(errors.afterPartyName?.message)}><Input id="afterPartyName" placeholder={tu("sunriseSlime")} {...register("afterPartyName")} /></Field>
                <Field id="afterPartyVenue" label={tu("venue")} optional><Input id="afterPartyVenue" {...register("afterPartyVenue")} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field id="afterPartyStart" label={tu("starts")}><Input id="afterPartyStart" type="time" {...register("afterPartyStart")} /></Field>
                  <Field id="afterPartyPrice" label={tu("priceUsd")}><Input id="afterPartyPrice" type="number" inputMode="decimal" {...register("afterPartyPrice")} /></Field>
                </div>
              </>
            )}
          </>
        )}

        {step === 4 && <Review values={getValues()} onEdit={(s) => setStep(s)} />}

        <div className="flex items-center gap-3 pt-2">
          {step > 0 && (
            <Button variant="ghost" onClick={() => go(-1)}>
              <ArrowLeft className="size-4" aria-hidden /> {tu("back")}
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button key="next" className="ml-auto flex-1 sm:flex-none" onClick={() => go(1)}>
              {tu("next")} <ArrowRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button key="submit" type="submit" className="ml-auto flex-1 sm:flex-none" size="lg">
              <Check className="size-5" aria-hidden /> {tu("publishDemo")}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-mute">
          <span className="inline-flex items-center gap-1"><Save className="size-3.5" aria-hidden /> {tu("draftAutoSavedInThis")}</span>
          <button type="button" className="min-h-11 font-bold text-coral" onClick={() => { reset(); form.reset(DEFAULTS); setStep(0); toast({ title: tu("draftCleared") }); }}>{tu("clearDraft")}</button>
        </div>
      </form>
      <DemoNotice className="mx-4 mt-6 md:mx-0">{tu("publishingSavesTheEventIn")}</DemoNotice>
    </div>
  );
}

function Review({ values: v, onEdit }: { values: FormValues; onEdit: (s: number) => void }) {
  const tu = useTranslations("events");
  const venue = VENUES.find((x) => x.id === v.venueId);
  const rows: [string, string, number][] = [
    [tu("name"), v.name, 0],
    [tu("genres"), v.genres.join(", "), 0],
    [tu("city"), v.city, 0],
    [tu("when"), `${v.date} · ${v.startTime}–${v.endTime}`, 1],
    [tu("venue"), v.venueMode === "select" ? venue?.name ?? "—" : tu("reviewRecruiting", { wish: v.venueWish ?? "" }), 1],
    [tu("sizeBudget"), tu("reviewSize", { n: Number(v.capacity), budget: money(Number(v.budget)) }), 2],
    [tu("tickets"), v.tickets.filter((t) => t.enabled).map((t) => `${TICKET_NAMES[t.kind]} ${money(Number(t.price))}`).join(", "), 3],
    [tu("djCall"), tu("reviewDjCall", { n: Number(v.djSlots), min: Number(v.djMinBpm), max: Number(v.djMaxBpm), fee: money(Number(v.djFee)) }), 3],
    [tu("afterParty"), v.afterParty ? `${v.afterPartyName} · ${v.afterPartyStart}` : tu("none"), 3],
  ];
  return (
    <>
    {/* Preview: how the listing will read on the events page (card order of the design system). */}
    <section aria-label={tu("preview")} className="rounded-[20px] border border-line bg-surface-2 p-4" data-testid="create-preview">
      <p className="text-[12px] font-extrabold uppercase tracking-wider text-mute">{tu("preview")}</p>
      <h3 className="mt-2 text-[18px] uppercase leading-tight">{v.name || "—"}</h3>
      <p className="mt-1 text-[14px] text-mute">{v.date || "—"} · {v.startTime}–{v.endTime}</p>
      <p className="text-[14px] text-mute">{v.city || "—"}{venue ? ` · ${venue.name}` : ""}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">{v.genres.map((g) => <Tag key={g}>{g}</Tag>)}</div>
      <div className="mt-2 flex flex-wrap gap-1.5"><StatusBadge status="funding" /><DemoBadge /></div>
    </section>
    <dl className="divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-surface">
      {rows.map(([k, val, s]) => (
        <div key={k} className="flex items-start gap-3 p-4">
          <dt className="w-28 shrink-0 text-sm font-bold text-mute">{k}</dt>
          <dd className="min-w-0 flex-1 text-sm">{val || "—"}</dd>
          <button type="button" onClick={() => onEdit(s)} className="-my-2 min-h-11 shrink-0 text-sm font-bold text-acid" aria-label={tu("editK", { k })}>{tu("edit")}</button>
        </div>
      ))}
    </dl>
    </>
  );
}
