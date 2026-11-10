"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Component, useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Bell, BellOff, Box, Check, CircleDashed, Map as MapIcon, Pencil, ShieldBan, Sparkles, Star, Ticket, UserPlus, Users } from "lucide-react";
import { Alien } from "@/components/art/Alien";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { Field, Input } from "@/components/forms/Fields";
import { Button, DemoBadge, DemoNotice, Progress } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { Section, useWhen } from "@/components/ops/shared";
import { WorldLite } from "@/components/party/WorldLite";
import { THEME_COLORS, TIERS, prefersLite, useParty, usePartyPost, type Planet, type WorldData } from "@/components/party/shared";
import { PassCard } from "@/components/party/PassCard";
import { useAuth } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

const World3D = dynamic(() => import("@/components/party/World3D").then((m) => m.World3D), { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-surface" /> });

type Mode = "3d" | "lite";

/** If the 3D view fails for any reason, fall back to the light 2D world instead of breaking the page. */
class Fallback extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
const MODE_KEY = "fk-world-mode";

export function WorldView({ handle }: { handle: string }) {
  const t = useTranslations("party");
  const href = useLocalHref();
  const status = useAuth((s) => s.status);
  const { data, error, reload } = useParty<{ world: WorldData }>(status === "loading" ? null : `/api/party/worlds/${handle}`);
  const w = data?.world;
  return (
    <div className="mx-auto max-w-6xl pb-24 md:px-6">
      <div className="px-4 pt-4 md:px-0 md:pt-6">
        <Link href={href(`/u/${handle}`)} className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-mute hover:text-cream" data-testid="world-exit">
          <ArrowLeft className="size-4" aria-hidden /> {t("backToProfile")}
        </Link>
      </div>
      <div className="px-4 md:px-0">
        {error ? (
          <EmptyState title={t("worldNotFound")} body={t("worldNotFoundBody")} />
        ) : !w ? (
          <div className="mt-2 h-[420px] animate-pulse rounded-[32px] bg-surface" aria-busy="true" />
        ) : (
          <Inner w={w} handle={handle} reload={reload} />
        )}
      </div>
    </div>
  );
}

function Inner({ w, handle, reload }: { w: WorldData; handle: string; reload: () => Promise<void> }) {
  const t = useTranslations("party");
  const href = useLocalHref();
  const when = useWhen();
  const [mode, setMode] = useState<Mode | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(MODE_KEY);
    } catch {}
    setMode(saved === "3d" || saved === "lite" ? saved : prefersLite() ? "lite" : "3d");
  }, []);
  const pick = (m: Mode) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {}
  };
  const planetHref = (p: Planet) => href(`/u/${handle}/world/${p.id}`);
  const sel = w.planets.find((p) => p.id === selected) ?? null;
  const ownerName = w.owner.name ?? t("anonymousOrganizer");

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3 pt-1">
        <div className="flex min-w-0 items-center gap-3">
          {w.owner.look && <Alien look={w.owner.look} className="size-16 shrink-0 rounded-2xl border-2 border-ink bg-purple" />}
          <div className="min-w-0">
            <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-acid">{t("kicker")}</div>
            <h1 className="truncate text-[30px] uppercase leading-none sm:text-5xl" data-testid="world-title">
              {t("worldOf", { name: ownerName })}
            </h1>
            {w.owner.tagline && <p className="mt-1 text-sm text-mute">{w.owner.tagline}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {w.demo && <DemoBadge />}
          <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-extrabold uppercase" data-testid="world-stage">
            {t("stageN", { n: w.growth.stage })} · {t(`stage.${w.growth.stage}`)}
          </span>
        </div>
      </header>
      {w.demo && <DemoNotice>{t("demoNotice")}</DemoNotice>}

      <div className="relative overflow-hidden rounded-[32px] border-[3px] border-ink bg-ink">
        <div className="absolute right-3 top-3 z-10 flex rounded-full border border-line bg-ink/80 p-1 backdrop-blur" role="group" aria-label={t("viewMode")}>
          {(["3d", "lite"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => pick(m)}
              aria-pressed={mode === m}
              data-testid={`mode-${m}`}
              className={cn("inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-extrabold uppercase", mode === m ? "bg-acid text-ink" : "text-cream")}
            >
              {m === "3d" ? <Box className="size-3.5" aria-hidden /> : <MapIcon className="size-3.5" aria-hidden />}
              {t(m === "3d" ? "mode3d" : "modeLite")}
            </button>
          ))}
        </div>
        <div className="h-[56vh] max-h-[560px] min-h-[340px]">
          {mode === "3d" ? (
            <Fallback onError={() => setMode("lite")}>
              <World3D w={w} planetHref={planetHref} selected={selected} onSelect={setSelected} onFail={() => setMode("lite")} />
            </Fallback>
          ) : mode === "lite" ? (
            <WorldLite w={w} planetHref={planetHref} selected={selected} onSelect={setSelected} />
          ) : null}
        </div>
        <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] font-bold text-mute">{t(mode === "3d" ? "hint3d" : "hintLite")}</p>
      </div>

      {sel && (
        <div className="rounded-3xl border-2 p-4" style={{ borderColor: THEME_COLORS[sel.theme].glow }} data-testid="planet-card">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider" style={{ color: THEME_COLORS[sel.theme].glow }}>
                {t(`theme.${sel.theme}`)} · {t(`state.${sel.state}`)}
              </div>
              <h2 className="text-2xl uppercase">{sel.name}</h2>
              <p className="text-sm text-mute">
                {when(sel.startAt, sel.timezone, false)} · {sel.city}
                {sel.venueName ? ` · ${sel.venueName}` : ""}
              </p>
            </div>
            <Link href={planetHref(sel)} className="inline-flex min-h-11 items-center rounded-full bg-acid px-4 text-sm font-extrabold uppercase text-ink" data-testid="planet-open">
              {t("openMemories")}
            </Link>
          </div>
          <PlanetFigures p={sel} />
        </div>
      )}

      <Dashboard w={w} />

      <div className="grid gap-4 lg:grid-cols-2">
        <NextParty w={w} handle={handle} reload={reload} />
        <FollowBox w={w} handle={handle} reload={reload} />
      </div>

      <Impact w={w} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Community w={w} />
        <Growth w={w} />
      </div>

      <Section title={t("history")} id="world-history">
        {w.planets.length === 0 ? (
          <p className="text-sm text-mute">{w.isOwner ? t("emptyOwner") : t("emptyVisitor")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {[...w.planets].reverse().map((p) => (
              <li key={p.id}>
                <Link href={planetHref(p)} className="flex min-h-14 items-center justify-between gap-3 py-2 hover:text-acid" data-testid="history-item">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="size-4 shrink-0 rounded-full border-2" style={{ background: THEME_COLORS[p.theme].base, borderColor: THEME_COLORS[p.theme].glow }} aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate font-extrabold uppercase">{p.name}</span>
                      <span className="block text-xs text-mute">{when(p.startAt, p.timezone, false)} · {p.city} · {t(`theme.${p.theme}`)}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs font-bold">
                    <span className="block">{t(`state.${p.state}`)}</span>
                    {p.attendance !== null && <span className="block text-mute">{t("verifiedCount", { n: p.attendance })}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {w.isOwner && <OwnerTools w={w} reload={reload} />}
    </div>
  );
}

function PlanetFigures({ p }: { p: Planet }) {
  const t = useTranslations("party");
  return (
    <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
      <div className="rounded-2xl bg-surface p-2">
        <dt className="text-[10px] font-extrabold uppercase text-mute">{t("verifiedAttendance")}</dt>
        <dd className="font-display text-xl">{p.attendance ?? "—"}</dd>
      </div>
      <div className="rounded-2xl bg-surface p-2">
        <dt className="text-[10px] font-extrabold uppercase text-mute">{t("rating")}</dt>
        <dd className="font-display text-xl">{p.rating !== null ? p.rating.toFixed(1) : "—"}</dd>
      </div>
      <div className="rounded-2xl bg-surface p-2">
        <dt className="text-[10px] font-extrabold uppercase text-mute">{t("size")}</dt>
        <dd className="font-display text-xl">L{p.level}</dd>
      </div>
    </dl>
  );
}

function Dashboard({ w }: { w: WorldData }) {
  const t = useTranslations("party");
  const s = w.stats;
  const tiles: { k: string; v: string | number; sub?: string }[] = [
    { k: "totalEvents", v: s.totalEvents },
    { k: "totalAttendance", v: s.totalAttendance },
    { k: "uniqueVisitors", v: s.uniqueVisitors },
    { k: "returningVisitors", v: s.returningVisitors },
    { k: "averageRating", v: s.averageRating !== null ? s.averageRating.toFixed(2) : "—", sub: t("reviewsN", { n: s.reviewCount }) },
    { k: "impact", v: w.impact.score ?? "—", sub: w.impact.score === null ? t("insufficient") : t(`confidence.${w.impact.confidence}`) },
  ];
  return (
    <section aria-labelledby="dash-h" className="rounded-3xl border border-line bg-surface/80 p-4 md:p-5">
      <h2 id="dash-h" className="mb-3 text-xl uppercase md:text-2xl">{t("dashboard")}</h2>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((x) => (
          <div key={x.k} className="rounded-2xl bg-ink p-3" data-testid={`dash-${x.k}`}>
            <dt className="text-[10px] font-extrabold uppercase tracking-wider text-mute">{t(`dash.${x.k}`)}</dt>
            <dd className="font-display text-3xl leading-tight" data-value>{x.v}</dd>
            {x.sub && <dd className="text-[11px] font-bold text-mute">{x.sub}</dd>}
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-mute">{t("dashDefinitions")}</p>
      {s.guests > 0 && <p className="mt-1 text-xs font-bold text-orange" data-testid="dash-guests">{t("guestsSeparate", { n: s.guests })}</p>}
    </section>
  );
}

function Impact({ w }: { w: WorldData }) {
  const t = useTranslations("party");
  const i = w.impact;
  const parts = ["satisfaction", "community", "engagement", "consistency", "scale"] as const;
  const weight = { satisfaction: 35, community: 25, engagement: 15, consistency: 15, scale: 10 };
  return (
    <Section title={t("impactTitle")} id="impact-h">
      <div className="flex flex-wrap items-center gap-4" data-testid="impact">
        <div className="flex size-28 shrink-0 flex-col items-center justify-center rounded-full border-[3px] border-acid">
          {i.score === null ? <span className="px-2 text-center text-xs font-extrabold uppercase text-orange">{t("insufficient")}</span> : <span className="font-display text-5xl">{i.score}</span>}
          <span className="text-[10px] font-extrabold uppercase text-mute">{t("estimate")}</span>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          {parts.map((k) => (
            <div key={k}>
              <div className="mb-0.5 flex justify-between text-xs font-bold">
                <span>{t(`impactPart.${k}`)} <span className="text-mute">({weight[k]}%)</span></span>
                <span>{i.parts[k] ?? "—"}</span>
              </div>
              <Progress value={i.parts[k] ?? 0} label={t(`impactPart.${k}`)} />
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-mute">
        {i.confidence && <span className="font-bold text-cream">{t("confidenceLabel")}: {t(`confidence.${i.confidence}`)} · </span>}
        {t("impactDisclaimer")}
      </p>
    </Section>
  );
}

function Community({ w }: { w: WorldData }) {
  const t = useTranslations("party");
  const href = useLocalHref();
  const c = w.community;
  return (
    <Section title={t("community")} id="community-h">
      <div className="mb-3 grid grid-cols-4 gap-2 text-center">
        {TIERS.map((k) => (
          <div key={k} className="rounded-2xl bg-ink p-2">
            <div className="font-display text-2xl">{c.tiers[k]}</div>
            <div className="text-[10px] font-extrabold uppercase text-mute">{t(`tier.${k}`)}</div>
          </div>
        ))}
      </div>
      {c.shown.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" data-testid="community-shown">
          {c.shown.slice(0, 48).map((a) => {
            const inner = (
              <>
                <Alien look={a.look} className={cn("size-12 rounded-xl bg-surface-2", a.tier === "aura" && "ring-2 ring-purple", a.tier === "glow" && "ring-2 ring-acid", a.tier === "regular" && "ring-2 ring-orange")} />
                {a.tier === "regular" && <Star className="absolute -right-1 -top-1 size-4 fill-orange text-orange" aria-hidden />}
              </>
            );
            const label = t("attendeeLabel", { name: a.name ?? "—", visits: a.visits, tier: t(`tier.${a.tier}`) });
            return (
              <li key={a.key} className="relative">
                {a.publicId ? (
                  <Link href={href(`/u/${a.publicId}`)} aria-label={label} title={label} className="relative block">{inner}</Link>
                ) : (
                  <span aria-label={label} title={label} className="relative block">{inner}</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-mute">{t("noneShown")}</p>
      )}
      <p className="mt-3 text-xs text-mute" data-testid="community-anon">{t("anonymousCrowd", { n: c.anonymous, total: c.total })}</p>
      {w.me && (
        <p className="mt-1 text-xs font-bold text-acid" data-testid="my-visits">
          {w.me.visits > 0 ? t("myVisits", { n: w.me.visits, tier: t(`tier.${w.me.tier ?? "first"}`) }) : t("myVisitsNone")}
          {!w.me.privacy.showInWorlds && w.me.visits > 0 && <> · {t("youAreAnonymous")}</>}
        </p>
      )}
    </Section>
  );
}

function Growth({ w }: { w: WorldData }) {
  const t = useTranslations("party");
  return (
    <Section title={t("growthTitle")} id="growth-h">
      <Progress value={(w.growth.stage / 5) * 100} label={t("stageN", { n: w.growth.stage })} />
      <ul className="mt-3 space-y-1.5">
        {w.growth.milestones.map((m) => (
          <li key={m.key} className={cn("flex items-center gap-2 text-sm", m.reached ? "text-cream" : "text-mute")}>
            {m.reached ? <Check className="size-4 text-acid" aria-hidden /> : <CircleDashed className="size-4" aria-hidden />}
            <span>{t(`milestone.${m.key}`)}</span>
            <span className="sr-only">{m.reached ? t("reached") : t("notReached")}</span>
          </li>
        ))}
      </ul>
      {w.growth.areas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {w.growth.areas.map((a) => (
            <span key={a} className="rounded-full border px-2 py-0.5 text-[11px] font-extrabold uppercase" style={{ borderColor: THEME_COLORS[a].glow, color: THEME_COLORS[a].glow }}>
              {t(`theme.${a}`)}
            </span>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-mute">{t("growthNote")}</p>
    </Section>
  );
}

function NextParty({ w, handle, reload }: { w: WorldData; handle: string; reload: () => Promise<void> }) {
  const t = useTranslations("party");
  const href = useLocalHref();
  const when = useWhen();
  const post = usePartyPost();
  const status = useAuth((s) => s.status);
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const n = w.next;
  const run = async (path: string, msg: string) => {
    setBusy(true);
    const r = await post(path, {}, msg);
    setBusy(false);
    if (r) await reload();
  };
  return (
    <Section title={t("nextParty")} id="next-h">
      {!n ? (
        <p className="text-sm text-mute">{t("noNext")}</p>
      ) : (
        <div data-testid="next-party">
          <Link href={href(`/u/${handle}/world/${n.id}`)} className="text-xl font-extrabold uppercase hover:text-acid">{n.name}</Link>
          <p className="text-sm text-mute">{when(n.startAt, n.timezone)} · {n.city}{n.venueName ? ` · ${n.venueName}` : ""}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {w.isOwner ? (
              <p className="text-xs text-mute">{t("ownerNextNote")}</p>
            ) : status !== "signedIn" ? (
              <Link href={href(`/login?returnTo=${encodeURIComponent(`/u/${handle}/world`)}`)} className="inline-flex min-h-11 items-center rounded-full bg-acid px-4 text-sm font-extrabold uppercase text-ink">{t("signInToRsvp")}</Link>
            ) : n.myStatus === "going" ? (
              <>
                <Button onClick={() => setShowPass((x) => !x)} data-testid="show-pass"><Ticket className="size-4" aria-hidden /> {t("myPass")}</Button>
                <Button variant="ghost" disabled={busy} onClick={() => run(`events/${n.id}/cancel`, t("rsvpCancelled"))} data-testid="rsvp-cancel">{t("cancelRsvp")}</Button>
              </>
            ) : (
              <Button disabled={busy || w.demo} onClick={() => run(`events/${n.id}/rsvp`, t("rsvpDone"))} data-testid="rsvp">{t("rsvp")}</Button>
            )}
          </div>
          <p className="mt-2 text-xs text-mute">{t("rsvpNote")}</p>
          {showPass && n.myStatus === "going" && <PassCard eventId={n.id} />}
        </div>
      )}
    </Section>
  );
}

function FollowBox({ w, handle, reload }: { w: WorldData; handle: string; reload: () => Promise<void> }) {
  const t = useTranslations("party");
  const href = useLocalHref();
  const post = usePartyPost();
  const status = useAuth((s) => s.status);
  const myId = useAuth((s) => s.me?.user.id);
  const [busy, setBusy] = useState(false);
  const f = w.follow;
  // Visitors address the organizer by the public handle; the internal user id is never sent to them.
  const oid = handle;
  const run = async (action: string, body: unknown, msg: string) => {
    if (!oid) return;
    setBusy(true);
    const r = await post(`organizers/${oid}/${action}`, body, msg);
    setBusy(false);
    if (r) await reload();
  };
  return (
    <Section title={t("followTitle")} id="follow-h">
      <p className="text-sm text-mute">{t("followers", { n: w.followers })}</p>
      {w.isOwner ? (
        <p className="mt-2 text-xs text-mute">{t("ownerFollowNote")}</p>
      ) : status !== "signedIn" || !myId ? (
        <p className="mt-2 text-sm">
          <Link href={href("/login")} className="font-bold text-acid underline">{t("signInToFollow")}</Link>
        </p>
      ) : f?.blocked ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-orange">{t("blockedNote")}</p>
          <Button variant="ghost" disabled={busy} onClick={() => run("unblock", {}, t("unblocked"))} data-testid="unblock">{t("unblock")}</Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {f?.following ? (
            <>
              <Button variant="ghost" disabled={busy} onClick={() => run("follow", { notify: !f.notify }, f.notify ? t("notifyOff") : t("notifyOn"))} data-testid="toggle-notify">
                {f.notify ? <BellOff className="size-4" aria-hidden /> : <Bell className="size-4" aria-hidden />} {f.notify ? t("stopNotify") : t("notifyMe")}
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => run("unfollow", {}, t("unfollowed"))} data-testid="unfollow">{t("unfollow")}</Button>
            </>
          ) : (
            <Button disabled={busy || w.demo} onClick={() => run("follow", { notify: true }, t("followed"))} data-testid="follow"><UserPlus className="size-4" aria-hidden /> {t("follow")}</Button>
          )}
          <Button variant="ghost" disabled={busy || w.demo} onClick={() => run("block", {}, t("blocked"))} data-testid="block"><ShieldBan className="size-4" aria-hidden /> {t("block")}</Button>
        </div>
      )}
      <p className="mt-3 text-xs text-mute">{t("noDmNote")}</p>
    </Section>
  );
}

function OwnerTools({ w, reload }: { w: WorldData; reload: () => Promise<void> }) {
  const t = useTranslations("party");
  const href = useLocalHref();
  const post = usePartyPost();
  const [tag, setTag] = useState(w.owner.tagline);
  const [busy, setBusy] = useState(false);
  return (
    <Section title={t("ownerTools")} id="owner-h">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field label={t("tagline")} id="tagline" hint={t("taglineHint")}>
            <Input id="tagline" value={tag} maxLength={140} onChange={(e) => setTag(e.target.value)} />
          </Field>
        </div>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            if (await post("tagline", { tagline: tag }, t("saved"))) await reload();
            setBusy(false);
          }}
        >
          <Pencil className="size-4" aria-hidden /> {t("save")}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <Link href={href("/events/manage")} className="inline-flex min-h-11 items-center gap-1 rounded-full border-2 border-cream/30 px-4 font-extrabold uppercase"><Sparkles className="size-4" aria-hidden /> {t("manageEvents")}</Link>
        <Link href={href("/profile/parties")} className="inline-flex min-h-11 items-center gap-1 rounded-full border-2 border-cream/30 px-4 font-extrabold uppercase"><Users className="size-4" aria-hidden /> {t("myParties")}</Link>
      </div>
      <p className="mt-3 text-xs text-mute">{t("ownerPublishNote")}</p>
    </Section>
  );
}
