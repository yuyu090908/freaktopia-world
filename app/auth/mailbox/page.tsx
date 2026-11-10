import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/AuthForms";
import { DEMO_INBOX_COOKIE, authConfig } from "@/lib/auth/config";
import { demoOutboxFor } from "@/lib/auth/mail";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("demoMailboxTitle"), robots: { index: false } };
}

/**
 * DEMO ONLY: emails that would have been sent, for the address this browser just used.
 * Disappears as soon as a real email provider or database is configured.
 */
export default async function Page() {
  if (authConfig().email !== "demo-mailbox") notFound();
  const t = await getTranslations("auth");
  const format = await getFormatter();
  const email = (await cookies()).get(DEMO_INBOX_COOKIE)?.value;
  const list = email ? demoOutboxFor(email) : [];
  return (
    <AuthShell title={t("demoMailboxTitle")}>
      <p className="rounded-2xl border-2 border-orange/60 bg-orange/10 p-4 text-sm font-semibold text-orange" role="note">{t("demoMailboxNote")}</p>
      {list.length === 0 && <p className="mt-6 text-mute">{t("demoMailboxEmpty")}</p>}
      <ul className="mt-6 space-y-4" data-testid="mailbox">
        {list.map((m) => {
          const path = m.link ? new URL(m.link).pathname + new URL(m.link).search : null;
          return (
            <li key={m.id} className="rounded-2xl border border-line bg-surface p-4" data-testid="mail">
              <div className="text-xs text-mute">{m.to} · {format.dateTime(new Date(m.at), { dateStyle: "short", timeStyle: "short" })}</div>
              <h2 className="mt-1 font-sans text-base font-extrabold" lang={m.locale}>{m.subject}</h2>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-cream/85" lang={m.locale}>{m.text.replace(m.link ?? "\u0000", "")}</pre>
              {path && (
                <Link href={path} className="mt-3 inline-flex min-h-11 items-center rounded-full bg-acid px-4 text-sm font-extrabold uppercase text-ink" data-testid="mail-link">
                  {t("openLink")}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </AuthShell>
  );
}
