"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { LogIn } from "lucide-react";
import { Alien } from "@/components/art/Alien";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { useAuth } from "@/lib/auth/client";

/** Header account entry: "Sign in" when signed out, the user's alien when signed in. */
export function AccountButton() {
  const t = useTranslations("auth");
  const href = useLocalHref();
  const status = useAuth((s) => s.status);
  const me = useAuth((s) => s.me);
  if (status === "signedIn" && me) {
    const name = me.profile.displayName ?? me.alien?.name ?? me.user.email;
    return (
      <Link href={href("/profile")} aria-label={`${t("account")}: ${name}`} data-testid="account-button" className="inline-flex size-11 items-center justify-center rounded-full hover:bg-surface">
        {me.alien ? (
          <span className="flex size-9 items-center justify-center overflow-hidden rounded-full border-2 border-acid bg-surface-2">
            <Alien look={me.alien.look} className="size-10 translate-y-0.5" />
          </span>
        ) : (
          <span className="flex size-9 items-center justify-center rounded-full border-2 border-orange text-xs font-extrabold uppercase">{name.slice(0, 1)}</span>
        )}
      </Link>
    );
  }
  return (
    <Link
      href={href("/auth/signin")}
      data-testid="signin-link"
      aria-label={t("signIn")}
      className="inline-flex h-11 items-center gap-1.5 rounded-full px-2.5 text-sm font-extrabold uppercase hover:bg-surface min-[480px]:border-2 min-[480px]:border-line min-[480px]:px-3.5"
    >
      <LogIn className="size-5 min-[480px]:hidden" aria-hidden />
      <span className="hidden min-[480px]:inline">{t("signIn")}</span>
    </Link>
  );
}
