"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Check, PartyPopper, Save, Sparkles } from "lucide-react";
import { Field, Input, Select, StepProgress, Textarea, ToggleRow } from "@/components/forms/Fields";
import { Button, Chip, DemoNotice, PageTitle, Card } from "@/components/ui/primitives";
import { GENRES, VENUES } from "@/lib/data";
import { grantXp, toast, useDemo, useHydrated } from "@/lib/store";
import { LoadingSkeleton } from "@/components/ui/States";
import { cn, money } from "@/lib/utils";
import type { EventDraft, Genre } from "@/lib/types";

const genreEnum = z.enum(GENRES as [Genre, ...Genre[]]);

const schema = z
  .object({
    name: z.string().trim().min(3, "Give your event a name (3+ characters)").max(40, "Keep it under 40 characters"),
    genres: z.array(genreEnum).min(1, "Pick at least one genre").max(3, "Pick up to 3 genres"),
    city: z.string().trim().min(2, "Where is it happening?"),
    date: z.string().min(1, "Choose a date"),
    startTime: z.string().min(1, "Start time"),
    endTime: z.string().min(1, "End time"),
    capacity: z.coerce.number().int().min(20, "At least 20 people").max(100000, "That’s a whole planet"),
    budget: z.coerce.number().min(0, "Budget can’t be negative"),
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
    if (v.venueMode === "select" && !v.venueId) ctx.addIssue({ code: "custom", path: ["venueId"], message: "Choose a venue or switch to recruiting" });
    if (v.venueMode === "recruit" && !(v.venueWish ?? "").trim()) ctx.addIssue({ code: "custom", path: ["venueWish"], message: "Describe the venue you’re looking for" });
    if (v.djMaxBpm < v.djMinBpm) ctx.addIssue({ code: "custom", path: ["djMaxBpm"], message: "Max BPM must be above min BPM" });
    if (!v.tickets.some((t) => t.enabled)) ctx.addIssue({ code: "custom", path: ["tickets"], message: "Enable at least one ticket type" });
    if (v.afterParty && !(v.afterPartyName ?? "").trim()) ctx.addIssue({ code: "custom", path: ["afterPartyName"], message: "Name your after party" });
  });

type FormValues = z.input<typeof schema>;

const STEPS = ["Basics", "Date & size", "Venue", "DJ call", "Tickets", "After party", "Review"];
const STEP_FIELDS: (keyof FormValues)[][] = [
  ["name", "genres", "city"],
  ["date", "startTime", "endTime", "capacity", "budget"],
  ["venueMode", "venueId", "venueWish"],
  ["djSlots", "djGenres", "djMinBpm", "djMaxBpm", "djFee", "djNotes"],
  ["tickets"],
  ["afterParty", "afterPartyName", "afterPartyVenue", "afterPartyStart", "afterPartyPrice"],
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
      grantXp(120, "Published your first event");
      setDone(ev.name);
    }
  }, () => toast({ title: "Some steps need attention", body: "Check the highlighted fields.", tone: "error" }));

  const v = watch();

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <PartyPopper className="mx-auto size-14 text-acid" aria-hidden />
        <h1 className="mt-4 text-4xl uppercase">{done} is live (demo)</h1>
        <p className="ja mt-3 text-mute">イベントはこのブラウザ内に保存されました。主催者ダッシュボードで管理できます。実際には公開されていません。</p>
        <div className="mt-6 grid gap-3">
          <Button onClick={() => router.push("/dashboard?role=organizer")} size="lg">Open organizer dashboard</Button>
          <Button variant="ghost" onClick={() => { setDone(null); setStep(0); form.reset(DEFAULTS); }}>Create another</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl md:px-6">
      <PageTitle kicker="Create event" title="Start a rave" sub="7ステップでイベントを作成。入力内容は自動で保存されます。" />
      <StepProgress step={step} total={STEPS.length} labels={STEPS} />

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5 px-4 md:px-0">
        {step === 0 && (
          <>
            <Field id="name" label="Event name" error={errors.name?.message} hint="例: NEON SLIME SUMMIT">
              <Input id="name" autoComplete="off" placeholder="e.g. GALACTIC GOO GATHERING" aria-invalid={!!errors.name} {...register("name")} />
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-sm font-bold">Genres <span className="font-semibold text-mute">(up to 3)</span></legend>
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
              {errors.genres && <p role="alert" className="text-sm font-semibold text-coral">{errors.genres.message}</p>}
            </fieldset>
            <Field id="city" label="City" error={errors.city?.message}>
              <Input id="city" autoComplete="address-level2" placeholder="Tokyo" list="city-list" aria-invalid={!!errors.city} {...register("city")} />
            </Field>
            <datalist id="city-list">{Array.from(new Set(VENUES.map((x) => x.city))).map((c) => <option key={c} value={c} />)}</datalist>
          </>
        )}

        {step === 1 && (
          <>
            <Field id="date" label="Date" error={errors.date?.message}>
              <Input id="date" type="date" min="2026-11-10" aria-invalid={!!errors.date} {...register("date")} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="startTime" label="Starts" error={errors.startTime?.message}>
                <Input id="startTime" type="time" {...register("startTime")} />
              </Field>
              <Field id="endTime" label="Ends" error={errors.endTime?.message}>
                <Input id="endTime" type="time" {...register("endTime")} />
              </Field>
            </div>
            <Field id="capacity" label="Expected attendance" error={errors.capacity?.message}>
              <Input id="capacity" type="number" inputMode="numeric" {...register("capacity")} />
            </Field>
            <Field id="budget" label="Budget (USD)" hint="会場費・DJ費・機材費などの合計目安" error={errors.budget?.message}>
              <Input id="budget" type="number" inputMode="numeric" {...register("budget")} />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Venue option">
              {(["select", "recruit"] as const).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={v.venueMode === m} onClick={() => setValue("venueMode", m)} className={cn("min-h-14 rounded-2xl border-2 px-3 font-bold", v.venueMode === m ? "border-acid bg-acid/10" : "border-line")}>
                  {m === "select" ? "Choose a venue" : "Recruit a venue"}
                </button>
              ))}
            </div>
            {v.venueMode === "select" ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-bold">Available venues (demo)</legend>
                {[...VENUES].sort((a, b) => Number(b.city.toLowerCase() === (v.city ?? "").trim().toLowerCase()) - Number(a.city.toLowerCase() === (v.city ?? "").trim().toLowerCase())).map((x) => (
                  <label key={x.id} className={cn("flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 p-3", v.venueId === x.id ? "border-acid bg-acid/10" : "border-line")}>
                    <input type="radio" value={x.id} {...register("venueId")} className="size-5 accent-[#B6F05C]" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{x.name}</span>
                      <span className="block text-xs text-mute">{x.city} · cap {x.capacity} · {money(x.hourlyRate)}/h</span>
                    </span>
                  </label>
                ))}
                {errors.venueId && <p role="alert" className="text-sm font-semibold text-coral">{errors.venueId.message}</p>}
              </fieldset>
            ) : (
              <Field id="venueWish" label="What kind of venue do you need?" error={errors.venueWish?.message} hint="会場オーナーに募集が公開されます（デモ）">
                <Textarea id="venueWish" placeholder="Warehouse for ~500 people, late licence, good sound system…" {...register("venueWish")} />
              </Field>
            )}
            <Link href="/venues/planner" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-purple"><Sparkles className="size-4" aria-hidden /> Not sure? Try the AI event planner (demo)</Link>
          </>
        )}

        {step === 3 && (
          <>
            <Field id="djSlots" label="Open DJ slots" error={errors.djSlots?.message}>
              <Input id="djSlots" type="number" inputMode="numeric" {...register("djSlots")} />
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-sm font-bold">Wanted genres</legend>
              <Controller control={control} name="djGenres" render={({ field }) => (
                <div className="flex flex-wrap gap-2">
                  {GENRES.map((g) => (
                    <Chip key={g} active={field.value.includes(g)} onClick={() => field.onChange(field.value.includes(g) ? field.value.filter((x) => x !== g) : [...field.value, g])}>{g}</Chip>
                  ))}
                </div>
              )} />
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <Field id="djMinBpm" label="Min BPM" error={errors.djMinBpm?.message}><Input id="djMinBpm" type="number" inputMode="numeric" {...register("djMinBpm")} /></Field>
              <Field id="djMaxBpm" label="Max BPM" error={errors.djMaxBpm?.message}><Input id="djMaxBpm" type="number" inputMode="numeric" {...register("djMaxBpm")} /></Field>
            </div>
            <Field id="djFee" label="Fee per set (USD)" error={errors.djFee?.message}><Input id="djFee" type="number" inputMode="numeric" {...register("djFee")} /></Field>
            <Field id="djNotes" label="Notes for applicants" optional><Textarea id="djNotes" placeholder="30-min audition required. Bring USB + headphones." {...register("djNotes")} /></Field>
          </>
        )}

        {step === 4 && (
          <fieldset className="space-y-3">
            <legend className="text-sm font-bold">Ticket types</legend>
            {fields.map((f, i) => (
              <Card key={f.id} className="p-4">
                <Controller control={control} name={`tickets.${i}.enabled`} render={({ field }) => (
                  <ToggleRow checked={field.value} onChange={field.onChange} label={TICKET_NAMES[f.kind]} />
                )} />
                {v.tickets?.[i]?.enabled && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Field id={`tp${i}`} label="Price (USD)"><Input id={`tp${i}`} type="number" inputMode="decimal" {...register(`tickets.${i}.price`)} /></Field>
                    <Field id={`tq${i}`} label="Quantity"><Input id={`tq${i}`} type="number" inputMode="numeric" {...register(`tickets.${i}.quantity`)} /></Field>
                  </div>
                )}
              </Card>
            ))}
            {errors.tickets?.root?.message || errors.tickets?.message ? <p role="alert" className="text-sm font-semibold text-coral">{errors.tickets?.root?.message ?? errors.tickets?.message}</p> : null}
          </fieldset>
        )}

        {step === 5 && (
          <>
            <Controller control={control} name="afterParty" render={({ field }) => (
              <ToggleRow checked={field.value} onChange={field.onChange} label="Add an after party" sub="メインイベントに紐づくアフターパーティーを作成" />
            )} />
            {v.afterParty && (
              <>
                <Field id="afterPartyName" label="After party name" error={errors.afterPartyName?.message}><Input id="afterPartyName" placeholder="SUNRISE SLIME" {...register("afterPartyName")} /></Field>
                <Field id="afterPartyVenue" label="Venue" optional><Input id="afterPartyVenue" {...register("afterPartyVenue")} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field id="afterPartyStart" label="Starts"><Input id="afterPartyStart" type="time" {...register("afterPartyStart")} /></Field>
                  <Field id="afterPartyPrice" label="Price (USD)"><Input id="afterPartyPrice" type="number" inputMode="decimal" {...register("afterPartyPrice")} /></Field>
                </div>
              </>
            )}
          </>
        )}

        {step === 6 && <Review values={getValues()} onEdit={(s) => setStep(s)} />}

        <div className="flex items-center gap-3 pt-2">
          {step > 0 && (
            <Button variant="ghost" onClick={() => go(-1)}>
              <ArrowLeft className="size-4" aria-hidden /> Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button key="next" className="ml-auto flex-1 sm:flex-none" onClick={() => go(1)}>
              Next <ArrowRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button key="submit" type="submit" className="ml-auto flex-1 sm:flex-none" size="lg">
              <Check className="size-5" aria-hidden /> Publish (demo)
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-mute">
          <span className="inline-flex items-center gap-1"><Save className="size-3.5" aria-hidden /> Draft auto-saved in this browser</span>
          <button type="button" className="min-h-11 font-bold text-coral" onClick={() => { reset(); form.reset(DEFAULTS); setStep(0); toast({ title: "Draft cleared" }); }}>Clear draft</button>
        </div>
      </form>
      <DemoNotice className="mx-4 mt-6 md:mx-0">Publishing saves the event in your browser only. It will not appear publicly or on the map in Phase 1.</DemoNotice>
    </div>
  );
}

function Review({ values: v, onEdit }: { values: FormValues; onEdit: (s: number) => void }) {
  const venue = VENUES.find((x) => x.id === v.venueId);
  const rows: [string, string, number][] = [
    ["Name", v.name, 0],
    ["Genres", v.genres.join(", "), 0],
    ["City", v.city, 0],
    ["When", `${v.date} · ${v.startTime}–${v.endTime}`, 1],
    ["Size & budget", `${v.capacity} people · ${money(Number(v.budget))}`, 1],
    ["Venue", v.venueMode === "select" ? venue?.name ?? "—" : `Recruiting: ${v.venueWish}`, 2],
    ["DJ call", `${v.djSlots} slots · ${v.djMinBpm}–${v.djMaxBpm} BPM · ${money(Number(v.djFee))}/set`, 3],
    ["Tickets", v.tickets.filter((t) => t.enabled).map((t) => `${TICKET_NAMES[t.kind]} ${money(Number(t.price))}`).join(", "), 4],
    ["After party", v.afterParty ? `${v.afterPartyName} · ${v.afterPartyStart}` : "None", 5],
  ];
  return (
    <dl className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
      {rows.map(([k, val, s]) => (
        <div key={k} className="flex items-start gap-3 p-4">
          <dt className="w-28 shrink-0 text-sm font-bold text-mute">{k}</dt>
          <dd className="min-w-0 flex-1 text-sm">{val || "—"}</dd>
          <button type="button" onClick={() => onEdit(s)} className="-my-2 min-h-11 shrink-0 text-sm font-bold text-acid" aria-label={`Edit ${k}`}>Edit</button>
        </div>
      ))}
    </dl>
  );
}
