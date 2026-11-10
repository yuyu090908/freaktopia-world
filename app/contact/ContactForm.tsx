"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Field, Input, Select, Textarea } from "@/components/forms/Fields";
import { Button, DemoNotice } from "@/components/ui/primitives";
import { toast } from "@/lib/store";

export function ContactForm() {
  const tu = useTranslations("pages");
  const [v, setV] = useState({ name: "", email: "", topic: "General", msg: "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const x: Record<string, string> = {};
    if (!v.name.trim()) x.name = "Please add your name";
    if (!/^\S+@\S+\.\S+$/.test(v.email)) x.email = "Enter a valid email";
    if (v.msg.trim().length < 10) x.msg = "Message should be 10+ characters";
    setErr(x);
    if (Object.keys(x).length) return;
    toast({ title: tu("messageSavedDemo"), body: tu("nothingWasSentInPhase"), tone: "success" });
    setV({ name: "", email: "", topic: "General", msg: "" });
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field id="c-name" label={tu("name")} error={err.name}><Input id="c-name" autoComplete="name" value={v.name} aria-invalid={!!err.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
      <Field id="c-email" label={tu("email")} error={err.email}><Input id="c-email" type="email" autoComplete="email" inputMode="email" value={v.email} aria-invalid={!!err.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
      <Field id="c-topic" label={tu("topic")}><Select id="c-topic" value={v.topic} onChange={(e) => setV({ ...v, topic: e.target.value })}>{[tu("general"), tu("organizers"), "DJs", tu("venues"), tu("press")].map((t) => <option key={t}>{t}</option>)}</Select></Field>
      <Field id="c-msg" label={tu("message")} error={err.msg}><Textarea id="c-msg" value={v.msg} aria-invalid={!!err.msg} onChange={(e) => setV({ ...v, msg: e.target.value })} /></Field>
      <DemoNotice>{tu("thisFormDoesNotSend")}</DemoNotice>
      <Button type="submit" size="lg" className="w-full">{tu("send")}</Button>
    </form>
  );
}
