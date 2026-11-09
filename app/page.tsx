import Link from "next/link";
import { ArrowRight, Compass, HandHeart, Sparkles, Ticket, Gamepad2, Radio } from "lucide-react";
import { HeroArt } from "@/components/art/Scenes";
import { DJCard, EventCard, IllustratedCard } from "@/components/cards/Cards";
import { ButtonLink, SectionHeader } from "@/components/ui/primitives";
import { DJS, EVENTS } from "@/lib/data";
import { HomePlayerStrip } from "./HomePlayerStrip";

const EXPLORE = [
  { href: "/world", title: "World Map", sub: "Find raves on a real map", kind: "world", color: "#55BCEB" },
  { href: "/djs", title: "DJ Arena", sub: "Auditions & rankings", kind: "dj", color: "#FFAD5B" },
  { href: "/events", title: "Events", sub: "Support & get tickets", kind: "events", color: "#B6F05C" },
  { href: "/venues", title: "Venues", sub: "Book or list a space", kind: "venues", color: "#A276E9" },
  { href: "/live", title: "Live Festival", sub: "Enter the venue map", kind: "live", color: "#FF625C" },
  { href: "/after-party", title: "After Party", sub: "The night continues", kind: "afterparty", color: "#55BCEB" },
  { href: "/avatar", title: "Alien World", sub: "Make your alien", kind: "alien", color: "#B6F05C" },
  { href: "/nft", title: "NFT Market", sub: "Collectibles preview", kind: "nft", color: "#FFAD5B" },
] as const;

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
  return (
    <div className="mx-auto max-w-6xl">
      {/* HERO */}
      <section aria-labelledby="hero-title" className="relative px-4 pb-8 pt-5 md:grid md:grid-cols-[1.1fr_1fr] md:items-center md:gap-8 md:px-6 md:pb-14 md:pt-12">
        <div className="relative z-10">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.22em] text-acid">Discover. Support. Create. Rave.</p>
          <h1 id="hero-title" className="text-[clamp(2.4rem,10.4vw,5.6rem)] uppercase leading-[0.88]">
            The world is your <span className="text-acid">dance</span>floor.
          </h1>
          <p className="mt-4 max-w-md text-[17px] leading-relaxed text-cream/85">
            A living world of music, aliens, DJs, festivals and unforgettable nights.
          </p>
          <p className="ja mt-1.5 max-w-md text-sm text-mute">音楽・DJ・イベント・ゲームがつながる、宇宙人たちのダンスフロア。</p>
          <div className="mt-6 flex flex-col gap-3 min-[420px]:flex-row">
            <ButtonLink href="/world" size="lg" className="w-full min-[420px]:w-auto">
              Explore world <ArrowRight className="size-5" aria-hidden />
            </ButtonLink>
            <ButtonLink href="/events/create" variant="ghost" size="lg" className="w-full min-[420px]:w-auto">
              Create event
            </ButtonLink>
          </div>
        </div>
        <div className="relative mx-auto mt-8 w-full max-w-[420px] md:mt-0">
          <HeroArt className="h-auto w-full" />
        </div>
      </section>

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
        <div className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 md:px-0 lg:grid-cols-4">
          {EXPLORE.map((e) => (
            <IllustratedCard key={e.href} {...e} />
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
        <div className="overflow-hidden rounded-[32px] border-[3px] border-ink bg-acid p-6 text-ink md:p-10">
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
