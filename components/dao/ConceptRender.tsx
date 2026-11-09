"use client";

/**
 * Demo compositor for AI STAGE DESIGNER concepts.
 * Draws production elements (LED, lighting, sculptures, booth, FX) as vector layers on
 * top of the unmodified venue photo, inside the stage zone the venue owner marked. The
 * building, walls, ceiling, pillars, floor and camera angle therefore never change.
 */
import { useId } from "react";
import type { ConceptSpec } from "@/lib/dao/types";
import { cn } from "@/lib/utils";

const W = 1600;
const H = 1000;

export function ConceptRender({
  photoUrl,
  zone,
  ceilingY,
  spec,
  title,
  className,
  showLabel = true,
  priority = false,
}: {
  photoUrl: string;
  zone: { x: number; y: number; w: number; h: number };
  ceilingY: number;
  spec: ConceptSpec | null;
  title: string;
  className?: string;
  showLabel?: boolean;
  priority?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const z = { x: zone.x * W, y: zone.y * H, w: zone.w * W, h: zone.h * H };
  const cx = z.x + z.w / 2;
  const floor = z.y + z.h;
  const s = spec;
  const [c1, c2, c3] = s?.palette ?? ["#B6F05C", "#A276E9", "#FF625C"];
  const unit = z.w / 10;
  const top = ceilingY * H;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} className={cn("block h-auto w-full bg-ink", className)} preserveAspectRatio="xMidYMid slice">
      <title>{title}</title>
      <defs>
        <linearGradient id={`beam${uid}a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c1} stopOpacity="0.85" />
          <stop offset="1" stopColor={c1} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`beam${uid}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c2} stopOpacity="0.85" />
          <stop offset="1" stopColor={c2} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`haze${uid}`} cx="0.5" cy="0.6" r="0.6">
          <stop offset="0" stopColor={c2} stopOpacity="0.55" />
          <stop offset="0.6" stopColor={c1} stopOpacity="0.18" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`led${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c2} />
          <stop offset="0.5" stopColor="#080808" />
          <stop offset="1" stopColor={c1} />
        </linearGradient>
        <pattern id={`grid${uid}`} width="18" height="18" patternUnits="userSpaceOnUse">
          <path d="M18 0H0V18" fill="none" stroke={c1} strokeOpacity="0.35" strokeWidth="2" />
        </pattern>
        <filter id={`glow${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="10" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`soft${uid}`}>
          <feGaussianBlur stdDeviation="28" />
        </filter>
        <clipPath id={`frame${uid}`}>
          <rect width={W} height={H} />
        </clipPath>
      </defs>
      <g clipPath={`url(#frame${uid})`}>
        <image href={photoUrl} x="0" y="0" width={W} height={H} preserveAspectRatio="xMidYMid slice" {...(priority ? { fetchPriority: "high" } : {})} />
        {s && (
          <>
            {/* Night grade: darken the room so the production reads, without repainting it. */}
            <rect width={W} height={H} fill="#05030a" opacity={0.42} />
            <rect width={W} height={H} fill={c2} opacity={0.08} style={{ mixBlendMode: "screen" }} />

            {/* Haze */}
            {s.haze > 0 && <ellipse cx={cx} cy={floor - z.h * 0.35} rx={z.w * 1.1} ry={z.h * 1.3} fill={`url(#haze${uid})`} opacity={0.4 + s.haze * 0.6} filter={`url(#soft${uid})`} />}

            {/* Installation behind everything */}
            <Installation kind={s.installation} z={z} c1={c1} c2={c2} c3={c3} uid={uid} />

            {/* LED back screens */}
            {Array.from({ length: s.ledScreens }).map((_, i) => {
              const n = s.ledScreens;
              const sw = (z.w * (s.layout === "wide" ? 0.86 : 0.62)) / n;
              const sh = z.h * (s.layout === "tower" ? 0.95 : 0.62);
              const x = cx - (sw * n) / 2 + i * sw + 4;
              const y = floor - z.h * 0.42 - sh;
              return (
                <g key={i}>
                  <rect x={x} y={y} width={sw - 8} height={sh} rx="6" fill={`url(#led${uid})`} filter={`url(#glow${uid})`} opacity="0.95" />
                  <rect x={x} y={y} width={sw - 8} height={sh} rx="6" fill={`url(#grid${uid})`} />
                  {i === Math.floor(n / 2) && <AlienEye x={x + (sw - 8) / 2} y={y + sh / 2} r={Math.min(sw, sh) * 0.28} c={c1} />}
                </g>
              );
            })}
            {s.ledSides &&
              [z.x - unit * 0.6, z.x + z.w - unit * 0.6].map((x, i) => (
                <g key={i}>
                  <rect x={x} y={floor - z.h * 1.25} width={unit * 1.2} height={z.h * 1.2} rx="6" fill={`url(#led${uid})`} filter={`url(#glow${uid})`} />
                  <rect x={x} y={floor - z.h * 1.25} width={unit * 1.2} height={z.h * 1.2} rx="6" fill={`url(#grid${uid})`} />
                </g>
              ))}

            {/* Beams from the rig line */}
            <g style={{ mixBlendMode: "screen" }}>
              {Array.from({ length: s.beams }).map((_, i) => {
                const t = s.beams === 1 ? 0.5 : i / (s.beams - 1);
                const sx = z.x - unit + t * (z.w + 2 * unit);
                const tx = cx + (t - 0.5) * W * 0.9;
                const spread = 18 + (i % 3) * 10;
                return <polygon key={i} points={`${sx - 6},${top} ${sx + 6},${top} ${tx + spread * 4},${H} ${tx - spread * 4},${H}`} fill={`url(#beam${uid}${i % 2 ? "b" : "a"})`} opacity={0.32 + s.haze * 0.3} />;
              })}
              {Array.from({ length: s.beams }).map((_, i) => {
                const t = s.beams === 1 ? 0.5 : i / (s.beams - 1);
                return <circle key={`h${i}`} cx={z.x - unit + t * (z.w + 2 * unit)} cy={top + 6} r="9" fill={i % 2 ? c2 : c1} filter={`url(#glow${uid})`} />;
              })}
            </g>

            {/* Lasers */}
            {s.lasers && (
              <g style={{ mixBlendMode: "screen" }} opacity="0.85">
                {Array.from({ length: 14 }).map((_, i) => (
                  <line key={i} x1={cx} y1={floor - z.h * 0.6} x2={(i / 13) * W} y2={top - 40} stroke={i % 2 ? c3 : c1} strokeWidth="2.5" filter={`url(#glow${uid})`} />
                ))}
              </g>
            )}

            {/* Speaker stacks */}
            {s.speakerDeco &&
              [z.x - unit * 0.2, z.x + z.w - unit * 1.2].map((x, i) => (
                <g key={i}>
                  {[0, 1, 2].map((k) => (
                    <g key={k}>
                      <rect x={x} y={floor - unit * (k + 1) * 0.95} width={unit * 1.4} height={unit * 0.92} rx="6" fill="#111" stroke={k % 2 ? c2 : c1} strokeWidth="4" />
                      <circle cx={x + unit * 0.7} cy={floor - unit * (k + 0.55) * 0.95} r={unit * 0.28} fill="#222" stroke={c3} strokeWidth="3" />
                    </g>
                  ))}
                </g>
              ))}

            {/* Alien sculptures */}
            {Array.from({ length: s.alienCount }).map((_, i) => {
              const pos = s.alienCount === 1 ? [0] : s.alienCount === 2 ? [-0.32, 0.32] : [-0.36, 0, 0.36];
              const scale = s.alienScale * (pos[i] === 0 ? 1 : 0.8);
              const ax = cx + pos[i] * z.w;
              return <AlienSculpture key={i} x={ax} floor={floor - z.h * 0.18} size={unit * 2.6 * scale} body={i % 2 ? c2 : c1} eye={c3} uid={uid} />;
            })}

            {/* DJ booth */}
            <Booth kind={s.booth} cx={cx} floor={floor} unit={unit} c1={c1} c2={c2} c3={c3} uid={uid} />

            {/* Flame FX */}
            {s.pyroFx &&
              [z.x + unit * 0.5, z.x + z.w - unit * 0.5].map((x, i) => (
                <path key={i} d={`M${x - unit * 0.3} ${floor} Q${x - unit * 0.4} ${floor - unit * 1.2} ${x} ${floor - unit * 2.2} Q${x + unit * 0.4} ${floor - unit * 1.2} ${x + unit * 0.3} ${floor} Z`} fill="#FFAD5B" filter={`url(#glow${uid})`} opacity="0.9" />
              ))}

            {/* Crowd silhouettes for scale */}
            <g fill="#050505" opacity="0.92">
              {Array.from({ length: 34 }).map((_, i) => {
                const x = (i / 33) * W + ((i * 37) % 23) - 11;
                const r = 26 + ((i * 13) % 9);
                const y = H - 30 - ((i * 7) % 5) * 6;
                return (
                  <g key={i}>
                    <circle cx={x} cy={y - r * 1.6} r={r} />
                    <rect x={x - r * 1.2} y={y - r * 0.8} width={r * 2.4} height={r * 3} rx={r} />
                    {i % 5 === 0 && <rect x={x + r * 0.6} y={y - r * 4.2} width={r * 0.45} height={r * 2.6} rx={r * 0.2} transform={`rotate(18 ${x} ${y})`} />}
                  </g>
                );
              })}
            </g>
          </>
        )}
      </g>
      {showLabel && s && (
        <g>
          <rect x="24" y="24" width="560" height="54" rx="27" fill="#080808" fillOpacity="0.88" stroke="#B6F05C" strokeWidth="3" />
          <text x="304" y="60" textAnchor="middle" fontFamily="Inter, Arial, sans-serif" fontWeight="800" fontSize="25" letterSpacing="2" fill="#B6F05C">
            AI CONCEPT / NOT A CONSTRUCTION PLAN
          </text>
        </g>
      )}
    </svg>
  );
}

function AlienEye({ x, y, r, c }: { x: number; y: number; r: number; c: string }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={r * 1.4} ry={r} fill="#080808" stroke={c} strokeWidth="6" />
      <circle cx={x} cy={y} r={r * 0.55} fill={c} />
      <circle cx={x - r * 0.18} cy={y - r * 0.2} r={r * 0.16} fill="#F5F2EA" />
    </g>
  );
}

function AlienSculpture({ x, floor, size, body, eye, uid }: { x: number; floor: number; size: number; body: string; eye: string; uid: string }) {
  const h = size;
  return (
    <g filter={`url(#glow${uid})`}>
      {/* body */}
      <path d={`M${x - h * 0.32} ${floor} Q${x - h * 0.42} ${floor - h * 0.55} ${x - h * 0.2} ${floor - h * 0.62} L${x + h * 0.2} ${floor - h * 0.62} Q${x + h * 0.42} ${floor - h * 0.55} ${x + h * 0.32} ${floor} Z`} fill={body} opacity="0.95" />
      {/* head */}
      <ellipse cx={x} cy={floor - h * 0.82} rx={h * 0.36} ry={h * 0.3} fill={body} />
      {/* antennae */}
      <path d={`M${x - h * 0.14} ${floor - h * 1.08} Q${x - h * 0.3} ${floor - h * 1.32} ${x - h * 0.22} ${floor - h * 1.4}`} stroke={body} strokeWidth={h * 0.04} fill="none" />
      <path d={`M${x + h * 0.14} ${floor - h * 1.08} Q${x + h * 0.3} ${floor - h * 1.32} ${x + h * 0.22} ${floor - h * 1.4}`} stroke={body} strokeWidth={h * 0.04} fill="none" />
      <circle cx={x - h * 0.22} cy={floor - h * 1.4} r={h * 0.05} fill={eye} />
      <circle cx={x + h * 0.22} cy={floor - h * 1.4} r={h * 0.05} fill={eye} />
      {/* eyes */}
      <ellipse cx={x - h * 0.13} cy={floor - h * 0.84} rx={h * 0.1} ry={h * 0.13} fill="#080808" />
      <ellipse cx={x + h * 0.13} cy={floor - h * 0.84} rx={h * 0.1} ry={h * 0.13} fill="#080808" />
      <circle cx={x - h * 0.11} cy={floor - h * 0.87} r={h * 0.035} fill={eye} />
      <circle cx={x + h * 0.15} cy={floor - h * 0.87} r={h * 0.035} fill={eye} />
      {/* mouth */}
      <path d={`M${x - h * 0.12} ${floor - h * 0.68} Q${x} ${floor - h * 0.6} ${x + h * 0.12} ${floor - h * 0.68}`} stroke="#080808" strokeWidth={h * 0.025} fill="none" />
    </g>
  );
}

function Booth({ kind, cx, floor, unit, c1, c2, c3, uid }: { kind: ConceptSpec["booth"]; cx: number; floor: number; unit: number; c1: string; c2: string; c3: string; uid: string }) {
  const w = unit * 3.4;
  const h = unit * 1.1;
  const y = floor - h;
  const deck = <rect x={cx - w * 0.32} y={y - unit * 0.18} width={w * 0.64} height={unit * 0.18} rx="4" fill="#1a1a1a" stroke={c3} strokeWidth="3" />;
  switch (kind) {
    case "ufo":
      return (
        <g filter={`url(#glow${uid})`}>
          <ellipse cx={cx} cy={y + h * 0.55} rx={w * 0.62} ry={h * 0.45} fill="#141414" stroke={c1} strokeWidth="6" />
          <ellipse cx={cx} cy={y + h * 0.2} rx={w * 0.28} ry={h * 0.5} fill={c2} opacity="0.7" />
          {Array.from({ length: 7 }).map((_, i) => (
            <circle key={i} cx={cx - w * 0.5 + (i * w) / 6} cy={y + h * 0.62} r={unit * 0.08} fill={i % 2 ? c1 : c3} />
          ))}
          <path d={`M${cx - w * 0.3} ${floor} L${cx - w * 0.6} ${floor + unit * 0.4} M${cx + w * 0.3} ${floor} L${cx + w * 0.6} ${floor + unit * 0.4}`} stroke={c1} strokeWidth="4" />
        </g>
      );
    case "crate":
      return (
        <g>
          {[-1, 0, 1].map((k) => (
            <rect key={k} x={cx + k * w * 0.33 - w * 0.17} y={y} width={w * 0.33} height={h} fill="#3a2a1c" stroke="#120b06" strokeWidth="5" />
          ))}
          <rect x={cx - w * 0.5} y={y - 6} width={w} height="10" fill={c1} filter={`url(#glow${uid})`} />
          {deck}
        </g>
      );
    case "skull":
      return (
        <g filter={`url(#glow${uid})`}>
          <path d={`M${cx - w * 0.5} ${floor} L${cx - w * 0.5} ${y + h * 0.3} Q${cx} ${y - h * 0.9} ${cx + w * 0.5} ${y + h * 0.3} L${cx + w * 0.5} ${floor} Z`} fill="#151515" stroke={c3} strokeWidth="6" />
          <circle cx={cx - w * 0.18} cy={y + h * 0.15} r={unit * 0.28} fill={c1} />
          <circle cx={cx + w * 0.18} cy={y + h * 0.15} r={unit * 0.28} fill={c1} />
          {deck}
        </g>
      );
    case "altar":
      return (
        <g filter={`url(#glow${uid})`}>
          <path d={`M${cx - w * 0.6} ${floor} L${cx - w * 0.42} ${y} L${cx + w * 0.42} ${y} L${cx + w * 0.6} ${floor} Z`} fill="#121a10" stroke={c1} strokeWidth="6" />
          {[0.2, 0.5, 0.8].map((t) => (
            <circle key={t} cx={cx - w * 0.5 + t * w} cy={y + h * 0.5} r={unit * 0.14} fill={c2} />
          ))}
          {deck}
        </g>
      );
    default:
      return (
        <g filter={`url(#glow${uid})`}>
          <rect x={cx - w / 2} y={y} width={w} height={h} rx={h / 2} fill="#121212" stroke={c1} strokeWidth="6" />
          <rect x={cx - w / 2 + 16} y={y + h * 0.35} width={w - 32} height={h * 0.2} rx="8" fill={c2} opacity="0.85" />
          {deck}
        </g>
      );
  }
}

function Installation({ kind, z, c1, c2, c3, uid }: { kind: ConceptSpec["installation"]; z: { x: number; y: number; w: number; h: number }; c1: string; c2: string; c3: string; uid: string }) {
  const floor = z.y + z.h;
  const cx = z.x + z.w / 2;
  switch (kind) {
    case "tentacles":
      return (
        <g filter={`url(#glow${uid})`} opacity="0.9">
          {[-1, 1].flatMap((side) =>
            [0, 1, 2].map((k) => {
              const bx = side < 0 ? z.x + k * 22 : z.x + z.w - k * 22;
              return <path key={`${side}${k}`} d={`M${bx} ${floor} C${bx + side * -80} ${floor - z.h * 0.6} ${bx + side * 120} ${floor - z.h * 1.1} ${bx + side * -40 - k * side * 30} ${floor - z.h * (1.3 + k * 0.15)}`} stroke={k % 2 ? c2 : c1} strokeWidth={26 - k * 6} strokeLinecap="round" fill="none" />;
            }),
          )}
        </g>
      );
    case "rings":
      return (
        <g filter={`url(#glow${uid})`} fill="none">
          {[1, 0.78, 0.56].map((r, i) => (
            <ellipse key={i} cx={cx} cy={floor - z.h * 0.75} rx={z.w * 0.48 * r} ry={z.h * 0.75 * r} stroke={[c1, c2, c3][i]} strokeWidth="10" opacity="0.85" />
          ))}
        </g>
      );
    case "vines":
      return (
        <g filter={`url(#glow${uid})`} fill="none" opacity="0.85">
          {Array.from({ length: 7 }).map((_, i) => {
            const x = z.x + (i / 6) * z.w;
            return <path key={i} d={`M${x} ${z.y - z.h * 0.6} q 30 ${z.h * 0.25} 0 ${z.h * 0.5} t 0 ${z.h * 0.5}`} stroke={i % 2 ? c1 : c2} strokeWidth="9" strokeLinecap="round" />;
          })}
        </g>
      );
    case "pipes":
      return (
        <g opacity="0.9">
          {Array.from({ length: 6 }).map((_, i) => (
            <rect key={i} x={z.x + (i / 6) * z.w + 10} y={z.y - z.h * 0.5} width="22" height={z.h * 1.4} rx="11" fill="#2a2d33" stroke={i % 2 ? c1 : c3} strokeWidth="3" />
          ))}
          <rect x={z.x} y={z.y - z.h * 0.5} width={z.w} height="16" fill={c1} filter={`url(#glow${uid})`} />
        </g>
      );
    case "orbs":
      return (
        <g filter={`url(#glow${uid})`}>
          {Array.from({ length: 6 }).map((_, i) => {
            const a = (i / 6) * Math.PI * 2;
            return <circle key={i} cx={cx + Math.cos(a) * z.w * 0.45} cy={floor - z.h * 0.85 + Math.sin(a) * z.h * 0.45} r={14 + (i % 3) * 6} fill={[c1, c2, c3][i % 3]} />;
          })}
        </g>
      );
    default:
      return null;
  }
}
