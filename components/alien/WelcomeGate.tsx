"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { btnClass } from "@/components/ui/primitives";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { useAuth, type Me, type MeAlien } from "@/lib/auth/client";
import { AlienReveal } from "./AlienReveal";

/** /onboarding: resumes at the saved step (see AlienReveal). */
export function WelcomeGate() {
  const t = useTranslations("auth");
  const ta = useTranslations("alien");
  const tc = useTranslations("common");
  const href = useLocalHref();
  const { status, me } = useAuth();
  if (status === "loading") return <p className="px-4 py-16 text-center text-mute" role="status">{tc("loading")}</p>;
  if (!me) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-4xl uppercase">{ta("signInToHatch")}</h1>
        <Link href={href("/signup")} className={btnClass("primary", "lg", "mt-6")}>{t("signUp")}</Link>
      </div>
    );
  }
  if (!me.alien) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-3xl uppercase">{t("notVerifiedTitle")}</h1>
        <p className="mt-3 text-mute">{t("notVerifiedBody")}</p>
      </div>
    );
  }
  return <AlienReveal me={me as Me & { alien: MeAlien }} />;
}
