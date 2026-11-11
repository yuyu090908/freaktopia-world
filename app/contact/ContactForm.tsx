"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useLeaveWarning } from "@/lib/useLeaveWarning";
import { Field, Input, Select, Textarea } from "@/components/forms/Fields";
import { Button, DemoNotice } from "@/components/ui/primitives";
import { toast } from "@/lib/store";

export function ContactForm() {
  const tu = useTranslations("pages");
  const [v, setV] = useState({ name: "", email: "", topic: "", msg: "" });
  const [err, setErr] = useState<Record<string, string>>({});
  useLeaveWarning(!!(v.name || v.email || v.msg));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const x: Record<string, string> = {};
    if (!v.name.trim()) x.name = tu("errName");
    if (!/^\S+@\S+\.\S+$/.test(v.email)) x.email = tu("errEmail");
    if (v.msg.trim().length < 10) x.msg = tu("errMessage");
    setErr(x);
    // Move to the first field with an error.
    const first = (["name", "email", "msg"] as const).find((k) => x[k]);
    if (first) return document.getElementById(`c-${first}`)?.focus();
    toast({ title: tu("messageSavedDemo"), body: tu("nothingWasSentInPhase"), tone: "success" });
    setV({ name: "", email: "", topic: "", msg: "" });
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field id="c-name" label={tu("name")} error={err.name}><Input id="c-name" autoComplete="name" value={v.name} aria-invalid={!!err.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
      <Field id="c-email" label={tu("email")} error={err.email}><Input id="c-email" type="email" autoComplete="email" inputMode="email" value={v.email} aria-invalid={!!err.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
      <Field id="c-topic" label={tu("topic")}><Select id="c-topic" value={v.topic || tu("general")} onChange={(e) => setV({ ...v, topic: e.target.value })}>{[tu("general"), tu("organizers"), "DJs", tu("venues"), tu("press")].map((t) => <option key={t}>{t}</option>)}</Select></Field>
      <Field id="c-msg" label={tu("message")} error={err.msg}><Textarea id="c-msg" value={v.msg} aria-invalid={!!err.msg} onChange={(e) => setV({ ...v, msg: e.target.value })} /></Field>
      <DemoNotice>{tu("thisFormDoesNotSend")}</DemoNotice>
      <Button type="submit" size="lg" className="w-full">{tu("send")}</Button>
    </form>
  );
}
