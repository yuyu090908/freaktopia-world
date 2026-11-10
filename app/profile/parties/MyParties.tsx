"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Globe2, Ticket, Trash2 } from "lucide-react";
import { ToggleRow } from "@/components/forms/Fields";
import { Button, PageTitle } from "@/components/ui/primitives";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { ConfirmSheet, Section, SignInGate, useWhen } from "@/components/ops/shared";
import { PassCard } from "@/components/party/PassCard";
import { useParty, usePartyPost, type Tier } from "@/components/party/shared";

interface Mine {
  items: { eventId: string; name: string; city: string; startAt: string; endAt: string; timezone: string; status: "going" | "checked_in" | "cancelled" | "team"; ended: boolean; organizer: { publicId: string | null; name: string | null; visits: number; userId: string } }[];
  follows: { organizerId: string; notify: boolean; name: string | null; publicId: string | null }[];
  blocks: { organizerId: string; name: string | null }[];
  privacy: { showInWorlds: boolean; showHistory: boolean };
  myPublicId: string | null;
  avatarPublic: boolean;
}

function PartyNotes() {
  const t = useTranslations("party");
  const to = useTranslations("ops");
  const href = useLocalHref();
  const when = useWhen();
  const { data } = useParty<{ notifications: { id: string; key: string; values: Record<string, string>; at: string; read: boolean }[] }>("/api/ops/notifications");
  const list = (data?.notifications ?? []).filter((n) => n.key === "notif.partyNew").slice(0, 5);
  if (list.length === 0) return null;
  return (
    <Section title={t("partyNews")} id="party-news">
      <ul className="space-y-2" data-testid="party-news">
        {list.map((n) => (
          <li key={n.id} className="rounded-2xl bg-surface-2 p-3 text-sm">
            <div>{to("notif.partyNew", n.values)}</div>
            <div className="text-xs text-mute">{when(n.at)}</div>
            {n.values.link?.startsWith("/") && <Link href={href(n.values.link)} className="text-xs font-bold text-acid underline">{to("open")}</Link>}
          </li>
        ))}
      </ul>
    </Section>
  );
}

const tierOf = (n: number): Tier => (n >= 10 ? "regular" : n >= 5 ? "glow" : n >= 2 ? "aura" : "first");

export function MyParties() {
  const t = useTranslations("party");
  return (
    <div className="mx-auto max-w-4xl pb-24 md:px-6">
      <PageTitle kicker={t("kicker")} title={t("myParties")} sub={t("myPartiesSub")} />
      <div className="px-4 md:px-0">
        <SignInGate returnTo="/profile/parties">
          <Inner />
        </SignInGate>
      </div>
    </div>
  );
}

function Inner() {
  const t = useTranslations("party");
  const href = useLocalHref();
  const when = useWhen();
  const post = usePartyPost();
  const { data, reload } = useParty<Mine>("/api/party/me");
  const [pass, setPass] = useState<string | null>(null);
  const [del, setDel] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!data) return <div className="h-64 animate-pulse rounded-3xl bg-surface" />;
  const upcoming = data.items.filter((i) => !i.ended && i.status === "going");
  const past = data.items.filter((i) => i.ended || i.status !== "going");
  const setPrivacy = async (patch: Partial<Mine["privacy"]>) => {
    if (await post("privacy", patch, t("saved"))) await reload();
  };
  return (
    <div className="space-y-4">
      {data.myPublicId && (
        <div className="flex flex-wrap gap-2">
          <Link href={href(`/u/${data.myPublicId}/world`)} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-acid px-4 text-sm font-extrabold uppercase text-ink" data-testid="my-world-link">
            <Globe2 className="size-4" aria-hidden /> {t("myWorld")}
          </Link>
          <Link href={href(`/u/${data.myPublicId}`)} className="inline-flex min-h-11 items-center rounded-full border-2 border-cream/30 px-4 text-sm font-extrabold uppercase">{t("myPublicProfile")}</Link>
        </div>
      )}

      <PartyNotes />

      <Section title={t("passes")} id="passes">
        {upcoming.length === 0 ? (
          <p className="text-sm text-mute">{t("noPasses")}</p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((i) => (
              <li key={i.eventId} className="rounded-2xl bg-ink p-3" data-testid="pass-item">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-extrabold uppercase">{i.name}</div>
                    <div className="text-xs text-mute">{when(i.startAt, i.timezone)} · {i.city} · {i.organizer.name}</div>
                  </div>
                  <Button size="sm" onClick={() => setPass(pass === i.eventId ? null : i.eventId)}><Ticket className="size-4" aria-hidden /> {t("myPass")}</Button>
                </div>
                {pass === i.eventId && <PassCard eventId={i.eventId} />}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("history")} id="mine-history">
        {past.length === 0 ? (
          <p className="text-sm text-mute">{t("noHistory")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {past.map((i) => (
              <li key={i.eventId} className="flex min-h-12 items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  {i.organizer.publicId ? (
                    <Link href={href(`/u/${i.organizer.publicId}/world/${i.eventId}`)} className="block truncate font-extrabold uppercase hover:text-acid">{i.name}</Link>
                  ) : (
                    <span className="block truncate font-extrabold uppercase">{i.name}</span>
                  )}
                  <span className="text-xs text-mute">{when(i.startAt, i.timezone, false)} · {i.organizer.name}</span>
                </span>
                <span className="shrink-0 text-right text-xs font-bold">
                  <span className="block">{t(`myStatus.${i.status}`)}</span>
                  {i.organizer.visits > 0 && <span className="block text-acid">{t("visitsWith", { n: i.organizer.visits, tier: t(`tier.${tierOf(i.organizer.visits)}`) })}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("privacyTitle")} id="privacy">
        <div className="space-y-2" data-testid="privacy">
          <ToggleRow checked={data.privacy.showInWorlds} onChange={(v) => setPrivacy({ showInWorlds: v })} label={t("showInWorlds")} sub={t("showInWorldsSub")} />
          <ToggleRow checked={data.privacy.showHistory} onChange={(v) => setPrivacy({ showHistory: v })} label={t("showHistory")} sub={t("showHistorySub")} />
        </div>
        {!data.avatarPublic && (
          <p className="mt-2 text-xs text-orange">
            {t("avatarNotPublic")} <Link href={href("/settings")} className="underline">{t("openSettings")}</Link>
          </p>
        )}
        <p className="mt-2 text-xs text-mute">{t("privacyNote")}</p>
      </Section>

      <Section title={t("followingTitle")} id="following">
        {data.follows.length === 0 ? (
          <p className="text-sm text-mute">{t("noFollows")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.follows.map((f) => (
              <li key={f.organizerId} className="flex min-h-12 flex-wrap items-center justify-between gap-2 py-2 text-sm">
                {f.publicId ? <Link href={href(`/u/${f.publicId}/world`)} className="font-extrabold hover:text-acid">{f.name}</Link> : <span className="font-extrabold">{f.name}</span>}
                <span className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={async () => (await post(`organizers/${f.organizerId}/follow`, { notify: !f.notify }, t("saved"))) && reload()}>{f.notify ? t("stopNotify") : t("notifyMe")}</Button>
                  <Button size="sm" variant="ghost" onClick={async () => (await post(`organizers/${f.organizerId}/unfollow`, {}, t("unfollowed"))) && reload()}>{t("unfollow")}</Button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {data.blocks.length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-extrabold uppercase">{t("blockedTitle")}</h3>
            <ul className="divide-y divide-line">
              {data.blocks.map((b) => (
                <li key={b.organizerId} className="flex min-h-12 items-center justify-between gap-2 py-2 text-sm">
                  <span>{b.name}</span>
                  <Button size="sm" variant="ghost" onClick={async () => (await post(`organizers/${b.organizerId}/unblock`, {}, t("unblocked"))) && reload()}>{t("unblock")}</Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section title={t("deleteTitle")} id="del">
        <p className="text-sm text-mute">{t("deleteBody")}</p>
        <Button variant="ghost" className="mt-3 text-orange" onClick={() => setDel(true)} data-testid="delete-party-data"><Trash2 className="size-4" aria-hidden /> {t("deleteButton")}</Button>
      </Section>
      <ConfirmSheet
        open={del}
        onClose={() => setDel(false)}
        title={t("deleteTitle")}
        statement={t("deleteStatement")}
        confirmLabel={t("deleteButton")}
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          if (await post("me/delete", { confirm: true }, t("deletedAll"))) await reload();
          setBusy(false);
          setDel(false);
        }}
      />
    </div>
  );
}
