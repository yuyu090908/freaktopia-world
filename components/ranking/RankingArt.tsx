import { useTranslations } from "next-intl";
import { AlienG } from "@/components/art/Alien";

const INK = "#080808";
const C = { acid: "#B6F05C", coral: "#FF625C", purple: "#A276E9", blue: "#55BCEB", orange: "#FFAD5B", cream: "#F5F2EA" };

function Speaker({ x, y, s = 1, color }: { x: number; y: number; s?: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="0" y="0" width="70" height="120" rx="12" fill={color} stroke={INK} strokeWidth="6" />
      <circle cx="35" cy="36" r="20" fill={INK} />
      <circle cx="35" cy="36" r="7" fill={C.cream} />
      <circle cx="35" cy="88" r="14" fill={INK} />
      <circle cx="35" cy="88" r="5" fill={C.cream} />
    </g>
  );
}

/**
 * Original WORLD RANKING illustration: three aliens on a podium between
 * stacks of speakers, with a DJ booth and stage lights. Pure SVG.
 */
export function RankingArt({ className }: { className?: string }) {
  const tu = useTranslations("ranking");
  return (
    <svg viewBox="0 0 640 360" className={className} role="img" aria-label={tu("threeAliensCelebratingOnA")}>
      <defs>
        <radialGradient id="rk-glow" cx="50%" cy="40%" r="60%">
          <stop offset="0" stopColor={C.purple} stopOpacity="0.55" />
          <stop offset="1" stopColor={C.purple} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="640" height="360" fill="url(#rk-glow)" />
      {/* light beams */}
      <g opacity="0.55">
        <path d="M320 0 L230 300 L300 300 Z" fill={C.acid} />
        <path d="M320 0 L340 300 L410 300 Z" fill={C.blue} />
        <path d="M120 0 L170 300 L230 300 Z" fill={C.coral} opacity="0.7" />
        <path d="M520 0 L410 300 L470 300 Z" fill={C.orange} opacity="0.7" />
      </g>
      {/* stars */}
      {[[40, 40], [600, 60], [560, 20], [90, 110], [470, 30], [180, 30]].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y - 9} l3 6 6 3 -6 3 -3 6 -3 -6 -6 -3 6 -3z`} fill={i % 2 ? C.acid : C.cream} />
      ))}
      {/* speakers */}
      <Speaker x={14} y={150} s={1.15} color={C.purple} />
      <Speaker x={90} y={190} s={0.9} color={C.blue} />
      <Speaker x={546} y={150} s={1.15} color={C.coral} />
      <Speaker x={486} y={190} s={0.9} color={C.orange} />
      {/* DJ booth behind */}
      <path d="M220 214 L420 214 L410 250 L230 250 Z" fill="#262626" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
      <ellipse cx="270" cy="214" rx="26" ry="7" fill={INK} />
      <ellipse cx="370" cy="214" rx="26" ry="7" fill={INK} />
      {/* podium */}
      <g stroke={INK} strokeWidth="6" strokeLinejoin="round">
        <rect x="262" y="250" width="116" height="110" rx="8" fill={C.acid} />
        <rect x="150" y="282" width="112" height="78" rx="8" fill={C.blue} />
        <rect x="378" y="298" width="112" height="62" rx="8" fill={C.coral} />
      </g>
      <g fontFamily="var(--font-display), 'Arial Black', sans-serif" textAnchor="middle" fill={INK}>
        <text x="320" y="318" fontSize="54">1</text>
        <text x="206" y="336" fontSize="42">2</text>
        <text x="434" y="346" fontSize="38">3</text>
      </g>
      {/* aliens */}
      <g transform="translate(266 120) scale(0.56)" className="alien-live">
        <AlienG look={{ species: "slime", body: C.acid, accent: C.coral, outfit: "hoodie", outfitColor: C.purple, accessory: "crown" }} />
      </g>
      <g transform="translate(160 168) scale(0.5)">
        <AlienG look={{ species: "fuzz", body: C.purple, accent: C.orange, outfit: "jacket", outfitColor: C.blue, accessory: "shades" }} />
      </g>
      <g transform="translate(386 192) scale(0.48)">
        <AlienG look={{ species: "jelly", body: C.blue, accent: C.acid, outfit: "vest", outfitColor: C.orange, accessory: "headphones" }} />
      </g>
      {/* trophy */}
      <g transform="translate(300 86)">
        <path d="M6 0 H34 V14 C34 26 26 32 20 32 C14 32 6 26 6 14 Z" fill={C.orange} stroke={INK} strokeWidth="4" />
        <rect x="14" y="32" width="12" height="8" fill={C.orange} stroke={INK} strokeWidth="4" />
        <rect x="8" y="40" width="24" height="7" rx="2" fill={C.cream} stroke={INK} strokeWidth="4" />
      </g>
    </svg>
  );
}
