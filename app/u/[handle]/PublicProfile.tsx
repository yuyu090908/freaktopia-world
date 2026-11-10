"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Globe2, Lock } from "lucide-react";
import { Alien } from "@/components/art/Alien";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { DemoBadge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { Section, useWhen } from "@/components/ops/shared";
import { useParty } from "@/components/party/shared";
import { useAuth } from "@/lib/auth/client";
import type { AlienLook } from "@/lib/types";

interface Profile {
  demo: boolean;
  isMe: boolean;
  publicId: string | null;
  name: string | null;
  look: AlienLook | null;
  private: boolean;
  hasWorld: boolean;
  history: { eventId: string; name: string; startAt: string; organizer: string | null; organizerPublicId: string | null }[] | null;
}

/** Public profile by alien ID (FREAK-…). Shows only what the person allowed; the party world is one tap away. */
export function PublicProfile({ handle }: { handle: string }) {
  const t = useTranslations("party");
  const href = useLocalHref();
  const when = useWhen();
  const status = useAuth((s) => s.status);
  const { data, error } = useParty<{ profile: Profile }>(status === "loading" ? null : `/api/party/profiles/${handle}`);
  if (error) return <div className="mx-auto max-w-3xl p-4"><EmptyState title={t("profileNotFound")} body={t("profileNotFoundBody")} /></div>;
  if (!data) return <div className="mx-auto max-w-3xl p-4"><div className="h-56 animate-pulse rounded-3xl bg-surface" /></div>;
  const p = data.profile;
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pb-24 pt-6 md:px-6">
      <section className="relative overflow-hidden rounded-[32px] border-[3px] border-ink bg-purple p-5 text-ink">
        <div className="halftone absolute inset-0" aria-hidden />
        <div className="relative flex items-center gap-4">
          <div className="size-24 shrink-0 rounded-3xl border-[3px] border-ink bg-cream">
            {p.look ? <Alien look={p.look} className="h-full w-full p-1" /> : <Lock className="m-auto mt-7 size-8" aria-hidden />}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-extrabold uppercase tracking-wider">{p.publicId ?? "DEMO"}</div>
            <h1 className="truncate text-3xl uppercase" data-testid="public-name">{p.private ? t("privateProfile") : p.name ?? "—"}</h1>
            {p.demo && <DemoBadge />}
            {p.isMe && <p className="text-xs font-bold">{t("thisIsYou")}</p>}
          </div>
        </div>
        {p.hasWorld && (
          <Link href={href(`/u/${handle}/world`)} className="relative mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border-[3px] border-ink bg-acid px-5 text-sm font-extrabold uppercase" data-testid="open-world">
            <Globe2 className="size-4" aria-hidden /> {t("openWorld")}
          </Link>
        )}
        {p.isMe && !p.hasWorld && <p className="relative mt-3 text-sm font-bold">{t("noWorldYet")}</p>}
      </section>
      {p.history ? (
        <Section title={t("partyHistory")} id="ph">
          {p.history.length === 0 ? (
            <p className="text-sm text-mute">{t("noHistory")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {p.history.map((h) => (
                <li key={h.eventId} className="flex min-h-12 items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-extrabold uppercase">{h.name}</span>
                    <span className="text-xs text-mute">{when(h.startAt, undefined, false)}{h.organizer ? ` · ${h.organizer}` : ""}</span>
                  </span>
                  {h.organizerPublicId && (
                    <Link href={href(`/u/${h.organizerPublicId}/world/${h.eventId}`)} className="shrink-0 text-xs font-bold text-acid underline">{t("view")}</Link>
                  )}
                </li>
              ))}
            </ul>
          )}
          {p.isMe && <p className="mt-2 text-xs text-mute">{t("historyVisibilityNote")}</p>}
        </Section>
      ) : (
        <p className="text-sm text-mute">{t("historyHidden")}</p>
      )}
    </div>
  );
}
