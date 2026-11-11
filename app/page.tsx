import { Tx } from "@/components/i18n/Tx";
import { type Tu } from "@/lib/i18n/tu";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowRight, Compass, HandHeart, Sparkles, Ticket, Gamepad2, Radio, Trophy, CalendarDays, Headphones, Building2, Moon, MapPin } from "lucide-react";
import Image, { getImageProps } from "next/image";
import { ART, CITY_ART } from "@/lib/art";
import { CityCard, DJCard, EventCard, IllustratedCard } from "@/components/cards/Cards";
import { ButtonLink, SectionHeader } from "@/components/ui/primitives";
import { DJS, EVENTS } from "@/lib/data";
import { HomePlayerStrip } from "./HomePlayerStrip";
import { HomeFeatured } from "./HomeFeatured";

const EXPLORE = (tu: Tu) => ([
  { href: "/world", title: tu("worldMap"), sub: tu("findRavesWorldwide"), kind: "world", color: "#66DFFF", art: { src: ART.panelMap, pos: "50% 50%" }, feature: true },
  { href: "/events/create", title: tu("createEvent2"), sub: tu("startANewParty"), kind: "events", color: "#C1FF53", art: { src: ART.panelUniverse, pos: "60% 60%" }, feature: true },
  { href: "/venues", title: tu("listVenue2"), sub: tu("bookOrListASpace"), kind: "venues", color: "#B78BFF", art: { src: ART.panelMarket, pos: "50% 40%" } },
  { href: "/after-party", title: tu("afterParty"), sub: tu("theNightContinues"), kind: "afterparty", color: "#FF79CD", art: { src: ART.panelAfterparty, pos: "50% 50%" } },
  { href: "/avatar", title: tu("alienWorld"), sub: tu("makeYourAlien"), kind: "alien", color: "#C1FF53", art: { src: ART.posterCity, pos: "75% 100%" } },
  { href: "/rankings", title: tu("worldRanking"), sub: tu("topFestivalsNow"), kind: "nft", color: "#FFB45C", art: { src: ART.mapCities, pos: "50% 50%" } },
  { href: "/djs", title: tu("djAudition"), sub: tu("auditionsRankings"), kind: "dj", color: "#FFB45C", art: { src: ART.mapIsland, pos: "40% 75%" }, feature: true },
  { href: "/live", title: tu("liveFestival"), sub: tu("enterTheVenueMap"), kind: "live", color: "#66DFFF", art: { src: ART.mapValley, pos: "50% 40%" }, feature: true },
] as const);

/** Party cities with an official poster: event counts and genres come from the listed events (sample data). */
function cityRows() {
  const upcoming = EVENTS.filter((e) => e.status !== "ended");
  return CITY_ART.map((art) => {
    const evs = upcoming.filter((e) => art.names.includes(e.city.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()));
    const g = new Map<string, number>();
    for (const e of evs) for (const x of e.genres) g.set(x, (g.get(x) ?? 0) + 1);
    const genres = [...g.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([x]) => x);
    return { art, count: evs.length, genres, country: evs[0]?.country ?? null };
  }).sort((a, b) => Number(b.count > 0) - Number(a.count > 0) || a.art.usagePriority - b.art.usagePriority);
}

const MAP_CHIPS = (tu: Tu) => ([
  { href: "/events", label: tu("allEvents"), icon: CalendarDays, active: true },
  { href: "/live", label: tu("liveNow"), icon: Radio },
  { href: "/rankings", label: tu("ranking"), icon: Trophy },
  { href: "/djs", label: tu("djOpen"), icon: Headphones },
  { href: "/venues", label: tu("venues"), icon: Building2 },
  { href: "/after-party", label: tu("afterParty2"), icon: Moon },
]);

function HeroPicture() {
  const common = { alt: "FREAKTOPIA WORLD: a crowd of aliens raving around a slime DJ. The world is your dancefloor.", priority: true, fetchPriority: "high" as const };
  const { props: { srcSet: wide } } = getImageProps({ ...common, src: ART.heroWide, sizes: "(min-width:1152px) 1152px, 100vw", quality: 72 });
  const { props: mobile } = getImageProps({ ...common, src: ART.heroPoster, sizes: "100vw", quality: 70 });
  return (
    <picture>
      <source media="(min-width: 768px)" srcSet={wide} sizes="(min-width:1152px) 1152px, 100vw" />
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <img {...mobile} className="block h-auto w-full" />
    </picture>
  );
}

const STEPS = (tu: Tu) => ([
  { icon: Compass, title: tu("discover"), body: tu("findEventsOnTheWorld"), color: "#55BCEB" },
  { icon: HandHeart, title: tu("support"), body: tu("backTheEventsYouWant"), color: "#B6F05C" },
  { icon: Sparkles, title: tu("evolve"), body: tu("supportersAndFundingLevelThe"), color: "#FFAD5B" },
  { icon: Ticket, title: tu("attend"), body: tu("grabATicketAndCheck"), color: "#FF625C" },
  { icon: Gamepad2, title: tu("play"), body: tu("joinTheLiveVenueMap"), color: "#A276E9" },
]);

export default function HomePage() {
  const tu = useTranslations("home");
  const tc = useTranslations("home.cities");
  const featured = [...EVENTS].sort((a, b) => b.supporters - a.supporters).slice(0, 8);
  const live = EVENTS.find((e) => e.status === "live");
  const spotlight = featured.find((e) => e.status !== "live" && e.djRecruiting) ?? featured[0];
  return (
    <div className="mx-auto max-w-6xl">
      {/* HERO: key art supplied by the FREAKTOPIA team */}
      <section aria-labelledby="hero-title" className="relative">
        <div className="relative overflow-hidden md:mx-6 md:mt-6 md:rounded-[32px] md:border-2 md:border-purple/50 md:shadow-[0_0_40px_-10px_rgba(162,118,233,0.7)]">
          <HeroPicture />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink to-transparent" aria-hidden />
        </div>
        <div className="relative z-10 -mt-2 px-4 md:mt-0 md:flex md:items-end md:justify-between md:gap-8 md:px-6 md:pt-8">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-acid">{tu("discoverSupportCreateRave")}</p>
            <h1 id="hero-title" className="sr-only md:not-sr-only md:mt-3 md:text-6xl md:uppercase md:leading-[0.9]">
              {tu.rich("heroTitle", { hl: (c) => <span className="text-acid glow-text">{c}</span> })}
            </h1>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-cream/85">{tu("dj")}</p>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 md:mt-0 md:flex md:shrink-0">
            <ButtonLink href="/world" size="lg" className="whitespace-nowrap px-3">
              {tu("explore")} <ArrowRight className="size-5" aria-hidden />
            </ButtonLink>
            <ButtonLink href="/events/create" variant="coral" size="lg" className="whitespace-nowrap px-3 text-[15px]">
              {tu("createEvent")}
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* WORLD MAP teaser */}
      <section aria-labelledby="network" className="mt-10 md:px-6">
        <div className="px-4 md:px-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-mute">{tu("globalFestivalNetwork")}</p>
          <h2 id="network" className="mt-1 text-[28px] uppercase sm:text-4xl">{tu("wheresTheParty")}</h2>
        </div>
        <Link href="/world" className="group relative mx-4 mt-4 block overflow-hidden rounded-[28px] border-2 border-blue/60 shadow-[0_0_30px_-10px_#55BCEB] md:mx-0">
          <Image src={ART.mapNeon} alt={tu("illustratedWorldMapWithFestival")} sizes="(min-width:1152px) 1100px, 100vw" className="h-auto w-full transition-transform duration-700 group-hover:scale-[1.03]" />
          <span className="absolute bottom-3 right-3 inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink bg-acid px-4 font-extrabold uppercase text-ink shadow-[0_4px_0_#080808]">
            <MapPin className="size-4" aria-hidden /> {tu("openWorldMap")}
          </span>
        </Link>
        <nav aria-label={tu("quickFilters")} className="rail mt-4 md:px-0">
          {MAP_CHIPS(tu).map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className={
                c.active
                  ? "inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-acid bg-acid px-4 text-sm font-extrabold uppercase text-ink shadow-[0_0_16px_-2px_rgba(182,240,92,0.6)]"
                  : "inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-cream/25 bg-ink/70 px-4 text-sm font-extrabold uppercase text-cream hover:border-cream/60"
              }
            >
              <c.icon className="size-4" aria-hidden /> <Tx>{c.label}</Tx>
            </Link>
          ))}
        </nav>
      </section>

      {/* DISCOVER CITIES: official city posters, numbers from the listed events */}
      <section aria-labelledby="cities" className="mt-14 md:px-6" data-testid="home-cities">
        <SectionHeader id="cities" title={tc("title")} sub={tc("sub")} />
        <ul className="rail rail-grid pb-2 md:grid-cols-5" aria-labelledby="cities">
          {cityRows().map(({ art, count, genres, country }) => (
            <li key={art.id} className="flex w-[62vw] max-w-[240px] shrink-0 md:w-auto md:max-w-none">
              <CityCard
                art={art}
                className="w-full"
                href={count && country ? `/world?city=${encodeURIComponent(`${art.city}|${country}`)}` : "/events/create"}
                count={count}
                genres={genres}
                labels={{ theme: tc(`theme.${art.id}`), events: tc("events", { count }), none: tc("none"), cta: tc("cta"), noneCta: tc("noneCta") }}
              />
            </li>
          ))}
        </ul>
        <p className="mt-2 px-4 text-[12px] text-mute md:px-0">{tc("note")}</p>
      </section>

      {/* SPOTLIGHT */}
      {spotlight && (
        <section aria-labelledby="spotlight" className="mt-10 px-4 md:px-6">
          <h2 id="spotlight" className="sr-only">{tu("spotlightEvent")}</h2>
          <HomeFeatured event={spotlight} />
        </section>
      )}

      {/* LIVE NOW strip */}
      {live && (
        <div className="px-4 md:px-6">
          <Link href="/live" className="flex min-h-14 items-center gap-3 rounded-full border-2 border-coral bg-coral/10 px-4 py-2 hover:bg-coral/20">
            <span className="relative flex size-3 shrink-0" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-coral opacity-75" />
              <span className="relative inline-flex size-3 rounded-full bg-coral" />
            </span>
            <Radio className="size-5 shrink-0 text-coral" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm font-bold">
              <span className="text-coral">{tu("demoLive")}</span> {tu("nameCitySimulation", { name: live.name, city: live.city })}
            </span>
            <ArrowRight className="size-5 shrink-0" aria-hidden />
          </Link>
        </div>
      )}

      {/* EXPLORE */}
      <section aria-labelledby="explore" className="mt-12 md:px-6">
        <SectionHeader id="explore" title={tu("explore")} sub={tu("n8Freaktopia")} />
        <div className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-4 md:px-0">
          {EXPLORE(tu).map((e) => (
            <IllustratedCard key={e.href} {...e} art={e.art} feature={"feature" in e && e.feature} />
          ))}
        </div>
      </section>

      {/* FEATURED EVENTS */}
      <section aria-labelledby="featured" className="mt-14">
        <div className="md:px-6">
          <SectionHeader
            id="featured"
            title={tu("featuredEvents")}
            sub={tu("text")}
            action={
              <Link href="/events" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-bold text-acid">
                {tu("all")} <ArrowRight className="size-4" aria-hidden />
              </Link>
            }
          />
        </div>
        <div className="rail pb-2 md:px-6" role="list" aria-label={tu("featuredEvents")}>
          {featured.map((e) => (
            <div role="listitem" key={e.id} className="flex">
              <EventCard event={e} />
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section aria-labelledby="how" className="mt-14 px-4 md:px-6">
        <h2 id="how" className="text-[28px] uppercase sm:text-4xl">{tu("howItWorks")}</h2>
        <p className="mt-2 text-sm text-mute">{tu("discoverSupportEvolveAttendPlay")}</p>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS(tu).map((s, i) => (
            <li key={s.title} className="relative flex gap-4 rounded-3xl border border-line bg-surface p-4 lg:flex-col">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border-[3px] border-ink text-ink" style={{ background: s.color }}>
                <s.icon className="size-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="font-display text-xl uppercase">
                  <span className="mr-1.5 text-mute">{i + 1}</span>
                  {s.title}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-cream/85">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <Link href="/how-it-works" className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-acid">
          {tu("learnMoreAboutEventEvolution")} <ArrowRight className="size-4" aria-hidden />
        </Link>
      </section>

      {/* FEATURED DJS */}
      <section aria-labelledby="djs" className="mt-14">
        <div className="md:px-6">
          <SectionHeader
            id="djs"
            title={tu("featuredDjs")}
            sub={tu("text2")}
            action={
              <Link href="/djs" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-bold text-acid">
                {tu("arena")} <ArrowRight className="size-4" aria-hidden />
              </Link>
            }
          />
        </div>
        <div className="rail pb-2 md:px-6" role="list" aria-label={tu("featuredDjs")}>
          {DJS.slice(0, 8).map((d) => (
            <div role="listitem" key={d.id} className="flex">
              <DJCard dj={d} />
            </div>
          ))}
        </div>
      </section>

      {/* PLAYER STRIP (game teaser) */}
      <section aria-labelledby="you" className="mt-14 px-4 md:px-6">
        <HomePlayerStrip />
      </section>

      {/* CREATE */}
      <section aria-labelledby="create" className="mt-14 px-4 md:px-6">
        <div className="relative grid overflow-hidden rounded-[32px] border-[3px] border-ink bg-acid text-ink md:grid-cols-[1.25fr_1fr]">
          <div className="relative aspect-[16/9] md:order-2 md:aspect-auto">
            <Image src={ART.panelStage} alt={tu("createArtAlt")} fill sizes="(min-width:1152px) 460px, (min-width:768px) 40vw, 100vw" className="object-cover" style={{ objectPosition: "50% 35%" }} />
          </div>
          <div className="p-6 md:p-10">
          <h2 id="create" className="text-[34px] uppercase sm:text-5xl">{tu("startSomethingWeird")}</h2>
          <p className="mt-3 max-w-lg font-medium">{tu("dj2")}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-1">
            <Link href="/events/create" className="flex min-h-14 items-center justify-between rounded-full bg-ink px-5 font-extrabold uppercase text-cream">{tu("createEvent")} <ArrowRight className="size-5" aria-hidden /></Link>
            <Link href="/djs/apply" className="flex min-h-14 items-center justify-between rounded-full border-[3px] border-ink px-5 font-extrabold uppercase">{tu("applyAsDj")} <ArrowRight className="size-5" aria-hidden /></Link>
            <Link href="/venues/new" className="flex min-h-14 items-center justify-between rounded-full border-[3px] border-ink px-5 font-extrabold uppercase">{tu("listVenue")} <ArrowRight className="size-5" aria-hidden /></Link>
          </div>
          </div>
        </div>
      </section>
    </div>
  );
}
