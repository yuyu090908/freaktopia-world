"use client";

/**
 * FREAK ID: the account's membership card (Phase 1). Every number comes from /api/loyalty/me, which counts only the
 * person's own door check-ins at events verified as held. Nothing here is simulated; with no history it says so.
 */
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, BadgeCheck, CalendarClock, Globe2, Info, MapPin, Orbit, Ticket } from "lucide-react";
import { Alien } from "@/components/art/Alien";
import { ButtonLink, Progress } from "@/components/ui/primitives";
import { useFreakId, useLoyaltyRules, RANK_COLOR, type FreakId } from "@/lib/loyalty/client";
import { RANKS, effectiveDiscountPct, fullDiscountPending, type LoyaltyRules, type Rank } from "@/lib/loyalty/rules";
import { formatEventDate } from "@/lib/i18n/format";
import type { Locale } from "@/i18n/config";

export function FreakIdCard() {
  const t = useTranslations("loyalty");
  const v = useFreakId();
  if (v.state === "loading") return <div className="h-48 animate-pulse rounded-[28px] border-2 border-line bg-surface" aria-busy="true" aria-label={t("loading")} />;
  if (v.state === "signedOut")
    return (
      <section className="rounded-[28px] border-2 border-[#3C3148] bg-[#15111D] p-5" aria-labelledby="fid-title" data-testid="freak-id">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-acid">FREAK ID</p>
        <h2 id="fid-title" className="mt-1 text-2xl uppercase">{t("signedOutTitle")}</h2>
        <p className="mt-2 max-w-prose text-sm text-[#BDB5C8]">{t("signedOutBody")}</p>
        <PublicLadder />
        <ButtonLink href="/login?next=/profile" className="mt-4">{t("signIn")}</ButtonLink>
      </section>
    );
  if (v.state === "error")
    return (
      <section className="rounded-[28px] border-2 border-coral/60 bg-[#15111D] p-5" data-testid="freak-id">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-acid">FREAK ID</p>
        <p className="mt-2 text-sm">{t("loadError")}</p>
      </section>
    );
  return <Card id={v.data} />;
}

function Card({ id }: { id: FreakId }) {
  const t = useTranslations("loyalty");
  const locale = useLocale() as Locale;
  const color = RANK_COLOR[id.rank];
  const rankName = t(`rank.${id.rank}`);
  return (
    <section className="overflow-hidden rounded-[28px] border-2 bg-[#15111D]" style={{ borderColor: `${color}88` }} aria-labelledby="fid-title" data-testid="freak-id" data-rank={id.rank}>
      {/* Top: avatar, name, rank, progress */}
      <div className="relative p-5" style={{ background: `linear-gradient(135deg, ${color}26, transparent 60%)` }}>
        <div className="flex items-center gap-4">
          <div className="size-20 shrink-0 rounded-3xl border-2 border-[#3C3148] bg-[#21192B]">{id.look && <Alien look={id.look} className="h-full w-full p-1" title={id.name ?? undefined} />}</div>
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-acid">FREAK ID</p>
            <h2 id="fid-title" className="truncate text-2xl uppercase leading-none">{id.name ?? id.username ?? "—"}</h2>
            {id.freakId && <p className="mt-1 font-mono text-xs text-[#BDB5C8]" data-testid="freak-id-number">{id.freakId}</p>}
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-0.5 font-display text-sm uppercase" style={{ borderColor: color, color }} data-testid="freak-id-rank">
              <BadgeCheck className="size-4" aria-hidden /> {rankName}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs font-bold text-[#BDB5C8]">
            <span>{t("verifiedCount", { count: id.verifiedEvents })}</span>
            <span>{id.next ? t("toNext", { count: id.next.remaining, rank: t(`rank.${id.next.rank}`) }) : t("topRank")}</span>
          </div>
          <Progress value={id.progress} color={color} label={t("progressLabel")} />
        </div>
      </div>

      {/* Middle: discount, places */}
      <dl className="grid grid-cols-2 gap-px bg-[#3C3148] sm:grid-cols-4" data-testid="freak-id-stats">
        <Stat label={t("feeDiscount")} value={`${id.discountPct}%`} accent={color} />
        <Stat label={t("verifiedEvents")} value={id.verifiedEvents} />
        <Stat label={t("cities")} value={id.cityCount} />
        <Stat label={t("countries")} value={id.countryCount} />
      </dl>

      <div className="space-y-3 p-5">
        <p className="flex gap-2 text-sm text-[#BDB5C8]"><Info className="mt-0.5 size-4 shrink-0 text-[#66DFFF]" aria-hidden />{t("howCounted")}</p>
        {id.fullDiscountPending && <p className="rounded-2xl border border-[#FFB45C]/50 bg-[#FFB45C]/10 p-3 text-sm">{t("legendPending", { pct: id.discountPct })}</p>}
        {id.pendingEvents > 0 && <p className="flex gap-2 text-sm"><CalendarClock className="mt-0.5 size-4 shrink-0 text-[#FFB45C]" aria-hidden />{t("pending", { count: id.pendingEvents })}</p>}
        {id.excludedEvents > 0 && (
          <p className="text-sm">
            {t("excluded", { count: id.excludedEvents })} <Link href="/contact" className="font-bold text-acid underline">{t("appeal")}</Link>
          </p>
        )}
        {id.scheduled && (
          <p className="rounded-2xl border border-[#FF79CD]/50 bg-[#FF79CD]/10 p-3 text-sm" data-testid="loyalty-notice">
            <strong>{t("ruleChange", { date: formatEventDate(locale, id.scheduled.effectiveAt, "UTC", { year: "numeric", month: "short", day: "numeric" }) })}</strong> {id.scheduled.notice}
          </p>
        )}
        {!id.emailVerified && <p className="text-sm text-coral">{t("verifyEmail")}</p>}

        <details className="group rounded-2xl border border-[#3C3148] bg-[#21192B] p-3">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between font-extrabold uppercase">{t("ranksTitle")}</summary>
          <RankLadder rules={id.rules} current={id.rank} />
        </details>

        <details className="rounded-2xl border border-[#3C3148] bg-[#21192B] p-3" data-testid="freak-id-history">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between font-extrabold uppercase">{t("historyTitle", { count: id.verifiedEvents })}</summary>
          {id.history.length === 0 ? (
            <p className="mt-2 text-sm text-[#BDB5C8]">{t("noHistory")}</p>
          ) : (
            <>
              <ul className="mt-2 divide-y divide-[#3C3148]">
                {id.history.slice(0, 10).map((h) => (
                  <li key={h.eventId} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0"><span className="block truncate font-bold">{h.name}</span><span className="text-xs text-[#BDB5C8]">{h.city} · {formatEventDate(locale, h.startAt, "UTC", { year: "numeric", month: "short", day: "numeric" })}</span></span>
                    <span className="shrink-0 text-xs font-bold uppercase text-[#BDB5C8]">{h.method === "qr" ? t("methodQr") : t("methodManual")}</span>
                  </li>
                ))}
              </ul>
              {id.cities.length > 0 && (
                <p className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  {id.cities.map((c) => <span key={`${c.city}|${c.country}`} className="inline-flex items-center gap-1 rounded-full bg-[#15111D] px-2 py-1"><MapPin className="size-3" aria-hidden />{c.city} ×{c.count}</span>)}
                </p>
              )}
            </>
          )}
        </details>

        <p className="flex gap-2 text-xs text-[#BDB5C8]"><Ticket className="mt-0.5 size-4 shrink-0" aria-hidden />{t("laterPhases")}</p>

        <div className="grid gap-2 sm:grid-cols-2">
          {id.freakId && (
            <ButtonLink href={`/u/${id.freakId}/world`} variant="secondary" className="w-full" data-testid="freak-id-world">
              <Orbit className="size-4" aria-hidden /> {t("viewWorld")}
            </ButtonLink>
          )}
          <ButtonLink href="/profile/parties" variant="secondary" className="w-full">
            <Globe2 className="size-4" aria-hidden /> {t("partyHistory")} <ArrowRight className="size-4" aria-hidden />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="bg-[#15111D] px-4 py-3">
      <dd className="font-display text-2xl leading-none" style={accent ? { color: accent } : undefined}>{value}</dd>
      <dt className="mt-1 text-[11px] font-bold uppercase leading-tight text-[#BDB5C8]">{label}</dt>
    </div>
  );
}

function PublicLadder() {
  const rules = useLoyaltyRules();
  return rules ? <RankLadder rules={rules} current={null} /> : null;
}

/** The five ranks with what each needs and gives, using the rules in force. */
function RankLadder({ rules, current }: { rules: LoyaltyRules; current: Rank | null }) {
  const t = useTranslations("loyalty");
  return (
    <table className="mt-3 w-full text-left text-sm" data-testid="rank-ladder">
      <thead className="text-xs uppercase text-[#BDB5C8]">
        <tr><th className="py-1 pr-2 font-bold">{t("colRank")}</th><th className="py-1 pr-2 font-bold">{t("colEvents")}</th><th className="py-1 font-bold">{t("colDiscount")}</th></tr>
      </thead>
      <tbody className="divide-y divide-[#3C3148]">
        {RANKS.map((r, i) => {
          const rule = rules.ranks[i];
          const nextMin = rules.ranks[i + 1]?.min;
          const on = current === r;
          return (
            <tr key={r} aria-current={on ? "true" : undefined} className={on ? "font-extrabold" : undefined}>
              <td className="py-1.5 pr-2" style={{ color: RANK_COLOR[r] }}>{t(`rank.${r}`)}{on && ` · ${t("you")}`}</td>
              <td className="py-1.5 pr-2">{nextMin != null ? `${rule.min}–${nextMin - 1}` : `${rule.min}+`}</td>
              <td className="py-1.5">
                {effectiveDiscountPct(r, rules)}%
                {fullDiscountPending(r, rules) && <span className="ml-1 text-xs text-[#FFB45C]">({t("pendingShort", { pct: rule.discountPct })})</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
