import type { AlienLook, Species } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Original FREAKTOPIA alien characters, drawn as inline SVG in a
 * consistent "thick black outline + flat colour + halftone" style.
 * Four species × outfits × accessories × colours → every avatar and DJ.
 */

const INK = "#080808";
const SW = 6;

const ANCHORS: Record<Species, { top: number; eyeY: number; left: number; right: number; cy: number; shadesW: number }> = {
  slime: { top: 50, eyeY: 100, left: 40, right: 160, cy: 105, shadesW: 100 },
  fuzz: { top: 52, eyeY: 98, left: 42, right: 158, cy: 112, shadesW: 100 },
  vinyl: { top: 35, eyeY: 92, left: 40, right: 160, cy: 95, shadesW: 56 },
  jelly: { top: 64, eyeY: 100, left: 42, right: 158, cy: 100, shadesW: 92 },
};

function Eye({ x, y, r, look = 0.35 }: { x: number; y: number; r: number; look?: number }) {
  return (
    <g className="fk-eye">
      <circle cx={x} cy={y} r={r} fill="#F5F2EA" stroke={INK} strokeWidth={SW - 1} />
      <circle cx={x + r * look} cy={y + r * 0.15} r={r * 0.45} fill={INK} />
      <circle cx={x + r * look - r * 0.15} cy={y - r * 0.05} r={r * 0.14} fill="#F5F2EA" />
    </g>
  );
}

function fuzzPath(cx: number, cy: number, r1: number, r2: number, n: number) {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n - Math.PI / 2;
    const r = i % 2 ? r2 : r1;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z`;
}

function Body({ look }: { look: AlienLook }) {
  const { species, body, accent } = look;
  switch (species) {
    case "slime":
      return (
        <g>
          <path
            d="M38 168 C30 120 42 58 100 50 C158 58 170 120 162 168 C160 182 148 186 144 174 C138 190 120 192 116 178 C108 194 88 194 84 178 C78 192 60 190 56 174 C50 186 38 182 38 168 Z"
            fill={body}
            stroke={INK}
            strokeWidth={SW}
            strokeLinejoin="round"
          />
          <ellipse cx="66" cy="82" rx="9" ry="16" transform="rotate(30 66 82)" fill="#fff" opacity="0.55" />
          <circle cx="140" cy="140" r="6" fill={accent} stroke={INK} strokeWidth={3} />
          <circle cx="56" cy="134" r="4" fill={accent} stroke={INK} strokeWidth={3} />
          <Eye x={80} y={100} r={20} />
          <Eye x={125} y={94} r={13} look={-0.2} />
          <path d="M82 134 Q102 156 124 132" fill={INK} stroke={INK} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M95 142 Q104 152 113 141" fill={accent} />
        </g>
      );
    case "fuzz":
      return (
        <g>
          <path d={fuzzPath(100, 114, 68, 54, 22)} fill={body} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
          <ellipse cx="80" cy="182" rx="14" ry="8" fill={accent} stroke={INK} strokeWidth={5} />
          <ellipse cx="122" cy="182" rx="14" ry="8" fill={accent} stroke={INK} strokeWidth={5} />
          <Eye x={78} y={100} r={14} />
          <Eye x={120} y={97} r={16} look={-0.3} />
          <Eye x={100} y={72} r={9} />
          <path d="M72 128 L128 128 Q124 152 100 152 Q76 152 72 128 Z" fill={INK} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
          <path d="M80 129 L86 138 L92 129 L98 138 L104 129 L110 138 L116 129 L122 138 L124 129 Z" fill="#F5F2EA" />
        </g>
      );
    case "vinyl":
      return (
        <g>
          {/* legs */}
          <path d="M88 180 L82 200 M112 180 L118 200" stroke={INK} strokeWidth={8} strokeLinecap="round" />
          <path d="M88 180 L82 200 M112 180 L118 200" stroke={accent} strokeWidth={3} strokeLinecap="round" />
          <rect x="74" y="146" width="52" height="40" rx="18" fill={accent} stroke={INK} strokeWidth={SW} />
          <circle cx="100" cy="95" r="62" fill="#262626" stroke={INK} strokeWidth={SW} />
          <circle cx="100" cy="95" r="53" fill="none" stroke="#4a4a4a" strokeWidth={2} />
          <circle cx="100" cy="95" r="45" fill="none" stroke="#4a4a4a" strokeWidth={2} />
          <circle cx="100" cy="95" r="37" fill="none" stroke="#4a4a4a" strokeWidth={2} />
          <path d="M58 64 A52 52 0 0 1 96 44" fill="none" stroke="#F5F2EA" strokeWidth={4} strokeLinecap="round" opacity="0.6" />
          <circle cx="100" cy="95" r="29" fill={body} stroke={INK} strokeWidth={4} />
          <Eye x={89} y={91} r={8} />
          <Eye x={112} y={91} r={8} look={-0.2} />
          <path d="M90 107 Q100 116 111 106" fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
          <circle cx="100" cy="100" r="2.5" fill={INK} />
        </g>
      );
    case "jelly":
    default:
      return (
        <g>
          {[56, 78, 100, 122, 144].map((x, i) => {
            const d = `M${x} 124 C${x - 12} 146 ${x + 12} 160 ${x} 176 C${x - 8} 186 ${x + 6} 194 ${x + (i % 2 ? 8 : -8)} 200`;
            return (
              <g key={x}>
                <path d={d} stroke={INK} strokeWidth={13} fill="none" strokeLinecap="round" />
                <path d={d} stroke={i % 2 ? accent : body} strokeWidth={6} fill="none" strokeLinecap="round" />
              </g>
            );
          })}
          <path
            d="M38 124 C34 60 166 60 162 124 C152 134 142 120 131 130 C120 140 110 124 100 132 C90 140 80 124 69 132 C58 140 48 124 38 124 Z"
            fill={body}
            stroke={INK}
            strokeWidth={SW}
            strokeLinejoin="round"
          />
          <ellipse cx="70" cy="78" rx="8" ry="13" transform="rotate(40 70 78)" fill="#fff" opacity="0.5" />
          <circle cx="132" cy="80" r="5" fill={accent} opacity="0.9" />
          <circle cx="146" cy="96" r="3.5" fill={accent} opacity="0.9" />
          <Eye x={80} y={100} r={13} />
          <Eye x={120} y={100} r={13} look={-0.3} />
          <path d="M92 116 Q100 124 108 116" fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        </g>
      );
  }
}

function OutfitLayer({ look }: { look: AlienLook }) {
  const c = look.outfitColor;
  const base = "M50 162 Q100 148 150 162 L156 194 Q100 206 44 194 Z";
  switch (look.outfit) {
    case "hoodie":
      return (
        <g>
          <path d={base} fill={c} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
          <path d="M88 158 L86 178 M112 158 L114 178" stroke={INK} strokeWidth={4} strokeLinecap="round" />
          <path d="M76 182 Q100 176 124 182 L122 196 Q100 200 78 196 Z" fill="none" stroke={INK} strokeWidth={4} />
        </g>
      );
    case "jacket":
      return (
        <g>
          <path d={base} fill={c} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
          <path d="M100 152 L100 200" stroke={INK} strokeWidth={4} />
          <path d="M70 157 L88 176 L96 153 Z M130 157 L112 176 L104 153 Z" fill="#F5F2EA" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        </g>
      );
    case "vest":
      return (
        <g>
          <path d="M50 162 Q70 154 82 154 L100 182 L118 154 Q130 154 150 162 L156 194 Q100 206 44 194 Z" fill={c} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
          <circle cx="70" cy="180" r="4" fill="#F5F2EA" stroke={INK} strokeWidth={2} />
          <circle cx="130" cy="180" r="4" fill="#F5F2EA" stroke={INK} strokeWidth={2} />
        </g>
      );
    case "kimono":
      return (
        <g>
          <path d={base} fill={c} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
          <path d="M70 156 L118 196 M130 156 L104 178" stroke={INK} strokeWidth={4} />
          <path d="M48 178 Q100 168 154 178 L155 188 Q100 178 46 188 Z" fill={look.accent} stroke={INK} strokeWidth={4} />
        </g>
      );
    default:
      return null;
  }
}

function AccessoryLayer({ look }: { look: AlienLook }) {
  const a = ANCHORS[look.species];
  const acc = look.accent;
  switch (look.accessory) {
    case "headphones":
      return (
        <g>
          <path d={`M${a.left + 4} ${a.cy - 8} C${a.left - 4} ${a.top - 36} ${a.right + 4} ${a.top - 36} ${a.right - 4} ${a.cy - 8}`} fill="none" stroke={INK} strokeWidth={14} strokeLinecap="round" />
          <path d={`M${a.left + 4} ${a.cy - 8} C${a.left - 4} ${a.top - 36} ${a.right + 4} ${a.top - 36} ${a.right - 4} ${a.cy - 8}`} fill="none" stroke={acc} strokeWidth={6} strokeLinecap="round" />
          <rect x={a.left - 14} y={a.cy - 30} width="26" height="44" rx="11" fill={acc} stroke={INK} strokeWidth={SW} />
          <rect x={a.right - 12} y={a.cy - 30} width="26" height="44" rx="11" fill={acc} stroke={INK} strokeWidth={SW} />
        </g>
      );
    case "shades": {
      const w = a.shadesW;
      const x = 100 - w / 2;
      const y = a.eyeY - 14;
      return (
        <g>
          <path d={`M${x} ${y} L${x + w} ${y} L${x + w - 6} ${y + 24} Q${x + w * 0.75} ${y + 32} ${100 + 4} ${y + 18} L${100 - 4} ${y + 18} Q${x + w * 0.25} ${y + 32} ${x + 6} ${y + 24} Z`} fill={INK} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
          <path d={`M${x + 10} ${y + 6} L${x + w * 0.3} ${y + 6}`} stroke={acc} strokeWidth={4} strokeLinecap="round" />
          <path d={`M${100 + 12} ${y + 6} L${100 + w * 0.28} ${y + 6}`} stroke={acc} strokeWidth={4} strokeLinecap="round" />
        </g>
      );
    }
    case "crown":
      return (
        <path
          d={`M70 ${a.top + 6} L66 ${a.top - 26} L84 ${a.top - 10} L100 ${a.top - 34} L116 ${a.top - 10} L134 ${a.top - 26} L130 ${a.top + 6} Z`}
          fill="#FFAD5B"
          stroke={INK}
          strokeWidth={SW}
          strokeLinejoin="round"
        />
      );
    case "antenna":
      return (
        <g>
          <path d={`M84 ${a.top + 8} Q74 ${a.top - 20} 70 ${a.top - 34} M116 ${a.top + 8} Q126 ${a.top - 20} 130 ${a.top - 34}`} stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />
          <circle cx="70" cy={a.top - 38} r="10" fill={acc} stroke={INK} strokeWidth={5} />
          <circle cx="130" cy={a.top - 38} r="10" fill={acc} stroke={INK} strokeWidth={5} />
        </g>
      );
    case "cap":
      return (
        <g>
          <path d={`M60 ${a.top + 14} C60 ${a.top - 30} 140 ${a.top - 30} 140 ${a.top + 14} Z`} fill={acc} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
          <path d={`M126 ${a.top + 12} Q160 ${a.top + 6} 176 ${a.top + 18} Q150 ${a.top + 24} 126 ${a.top + 20} Z`} fill={acc} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <circle cx="100" cy={a.top - 18} r="5" fill={INK} />
        </g>
      );
    default:
      return null;
  }
}

/** Alien shapes without the outer <svg>, for composing into larger scenes (viewBox 0 -10 200 220). */
export function AlienG({ look }: { look: AlienLook }) {
  return (
    <g>
      <Body look={look} />
      <OutfitLayer look={look} />
      <AccessoryLayer look={look} />
    </g>
  );
}

export function Alien({
  look,
  className,
  title,
  bob = false,
}: {
  look: AlienLook;
  className?: string;
  title?: string;
  bob?: boolean;
}) {
  return (
    <svg
      viewBox="0 -10 200 220"
      className={cn(className, bob && "animate-bob alien-live")}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <ellipse cx="100" cy="204" rx="58" ry="7" fill="#000" opacity="0.35" />
      <Body look={look} />
      <OutfitLayer look={look} />
      <AccessoryLayer look={look} />
    </svg>
  );
}

/** The four starter characters for the Avatar page. */
export const STARTERS: { id: string; name: string; look: AlienLook; blurb: string }[] = [
  { id: "slime-beat", name: "SLIME BEAT", look: { species: "slime", body: "#B6F05C", accent: "#FF625C", outfit: "none", outfitColor: "#A276E9", accessory: "headphones" }, blurb: "Sticky grooves. Leaves a trail on every dancefloor." },
  { id: "cosmic-fuzz", name: "COSMIC FUZZ", look: { species: "fuzz", body: "#A276E9", accent: "#FFAD5B", outfit: "none", outfitColor: "#55BCEB", accessory: "antenna" }, blurb: "Three eyes, zero chill. Static electricity on contact." },
  { id: "vinyl-mutant", name: "VINYL MUTANT", look: { species: "vinyl", body: "#FFAD5B", accent: "#55BCEB", outfit: "jacket", outfitColor: "#FF625C", accessory: "none" }, blurb: "A 12-inch head full of rare grooves. Spins when happy." },
  { id: "jelly-raver", name: "JELLY RAVER", look: { species: "jelly", body: "#55BCEB", accent: "#B6F05C", outfit: "none", outfitColor: "#FFAD5B", accessory: "shades" }, blurb: "Wobbles at 128 BPM. Glows brighter as the night goes on." },
];
