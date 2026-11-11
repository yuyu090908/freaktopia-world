"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageTitle } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { SignInGate } from "@/components/ops/shared";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { useMusic } from "@/components/music/shared";
import type { DjProfile } from "@/lib/music/types";
import { ProfileForm } from "./ProfileForm";
import { TracksPanel, type MeRes } from "./Tracks";
import { CalendarPanel } from "./Calendar";
import { BookingsPanel } from "./Bookings";
import { AnalyticsPanel } from "./Analytics";

type Tab = "profile" | "tracks" | "calendar" | "bookings" | "analytics";
const TABS: Tab[] = ["profile", "tracks", "calendar", "bookings", "analytics"];

export function DjStudio() {
  const t = useTranslations("music");
  return (
    <div className="mx-auto max-w-5xl pb-16 md:px-6">
      <PageTitle kicker={t("studioKicker")} title={t("studioTitle")} sub={t("studioSub")} />
      <div className="px-4 md:px-0">
        <SignInGate returnTo="/profile/dj">
          <Inner />
        </SignInGate>
      </div>
    </div>
  );
}

function Inner() {
  const t = useTranslations("music");
  const href = useLocalHref();
  const sp = useSearchParams();
  const initial = (TABS as string[]).includes(sp.get("tab") ?? "") ? (sp.get("tab") as Tab) : "profile";
  const [tab, setTab] = useState<Tab>(initial);
  const { data, reload } = useMusic<MeRes & { profile: DjProfile | null; admin: boolean }>("/api/music/me");
  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set("tab", tab);
    history.replaceState(history.state, "", url);
  }, [tab]);
  if (!data) return <div className="h-40 animate-pulse rounded-3xl bg-surface" aria-busy="true" />;
  const hasProfile = !!data.profile;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-sm">
        {data.profile && (
          <Link href={href(`/djs/u/${data.profile.slug}`)} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 font-bold hover:border-acid" data-testid="view-public-profile">
            {t("viewPublicProfile")}
          </Link>
        )}
        <Link href={href("/music/library")} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 font-bold hover:border-acid">{t("myLibrary")}</Link>
        {data.admin && <Link href={href("/admin/music")} className="inline-flex min-h-11 items-center rounded-full border border-orange/60 px-4 font-bold text-orange">{t("adminLink")}</Link>}
      </div>
      <Tabs label={t("studioTitle")} tabs={TABS.map((x) => ({ id: x, label: t(`tab.${x}`) }))} active={tab} onChange={setTab}>
        {tab === "profile" && <ProfileForm profile={data.profile} onSaved={reload} />}
        {tab === "tracks" && (hasProfile ? <TracksPanel me={data} reload={reload} /> : <NeedProfile onGo={() => setTab("profile")} />)}
        {tab === "calendar" && (hasProfile ? <CalendarPanel /> : <NeedProfile onGo={() => setTab("profile")} />)}
        {tab === "bookings" && <BookingsPanel initialId={sp.get("b")} />}
        {tab === "analytics" && (hasProfile ? <AnalyticsPanel /> : <NeedProfile onGo={() => setTab("profile")} />)}
      </Tabs>
    </div>
  );
}

function NeedProfile({ onGo }: { onGo: () => void }) {
  const t = useTranslations("music");
  return (
    <div className="rounded-3xl border-2 border-dashed border-line p-6 text-center">
      <p className="font-bold">{t("needProfile")}</p>
      <button type="button" onClick={onGo} className="mt-3 min-h-11 font-bold text-acid underline">{t("activateProfile")}</button>
    </div>
  );
}
