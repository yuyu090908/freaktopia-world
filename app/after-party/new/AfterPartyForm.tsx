"use client";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check } from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/forms/Fields";
import { Button, Chip, DemoNotice, PageTitle } from "@/components/ui/primitives";
import { DJS, EVENTS, getEvent } from "@/lib/data";
import { grantXp, toast, uid, useDemo } from "@/lib/store";

const schema = z.object({
  eventId: z.string().min(1, "errLinkItToAMain"),
  name: z.string().trim().min(3, "errNameYourAfterParty"),
  venueName: z.string().trim().min(2, "errWhereIsIt"),
  date: z.string().min(1, "errChooseADate"),
  start: z.string().min(1, "errStartTime"),
  end: z.string().min(1, "errEndTime"),
  price: z.coerce.number().min(0, "errPriceCantBeNegative"),
  capacity: z.coerce.number().int().min(10, "errAtLeast10"),
  djIds: z.array(z.string()),
  description: z.string().max(300).optional(),
});
type V = z.input<typeof schema>;

export function AfterPartyForm() {
  const tu = useTranslations("afterParty");
  /** Form errors are translation keys (see the schema above); anything else is shown as is. */
  const msg = (m?: string) => (m ? (tu.has(m) ? tu(m) : m) : undefined);
  const router = useRouter();
  const params = useSearchParams();
  const add = useDemo((s) => s.addAfterParty);
  const pre = params.get("event") ?? "";
  const preEv = getEvent(pre);
  const { register, control, handleSubmit, formState: { errors } } = useForm<V>({
    resolver: zodResolver(schema),
    defaultValues: { eventId: preEv ? pre : "", name: "", venueName: "", date: preEv ? preEv.endsAt.slice(0, 10) : "", start: "05:00", end: "11:00", price: 15, capacity: 150, djIds: [], description: "" },
    mode: "onTouched",
  });

  const submit = handleSubmit((v) => {
    const ev = getEvent(v.eventId)!;
    const id = uid("my-ap");
    add({
      id,
      eventId: v.eventId,
      name: v.name.toUpperCase(),
      venueName: v.venueName,
      city: ev.city,
      startsAt: `${v.date}T${v.start}:00Z`,
      endsAt: `${v.date}T${v.end}:00Z`,
      djIds: v.djIds,
      price: Number(v.price),
      seatsLeft: Number(v.capacity),
      capacity: Number(v.capacity),
      description: v.description ?? "",
      palette: ev.palette,
      isDemo: false,
      createdByUser: true,
    });
    grantXp(60, tu("xpCreatedAnAfterParty"));
    toast({ title: tu("afterPartyCreatedDemo"), body: tu("linkedToName", { name: ev.name }), tone: "success" });
    router.push(`/after-party/${id}`);
  });

  return (
    <div className="mx-auto max-w-2xl md:px-6">
      <PageTitle kicker={tu("organizer")} title={tu("createAfterParty")} sub={tu("text2")} />
      <form onSubmit={submit} noValidate className="space-y-5 px-4 md:px-0">
        <Field id="eventId" label={tu("mainEvent")} error={msg(errors.eventId?.message)}>
          <Select id="eventId" {...register("eventId")} aria-invalid={!!errors.eventId}>
            <option value="">{tu("chooseTheMainEvent")}</option>
            {EVENTS.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.city}</option>)}
          </Select>
        </Field>
        <Field id="name" label={tu("afterPartyName")} error={msg(errors.name?.message)}><Input id="name" {...register("name")} aria-invalid={!!errors.name} /></Field>
        <Field id="venueName" label={tu("venue")} error={msg(errors.venueName?.message)}><Input id="venueName" {...register("venueName")} aria-invalid={!!errors.venueName} /></Field>
        <Field id="date" label={tu("date")} error={msg(errors.date?.message)}><Input id="date" type="date" {...register("date")} aria-invalid={!!errors.date} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="start" label={tu("starts")}><Input id="start" type="time" {...register("start")} /></Field>
          <Field id="end" label={tu("ends")}><Input id="end" type="time" {...register("end")} /></Field>
          <Field id="price" label={tu("ticketPriceUsd")} error={msg(errors.price?.message)}><Input id="price" type="number" inputMode="decimal" {...register("price")} /></Field>
          <Field id="capacity" label={tu("capacity")} error={msg(errors.capacity?.message)}><Input id="capacity" type="number" inputMode="numeric" {...register("capacity")} /></Field>
        </div>
        <fieldset>
          <legend className="text-sm font-bold">DJs</legend>
          <Controller control={control} name="djIds" render={({ field }) => (
            <div className="mt-2 flex flex-wrap gap-2">{DJS.map((d) => <Chip key={d.id} active={field.value.includes(d.id)} onClick={() => field.onChange(field.value.includes(d.id) ? field.value.filter((x) => x !== d.id) : [...field.value, d.id])}>{d.name}</Chip>)}</div>
          )} />
        </fieldset>
        <Field id="description" label={tu("description")} optional><Textarea id="description" {...register("description")} /></Field>
        <DemoNotice>{tu("savedInYourBrowserOnly")}</DemoNotice>
        <Button type="submit" size="lg" className="w-full"><Check className="size-5" aria-hidden /> {tu("createAfterParty")}</Button>
      </form>
    </div>
  );
}
