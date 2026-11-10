import type { AlienLook, Species } from "@/lib/types";
import { useId } from "react";
import { cn } from "@/lib/utils";

/** A url(#id)-safe unique id for the pattern clip path. */
function useClipId() {
  return "fkc" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
}

/**
 * Original FREAKTOPIA alien characters, drawn as inline SVG in a
 * consistent "thick black outline + flat colour + halftone" style.
 * Five species (slime, fuzz, mutant, jelly + the legacy vinyl head) × eyes × mouths × patterns ×
 * outfits × accessories × specials × colours → every avatar, DJ and identity alien.
 */

const INK = "#080808";
const SW = 6;

const ANCHORS: Record<Species, { top: number; eyeY: number; left: number; right: number; cy: number; shadesW: number }> = {
  slime: { top: 50, eyeY: 100, left: 40, right: 160, cy: 105, shadesW: 100 },
  fuzz: { top: 52, eyeY: 98, left: 42, right: 158, cy: 112, shadesW: 100 },
  vinyl: { top: 35, eyeY: 92, left: 40, right: 160, cy: 95, shadesW: 56 },
  jelly: { top: 64, eyeY: 100, left: 42, right: 158, cy: 100, shadesW: 92 },
  mutant: { top: 54, eyeY: 98, left: 44, right: 160, cy: 108, shadesW: 100 },
};

/** Where a variant face goes on each body: centre x, eye line, eye gap/radius, mouth line/width, scale. */
const FACE: Record<Species, { cx: number; eyeY: number; gap: number; r: number; mouthY: number; mw: number; s: number }> = {
  slime: { cx: 100, eyeY: 98, gap: 23, r: 16, mouthY: 138, mw: 22, s: 1 },
  fuzz: { cx: 100, eyeY: 100, gap: 22, r: 15, mouthY: 138, mw: 25, s: 1 },
  vinyl: { cx: 100, eyeY: 90, gap: 11, r: 8, mouthY: 107, mw: 10, s: 0.5 },
  jelly: { cx: 100, eyeY: 96, gap: 21, r: 13, mouthY: 116, mw: 12, s: 0.75 },
  mutant: { cx: 104, eyeY: 98, gap: 23, r: 16, mouthY: 140, mw: 24, s: 1 },
};

const SLIME_D = "M38 168 C30 120 42 58 100 50 C158 58 170 120 162 168 C160 182 148 186 144 174 C138 190 120 192 116 178 C108 194 88 194 84 178 C78 192 60 190 56 174 C50 186 38 182 38 168 Z";
const JELLY_D = "M38 124 C34 60 166 60 162 124 C152 134 142 120 131 130 C120 140 110 124 100 132 C90 140 80 124 69 132 C58 140 48 124 38 124 Z";
const MUTANT_D = "M46 178 C34 142 38 96 60 72 C72 58 86 64 96 52 C112 40 142 50 152 74 C168 104 170 146 158 178 C152 194 52 194 46 178 Z";

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
const FUZZ_D = fuzzPath(100, 114, 68, 54, 22);

/** The silhouette a pattern is clipped to. */
function shapeOf(species: Species): { d?: string; circle?: [number, number, number] } {
  switch (species) {
    case "slime": return { d: SLIME_D };
    case "fuzz": return { d: FUZZ_D };
    case "jelly": return { d: JELLY_D };
    case "mutant": return { d: MUTANT_D };
    default: return { circle: [100, 95, 29] };
  }
}

function star(cx: number, cy: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z`;
}

function Eyes({ look }: { look: AlienLook }) {
  const f = FACE[look.species];
  const { cx, eyeY: y, gap, r } = f;
  const top = ANCHORS[look.species].top;
  switch (look.eyes ?? "duo") {
    case "cyclops":
      return (
        <g>
          {[-1, -0.4, 0.4, 1].map((k) => (
            <path key={k} d={`M${cx + k * r * 1.2} ${y - r * 1.45} L${cx + k * r * 1.55} ${y - r * 2}`} stroke={INK} strokeWidth={4 * f.s} strokeLinecap="round" />
          ))}
          <Eye x={cx} y={y} r={r * 1.55} look={0.2} />
        </g>
      );
    case "trio":
      return (
        <g>
          <Eye x={cx - gap} y={y + 3 * f.s} r={r * 0.85} />
          <Eye x={cx + gap} y={y + 3 * f.s} r={r * 0.85} look={-0.3} />
          <Eye x={cx} y={y - r * 1.35} r={r * 0.7} />
        </g>
      );
    case "stalks": {
      const tip = (k: number) => ({ x: cx + k * gap * 1.25, y: top - 30 * f.s });
      return (
        <g>
          {[-1, 1].map((k) => (
            <g key={k}>
              <path d={`M${cx + k * gap * 0.55} ${top + 10 * f.s} Q${cx + k * gap * 0.7} ${top - 10 * f.s} ${tip(k).x} ${tip(k).y}`} stroke={INK} strokeWidth={9 * f.s} fill="none" strokeLinecap="round" />
              <path d={`M${cx + k * gap * 0.55} ${top + 10 * f.s} Q${cx + k * gap * 0.7} ${top - 10 * f.s} ${tip(k).x} ${tip(k).y}`} stroke={look.body} strokeWidth={4 * f.s} fill="none" strokeLinecap="round" />
              <Eye x={tip(k).x} y={tip(k).y} r={r * 0.9} look={k * 0.3} />
            </g>
          ))}
          <path d={`M${cx - gap * 0.6} ${y} q${gap * 0.3} ${-6 * f.s} ${gap * 0.6} 0 M${cx + gap * 0.0} ${y} q${gap * 0.3} ${-6 * f.s} ${gap * 0.6} 0`} stroke={INK} strokeWidth={3 * f.s} fill="none" strokeLinecap="round" opacity="0.5" />
        </g>
      );
    }
    case "sleepy":
      return (
        <g>
          {[-1, 1].map((k) => (
            <g key={k}>
              <Eye x={cx + k * gap} y={y} r={r} look={0} />
              <path d={`M${cx + k * gap - r - 2} ${y + 1} A${r + 2} ${r + 2} 0 0 1 ${cx + k * gap + r + 2} ${y + 1} Z`} fill={look.body} stroke={INK} strokeWidth={(SW - 1) * Math.max(f.s, 0.6)} strokeLinejoin="round" />
            </g>
          ))}
        </g>
      );
    case "star":
      return (
        <g>
          {[-1, 1].map((k) => (
            <g key={k}>
              <circle cx={cx + k * gap} cy={y} r={r} fill="#F5F2EA" stroke={INK} strokeWidth={(SW - 1) * Math.max(f.s, 0.6)} />
              <path d={star(cx + k * gap, y + 1, r * 0.62)} fill={k < 0 ? INK : look.accent} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
            </g>
          ))}
        </g>
      );
    case "duo":
    default:
      return (
        <g>
          <Eye x={cx - gap} y={y} r={r * 1.1} />
          <Eye x={cx + gap} y={y - 3 * f.s} r={r * 0.82} look={-0.2} />
        </g>
      );
  }
}

function Mouth({ look }: { look: AlienLook }) {
  const f = FACE[look.species];
  const { cx, mouthY: y, mw: w, s } = f;
  const sw = Math.max(SW * s, 3);
  switch (look.mouth ?? "grin") {
    case "fangs":
      return (
        <g>
          <path d={`M${cx - w} ${y - 4 * s} Q${cx} ${y + w * 0.9} ${cx + w} ${y - 4 * s} Z`} fill={INK} stroke={INK} strokeWidth={sw * 0.7} strokeLinejoin="round" />
          <path d={`M${cx - w * 0.62} ${y - 1 * s} l${5 * s} ${11 * s} l${5 * s} ${-11 * s} Z M${cx + w * 0.62} ${y - 1 * s} l${-5 * s} ${11 * s} l${-5 * s} ${-11 * s} Z`} fill="#F5F2EA" />
        </g>
      );
    case "tongue":
      return (
        <g>
          <path d={`M${cx - w} ${y - 3 * s} Q${cx} ${y + w * 0.7} ${cx + w} ${y - 3 * s} Z`} fill={INK} stroke={INK} strokeWidth={sw * 0.7} strokeLinejoin="round" />
          <path d={`M${cx - w * 0.2} ${y + 4 * s} q${w * 0.32} ${w * 1.1} ${w * 0.6} 0 Z`} fill="#FF7A9C" stroke={INK} strokeWidth={3 * s + 1} strokeLinejoin="round" />
        </g>
      );
    case "zigzag":
      return (
        <g>
          <path d={`M${cx - w} ${y - 6 * s} L${cx + w} ${y - 6 * s} Q${cx + w * 0.9} ${y + 16 * s} ${cx} ${y + 16 * s} Q${cx - w * 0.9} ${y + 16 * s} ${cx - w} ${y - 6 * s} Z`} fill={INK} stroke={INK} strokeWidth={sw * 0.6} strokeLinejoin="round" />
          <path d={Array.from({ length: 7 }, (_, i) => `${i ? "L" : "M"}${cx - w * 0.85 + (i * w * 1.7) / 6} ${y - 5 * s + (i % 2 ? 8 * s : 0)}`).join(" ") + ` L${cx + w * 0.85} ${y - 5 * s} Z`} fill="#F5F2EA" />
        </g>
      );
    case "o":
      return <ellipse cx={cx} cy={y + 4 * s} rx={w * 0.42} ry={w * 0.55} fill={INK} stroke={INK} strokeWidth={sw * 0.6} />;
    case "smirk":
      return <path d={`M${cx - w * 0.8} ${y + 2 * s} Q${cx - w * 0.1} ${y + 14 * s} ${cx + w * 0.8} ${y - 8 * s}`} fill="none" stroke={INK} strokeWidth={sw} strokeLinecap="round" />;
    case "grin":
    default:
      return (
        <g>
          <path d={`M${cx - w} ${y - 4 * s} Q${cx} ${y + w} ${cx + w} ${y - 4 * s}`} fill={INK} stroke={INK} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <path d={`M${cx - w * 0.4} ${y + 5 * s} Q${cx} ${y + w * 0.75} ${cx + w * 0.42} ${y + 5 * s}`} fill={look.accent} />
        </g>
      );
  }
}

function PatternLayer({ look, clipId }: { look: AlienLook; clipId: string }) {
  const p = look.pattern ?? "none";
  if (p === "none") return null;
  const shape = shapeOf(look.species);
  const c = look.accent;
  let marks: React.ReactNode = null;
  if (p === "spots") marks = [[56, 72, 9], [148, 98, 11], [62, 150, 8], [140, 160, 7], [120, 60, 6], [44, 110, 6], [96, 172, 6]].map(([x, y, r]) => <circle key={`${x}${y}`} cx={x} cy={y} r={r} fill={c} stroke={INK} strokeWidth={3} />);
  if (p === "stripes") marks = [40, 72, 104, 136, 168].map((y) => <path key={y} d={`M10 ${y} Q100 ${y - 14} 190 ${y}`} stroke={c} strokeWidth={9} fill="none" opacity="0.8" />);
  if (p === "stars") marks = [[54, 76, 9], [150, 84, 8], [58, 152, 8], [144, 156, 10], [120, 58, 6]].map(([x, y, r]) => <path key={`${x}${y}`} d={star(x, y, r)} fill={c} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />);
  if (p === "glitter") marks = [[50, 80], [150, 74], [60, 150], [146, 150], [118, 172], [80, 168], [40, 120], [160, 120]].map(([x, y], i) => <path key={i} d={`M${x} ${y - 6} L${x + 2} ${y - 2} L${x + 6} ${y} L${x + 2} ${y + 2} L${x} ${y + 6} L${x - 2} ${y + 2} L${x - 6} ${y} L${x - 2} ${y - 2} Z`} fill={i % 2 ? "#F5F2EA" : c} />);
  if (p === "swirl") marks = [[56, 152], [146, 86]].map(([x, y]) => <path key={x} d={`M${x} ${y} m-14 0 a14 14 0 1 1 28 0 a10 10 0 1 1 -20 0 a6 6 0 1 1 12 0`} fill="none" stroke={c} strokeWidth={5} strokeLinecap="round" opacity="0.85" />);
  return (
    <g>
      <clipPath id={clipId}>{shape.d ? <path d={shape.d} /> : <circle cx={shape.circle![0]} cy={shape.circle![1]} r={shape.circle![2]} />}</clipPath>
      <g clipPath={`url(#${clipId})`}>{marks}</g>
    </g>
  );
}

function SpecialBack({ look }: { look: AlienLook }) {
  if (look.special !== "glow") return null;
  return (
    <g aria-hidden>
      <circle cx="100" cy="112" r="96" fill={look.accent} opacity="0.14" />
      <circle cx="100" cy="112" r="82" fill={look.accent} opacity="0.16" />
    </g>
  );
}

function SpecialFront({ look }: { look: AlienLook }) {
  const f = FACE[look.species];
  const a = ANCHORS[look.species];
  switch (look.special) {
    case "blush":
      return (
        <g opacity="0.75">
          <ellipse cx={f.cx - f.gap - 8 * f.s} cy={f.eyeY + f.r + 10 * f.s} rx={9 * f.s} ry={5 * f.s} fill="#FF8FA3" />
          <ellipse cx={f.cx + f.gap + 8 * f.s} cy={f.eyeY + f.r + 10 * f.s} rx={9 * f.s} ry={5 * f.s} fill="#FF8FA3" />
        </g>
      );
    case "freckles":
      return (
        <g fill={INK} opacity="0.6">
          {[-1, 1].flatMap((k) => [0, 1, 2].map((i) => <circle key={`${k}${i}`} cx={f.cx + k * (f.gap + (4 + i * 6) * f.s)} cy={f.eyeY + f.r + (6 + (i % 2) * 5) * f.s} r={2.2 * f.s + 0.4} />))}
        </g>
      );
    case "bandage":
      return (
        <g transform={`rotate(-28 ${a.right - 26} ${a.top + 26})`}>
          <rect x={a.right - 46} y={a.top + 18} width="40" height="16" rx="6" fill="#F5F2EA" stroke={INK} strokeWidth={4} />
          <path d={`M${a.right - 30} ${a.top + 22} l8 8 M${a.right - 22} ${a.top + 22} l-8 8`} stroke={INK} strokeWidth={2.5} />
        </g>
      );
    case "drip":
      return <path d="M64 176 C60 190 58 200 66 202 C74 200 72 190 70 176 Z" fill={look.body} stroke={INK} strokeWidth={4} strokeLinejoin="round" />;
    default:
      return null;
  }
}

function Body({ look, clipId }: { look: AlienLook; clipId: string }) {
  const { species, body, accent } = look;
  const variant = Boolean(look.eyes || look.mouth);
  const face = variant ? (
    <>
      <Eyes look={look} />
      <Mouth look={look} />
    </>
  ) : null;
  const pattern = <PatternLayer look={look} clipId={clipId} />;
  switch (species) {
    case "slime":
      return (
        <g>
          <path d={SLIME_D} fill={body} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
          {pattern}
          <ellipse cx="66" cy="82" rx="9" ry="16" transform="rotate(30 66 82)" fill="#fff" opacity="0.55" />
          <circle cx="140" cy="140" r="6" fill={accent} stroke={INK} strokeWidth={3} />
          <circle cx="56" cy="134" r="4" fill={accent} stroke={INK} strokeWidth={3} />
          {face ?? (
            <>
              <Eye x={80} y={100} r={20} />
              <Eye x={125} y={94} r={13} look={-0.2} />
              <path d="M82 134 Q102 156 124 132" fill={INK} stroke={INK} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
              <path d="M95 142 Q104 152 113 141" fill={accent} />
            </>
          )}
        </g>
      );
    case "fuzz":
      return (
        <g>
          <path d={FUZZ_D} fill={body} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
          {pattern}
          <ellipse cx="80" cy="182" rx="14" ry="8" fill={accent} stroke={INK} strokeWidth={5} />
          <ellipse cx="122" cy="182" rx="14" ry="8" fill={accent} stroke={INK} strokeWidth={5} />
          {face ?? (
            <>
              <Eye x={78} y={100} r={14} />
              <Eye x={120} y={97} r={16} look={-0.3} />
              <Eye x={100} y={72} r={9} />
              <path d="M72 128 L128 128 Q124 152 100 152 Q76 152 72 128 Z" fill={INK} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
              <path d="M80 129 L86 138 L92 129 L98 138 L104 129 L110 138 L116 129 L122 138 L124 129 Z" fill="#F5F2EA" />
            </>
          )}
        </g>
      );
    case "mutant":
      // Lumpy, lopsided and stitched together: one stubby arm, one big claw.
      return (
        <g>
          <path d="M150 128 C172 120 186 132 182 150 C176 162 164 158 166 148 C160 156 150 150 154 142" fill={accent} stroke={INK} strokeWidth={SW} strokeLinejoin="round" strokeLinecap="round" />
          <path d="M48 134 C34 136 28 148 36 156" fill="none" stroke={INK} strokeWidth={13} strokeLinecap="round" />
          <path d="M48 134 C34 136 28 148 36 156" fill="none" stroke={body} strokeWidth={6} strokeLinecap="round" />
          <path d={MUTANT_D} fill={body} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
          {pattern}
          <path d="M62 64 C58 50 62 40 70 36 C72 46 74 54 76 60" fill={accent} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <path d="M138 58 C142 46 150 40 158 42 C154 50 152 58 150 66" fill={accent} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <path d="M58 164 Q100 172 146 162" fill="none" stroke={INK} strokeWidth={3} strokeDasharray="2 7" strokeLinecap="round" />
          {[72, 92, 112, 132].map((x) => <path key={x} d={`M${x} ${163 + (x === 92 || x === 112 ? 4 : 2)} l0 -9`} stroke={INK} strokeWidth={3} strokeLinecap="round" />)}
          <ellipse cx="72" cy="84" rx="7" ry="13" transform="rotate(28 72 84)" fill="#fff" opacity="0.45" />
          {face ?? (
            <>
              <Eye x={82} y={98} r={18} />
              <Eye x={128} y={92} r={12} look={-0.25} />
              <path d="M80 132 Q104 160 128 130 Z" fill={INK} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
              <path d="M88 134 l5 10 l5 -10 Z M118 133 l-5 10 l-5 -10 Z" fill="#F5F2EA" />
            </>
          )}
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
          {pattern}
          {face ?? (
            <>
              <Eye x={89} y={91} r={8} />
              <Eye x={112} y={91} r={8} look={-0.2} />
              <path d="M90 107 Q100 116 111 106" fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
              <circle cx="100" cy="100" r="2.5" fill={INK} />
            </>
          )}
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
          <path d={JELLY_D} fill={body} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
          {pattern}
          <ellipse cx="70" cy="78" rx="8" ry="13" transform="rotate(40 70 78)" fill="#fff" opacity="0.5" />
          <circle cx="132" cy="80" r="5" fill={accent} opacity="0.9" />
          <circle cx="146" cy="96" r="3.5" fill={accent} opacity="0.9" />
          {face ?? (
            <>
              <Eye x={80} y={100} r={13} />
              <Eye x={120} y={100} r={13} look={-0.3} />
              <path d="M92 116 Q100 124 108 116" fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
            </>
          )}
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
    case "dao_antenna":
      // Festival DAO cosmetic: one tall antenna with a purple ballot orb and an acid halo.
      return (
        <g>
          <path d={`M100 ${a.top + 6} L100 ${a.top - 40}`} stroke={INK} strokeWidth={6} strokeLinecap="round" />
          <ellipse cx="100" cy={a.top - 50} rx="22" ry="6" fill="none" stroke="#B6F05C" strokeWidth={4} />
          <circle cx="100" cy={a.top - 52} r="12" fill="#A276E9" stroke={INK} strokeWidth={5} />
          <path d={`M95 ${a.top - 52} L99 ${a.top - 47} L106 ${a.top - 57}`} stroke={INK} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case "horns":
      return (
        <g>
          <path d={`M74 ${a.top + 10} C60 ${a.top - 4} 56 ${a.top - 24} 62 ${a.top - 38} C70 ${a.top - 24} 80 ${a.top - 10} 88 ${a.top + 4} Z`} fill="#F5F2EA" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <path d={`M126 ${a.top + 10} C140 ${a.top - 4} 144 ${a.top - 24} 138 ${a.top - 38} C130 ${a.top - 24} 120 ${a.top - 10} 112 ${a.top + 4} Z`} fill="#F5F2EA" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        </g>
      );
    case "halo":
      return (
        <g>
          <ellipse cx="100" cy={a.top - 26} rx="34" ry="9" fill="none" stroke={INK} strokeWidth={11} />
          <ellipse cx="100" cy={a.top - 26} rx="34" ry="9" fill="none" stroke="#FFE27A" strokeWidth={5} />
        </g>
      );
    case "flower":
      return (
        <g>
          <path d={`M120 ${a.top + 6} Q124 ${a.top - 8} 126 ${a.top - 16}`} stroke={INK} strokeWidth={5} fill="none" strokeLinecap="round" />
          {[0, 72, 144, 216, 288].map((r) => (
            <ellipse key={r} cx="128" cy={a.top - 32} rx="7" ry="12" transform={`rotate(${r} 128 ${a.top - 22})`} fill={acc} stroke={INK} strokeWidth={4} />
          ))}
          <circle cx="128" cy={a.top - 22} r="7" fill="#FFE27A" stroke={INK} strokeWidth={4} />
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
  const clipId = useClipId();
  return (
    <g>
      <SpecialBack look={look} />
      <Body look={look} clipId={clipId} />
      <SpecialFront look={look} />
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
  const clipId = useClipId();
  return (
    <svg
      viewBox="0 -10 200 220"
      className={cn(className, bob && "animate-bob alien-live")}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <ellipse cx="100" cy="204" rx="58" ry="7" fill="#000" opacity="0.35" />
      <SpecialBack look={look} />
      <Body look={look} clipId={clipId} />
      <SpecialFront look={look} />
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
