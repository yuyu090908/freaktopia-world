"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Bell, Briefcase, CalendarDays, Plus, Users } from "lucide-react";
import { ButtonLink, PageTitle } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { Section, SignInGate, StatusPill, useOps, useOpsPost, useWhen } from "@/components/ops/shared";
import { SCALE_LEVELS, type Notification, type OpsEvent, type MemberRole } from "@/lib/ops/types";

export function ManageList() {
  const t = useTranslations("ops");
  return (
    <div className="mx-auto max-w-6xl pb-16 md:px-6">
      <PageTitle kicker={t("manageKicker")} title={t("manageTitle")} sub={t("manageSub")} />
      <div className="px-4 md:px-0">
        <SignInGate returnTo="/events/manage">
          <Inner />
        </SignInGate>
      </div>
    </div>
  );
}

function Inner() {
  const t = useTranslations("ops");
  const href = useLocalHref();
  const when = useWhen();
  const events = useOps<{ events: { event: OpsEvent; role: MemberRole; level: number }[] }>("/api/ops/events");
  const notes = useOps<{ notifications: Notification[] }>("/api/ops/notifications");
  const post = useOpsPost();
  const unread = notes.data?.notifications.filter((n) => !n.read).length ?? 0;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={href("/events/manage/new")} data-testid="new-ops-event">
            <Plus className="size-4" aria-hidden /> {t("newEvent")}
          </ButtonLink>
          <ButtonLink href={href("/profile/work")} variant="ghost">
            <Briefcase className="size-4" aria-hidden /> {t("myWork")}
          </ButtonLink>
        </div>
        {events.loading && !events.data && <div className="h-32 animate-pulse rounded-3xl bg-surface" />}
        {events.data && events.data.events.length === 0 && <EmptyState title={t("noEvents")} body={t("noEventsBody")} />}
        <ul className="grid gap-3 sm:grid-cols-2" data-testid="ops-events">
          {events.data?.events.map(({ event: e, role, level }) => (
            <li key={e.id}>
              <Link href={href(`/events/manage/${e.id}`)} className="block rounded-3xl border border-line bg-surface/90 p-4 transition-colors hover:border-acid">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="min-w-0 truncate text-xl uppercase">{e.name}</h2>
                  <StatusPill status={e.status === "cancelled" ? "cancelled" : "open"} label={t(`evStatus.${e.status}`)} />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-mute">
                  <span className="inline-flex items-center gap-1"><CalendarDays className="size-4" aria-hidden /> {when(e.startAt, e.timezone)}</span>
                  <span>{e.city}</span>
                  <span className="inline-flex items-center gap-1"><Users className="size-4" aria-hidden /> {e.attendance}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-surface-2 px-2 py-1 text-acid">L{level} · {t(`level.${SCALE_LEVELS[level - 1].key}`)}</span>
                  <span className="rounded-full bg-surface-2 px-2 py-1">{t(`role.${role}`)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <Section
        title={t("notifications")}
        id="notif-h"
        action={
          unread > 0 ? (
            <button type="button" className="min-h-11 text-sm font-bold text-acid underline" onClick={async () => { if (await post("notifications/read")) void notes.reload(); }}>
              {t("markRead")}
            </button>
          ) : undefined
        }
      >
        {notes.data && notes.data.notifications.length === 0 && <p className="text-sm text-mute">{t("noNotifications")}</p>}
        <ul className="space-y-2" data-testid="notifications">
          {notes.data?.notifications.map((n) => (
            <li key={n.id} className="flex gap-2 rounded-2xl bg-surface-2 p-3 text-sm">
              <Bell className={n.read ? "size-4 shrink-0 text-mute" : "size-4 shrink-0 text-acid"} aria-hidden />
              <div className="min-w-0">
                <div>{t.has(n.key) ? t(n.key, n.values as Record<string, string>) : n.key}</div>
                <div className="text-xs text-mute">{when(n.at)}</div>
                <Link href={href(typeof n.values?.link === "string" && n.values.link.startsWith("/") ? n.values.link : n.eventId ? `/events/manage/${n.eventId}` : "/profile/work")} className="text-xs font-bold text-acid underline">
                  {t("open")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
