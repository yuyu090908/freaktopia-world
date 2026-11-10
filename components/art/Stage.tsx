import { useTranslations } from "next-intl";
import type { EventLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Event stage illustration that evolves with the event level.
 * LV.1 DJ booth → LV.2 club → LV.3 rave → LV.4 festival → LV.5 mega fest.
 * Each level adds production on top of the previous one.
 */

const INK = "#080808";
const C = { acid: "#B6F05C", coral: "#FF625C", purple: "#A276E9", blue: "#55BCEB", orange: "#FFAD5B", cream: "#F5F2EA" };

const STARS = [
  [18, 22], [44, 54], [70, 14], [102, 40], [150, 18], [196, 34], [232, 12], [268, 46], [300, 20], [286, 80], [30, 92], [246, 70],
];

function Speaker({ x, y, w, h, color }: { x: number; y: number; w: number; h: number; color: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={color} stroke={INK} strokeWidth={4} />
      <circle cx={x + w / 2} cy={y + h * 0.32} r={w * 0.26} fill={INK} stroke={INK} strokeWidth={2} />
      <circle cx={x + w / 2} cy={y + h * 0.32} r={w * 0.1} fill={C.cream} />
      <circle cx={x + w / 2} cy={y + h * 0.72} r={w * 0.18} fill={INK} />
      <circle cx={x + w / 2} cy={y + h * 0.72} r={w * 0.06} fill={C.cream} />
    </g>
  );
}

function Crowd({ y, count, offset = 0, scale = 1 }: { y: number; count: number; offset?: number; scale?: number }) {
  const cols = [C.acid, C.coral, C.purple, C.blue, C.orange];
  return (
    <g>
      {Array.from({ length: count }).map((_, i) => {
        const x = 12 + offset + (i * (296 / count));
        const r = (10 + ((i * 7) % 5)) * scale;
        const yy = y + ((i * 13) % 7);
        return (
          <g key={i}>
            <circle cx={x} cy={yy} r={r} fill={cols[(i + offset) % cols.length]} stroke={INK} strokeWidth={3} />
            <circle cx={x - r * 0.35} cy={yy - r * 0.15} r={r * 0.22} fill={C.cream} />
            <circle cx={x + r * 0.35} cy={yy - r * 0.15} r={r * 0.22} fill={C.cream} />
            <circle cx={x - r * 0.3} cy={yy - r * 0.12} r={r * 0.1} fill={INK} />
            <circle cx={x + r * 0.4} cy={yy - r * 0.12} r={r * 0.1} fill={INK} />
            {i % 3 === 0 && <path d={`M${x + r * 0.7} ${yy - r * 0.4} L${x + r * 1.3} ${yy - r * 1.6}`} stroke={INK} strokeWidth={4} strokeLinecap="round" />}
          </g>
        );
      })}
    </g>
  );
}

export function Stage({
  level,
  palette = [C.acid, C.purple, C.coral],
  className,
  title,
}: {
  level: EventLevel;
  palette?: [string, string, string];
  className?: string;
  title?: string;
}) {
  const tu = useTranslations("ui");
  const [p1, p2, p3] = palette;
  return (
    <svg viewBox="0 0 320 200" className={cn("block", className)} role="img" aria-label={title ?? tu("stageIllustrationLevelLevel", { level })}>
      <defs>
        <pattern id={`dots-${level}`} width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.1" fill="#fff" opacity="0.08" />
        </pattern>
        <clipPath id={`clip-${level}`}>
          <rect x="0" y="0" width="320" height="200" rx="18" />
        </clipPath>
      </defs>
      <g clipPath={`url(#clip-${level})`}>
        <rect width="320" height="200" fill={level >= 4 ? "#140f22" : "#111015"} />
        <rect width="320" height="200" fill={`url(#dots-${level})`} />
        {STARS.slice(0, 4 + level * 2).map(([x, y], i) => (
          <path key={i} d={`M${x} ${y - 4} L${x + 1.4} ${y - 1.4} L${x + 4} ${y} L${x + 1.4} ${y + 1.4} L${x} ${y + 4} L${x - 1.4} ${y + 1.4} L${x - 4} ${y} L${x - 1.4} ${y - 1.4} Z`} fill={i % 2 ? C.cream : p1} opacity="0.85" />
        ))}

        {/* LV5: mothership moon with giant alien face */}
        {level >= 5 && (
          <g>
            <circle cx="160" cy="58" r="52" fill={p2} stroke={INK} strokeWidth={5} />
            <circle cx="140" cy="52" r="12" fill={C.cream} stroke={INK} strokeWidth={4} />
            <circle cx="180" cy="52" r="12" fill={C.cream} stroke={INK} strokeWidth={4} />
            <circle cx="143" cy="54" r="5" fill={INK} />
            <circle cx="183" cy="54" r="5" fill={INK} />
            <path d="M140 78 Q160 92 180 78" stroke={INK} strokeWidth={5} fill="none" strokeLinecap="round" />
            <ellipse cx="160" cy="112" rx="96" ry="10" fill={C.cream} opacity="0.18" />
            <g>
              <ellipse cx="48" cy="34" rx="26" ry="8" fill={C.blue} stroke={INK} strokeWidth={4} />
              <path d="M36 32 Q48 14 60 32" fill={C.cream} stroke={INK} strokeWidth={4} />
              <path d="M44 42 L30 90 L66 90 L52 42 Z" fill={C.acid} opacity="0.25" />
            </g>
          </g>
        )}

        {/* LV4: festival roof truss and side screens */}
        {level >= 4 && (
          <g>
            <path d="M40 66 L280 66 L268 50 L52 50 Z" fill="#2a2a2a" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
            {Array.from({ length: 11 }).map((_, i) => (
              <path key={i} d={`M${56 + i * 21} 52 L${66 + i * 21} 64 M${66 + i * 21} 52 L${56 + i * 21} 64`} stroke="#555" strokeWidth={2} />
            ))}
            {[60, 100, 140, 180, 220, 260].map((x, i) => (
              <circle key={x} cx={x} cy={70} r={5} fill={[p1, p3, C.cream][i % 3]} stroke={INK} strokeWidth={2} />
            ))}
            <rect x="44" y="66" width="8" height="100" fill="#333" stroke={INK} strokeWidth={3} />
            <rect x="268" y="66" width="8" height="100" fill="#333" stroke={INK} strokeWidth={3} />
            <rect x="6" y="76" width="34" height="46" rx="4" fill={p2} stroke={INK} strokeWidth={4} />
            <rect x="280" y="76" width="34" height="46" rx="4" fill={p2} stroke={INK} strokeWidth={4} />
            <circle cx="23" cy="99" r="9" fill={C.cream} stroke={INK} strokeWidth={3} />
            <circle cx="297" cy="99" r="9" fill={C.cream} stroke={INK} strokeWidth={3} />
            <path d="M84 50 L84 30 L100 36 L84 42" fill={p3} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
            <path d="M236 50 L236 30 L252 36 L236 42" fill={p1} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          </g>
        )}

        {/* LV3: lasers */}
        {level >= 3 && (
          <g opacity="0.75">
            {[
              [0, 30, 150, 140, p1],
              [0, 60, 200, 150, p3],
              [320, 30, 170, 140, p1],
              [320, 60, 120, 150, C.blue],
              [160, 0, 60, 160, p2],
              [160, 0, 260, 160, p2],
            ].map(([x1, y1, x2, y2, col], i) => (
              <line key={i} x1={x1 as number} y1={y1 as number} x2={x2 as number} y2={y2 as number} stroke={col as string} strokeWidth={3} strokeLinecap="round" />
            ))}
          </g>
        )}

        {/* LV2: club arch + disco ball */}
        {level >= 2 && (
          <g>
            <path d="M72 166 L72 104 Q160 40 248 104 L248 166" fill={level >= 4 ? "none" : "#1f1830"} stroke={INK} strokeWidth={5} />
            <path d="M80 166 L80 108 Q160 52 240 108 L240 166" fill="none" stroke={p2} strokeWidth={4} strokeDasharray="2 10" strokeLinecap="round" />
            <line x1="160" y1="0" x2="160" y2="70" stroke="#666" strokeWidth={2} />
            <circle cx="160" cy="78" r="12" fill="#cfcfcf" stroke={INK} strokeWidth={4} />
            <path d="M150 74 L170 74 M148 80 L172 80 M156 68 L156 88 M164 68 L164 88" stroke="#888" strokeWidth={1.5} />
            <circle cx="155" cy="73" r="2.5" fill="#fff" />
          </g>
        )}

        {/* Ground */}
        <rect x="0" y="164" width="320" height="40" fill="#1c1c1c" stroke={INK} strokeWidth={4} />

        {/* Speakers */}
        <Speaker x={level >= 2 ? 84 : 92} y={level >= 3 ? 112 : 118} w={32} h={48} color={p3} />
        {level >= 2 && <Speaker x={204} y={level >= 3 ? 112 : 118} w={32} h={48} color={p3} />}
        {level >= 3 && (
          <g>
            <Speaker x={20} y={118} w={36} h={48} color={p2} />
            <Speaker x={20} y={74} w={36} h={44} color={p2} />
            <Speaker x={264} y={118} w={36} h={48} color={p2} />
            <Speaker x={264} y={74} w={36} h={44} color={p2} />
          </g>
        )}

        {/* DJ alien behind booth */}
        <g>
          <path d="M140 132 C136 100 184 100 180 132 Z" fill={p1} stroke={INK} strokeWidth={4} />
          <circle cx="152" cy="116" r="6" fill={C.cream} stroke={INK} strokeWidth={2.5} />
          <circle cx="168" cy="114" r="7" fill={C.cream} stroke={INK} strokeWidth={2.5} />
          <circle cx="153" cy="117" r="2.5" fill={INK} />
          <circle cx="169" cy="115" r="3" fill={INK} />
          <path d="M140 116 Q160 88 180 116" stroke={INK} strokeWidth={6} fill="none" />
          <rect x="134" y="110" width="9" height="15" rx="4" fill={p3} stroke={INK} strokeWidth={3} />
          <rect x="177" y="110" width="9" height="15" rx="4" fill={p3} stroke={INK} strokeWidth={3} />
          <path d="M140 124 L124 112 M180 124 L196 110" stroke={INK} strokeWidth={5} strokeLinecap="round" />
        </g>

        {/* Booth */}
        <path d="M122 132 L198 132 L192 166 L128 166 Z" fill={C.orange} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        <rect x="118" y="126" width="84" height="10" rx="3" fill="#2a2a2a" stroke={INK} strokeWidth={4} />
        <ellipse cx="140" cy="126" rx="12" ry="4" fill={INK} />
        <ellipse cx="180" cy="126" rx="12" ry="4" fill={INK} />
        <text x="160" y="155" textAnchor="middle" fontFamily="var(--font-display), sans-serif" fontSize="11" fill={INK}>
          LV.{level}
        </text>

        {/* LV1: string lights */}
        {level === 1 && (
          <g>
            <path d="M60 60 Q160 96 260 60" stroke="#666" strokeWidth={2} fill="none" />
            {[80, 110, 140, 170, 200, 230].map((x, i) => (
              <circle key={x} cx={x} cy={68 + Math.sin((i / 5) * Math.PI) * 14} r={5} fill={[p1, C.orange, p3][i % 3]} stroke={INK} strokeWidth={2} />
            ))}
          </g>
        )}

        {/* Crowd */}
        {level >= 3 && <Crowd y={186} count={level >= 4 ? 16 : 11} />}
        {level >= 4 && <Crowd y={198} count={14} offset={8} scale={1.2} />}

        {/* LV5 fireworks */}
        {level >= 5 && (
          <g>
            {[
              [270, 30, C.orange],
              [28, 120, p1],
              [296, 140, C.coral],
            ].map(([x, y, col], i) => (
              <g key={i}>
                {Array.from({ length: 8 }).map((_, k) => {
                  const a = (k / 8) * Math.PI * 2;
                  return <line key={k} x1={(x as number) + Math.cos(a) * 5} y1={(y as number) + Math.sin(a) * 5} x2={(x as number) + Math.cos(a) * 16} y2={(y as number) + Math.sin(a) * 16} stroke={col as string} strokeWidth={3} strokeLinecap="round" />;
                })}
              </g>
            ))}
          </g>
        )}
      </g>
      <rect x="2" y="2" width="316" height="196" rx="17" fill="none" stroke={INK} strokeWidth={4} />
    </svg>
  );
}
