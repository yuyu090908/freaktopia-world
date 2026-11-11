"use client";

/**
 * Decorative background video for the home hero. The poster image underneath is the real (LCP) content; the video only
 * fades in once it actually plays. It is not loaded at all for "reduce motion", Data Saver or 2G, it pauses when the
 * hero scrolls out of view or the tab is hidden, and a visible button stops it (WCAG 2.2.2).
 */
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Pause, Play } from "lucide-react";
import { HERO_VIDEO } from "@/lib/art";
import { cn } from "@/lib/utils";

type Conn = { saveData?: boolean; effectiveType?: string };

export function HeroVideo() {
  const t = useTranslations("home");
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const visible = useRef(true);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const conn = (navigator as Navigator & { connection?: Conn }).connection;
    const slow = !!conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? "");
    const wide = window.matchMedia("(min-width: 768px)");
    const pick = () => setSrc(reduce.matches || slow ? null : wide.matches ? HERO_VIDEO.wide.src : HERO_VIDEO.tall.src);
    pick();
    reduce.addEventListener("change", pick);
    wide.addEventListener("change", pick);
    return () => {
      reduce.removeEventListener("change", pick);
      wide.removeEventListener("change", pick);
    };
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v || !src) return;
    setPlaying(false);
    const sync = () => {
      if (pausedRef.current || !visible.current || document.hidden) v.pause();
      else v.play().catch(() => {});
    };
    const io = new IntersectionObserver(([e]) => {
      visible.current = e.isIntersecting;
      sync();
    });
    io.observe(v);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [src]);

  const toggle = () => {
    const v = ref.current;
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
    if (!v) return;
    if (pausedRef.current) v.pause();
    else v.play().catch(() => {});
  };

  if (!src) return null;
  return (
    <>
      <video
        ref={ref}
        key={src}
        src={src}
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden
        tabIndex={-1}
        data-testid="hero-video"
        onPlaying={() => setPlaying(true)}
        className={cn("absolute inset-0 size-full object-cover transition-opacity duration-700", playing ? "opacity-100" : "opacity-0")}
      />
      <button
        type="button"
        onClick={toggle}
        aria-pressed={paused}
        aria-label={paused ? t("heroVideoPlay") : t("heroVideoPause")}
        data-testid="hero-video-toggle"
        className="absolute right-3 top-3 z-20 inline-flex size-11 items-center justify-center rounded-full border border-cream/30 bg-ink/60 text-cream backdrop-blur hover:bg-ink/80"
      >
        {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
      </button>
    </>
  );
}
