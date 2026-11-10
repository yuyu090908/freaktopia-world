import { useTranslations } from "next-intl";
import { AlienG } from "./Alien";
import { cn, rng } from "@/lib/utils";

const INK = "#080808";
const C = { acid: "#B6F05C", coral: "#FF625C", purple: "#A276E9", blue: "#55BCEB", orange: "#FFAD5B", cream: "#F5F2EA" };

/* ------------------------------------------------------------------ */
/* Psychedelic city skyline used by event and hero art                 */
/* ------------------------------------------------------------------ */
function Skyline({ seed, y, w, color, windowColor, count = 9 }: { seed: string; y: number; w: number; color: string; windowColor: string; count?: number }) {
  const r = rng(seed);
  const items: React.ReactNode[] = [];
  let x = -6;
  for (let i = 0; i < count; i++) {
    const bw = 24 + r() * (w / count);
    const bh = 40 + r() * 80;
    const top = y - bh;
    const kind = r();
    if (kind < 0.28) {
      // mushroom tower
      items.push(
        <g key={i}>
          <rect x={x + bw * 0.3} y={top + 14} width={bw * 0.4} height={bh - 14} fill={color} stroke={INK} strokeWidth={4} />
          <path d={`M${x - 4} ${top + 18} Q${x + bw / 2} ${top - 26} ${x + bw + 4} ${top + 18} Z`} fill={windowColor} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
          <circle cx={x + bw * 0.35} cy={top + 6} r={3.5} fill={C.cream} />
          <circle cx={x + bw * 0.65} cy={top + 2} r={2.5} fill={C.cream} />
        </g>,
      );
    } else if (kind < 0.5) {
      // dome
      items.push(
        <g key={i}>
          <rect x={x} y={top + bw / 2} width={bw} height={bh - bw / 2} fill={color} stroke={INK} strokeWidth={4} />
          <path d={`M${x} ${top + bw / 2} A${bw / 2} ${bw / 2} 0 0 1 ${x + bw} ${top + bw / 2} Z`} fill={color} stroke={INK} strokeWidth={4} />
          <line x1={x + bw / 2} y1={top} x2={x + bw / 2} y2={top - 14} stroke={INK} strokeWidth={3} />
          <circle cx={x + bw / 2} cy={top - 16} r={4} fill={windowColor} stroke={INK} strokeWidth={2} />
        </g>,
      );
    } else {
      items.push(<rect key={i} x={x} y={top} width={bw} height={bh} fill={color} stroke={INK} strokeWidth={4} />);
    }
    // windows
    for (let k = 0; k < 4; k++) {
      if (r() < 0.45) continue;
      items.push(
        <rect key={`${i}-w${k}`} x={x + 6 + (k % 2) * (bw / 2 - 4)} y={y - bh + 34 + Math.floor(k / 2) * 18} width={7} height={9} rx={2} fill={windowColor} />,
      );
    }
    x += bw - 2;
  }
  return <g>{items}</g>;
}

/* ------------------------------------------------------------------ */
/* Event cover art: deterministic per event id                         */
/* ------------------------------------------------------------------ */
export function EventArt({ id, palette, className, label }: { id: string; palette: [string, string, string]; className?: string; label?: string }) {
  const tu = useTranslations("ui");
  const [p1, p2, p3] = palette;
  const r = rng(id);
  const sunX = 220 + r() * 140;
  const sunY = 50 + r() * 40;
  const tx = 330 + r() * 40;
  const ty = 110 + r() * 30;
  const tent = `M${tx - 30} 240 C${tx - 60} 200 ${tx + 20} 180 ${tx - 4} ${ty + 30} C${tx - 14} ${ty + 10} ${tx - 6} ${ty} ${tx} ${ty}`;
  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className={cn("block", className)} role="img" aria-label={label ?? tu("illustratedEventCover")}>
      <rect width="400" height="240" fill={p1} />
      <g opacity="0.9">
        {[150, 118, 88, 60].map((rad, i) => (
          <circle key={rad} cx={sunX} cy={sunY} r={rad} fill={[p2, p1, p3, C.cream][i]} stroke={INK} strokeWidth={4} />
        ))}
      </g>
      <ellipse cx={sunX} cy={sunY} rx="70" ry="12" fill="none" stroke={INK} strokeWidth={5} transform={`rotate(-18 ${sunX} ${sunY})`} />
      {Array.from({ length: 8 }).map((_, i) => (
        <path key={i} d={`M${20 + r() * 360} ${10 + r() * 90} l3 -8 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 Z`} fill={i % 2 ? C.cream : INK} />
      ))}
      <Skyline seed={id} y={214} w={400} color="#1b1b1f" windowColor={p1 === "#F5F2EA" ? p2 : p1} count={10} />
      {/* tentacle creature climbing the skyline */}
      <path d={tent} fill="none" stroke={INK} strokeWidth={22} strokeLinecap="round" />
      <path d={tent} fill="none" stroke={p3} strokeWidth={11} strokeLinecap="round" />
      <circle cx={tx + 10} cy={ty - 6} r={9} fill={C.cream} stroke={INK} strokeWidth={4} />
      <circle cx={tx + 12} cy={ty - 5} r={4} fill={INK} />
      <rect x="0" y="212" width="400" height="28" fill={INK} />
      <path d="M0 214 Q50 204 100 214 T200 214 T300 214 T400 214" fill="none" stroke={p2} strokeWidth={4} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Home hero: alien DJ above a psychedelic music city                  */
/* ------------------------------------------------------------------ */
export function HeroArt({ className }: { className?: string }) {
  const tu = useTranslations("ui");
  const rays = 18;
  return (
    <svg viewBox="0 0 400 400" className={cn("block", className)} role="img" aria-label={tu("anOriginalAlienDjPerforming")}>
      <defs>
        <clipPath id="hero-clip">
          <circle cx="200" cy="200" r="196" />
        </clipPath>
        <pattern id="hero-dots" width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.4" fill={INK} opacity="0.25" />
        </pattern>
      </defs>
      <g clipPath="url(#hero-clip)">
        <rect width="400" height="400" fill={C.purple} />
        {Array.from({ length: rays }).map((_, i) => {
          const a1 = (i / rays) * Math.PI * 2;
          const a2 = ((i + 0.5) / rays) * Math.PI * 2;
          return (
            <path key={i} d={`M200 210 L${200 + Math.cos(a1) * 400} ${210 + Math.sin(a1) * 400} L${200 + Math.cos(a2) * 400} ${210 + Math.sin(a2) * 400} Z`} fill={[C.orange, C.coral, C.acid][i % 3]} opacity="0.9" />
          );
        })}
        <rect width="400" height="400" fill="url(#hero-dots)" />
        <circle cx="200" cy="200" r="120" fill={C.blue} stroke={INK} strokeWidth={6} />
        <circle cx="200" cy="200" r="92" fill={C.cream} stroke={INK} strokeWidth={6} />
        <ellipse cx="200" cy="200" rx="170" ry="28" fill="none" stroke={INK} strokeWidth={7} transform="rotate(-14 200 200)" />
        <ellipse cx="200" cy="200" rx="170" ry="28" fill="none" stroke={C.acid} strokeWidth={3} transform="rotate(-14 200 200)" />
        {/* floating speakers */}
        <g className="animate-bob" style={{ animationDelay: "-0.6s" }}>
          <rect x="32" y="84" width="54" height="76" rx="12" fill={C.acid} stroke={INK} strokeWidth={6} />
          <circle cx="59" cy="108" r="15" fill={INK} />
          <circle cx="59" cy="108" r="5" fill={C.cream} />
          <circle cx="59" cy="142" r="10" fill={INK} />
          <path d="M40 160 L34 180 M78 160 L84 180" stroke={INK} strokeWidth={6} strokeLinecap="round" />
        </g>
        <g className="animate-bob" style={{ animationDelay: "-1.4s" }}>
          <rect x="314" y="64" width="54" height="76" rx="12" fill={C.coral} stroke={INK} strokeWidth={6} />
          <circle cx="341" cy="88" r="15" fill={INK} />
          <circle cx="341" cy="88" r="5" fill={C.cream} />
          <circle cx="341" cy="122" r="10" fill={INK} />
          <circle cx="324" cy="58" r="8" fill={C.cream} stroke={INK} strokeWidth={4} />
          <circle cx="326" cy="58" r="3" fill={INK} />
        </g>
        {/* the alien DJ */}
        <g transform="translate(106 66) scale(0.94)" className="alien-live">
          <AlienG look={{ species: "slime", body: C.acid, accent: C.coral, outfit: "hoodie", outfitColor: C.purple, accessory: "headphones" }} />
        </g>
        {/* decks */}
        <path d="M84 262 L316 262 L302 318 L98 318 Z" fill={C.orange} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
        <rect x="76" y="248" width="248" height="20" rx="6" fill="#262626" stroke={INK} strokeWidth={6} />
        <ellipse cx="136" cy="248" rx="34" ry="9" fill={INK} />
        <ellipse cx="264" cy="248" rx="34" ry="9" fill={INK} />
        <circle cx="136" cy="246" r="4" fill={C.cream} />
        <circle cx="264" cy="246" r="4" fill={C.cream} />
        <path d="M124 290 L140 290 M150 290 L166 290 M234 290 L250 290 M260 290 L276 290" stroke={INK} strokeWidth={6} strokeLinecap="round" />
        <text x="200" y="302" textAnchor="middle" fontFamily="var(--font-display), sans-serif" fontSize="18" fill={INK}>FREAK</text>{/* i18n-ignore: logo lettering in the artwork */}
        {/* city */}
        <Skyline seed="hero-city" y={400} w={400} color="#1b1b1f" windowColor={C.acid} count={9} />
        <rect x="0" y="384" width="400" height="20" fill={INK} />
        {/* sound waves */}
        <path d="M30 220 q10 -14 20 0 t20 0 t20 0" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
        <path d="M310 220 q10 -14 20 0 t20 0 t20 0" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      </g>
      <circle cx="200" cy="200" r="196" fill="none" stroke={C.cream} strokeWidth={4} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Explore card art                                                    */
/* ------------------------------------------------------------------ */
export type ExploreKind = "world" | "dj" | "events" | "venues" | "live" | "afterparty" | "alien" | "nft";

export function ExploreArt({ kind, className }: { kind: ExploreKind; className?: string }) {
  return (
    <svg viewBox="0 0 200 150" className={cn("block", className)} aria-hidden="true">
      {kind === "world" && (
        <g>
          <circle cx="100" cy="78" r="56" fill={C.blue} stroke={INK} strokeWidth={6} />
          <path d="M66 52 q14 -10 24 0 q6 14 -8 20 q-14 4 -16 18 q-12 -8 -10 -22 Z M110 40 q20 2 28 18 q-8 6 -18 2 q-6 10 -16 4 q2 -14 6 -24 Z M108 92 q16 -6 24 8 q-4 18 -20 22 q-10 -12 -4 -30 Z" fill={C.acid} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
          <ellipse cx="100" cy="78" rx="88" ry="16" fill="none" stroke={INK} strokeWidth={6} transform="rotate(-12 100 78)" />
          <ellipse cx="100" cy="78" rx="88" ry="16" fill="none" stroke={C.coral} strokeWidth={2.5} transform="rotate(-12 100 78)" />
          <path d="M140 30 l-6 -16 a10 10 0 1 1 12 0 Z" fill={C.coral} stroke={INK} strokeWidth={4} />
        </g>
      )}
      {kind === "dj" && (
        <g>
          <rect x="20" y="62" width="160" height="66" rx="12" fill={C.orange} stroke={INK} strokeWidth={6} />
          <circle cx="66" cy="94" r="26" fill={INK} />
          <circle cx="66" cy="94" r="18" fill="none" stroke="#444" strokeWidth={2} />
          <circle cx="66" cy="94" r="8" fill={C.coral} />
          <circle cx="136" cy="94" r="26" fill={INK} />
          <circle cx="136" cy="94" r="8" fill={C.acid} />
          <path d="M84 68 L100 50" stroke={INK} strokeWidth={5} strokeLinecap="round" />
          <path d="M70 40 q30 -36 60 0" fill="none" stroke={INK} strokeWidth={10} strokeLinecap="round" />
          <rect x="58" y="34" width="18" height="26" rx="8" fill={C.purple} stroke={INK} strokeWidth={5} />
          <rect x="124" y="34" width="18" height="26" rx="8" fill={C.purple} stroke={INK} strokeWidth={5} />
        </g>
      )}
      {kind === "events" && (
        <g transform="rotate(-8 100 75)">
          <path d="M28 44 h144 v24 a10 10 0 0 0 0 20 v24 h-144 v-24 a10 10 0 0 0 0 -20 Z" fill={C.acid} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
          <path d="M128 48 v64" stroke={INK} strokeWidth={4} strokeDasharray="6 6" />
          <text x="78" y="86" textAnchor="middle" fontFamily="var(--font-display), sans-serif" fontSize="20" fill={INK}>RAVE</text>{/* i18n-ignore: logo lettering in the artwork */}
          <circle cx="150" cy="78" r="9" fill={C.coral} stroke={INK} strokeWidth={4} />
        </g>
      )}
      {kind === "venues" && (
        <g>
          <path d="M40 132 V64 L100 26 L160 64 V132 Z" fill={C.purple} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
          <path d="M80 132 V94 a20 20 0 0 1 40 0 V132 Z" fill={INK} />
          <circle cx="100" cy="64" r="12" fill={C.cream} stroke={INK} strokeWidth={4} />
          <circle cx="102" cy="66" r="5" fill={INK} />
          <rect x="52" y="78" width="16" height="16" rx="3" fill={C.orange} stroke={INK} strokeWidth={3} />
          <rect x="132" y="78" width="16" height="16" rx="3" fill={C.orange} stroke={INK} strokeWidth={3} />
          <path d="M20 134 H180" stroke={INK} strokeWidth={6} strokeLinecap="round" />
        </g>
      )}
      {kind === "live" && (
        <g>
          <path d="M20 132 L40 50 L160 50 L180 132 Z" fill={C.coral} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
          <path d="M40 50 Q100 10 160 50" fill={C.orange} stroke={INK} strokeWidth={6} />
          <rect x="70" y="80" width="60" height="30" rx="6" fill={INK} />
          <circle cx="86" cy="95" r="5" fill={C.coral} />
          <text x="112" y="100" textAnchor="middle" fontFamily="var(--font-display), sans-serif" fontSize="12" fill={C.cream}>LIVE</text>
          {[34, 64, 100, 136, 166].map((x, i) => (
            <circle key={x} cx={x} cy={136} r={11} fill={[C.acid, C.blue, C.purple, C.orange, C.acid][i]} stroke={INK} strokeWidth={4} />
          ))}
        </g>
      )}
      {kind === "afterparty" && (
        <g>
          <path d="M138 24 a40 40 0 1 0 30 62 a32 32 0 1 1 -30 -62 Z" fill={C.orange} stroke={INK} strokeWidth={6} />
          <path d="M44 50 h64 l-32 40 Z" fill={C.blue} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
          <path d="M76 90 v34 M58 126 h36" stroke={INK} strokeWidth={6} strokeLinecap="round" />
          <circle cx="90" cy="60" r="7" fill={C.acid} stroke={INK} strokeWidth={3} />
          <path d="M100 52 L118 30" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        </g>
      )}
      {kind === "alien" && (
        <g transform="translate(46 0) scale(0.62)">
          <AlienG look={{ species: "fuzz", body: C.purple, accent: C.acid, outfit: "none", outfitColor: C.blue, accessory: "antenna" }} />
        </g>
      )}
      {kind === "nft" && (
        <g>
          <path d="M100 18 L150 58 L100 132 L50 58 Z" fill={C.blue} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
          <path d="M50 58 H150 M80 58 L100 18 L120 58 L100 132 Z" fill="none" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
          <path d="M80 58 L100 132 L120 58 Z" fill={C.cream} opacity="0.5" />
          <circle cx="160" cy="30" r="5" fill={C.acid} />
          <circle cx="38" cy="104" r="6" fill={C.coral} />
        </g>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Venue art                                                            */
/* ------------------------------------------------------------------ */
export function VenueArt({ id, palette, className, label }: { id: string; palette: [string, string, string]; className?: string; label?: string }) {
  const tu = useTranslations("ui");
  const [p1, p2] = palette;
  const r = rng(id);
  const roof = r();
  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className={cn("block", className)} role="img" aria-label={label ?? tu("venueIllustration")}>
      <rect width="400" height="240" fill={p1} />
      <rect width="400" height="240" fill={p2} opacity="0.25" />
      {Array.from({ length: 6 }).map((_, i) => (
        <circle key={i} cx={30 + r() * 340} cy={20 + r() * 60} r={3 + r() * 4} fill={C.cream} stroke={INK} strokeWidth={2} />
      ))}
      <g>
        {roof < 0.5 ? (
          <path d="M70 210 V100 Q200 20 330 100 V210 Z" fill="#1b1b1f" stroke={INK} strokeWidth={6} />
        ) : (
          <path d="M60 210 V90 L130 60 L200 90 L270 60 L340 90 V210 Z" fill="#1b1b1f" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
        )}
        <path d="M160 210 V150 a40 40 0 0 1 80 0 V210 Z" fill={p2} stroke={INK} strokeWidth={5} />
        <rect x="96" y="120" width="40" height="34" rx="6" fill={p1} stroke={INK} strokeWidth={4} />
        <rect x="264" y="120" width="40" height="34" rx="6" fill={p1} stroke={INK} strokeWidth={4} />
        <circle cx="200" cy="100" r="18" fill={C.cream} stroke={INK} strokeWidth={5} />
        <circle cx="204" cy="102" r="7" fill={INK} />
        <path d="M170 176 h60" stroke={INK} strokeWidth={4} />
      </g>
      <rect x="0" y="208" width="400" height="32" fill={INK} />
    </svg>
  );
}
