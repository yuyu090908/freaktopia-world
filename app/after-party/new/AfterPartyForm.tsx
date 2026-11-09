"use client";

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
  eventId: z.string().min(1, "Link it to a main event"),
  name: z.string().trim().min(3, "Name your after party"),
  venueName: z.string().trim().min(2, "Where is it?"),
  date: z.string().min(1, "Choose a date"),
  start: z.string().min(1, "Start time"),
  end: z.string().min(1, "End time"),
  price: z.coerce.number().min(0, "Price can’t be negative"),
  capacity: z.coerce.number().int().min(10, "At least 10"),
  djIds: z.array(z.string()),
  description: z.string().max(300).optional(),
});
type V = z.input<typeof schema>;

export function AfterPartyForm() {
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
    grantXp(60, "Created an after party");
    toast({ title: "After party created (demo)", body: `Linked to ${ev.name}.`, tone: "success" });
    router.push(`/after-party/${id}`);
  });

  return (
    <div className="mx-auto max-w-2xl md:px-6">
      <PageTitle kicker="Organizer" title="Create after party" sub="メインイベントに紐づけて、アフターパーティーを作成します。" />
      <form onSubmit={submit} noValidate className="space-y-5 px-4 md:px-0">
        <Field id="eventId" label="Main event" error={errors.eventId?.message}>
          <Select id="eventId" {...register("eventId")} aria-invalid={!!errors.eventId}>
            <option value="">Choose the main event…</option>
            {EVENTS.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.city}</option>)}
          </Select>
        </Field>
        <Field id="name" label="After party name" error={errors.name?.message}><Input id="name" {...register("name")} aria-invalid={!!errors.name} /></Field>
        <Field id="venueName" label="Venue" error={errors.venueName?.message}><Input id="venueName" {...register("venueName")} aria-invalid={!!errors.venueName} /></Field>
        <Field id="date" label="Date" error={errors.date?.message}><Input id="date" type="date" {...register("date")} aria-invalid={!!errors.date} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="start" label="Starts"><Input id="start" type="time" {...register("start")} /></Field>
          <Field id="end" label="Ends"><Input id="end" type="time" {...register("end")} /></Field>
          <Field id="price" label="Ticket price (USD)" error={errors.price?.message}><Input id="price" type="number" inputMode="decimal" {...register("price")} /></Field>
          <Field id="capacity" label="Capacity" error={errors.capacity?.message}><Input id="capacity" type="number" inputMode="numeric" {...register("capacity")} /></Field>
        </div>
        <fieldset>
          <legend className="text-sm font-bold">DJs</legend>
          <Controller control={control} name="djIds" render={({ field }) => (
            <div className="mt-2 flex flex-wrap gap-2">{DJS.map((d) => <Chip key={d.id} active={field.value.includes(d.id)} onClick={() => field.onChange(field.value.includes(d.id) ? field.value.filter((x) => x !== d.id) : [...field.value, d.id])}>{d.name}</Chip>)}</div>
          )} />
        </fieldset>
        <Field id="description" label="Description" optional><Textarea id="description" {...register("description")} /></Field>
        <DemoNotice>Saved in your browser only. Ticket sales for after parties are simulated.</DemoNotice>
        <Button type="submit" size="lg" className="w-full"><Check className="size-5" aria-hidden /> Create after party</Button>
      </form>
    </div>
  );
}
