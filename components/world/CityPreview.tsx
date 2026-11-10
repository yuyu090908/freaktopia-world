"use client";

/**
 * CITY FESTIVAL PREVIEW: opens when a party city is tapped on the globe.
 * Every number is counted from the events currently shown on the map (filters apply), and community parties come
 * from published party worlds (/api/party/upcoming), so the organizer link always leads to a real PERSONAL WORLD.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Orbit, X } from "lucide-react";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import type { Locale } from "@/i18n/config";
import { citySvg, type PartyCity } from "@/lib/map/cities";
import { STATUS_META } from "@/lib/map/landmarks";
import { REGION_COLOR } from "@/lib/map/regions";
import { formatEventDate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { StatusPill } from "./EventPanel";

interface CommunityParty {
  id: string;
  name: string;
  city: string;
  startAt: string;
  organizer: string;
  handle: string | null;
  demo: boolean;
}

let partyCache: Promise<CommunityParty[]> | null = null;
const loadParties = () =>
  (partyCache ??= fetch("/api/party/upcoming")
    .then((r) => (r.ok ? r.json() : { parties: [] }))
    .then((j: { parties?: CommunityParty[] }) => j.parties ?? [])
    .catch(() => {
      partyCache = null;
      return [];
    }));

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function CityPreview({ city, desktop, onClose, onPickEvent, onSeeEvents, onHeight }: { city: PartyCity; desktop: boolean; onClose: () => void; onPickEvent: (id: string) => void; onSeeEvents: () => void; onHeight?: (h: number) => void }) {
  const t = useTranslations("world.city");
  const tr = useTranslations("world.regions");
  const locale = useLocale() as Locale;
  const href = useLocalHref();
  const ref = useRef<HTMLElement>(null);
  const [parties, setParties] = useState<CommunityParty[]>([]);

  useEffect(() => {
    let live = true;
    loadParties().then((all) => live && setParties(all.filter((p) => norm(p.city) === norm(city.city) && p.handle)));
    return () => {
      live = false;
    };
  }, [city.city]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onHeight) return;
    const ro = new ResizeObserver(() => onHeight(el.getBoundingClientRect().height));
    ro.observe(el);
    return () => {
      ro.disconnect();
      onHeight(0);
    };
  }, [onHeight]);

  const c = city.counts;
  const accent = city.region ? REGION_COLOR[city.region] : "#C1FF53";
  const stats: { key: string; n: number; color?: string }[] = [
    { key: "upcoming", n: c.upcoming },
    { key: "live", n: c.live, color: "#FF625C" },
    { key: "djWanted", n: c.djWanted },
    { key: "funding", n: c.funding },
    { key: "dao", n: c.dao },
    { key: "afterParty", n: c.afterParty },
  ];
  const tagline = city.signature ? t(`tagline.${city.signature}`) : city.region ? t("taglineRegion", { region: tr(city.region) }) : t("taglineGeneric");

  return (
    <section
      ref={ref}
      aria-label={t("aria", { city: city.city })}
      data-testid="city-preview"
      className={cn(
        "wm-panel absolute z-20 flex flex-col overflow-hidden border-2 border-line bg-[#0D121B]/95 shadow-[0_20px_60px_rgba(0,0,0,.55)] backdrop-blur",
        desktop ? "bottom-4 right-4 top-[124px] w-[400px] rounded-[28px]" : "inset-x-0 bottom-0 max-h-[58%] rounded-t-[26px] border-b-0",
      )}
      style={{ borderColor: `${accent}66` }}
    >
      <div className="flex items-start gap-3 border-b border-line p-4 pb-3">
        <span className="size-16 shrink-0" aria-hidden dangerouslySetInnerHTML={{ __html: citySvg({ signature: city.signature, region: city.region, live: c.live > 0, count: c.total, animate: false }) }} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-[.14em]" style={{ color: accent }}>
            {t("eyebrow")}
          </p>
          <h2 className="font-display text-2xl uppercase leading-none" data-testid="city-preview-name">
            {city.city}
          </h2>
          <p className="mt-0.5 text-[12px] text-mute">
            {city.country}
            {city.region && ` · ${tr(city.region)}`}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label={t("close")} className="-mr-1 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 hover:bg-surface-2/70">
          <X className="size-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pt-3">
        <p className="text-[13px] leading-snug text-cream/90">{tagline}</p>
        <p className="mt-2 text-[13px] font-extrabold uppercase" data-testid="city-preview-total">
          {t("total", { count: c.total })}
        </p>
        <dl className="mt-2 grid grid-cols-3 gap-1.5 text-center" data-testid="city-preview-stats">
          {stats.map((s) => (
            <div key={s.key} className="rounded-xl bg-ink/70 px-1 py-2">
              <dd className="font-display text-xl leading-none" style={s.n && s.color ? { color: s.color } : undefined}>
                {s.n}
              </dd>
              <dt className="mt-1 text-[10px] font-bold uppercase leading-tight text-mute">{t(`stats.${s.key}`)}</dt>
            </div>
          ))}
        </dl>
        <p className="mt-1.5 text-[11px] text-mute">{t("countsNote")}</p>

        <h3 className="mt-4 text-[12px] font-extrabold uppercase text-mute">{t("events")}</h3>
        <ul className="mt-1.5 space-y-1.5" data-testid="city-preview-events">
          {city.events.slice(0, 6).map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => onPickEvent(e.id)} className="flex min-h-12 w-full items-center gap-2.5 rounded-2xl border border-line bg-ink/50 px-3 py-2 text-left hover:border-cream/40">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: STATUS_META[e.status].color }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold">{e.name}</span>
                  <span className="block truncate text-[11px] text-mute">{formatEventDate(locale, e.startsAt, "UTC", { month: "short", day: "numeric", year: "numeric" })}</span>
                </span>
                <StatusPill status={e.status} />
              </button>
            </li>
          ))}
        </ul>
        {city.events.length > 6 && <p className="mt-1 text-[11px] text-mute">{t("more", { count: city.events.length - 6 })}</p>}

        {parties.length > 0 && (
          <>
            <h3 className="mt-4 text-[12px] font-extrabold uppercase text-mute">{t("community")}</h3>
            <ul className="mt-1.5 space-y-1.5" data-testid="city-preview-parties">
              {parties.slice(0, 4).map((p) => (
                <li key={p.id} className="rounded-2xl border border-[#C3A1FF]/40 bg-[#C3A1FF]/10 px-3 py-2">
                  <Link href={href(`/u/${p.handle}/world/${p.id}`)} className="block min-h-6 truncate text-[14px] font-bold hover:underline">
                    {p.name}
                  </Link>
                  <Link href={href(`/u/${p.handle}/world`)} className="mt-0.5 inline-flex min-h-8 items-center gap-1 text-[12px] font-bold text-[#C3A1FF] hover:underline" data-testid="city-organizer-world">
                    <Orbit className="size-3.5" aria-hidden /> {t("organizerWorld", { name: p.organizer })}
                  </Link>
                  <span className="block text-[11px] text-mute">
                    {formatEventDate(locale, p.startAt, "UTC", { month: "short", day: "numeric" })}
                    {p.demo && ` · ${t("demoWorld")}`}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="border-t border-line p-3">
        <button type="button" onClick={onSeeEvents} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-acid font-extrabold uppercase text-ink" data-testid="city-see-events">
          {t("seeEvents")} <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}
