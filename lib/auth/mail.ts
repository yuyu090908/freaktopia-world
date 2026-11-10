import { createTranslator } from "next-intl";
import type { Locale } from "@/i18n/config";
import { loadMessages } from "@/i18n/messages";
import { authConfig } from "./config";

export type MailTemplate = "verify" | "reset" | "resetNoAccount" | "signupExisting" | "partyNew";

export interface OutboxMessage {
  id: string;
  to: string;
  subject: string;
  text: string;
  link: string | null;
  at: string;
  locale: Locale;
}

const g = globalThis as unknown as { __fkOutbox?: OutboxMessage[] };
const outbox = () => (g.__fkOutbox ??= []);

/** DEMO mailbox: messages "sent" while no email provider is connected. Never used in production mode. */
export function demoOutboxFor(email: string): OutboxMessage[] {
  return outbox().filter((m) => m.to === email.toLowerCase()).slice(-20).reverse();
}

export async function renderMail(template: MailTemplate, locale: Locale, link: string | null, values: Record<string, string> = {}) {
  const messages = await loadMessages(locale);
  const t = createTranslator({ locale, messages, namespace: "email" }) as unknown as (key: string, values?: Record<string, string>) => string;
  const subject = t(`${template}.subject`, values);
  const lines = [t("greeting"), "", t(`${template}.body`, values), ...(link ? ["", link] : []), "", t(`${template}.footer`, values), "", t("signature")];
  return { subject, text: lines.join("\n") };
}

/**
 * Sends a transactional email. With RESEND_API_KEY + MAIL_FROM it goes through Resend.
 * Without them, demo mode drops it into the demo mailbox, and production mode refuses (the caller reports it).
 */
export async function sendMail(to: string, template: MailTemplate, locale: Locale, link: string | null, values: Record<string, string> = {}): Promise<"sent" | "demo" | "not-configured"> {
  const { subject, text } = await renderMail(template, locale, link, values);
  const cfg = authConfig();
  if (cfg.email === "connected") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text }),
    });
    if (!res.ok) throw new Error(`MAIL_FAILED ${res.status}`);
    return "sent";
  }
  if (cfg.email === "demo-mailbox") {
    const list = outbox();
    list.push({ id: crypto.randomUUID(), to: to.toLowerCase(), subject, text, link, at: new Date().toISOString(), locale });
    if (list.length > 500) list.splice(0, list.length - 500);
    return "demo";
  }
  return "not-configured";
}
