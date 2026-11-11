"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Building2, CalendarDays, Gem, Heart, LayoutDashboard, Mic2, Package, Pencil, Settings, Ticket, Trash2, Trophy, PartyPopper, Orbit, Headphones, Library } from "lucide-react";
import { Alien } from "@/components/art/Alien";
import { AlienAvatar } from "@/components/cards/Cards";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button, ButtonLink, Card, Chip, DemoBadge, DemoNotice, Progress, Stat } from "@/components/ui/primitives";
import { Field, Input, Textarea } from "@/components/forms/Fields";
import { EmptyState } from "@/components/ui/States";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Tabs } from "@/components/ui/Tabs";
import { EVENTS, GENRES, PAST_EVENTS, getDJ, getEvent } from "@/lib/data";
import { userLevel } from "@/lib/levels";
import { toast, useDemo } from "@/lib/store";
import { fmtDate } from "@/lib/utils";
import type { Genre } from "@/lib/types";
import { COLLECTIBLES } from "@/app/nft/collectibles";
import { AccountCard } from "@/components/profile/AccountCard";
import { FreakIdCard } from "@/components/profile/FreakIdCard";
import { useAuth, useMyAvatar } from "@/lib/auth/client";
import { useTranslations } from "next-intl";

export function ProfileView() {
  // Renders immediately from default demo state, then updates once saved data loads.
  return <Inner />;
}

function Inner() {
  const tu = useTranslations("profile");
  const tp = useTranslations("profile");
  const to = useTranslations("ops");
  const tparty = useTranslations("party");
  const tmusic = useTranslations("music");
  const myPublicId = useMyAvatar().publicId;
  const signedIn = useAuth((x) => x.status === "signedIn");
  const s = useDemo();
  const p = s.profile;
  const lv = userLevel(p.xp);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState({ username: p.username, bio: p.bio, city: p.city, favoriteGenres: p.favoriteGenres });
  const [confirmReset, setConfirmReset] = useState(false);
  const [tab, setTab] = useState<"id" | "activity" | "settings">("id");
  const openEdit = () => {
    setDraft({ username: p.username, bio: p.bio, city: p.city, favoriteGenres: p.favoriteGenres });
    setEdit(true);
  };
  const upcomingIds = Array.from(new Set([...s.orders.map((o) => o.eventId), ...Object.keys(s.support)]));
  const upcoming = upcomingIds.map(getEvent).filter(Boolean);

  const saveProfile = () => {
    const name = draft.username.trim().replace(/\s+/g, "_").slice(0, 24);
    if (name.length < 3) {
      toast({ title: tu("usernameNeeds3Characters"), tone: "error" });
      return;
    }
    s.updateProfile({ ...draft, username: name });
    setEdit(false);
    toast({ title: tu("profileUpdated"), tone: "success" });
  };

  return (
    <div className="mx-auto max-w-5xl md:px-6">
      <div className="px-4 pt-5 md:px-0 md:pt-8">
        <h1 className="sr-only">{tp("title")}</h1>
      </div>
      <Tabs label={tp("title")} tabs={[{ id: "id", label: tp("tabId") }, { id: "activity", label: tp("tabActivity") }, { id: "settings", label: tp("tabSettings") }]} active={tab} onChange={setTab} className="px-4 md:px-0">
      {tab === "id" && (
        <div data-testid="profile-tab-id">
          <AccountCard />
          <div className="mt-5"><FreakIdCard /></div>
        </div>
      )}
      {tab === "activity" && (<div className="-mx-4 md:mx-0" data-testid="profile-tab-activity">
      {/* Header card: demo progress kept in this browser (tickets, XP, favourites) */}
      <section className="px-4 pt-5 md:px-0" aria-labelledby="pf-name">
        {!signedIn && <p className="mb-2 text-xs font-bold uppercase tracking-wider text-orange">{tp("demoProfile")}</p>}
        <div className="relative overflow-hidden rounded-[32px] border-[3px] border-ink bg-purple p-5 text-ink">
          <div className="halftone absolute inset-0" aria-hidden />
          <div className="relative flex items-center gap-4">
            <Link href="/avatar" className="relative size-28 shrink-0 rounded-3xl border-[3px] border-ink bg-cream" aria-label={tu("editAvatar")}>
              <Alien look={p.look} className="h-full w-full p-1" title={p.avatarName} />
              <span className="absolute -bottom-2 -right-2 flex size-9 items-center justify-center rounded-full border-[3px] border-ink bg-acid"><Pencil className="size-4" aria-hidden /></span>
            </Link>
            <div className="min-w-0">
              <h2 id="pf-name" className="truncate text-2xl sm:text-3xl">@{p.username}</h2>
              <div className="truncate text-sm font-bold">{p.avatarName} · {p.city}</div>
              <div className="mt-2 inline-flex rounded-full bg-ink px-3 py-1 font-display text-sm text-cream">LV.{lv.level}</div>
            </div>
          </div>
          <p className="relative mt-3 text-sm font-medium">{p.bio}</p>
          <div className="relative mt-3">
            <div className="mb-1 flex justify-between text-xs font-bold"><span>XP {p.xp}</span><span>{tu("valueToLvValue2", { value: lv.need - lv.intoLevel, value2: lv.level + 1 })}</span></div>
            <Progress value={lv.pct} color="#080808" className="!border-ink !bg-cream/60" label={tu("xpProgress")} />
          </div>
          <div className="relative mt-4 flex gap-2">
            <Button variant="secondary" size="sm" onClick={openEdit}><Pencil className="size-4" aria-hidden /> {tu("editProfile")}</Button>
            <ButtonLink href="/quests" size="sm" className="!bg-ink !text-cream !shadow-none"><Trophy className="size-4" aria-hidden /> {tu("quests")}</ButtonLink>
          </div>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-3 gap-2 px-4 md:px-0">
        <Stat label={tu("tickets")} value={s.orders.length} accent="#B6F05C" />
        <Stat label={tu("supported")} value={Object.keys(s.support).length} accent="#FFAD5B" />
        <Stat label={tu("following")} value={s.favorites.length} accent="#FF625C" />
      </div>

      {/* Dashboards */}
      <section aria-labelledby="dash-h" className="mt-8 px-4 md:px-0">
        <h2 id="dash-h" className="text-2xl uppercase">{tu("dashboards")}</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["organizer", tu("organizer"), CalendarDays, "#B6F05C"],
            ["dj", "DJ", Mic2, "#A276E9"],
            ["venue", tu("venueOwner"), Building2, "#55BCEB"],
            ["fan", tu("fan"), Heart, "#FF625C"],
          ].map(([role, label, Icon, color]) => {
            const I = Icon as typeof Mic2;
            return (
              <Link key={role as string} href={`/dashboard?role=${role}`} className="flex min-h-16 items-center gap-2.5 rounded-2xl border border-line bg-surface p-3 hover:border-cream/30">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border-2 border-ink text-ink" style={{ background: color as string }}><I className="size-5" aria-hidden /></span>
                <span className="text-sm font-extrabold">{label as string}</span>
              </Link>
            );
          })}
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Link href="/profile/work" className="flex min-h-14 items-center justify-between gap-2 rounded-2xl border border-acid/40 bg-surface p-3 font-extrabold hover:border-acid" data-testid="link-work">
            <span className="inline-flex items-center gap-2"><Package className="size-5 text-acid" aria-hidden /> {to("workTitle")}</span>
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/events/manage" className="flex min-h-14 items-center justify-between gap-2 rounded-2xl border border-acid/40 bg-surface p-3 font-extrabold hover:border-acid" data-testid="link-manage">
            <span className="inline-flex items-center gap-2"><CalendarDays className="size-5 text-acid" aria-hidden /> {to("manageTitle")}</span>
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          {myPublicId && (
            <Link href={`/u/${myPublicId}/world`} className="flex min-h-14 items-center justify-between gap-2 rounded-2xl border border-acid/40 bg-surface p-3 font-extrabold hover:border-acid" data-testid="link-party-world">
              <span className="inline-flex items-center gap-2"><Orbit className="size-5 text-acid" aria-hidden /> {tparty("myWorld")}</span>
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
          <Link href="/profile/parties" className="flex min-h-14 items-center justify-between gap-2 rounded-2xl border border-acid/40 bg-surface p-3 font-extrabold hover:border-acid" data-testid="link-my-parties">
            <span className="inline-flex items-center gap-2"><Ticket className="size-5 text-acid" aria-hidden /> {tparty("myParties")}</span>
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/profile/dj" className="flex min-h-14 items-center justify-between gap-2 rounded-2xl border border-acid/40 bg-surface p-3 font-extrabold hover:border-acid" data-testid="link-dj-studio">
            <span className="inline-flex items-center gap-2"><Headphones className="size-5 text-acid" aria-hidden /> {tmusic("studioTitle")}</span>
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/music/library" className="flex min-h-14 items-center justify-between gap-2 rounded-2xl border border-acid/40 bg-surface p-3 font-extrabold hover:border-acid" data-testid="link-library">
            <span className="inline-flex items-center gap-2"><Library className="size-5 text-acid" aria-hidden /> {tmusic("myLibrary")}</span>
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>

      <div className="mt-8 grid gap-8 px-4 md:grid-cols-2 md:px-0">
        <Section icon={Ticket} title={tu("tickets")} action={<Link href="/tickets" className="text-sm font-bold text-acid">{tu("all")}</Link>}>
          {s.orders.length ? (
            <ul className="space-y-2">
              {s.orders.slice(0, 3).map((o) => (
                <li key={o.id}><Link href={`/tickets/${o.id}`} className="flex min-h-14 items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-4"><span className="truncate font-bold">{getEvent(o.eventId)?.name}</span><DemoBadge /></Link></li>
              ))}
            </ul>
          ) : (
            <EmptyState title={tu("noTickets")} body={tu("text")} action={<ButtonLink href={`/events/${EVENTS[0].id}/tickets`} size="sm">{tu("getADemoTicket")}</ButtonLink>} />
          )}
        </Section>

        <Section icon={CalendarDays} title={tu("upcoming")}>
          {upcoming.length ? (
            <ul className="space-y-2">
              {upcoming.map((e) => (
                <li key={e!.id}><Link href={`/events/${e!.id}`} className="flex min-h-14 items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-4"><span className="min-w-0"><span className="block truncate font-bold">{e!.name}</span><span className="text-xs text-mute">{e!.city} · {fmtDate(e!.startsAt)}</span></span><ArrowRight className="size-4 shrink-0" aria-hidden /></Link></li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mute">{tu("supportAnEventOrGet")}</p>
          )}
        </Section>

        <Section icon={PartyPopper} title={tu("history")}>
          <ul className="space-y-2">
            {PAST_EVENTS.map((e) => (
              <li key={e.name} className="flex min-h-12 items-center justify-between rounded-2xl bg-surface-2 px-4 text-sm"><span className="font-bold">{e.name}</span><span className="text-mute">{e.city} · {fmtDate(e.date + "T00:00:00Z", { month: "short", year: "numeric" })}</span></li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-mute">{tu("sampleHistoryForTheDemo")}</p>
        </Section>

        <Section icon={Heart} title={tu("favoriteDjs")}>
          {s.favorites.length ? (
            <ul className="flex flex-wrap gap-3">
              {s.favorites.map((id) => {
                const d = getDJ(id);
                return d ? <li key={id}><Link href={`/djs/${id}`} className="flex w-20 flex-col items-center gap-1 text-center"><AlienAvatar look={d.look} size={64} ring={d.look.accent} /><span className="line-clamp-2 text-xs font-bold">{d.name}</span></Link></li> : null;
              })}
            </ul>
          ) : <p className="text-sm text-mute">{tu("followDjsInTheDj")}</p>}
        </Section>

        <Section icon={Package} title={tu("items")}>
          <ul className="flex flex-wrap gap-2">
            {s.ownedItems.map((i) => <li key={i} className="rounded-full bg-surface-2 px-3 py-2 text-sm font-bold capitalize">{i}</li>)}
          </ul>
          <Link href="/avatar" className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-acid">{tu("useInAvatarStudio")}</Link>
        </Section>

        <Section icon={Gem} title={tu("nftCollection")} action={<DemoBadge label={tu("preview")} />}>
          <ul className="grid grid-cols-3 gap-2">
            {COLLECTIBLES.slice(0, 3).map((c) => (
              <li key={c.id} className="overflow-hidden rounded-2xl border border-line">
                <div className="aspect-square" style={{ background: c.bg }}><Alien look={c.look} className="h-full w-full p-1" /></div>
                <div className="truncate p-1.5 text-[11px] font-bold">{c.name}</div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-mute">{tu("notMintedNoWalletConnected")}</p>
        </Section>
      </div>

      </div>)}
      {tab === "settings" && (<div className="-mx-4 md:mx-0" data-testid="profile-tab-settings">
      {/* Settings */}
      <section aria-labelledby="set-h" className="px-4 md:px-0">
        <h2 id="set-h" className="flex items-center gap-2 text-2xl uppercase"><Settings className="size-5" aria-hidden /> {tu("settings2")}</h2>
        <Card className="mt-3 divide-y divide-line">
          <button type="button" onClick={openEdit} className="flex min-h-14 w-full items-center justify-between px-4 text-left font-bold">{tu("editProfile")} <ArrowRight className="size-4" aria-hidden /></button>
          <Link href="/avatar" className="flex min-h-14 items-center justify-between px-4 font-bold">{tu("avatar")} <ArrowRight className="size-4" aria-hidden /></Link>
          <div className="flex min-h-14 items-center justify-between px-4"><span className="font-bold">{tu("wallet")}</span><span className="text-sm text-mute">{tu("notConnectedPhase3")}</span></div>
          <div className="flex min-h-14 items-center justify-between px-4"><span className="font-bold">{tu("notifications")}</span><span className="text-sm text-mute">{tu("comingSoon")}</span></div>
          <button type="button" onClick={() => setConfirmReset(true)} className="flex min-h-14 w-full items-center gap-2 px-4 text-left font-bold text-coral"><Trash2 className="size-4" aria-hidden /> {tu("resetAllDemoData")}</button>
        </Card>
        <DemoNotice className="mt-3">{tu("thisProfileAndEverythingYou")}</DemoNotice>
      </section>
      </div>)}
      </Tabs>

      <BottomSheet open={edit} onClose={() => setEdit(false)} title={tu("editProfile")} footer={<Button className="mb-1 w-full" onClick={saveProfile}>{tu("save")}</Button>}>
        <div className="space-y-4">
          <Field id="pf-u" label={tu("username")}><Input id="pf-u" autoComplete="username" value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} /></Field>
          <Field id="pf-c" label={tu("city")}><Input id="pf-c" autoComplete="address-level2" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} /></Field>
          <Field id="pf-b" label={tu("bio")}><Textarea id="pf-b" maxLength={160} value={draft.bio} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} /></Field>
          <fieldset>
            <legend className="text-sm font-bold">{tu("favoriteGenres")}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {GENRES.map((g) => <Chip key={g} active={draft.favoriteGenres.includes(g)} onClick={() => setDraft({ ...draft, favoriteGenres: draft.favoriteGenres.includes(g) ? draft.favoriteGenres.filter((x) => x !== g) : [...draft.favoriteGenres, g as Genre] })}>{g}</Chip>)}
            </div>
          </fieldset>
        </div>
      </BottomSheet>

      <ConfirmDialog open={confirmReset} title={tu("resetDemoData")} cancelLabel={tu("cancel")} confirmLabel={tu("reset")} onCancel={() => setConfirmReset(false)} onConfirm={() => { s.resetAll(); setConfirmReset(false); toast({ title: tu("demoDataReset") }); }}>
        <p>{tu("thisClearsYourDemoTickets")}</p>
      </ConfirmDialog>
    </div>
  );
}

function Section({ icon: Icon, title, action, children }: { icon: typeof Mic2; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-2xl uppercase"><Icon className="size-5 text-acid" aria-hidden />{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
