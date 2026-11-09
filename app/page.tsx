import Link from "next/link";
import { ArrowRight, Compass, HandHeart, Sparkles, Ticket, Gamepad2, Radio, Trophy, CalendarDays, Headphones, Building2, Moon, MapPin } from "lucide-react";
import Image, { getImageProps } from "next/image";
import { ART } from "@/lib/art";
import { DJCard, EventCard, IllustratedCard } from "@/components/cards/Cards";
import { ButtonLink, SectionHeader } from "@/components/ui/primitives";
import { DJS, EVENTS } from "@/lib/data";
import { HomePlayerStrip } from "./HomePlayerStrip";
import { HomeFeatured } from "./HomeFeatured";

const EXPLORE = [
  { href: "/world", title: "World Map", sub: "Find raves worldwide", kind: "world", color: "#55BCEB", art: { src: ART.panelMap, pos: "50% 50%" } },
  { href: "/events/create", title: "Create Event", sub: "Start a new party", kind: "events", color: "#B6F05C", art: { src: ART.panelUniverse, pos: "88% 75%" } },
  { href: "/venues", title: "List Venue", sub: "Book or list a space", kind: "venues", color: "#A276E9", art: { src: ART.panelMarket, pos: "50% 40%" } },
  { href: "/djs", title: "DJ Audition", sub: "Auditions & rankings", kind: "dj", color: "#FFAD5B", art: { src: ART.mapIsland, pos: "40% 75%" } },
  { href: "/after-party", title: "After Party", sub: "The night continues", kind: "afterparty", color: "#FF625C", art: { src: ART.panelAfterparty, pos: "50% 50%" } },
  { href: "/live", title: "Live Festival", sub: "Enter the venue map", kind: "live", color: "#55BCEB", art: { src: ART.mapValley, pos: "50% 40%" } },
  { href: "/avatar", title: "Alien World", sub: "Make your alien", kind: "alien", color: "#B6F05C", art: { src: ART.posterCity, pos: "75% 100%" } },
  { href: "/rankings", title: "World Ranking", sub: "Top festivals now", kind: "nft", color: "#FFAD5B", art: { src: ART.panelStage, pos: "50% 30%" } },
] as const;

const MAP_CHIPS = [
  { href: "/events", label: "All events", icon: CalendarDays, active: true },
  { href: "/live", label: "Live now", icon: Radio },
  { href: "/rankings", label: "Ranking", icon: Trophy },
  { href: "/djs", label: "DJ open", icon: Headphones },
  { href: "/venues", label: "Venues", icon: Building2 },
  { href: "/after-party", label: "After party", icon: Moon },
];

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

const STEPS = [
  { icon: Compass, title: "Discover", body: "Find events on the world map by city, genre and date.", ja: "世界地図からイベントを見つける", color: "#55BCEB" },
  { icon: HandHeart, title: "Support", body: "Back the events you want to happen. Every supporter counts.", ja: "開催してほしいイベントを応援", color: "#B6F05C" },
  { icon: Sparkles, title: "Evolve", body: "Supporters and funding level the stage up from booth to mega fest.", ja: "応援と資金でステージが進化", color: "#FFAD5B" },
  { icon: Ticket, title: "Attend", body: "Grab a ticket and check in on the night.", ja: "チケットを手に入れて参加", color: "#FF625C" },
  { icon: Gamepad2, title: "Play", body: "Join the live venue map with your alien, earn XP and badges.", ja: "アバターで会場マップに参加", color: "#A276E9" },
];

export default function HomePage() {
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
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-acid">Discover. Support. Create. Rave.</p>
            <h1 id="hero-title" className="sr-only md:not-sr-only md:mt-3 md:text-6xl md:uppercase md:leading-[0.9]">
              The world is your <span className="text-acid glow-text">dance</span>floor.
            </h1>
            <p className="ja mt-2 max-w-md text-[15px] leading-relaxed text-cream/85">音楽・DJ・イベント・ゲームがつながる、宇宙人たちのダンスフロア。</p>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 md:mt-0 md:flex md:shrink-0">
            <ButtonLink href="/world" size="lg" className="whitespace-nowrap px-3">
              Explore <ArrowRight className="size-5" aria-hidden />
            </ButtonLink>
            <ButtonLink href="/events/create" variant="coral" size="lg" className="whitespace-nowrap px-3 text-[15px]">
              Create event
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* WORLD MAP teaser */}
      <section aria-labelledby="network" className="mt-10 md:px-6">
        <div className="px-4 md:px-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-mute">Global festival network</p>
          <h2 id="network" className="mt-1 text-[28px] uppercase sm:text-4xl">Where’s the party?</h2>
        </div>
        <Link href="/world" className="group relative mx-4 mt-4 block overflow-hidden rounded-[28px] border-2 border-blue/60 shadow-[0_0_30px_-10px_#55BCEB] md:mx-0">
          <Image src={ART.mapNeon} alt="Illustrated world map with festival stages in New York, Rio, Berlin, Bangkok and Tokyo" sizes="(min-width:1152px) 1100px, 100vw" className="h-auto w-full transition-transform duration-700 group-hover:scale-[1.03]" />
          <span className="absolute bottom-3 right-3 inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink bg-acid px-4 font-extrabold uppercase text-ink shadow-[0_4px_0_#080808]">
            <MapPin className="size-4" aria-hidden /> Open world map
          </span>
        </Link>
        <nav aria-label="Quick filters" className="rail mt-4 md:px-0">
          {MAP_CHIPS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className={
                c.active
                  ? "inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-acid bg-acid px-4 text-sm font-extrabold uppercase text-ink shadow-[0_0_16px_-2px_rgba(182,240,92,0.6)]"
                  : "inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-cream/25 bg-ink/70 px-4 text-sm font-extrabold uppercase text-cream hover:border-cream/60"
              }
            >
              <c.icon className="size-4" aria-hidden /> {c.label}
            </Link>
          ))}
        </nav>
      </section>

      {/* SPOTLIGHT */}
      {spotlight && (
        <section aria-labelledby="spotlight" className="mt-10 px-4 md:px-6">
          <h2 id="spotlight" className="sr-only">Spotlight event</h2>
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
              <span className="text-coral">LIVE NOW</span> · {live.name} · {live.city}
            </span>
            <ArrowRight className="size-5 shrink-0" aria-hidden />
          </Link>
        </div>
      )}

      {/* EXPLORE */}
      <section aria-labelledby="explore" className="mt-12 md:px-6">
        <SectionHeader id="explore" title="Explore" sub="8つの入口から、FREAKTOPIAの世界へ。" />
        <div className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-4 md:px-0">
          {EXPLORE.map((e) => (
            <IllustratedCard key={e.href} {...e} art={e.art} />
          ))}
        </div>
      </section>

      {/* FEATURED EVENTS */}
      <section aria-labelledby="featured" className="mt-14">
        <div className="md:px-6">
          <SectionHeader
            id="featured"
            title="Featured events"
            sub="応援が集まるほど、ステージが育つ。"
            action={
              <Link href="/events" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-bold text-acid">
                All <ArrowRight className="size-4" aria-hidden />
              </Link>
            }
          />
        </div>
        <div className="rail pb-2 md:px-6" role="list" aria-label="Featured events">
          {featured.map((e) => (
            <div role="listitem" key={e.id} className="flex">
              <EventCard event={e} />
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section aria-labelledby="how" className="mt-14 px-4 md:px-6">
        <h2 id="how" className="text-[28px] uppercase sm:text-4xl">How it works</h2>
        <p className="ja mt-2 text-sm text-mute">Discover → Support → Evolve → Attend → Play</p>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => (
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
                <p className="ja mt-1 text-xs text-mute">{s.ja}</p>
              </div>
            </li>
          ))}
        </ol>
        <Link href="/how-it-works" className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-acid">
          Learn more about event evolution <ArrowRight className="size-4" aria-hidden />
        </Link>
      </section>

      {/* FEATURED DJS */}
      <section aria-labelledby="djs" className="mt-14">
        <div className="md:px-6">
          <SectionHeader
            id="djs"
            title="Featured DJs"
            sub="オーディションとランキングで、次のスターを見つけよう。"
            action={
              <Link href="/djs" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-bold text-acid">
                Arena <ArrowRight className="size-4" aria-hidden />
              </Link>
            }
          />
        </div>
        <div className="rail pb-2 md:px-6" role="list" aria-label="Featured DJs">
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
        <div className="relative overflow-hidden rounded-[32px] border-[3px] border-ink bg-acid p-6 text-ink md:p-10">
          <h2 id="create" className="text-[34px] uppercase sm:text-5xl">Start something weird.</h2>
          <p className="ja mt-3 max-w-lg font-medium">イベントを企画する、DJとして応募する、会場を掲載する。どこからでも始められます。</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Link href="/events/create" className="flex min-h-14 items-center justify-between rounded-full bg-ink px-5 font-extrabold uppercase text-cream">Create event <ArrowRight className="size-5" aria-hidden /></Link>
            <Link href="/djs/apply" className="flex min-h-14 items-center justify-between rounded-full border-[3px] border-ink px-5 font-extrabold uppercase">Apply as DJ <ArrowRight className="size-5" aria-hidden /></Link>
            <Link href="/venues/new" className="flex min-h-14 items-center justify-between rounded-full border-[3px] border-ink px-5 font-extrabold uppercase">List venue <ArrowRight className="size-5" aria-hidden /></Link>
          </div>
        </div>
      </section>
    </div>
  );
}
