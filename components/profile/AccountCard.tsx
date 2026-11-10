"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { BadgeCheck, MailWarning, Settings, Shirt } from "lucide-react";
import { Alien } from "@/components/art/Alien";
import { btnClass } from "@/components/ui/primitives";
import { AlienTraitList, FamilyBadge } from "@/components/alien/AlienTraits";
import { useLocalHref, useLocaleInfo } from "@/components/i18n/LocaleContext";
import { LOCALE_META } from "@/i18n/config";
import { useAuth } from "@/lib/auth/client";
import { formatEventDate } from "@/lib/i18n/format";

/** The signed-in identity: alien, names, verification, language. Signed out: an invitation to hatch one. */
export function AccountCard() {
  const t = useTranslations("profile");
  const ta = useTranslations("alien");
  const tauth = useTranslations("auth");
  const href = useLocalHref();
  const { locale } = useLocaleInfo();
  const { status, me } = useAuth();

  if (status === "loading") return <div className="h-40 animate-pulse rounded-[32px] bg-surface" aria-hidden />;

  if (!me) {
    return (
      <section className="rounded-[32px] border-2 border-dashed border-line bg-surface p-5" data-testid="account-card-signed-out">
        <p className="text-[15px]">{t("notSignedIn")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={href("/signup")} className={btnClass("primary", "md")}>{tauth("signUp")}</Link>
          <Link href={href("/login")} className={btnClass("ghost", "md")}>{tauth("signIn")}</Link>
        </div>
      </section>
    );
  }

  const name = me.profile.displayName ?? me.alien?.name ?? me.user.email.split("@")[0];
  return (
    <section className="overflow-hidden rounded-[32px] border-2 border-line bg-[#0D121B]" aria-labelledby="acct-name" data-testid="account-card">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        {me.alien && (
          <div className="relative mx-auto size-36 shrink-0 rounded-3xl border-2 border-line sm:mx-0" style={{ background: `radial-gradient(circle at 50% 40%, ${me.alien.look.body}55, transparent 70%)` }}>
            <Alien look={me.alien.look} className="h-full w-full p-1" title={me.alien.name} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 id="acct-name" className="truncate text-3xl uppercase" data-testid="profile-display-name">{name}</h2>
          {me.profile.username && <div className="text-sm text-mute">@{me.profile.username}</div>}
          {me.alien && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="font-display text-lg uppercase" data-testid="profile-alien-name">{me.alien.name}</span>
              <FamilyBadge family={me.alien.family} />
            </div>
          )}
          {me.alien && (
            <div className="mt-1 text-sm text-mute">
              {ta("id")}: <b className="font-mono text-acid" data-testid="profile-alien-id">{me.alien.publicId}</b>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {me.user.emailVerified ? (
              <span className="inline-flex items-center gap-1 text-acid"><BadgeCheck className="size-4" aria-hidden />{t("emailVerified")}</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-orange"><MailWarning className="size-4" aria-hidden />{t("emailUnverified")}</span>
            )}
            <span className="text-mute">{t("preferredLanguage")}: <b className="text-cream">{LOCALE_META[me.profile.locale].native}</b></span>
            {me.alien && <span className="text-mute">{ta("bornOn", { date: formatEventDate(locale, me.alien.createdAt) })}</span>}
            <span className="text-mute">XP: <b className="text-cream" data-testid="profile-xp">{me.profile.xp}</b></span>
          </div>
          {me.profile.favoriteGenres.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t("favoriteGenres")} data-testid="profile-genres">
              {me.profile.favoriteGenres.map((g) => (
                <li key={g} className="rounded-full border border-acid/50 px-2.5 py-0.5 text-xs font-bold text-acid">{g}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {me.alien && (
        <div className="border-t border-line px-5 py-4">
          <AlienTraitList alien={me.alien} compact />
        </div>
      )}
      <div className="flex flex-wrap gap-2 border-t border-line px-5 py-4">
        <Link href={href("/profile/alien")} className={btnClass("primary", "sm")}><Shirt className="size-4" aria-hidden />{ta("customize")}</Link>
        <Link href={href("/settings")} className={btnClass("ghost", "sm")} data-testid="settings-link"><Settings className="size-4" aria-hidden />{t("settings")}</Link>
      </div>
    </section>
  );
}
