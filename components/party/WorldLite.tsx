"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Alien } from "@/components/art/Alien";
import { cn } from "@/lib/utils";
import { THEME_COLORS, type Planet, type WorldData } from "./shared";

/**
 * Light 2D world (SVG): the same world as the 3D view without WebGL. Used on low-power devices, with
 * reduced motion, when WebGL is missing, or when the visitor picks "Lite". Every planet is a real link.
 */
export function WorldLite({ w, planetHref, selected, onSelect }: { w: WorldData; planetHref: (p: Planet) => string; selected: string | null; onSelect: (id: string) => void }) {
  const t = useTranslations("party");
  const stage = w.growth.stage;
  const R = 54 + stage * 9;
  const cx = 200;
  const cy = 165;
  const planets = w.planets;
  const pos = (i: number) => {
    const a = -Math.PI / 2 + (i / Math.max(planets.length, 1)) * Math.PI * 2;
    return { x: cx + Math.cos(a) * 160, y: cy + Math.sin(a) * 118 };
  };
  const avatars = w.community.shown.slice(0, 10);
  const crowd = Math.min(w.community.total - avatars.length, 90);
  return (
    <div className="flex h-full w-full items-center justify-center [container-type:size]" data-testid="world-lite">
    {/* Same aspect as the drawing, so the tappable planet links sit exactly on the drawn planets. */}
    <div className="relative aspect-[400/330] [width:min(100cqw,calc(100cqh*400/330))]">
      <svg viewBox="0 0 400 330" className="h-full w-full" role="img" aria-label={t("worldAlt", { name: w.owner.name ?? "—", stage })}>
        <defs>
          <radialGradient id="pl-core" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#c6f77a" />
            <stop offset="55%" stopColor="#5f8a22" />
            <stop offset="100%" stopColor="#1b2a09" />
          </radialGradient>
          <radialGradient id="pl-glow" r="50%">
            <stop offset="60%" stopColor="#B6F05C" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#B6F05C" stopOpacity="0" />
          </radialGradient>
        </defs>
        {Array.from({ length: 50 }, (_, i) => (
          <circle key={i} cx={(i * 97) % 400} cy={(i * 53) % 330} r={i % 7 === 0 ? 1.4 : 0.7} fill="#F5F2EA" opacity={0.25 + (i % 5) * 0.1} />
        ))}
        <ellipse cx={cx} cy={cy} rx="160" ry="118" fill="none" stroke="#A276E9" strokeOpacity="0.35" strokeDasharray="3 6" />
        <circle cx={cx} cy={cy} r={R * 1.6} fill="url(#pl-glow)" />
        <circle cx={cx} cy={cy} r={R} fill="url(#pl-core)" stroke="#B6F05C" strokeWidth="2" />
        {stage >= 2 && <ellipse cx={cx} cy={cy + 4} rx={R * 1.35} ry={R * 0.28} fill="none" stroke="#FF8FD1" strokeOpacity="0.7" strokeWidth="2" />}
        {/* Stage grows with verified history: first venue, more structures, the big festival stage. */}
        {stage >= 1 && (
          <g transform={`translate(${cx} ${cy - R + 6})`}>
            <rect x={-(10 + stage * 4)} y={-12} width={20 + stage * 8} height="12" rx="2" fill="#080808" stroke="#B6F05C" />
            <rect x={-(16 + stage * 4)} y={-18} width="6" height="18" fill="#080808" stroke="#55BCEB" />
            <rect x={10 + stage * 4} y={-18} width="6" height="18" fill="#080808" stroke="#55BCEB" />
            {stage >= 4 && <path d={`M${-(22 + stage * 4)} -26 L0 -44 L${22 + stage * 4} -26`} fill="none" stroke="#FF625C" strokeWidth="2" />}
          </g>
        )}
        {Array.from({ length: Math.max(crowd, 0) }, (_, i) => {
          const a = Math.PI * (0.15 + (i / Math.max(crowd, 1)) * 0.7);
          const rr = R * (0.45 + ((i * 37) % 40) / 100);
          return <circle key={i} cx={cx + Math.cos(a) * rr * (i % 2 ? 1 : -1)} cy={cy + Math.sin(a) * rr * 0.6 - 4} r="1.6" fill={["#B6F05C", "#A276E9", "#55BCEB", "#FF8FD1"][i % 4]} opacity="0.8" />;
        })}
        {stage === 0 && (
          <text x={cx} y={cy + R + 22} textAnchor="middle" className="fill-cream text-[11px] font-bold uppercase">
            {t("stage0Hint")}
          </text>
        )}
        {planets.map((p, i) => {
          const { x, y } = pos(i);
          const c = THEME_COLORS[p.theme];
          const size = p.theme === "festival" ? 17 : 12 + Math.min(4, p.level);
          const dim = p.state === "unverified" || p.state === "cancelled";
          return (
            <g key={p.id} opacity={dim ? 0.45 : 1}>
              <circle cx={x} cy={y} r={size + 6} fill={c.glow} opacity={selected === p.id ? 0.35 : 0.12} />
              <circle cx={x} cy={y} r={size} fill={c.base} stroke={c.glow} strokeWidth="2" strokeDasharray={p.state === "upcoming" ? "4 3" : undefined} />
              <circle cx={x - size / 3} cy={y - size / 3} r={size / 3} fill={c.accent} opacity="0.5" />
            </g>
          );
        })}
      </svg>
      {/* Accessible, tappable targets on top of the drawing. */}
      {planets.map((p, i) => {
        const { x, y } = pos(i);
        return (
          <Link
            key={p.id}
            href={planetHref(p)}
            onClick={(e) => {
              if (selected !== p.id) {
                e.preventDefault();
                onSelect(p.id);
              }
            }}
            className={cn("absolute flex min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 items-end justify-center rounded-full focus-visible:outline-2", selected === p.id && "ring-2 ring-acid")}
            style={{ left: `${(x / 400) * 100}%`, top: `${(y / 330) * 100}%` }}
            aria-label={`${p.name} · ${t(`state.${p.state}`)}`}
            data-testid="planet"
            data-state={p.state}
            data-theme={p.theme}
          >
            <span className="pointer-events-none translate-y-6 whitespace-nowrap rounded-full bg-ink/80 px-1.5 text-[10px] font-extrabold uppercase text-cream">{p.name.length > 16 ? `${p.name.slice(0, 15)}…` : p.name}</span>
          </Link>
        );
      })}
      <div className="pointer-events-none absolute left-1/2 top-[50%] flex -translate-x-1/2 -translate-y-[85%] gap-0.5">
        {w.owner.look && <Alien look={w.owner.look} className="size-12" />}
        {avatars.slice(0, 6).map((a) => (
          <Alien key={a.key} look={a.look} className={cn("size-8 self-end", a.tier !== "first" && "drop-shadow-[0_0_6px_rgba(182,240,92,0.8)]")} />
        ))}
      </div>
    </div>
    </div>
  );
}
