"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Check, Mic2 } from "lucide-react";
import { Field, Input, Select, StepProgress, Textarea } from "@/components/forms/Fields";
import { Button, Chip, DemoNotice, PageTitle } from "@/components/ui/primitives";
import { EVENTS, GENRES } from "@/lib/data";
import { grantXp, uid, useDemo } from "@/lib/store";
import type { Genre } from "@/lib/types";

const schema = z.object({
  djName: z.string().trim().min(2, "Your DJ name"),
  city: z.string().trim().min(2, "Where are you based?"),
  genres: z.array(z.enum(GENRES as [Genre, ...Genre[]])).min(1, "Pick at least one genre"),
  bpm: z.coerce.number().min(60, "60–200").max(200, "60–200"),
  eventId: z.string().min(1, "Choose an event"),
  mixUrl: z.string().trim().url("Paste a full link, e.g. https://…"),
  message: z.string().trim().min(10, "Tell the organizer a little more (10+ characters)").max(500),
});
type V = z.input<typeof schema>;
const STEP_FIELDS: (keyof V)[][] = [["djName", "city", "genres", "bpm"], ["eventId", "mixUrl", "message"]];

export function DJApplyForm() {
  const params = useSearchParams();
  const router = useRouter();
  const add = useDemo((s) => s.addApplication);
  const [step, setStep] = useState(0);
  const [sent, setSent] = useState(false);
  const recruiting = EVENTS.filter((e) => e.djRecruiting);
  const pre = params.get("event");
  const { register, control, handleSubmit, trigger, formState: { errors }, getValues } = useForm<V>({
    resolver: zodResolver(schema),
    defaultValues: { djName: "", city: "", genres: [], bpm: 128, eventId: pre && EVENTS.some((e) => e.id === pre) ? pre : "", mixUrl: "", message: "" },
    mode: "onTouched",
  });

  const submit = handleSubmit((v) => {
    add({ id: uid("app"), eventId: v.eventId, djName: v.djName, genres: v.genres as Genre[], bpm: Number(v.bpm), city: v.city, mixUrl: v.mixUrl, message: v.message, createdAt: new Date().toISOString(), status: "pending" });
    grantXp(50, "Applied to play an event");
    setSent(true);
  });

  if (sent) {
    const e = EVENTS.find((x) => x.id === getValues("eventId"));
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <Mic2 className="mx-auto size-14 text-purple" aria-hidden />
        <h1 className="mt-4 text-4xl uppercase">Application saved</h1>
        <p className="ja mt-3 text-mute">{e?.name} への応募をデモとして保存しました。主催者ダッシュボードとDJダッシュボードで確認できます（実際には送信されません）。</p>
        <div className="mt-6 grid gap-3">
          <Button size="lg" onClick={() => router.push("/dashboard?role=dj")}>Open DJ dashboard</Button>
          <Button variant="ghost" onClick={() => router.push(`/events/${e?.id ?? ""}`)}>Back to event</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl md:px-6">
      <PageTitle kicker="DJ Arena" title="Apply as DJ" sub="プロフィールと応募内容の2ステップ。採用されると30分のオーディション枠が割り当てられます。" />
      <StepProgress step={step} total={2} labels={["Your profile", "Application"]} />
      <form onSubmit={submit} noValidate className="mt-6 space-y-5 px-4 md:px-0">
        {step === 0 ? (
          <>
            <Field id="djName" label="DJ name" error={errors.djName?.message}><Input id="djName" autoComplete="nickname" {...register("djName")} aria-invalid={!!errors.djName} /></Field>
            <Field id="city" label="City" error={errors.city?.message}><Input id="city" autoComplete="address-level2" {...register("city")} aria-invalid={!!errors.city} /></Field>
            <fieldset className="space-y-2">
              <legend className="text-sm font-bold">Genres</legend>
              <Controller control={control} name="genres" render={({ field }) => (
                <div className="flex flex-wrap gap-2">{GENRES.map((g) => <Chip key={g} active={field.value.includes(g)} onClick={() => field.onChange(field.value.includes(g) ? field.value.filter((x) => x !== g) : [...field.value, g])}>{g}</Chip>)}</div>
              )} />
              {errors.genres && <p role="alert" className="text-sm font-semibold text-coral">{errors.genres.message}</p>}
            </fieldset>
            <Field id="bpm" label="Typical BPM" error={errors.bpm?.message}><Input id="bpm" type="number" inputMode="numeric" {...register("bpm")} /></Field>
          </>
        ) : (
          <>
            <Field id="eventId" label="Event" error={errors.eventId?.message} hint="DJ募集中のイベントのみ表示">
              <Select id="eventId" {...register("eventId")} aria-invalid={!!errors.eventId}>
                <option value="">Choose an event…</option>
                {recruiting.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.city}</option>)}
                {pre && !recruiting.some((e) => e.id === pre) && EVENTS.filter((e) => e.id === pre).map((e) => <option key={e.id} value={e.id}>{e.name} · {e.city} (waitlist)</option>)}
              </Select>
            </Field>
            <Field id="mixUrl" label="Mix link" error={errors.mixUrl?.message}><Input id="mixUrl" type="url" inputMode="url" placeholder="https://soundcloud.com/…" {...register("mixUrl")} aria-invalid={!!errors.mixUrl} /></Field>
            <Field id="message" label="Message to the organizer" error={errors.message?.message}><Textarea id="message" {...register("message")} aria-invalid={!!errors.message} /></Field>
            <DemoNotice>Your application is stored in this browser only. Nothing is sent to an organizer in Phase 1.</DemoNotice>
          </>
        )}
        <div className="flex gap-3 pt-2">
          {step === 1 && <Button variant="ghost" onClick={() => setStep(0)}><ArrowLeft className="size-4" aria-hidden /> Back</Button>}
          {step === 0 ? (
            <Button key="next" className="ml-auto flex-1 sm:flex-none" onClick={async () => { if (await trigger(STEP_FIELDS[0], { shouldFocus: true })) setStep(1); }}>Next <ArrowRight className="size-4" aria-hidden /></Button>
          ) : (
            <Button key="submit" type="submit" className="ml-auto flex-1 sm:flex-none"><Check className="size-4" aria-hidden /> Submit application</Button>
          )}
        </div>
      </form>
    </div>
  );
}
