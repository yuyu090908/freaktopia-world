"use client";

/**
 * Interactive isometric festival map (SVG, no game engine).
 * Everything is placed in tile coordinates (lib/live/zones.ts) and projected with iso(),
 * so hit areas and avatars stay resolution independent. Pan: drag. Zoom: wheel / pinch / buttons.
 * The player's avatar walks between zones along a path through the central plaza.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Maximize2, Minus, Plus } from "lucide-react";
import { AlienG } from "@/components/art/Alien";
import type { AlienLook } from "@/lib/types";
import type { RoomAvatar } from "@/lib/live/client";
import { REACTION_META } from "@/lib/live/energy";
import type { DanceMove, Emote, ReactionKind, ZoneId } from "@/lib/live/types";
import { MAP_BOUNDS, ZONES, iso, pathLength, pointAt, spotIn, walkPath, zoneById, type ZoneDef } from "@/lib/live/zones";

export interface MapFloat {
  id: string;
  kind: ReactionKind;
  zone: ZoneId;
}

export interface MeOnMap {
  look: AlienLook;
  name: string;
  zone: ZoneId;
  visibility: "public" | "friends" | "hidden";
  dance: DanceMove;
  emote: Emote;
}

const EMOTE: Record<Exclude<Emote, "none">, string> = { wave: "👋", heart: "💚", fire: "🔥", alien: "👽" };
const ELEV = 6; // ground plate thickness (px)

const hashN = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/* ---------------- geometry helpers ---------------- */

const pt = (gx: number, gy: number, up = 0) => {
  const p = iso(gx, gy);
  return `${p.x},${p.y - up}`;
};

/** Box from (gx,gy) size (w,h) tiles, lifted `base` px, `height` px tall. Returns top + two visible sides. */
function box(gx: number, gy: number, w: number, h: number, height: number, base = 0) {
  const t = base + height;
  return {
    top: [pt(gx, gy, t), pt(gx + w, gy, t), pt(gx + w, gy + h, t), pt(gx, gy + h, t)].join(" "),
    left: [pt(gx, gy + h, base), pt(gx + w, gy + h, base), pt(gx + w, gy + h, t), pt(gx, gy + h, t)].join(" "),
    right: [pt(gx + w, gy, base), pt(gx + w, gy + h, base), pt(gx + w, gy + h, t), pt(gx + w, gy, t)].join(" "),
  };
}

function Box({ gx, gy, w, h, height, base = 0, color, stroke = "#080808" }: { gx: number; gy: number; w: number; h: number; height: number; base?: number; color: string; stroke?: string }) {
  const b = box(gx, gy, w, h, height, base);
  return (
    <g stroke={stroke} strokeWidth={1.5} strokeLinejoin="round">
      <polygon points={b.left} fill={color} />
      <polygon points={b.left} fill="#000" fillOpacity={0.4} stroke="none" />
      <polygon points={b.right} fill={color} />
      <polygon points={b.right} fill="#000" fillOpacity={0.2} stroke="none" />
      <polygon points={b.top} fill={color} />
    </g>
  );
}

/* ---------------- static layers ---------------- */

function Ground({ z, active, count }: { z: ZoneDef; active: boolean; count: number }) {
  const b = box(z.gx, z.gy, z.w, z.h, ELEV);
  const c = iso(z.gx + z.w / 2, z.gy + z.h / 2);
  return (
    <g>
      <polygon points={b.left} fill={z.color} opacity={0.35} />
      <polygon points={b.right} fill={z.color} opacity={0.5} />
      <polygon points={b.top} fill={z.color} fillOpacity={active ? 0.32 : 0.16} stroke={z.color} strokeWidth={active ? 3.5 : 2} />
      <g transform={`translate(${c.x} ${c.y + 24})`} pointerEvents="none">
        <rect x={-z.short.length * 6.2 - 12 - (count ? 16 : 0)} y={-12} width={z.short.length * 12.4 + 24 + (count ? 32 : 0)} height={24} rx={12} fill="#080808" fillOpacity={0.82} stroke={z.color} strokeWidth={1.5} />
        <text x={count ? -16 : 0} y={5} textAnchor="middle" fontFamily="var(--font-display), sans-serif" fontSize={14} fill={z.color}>{z.short}</text>
        {count > 0 && (
          <text x={z.short.length * 6.2 + 4} y={5} textAnchor="middle" fontSize={12} fontWeight={800} fill="#F5F2EA">{count}</text>
        )}
      </g>
    </g>
  );
}

function Props({ z, beam, invasion }: { z: ZoneDef; beam: string; invasion: boolean }) {
  switch (z.id) {
    case "main":
    case "second": {
      const top = iso(z.gx + z.w / 2, z.gy + 0.5);
      return (
        <g>
          <Box gx={z.gx + 0.5} gy={z.gy} w={z.w - 1} h={1.1} height={z.height} base={ELEV} color="#262626" />
          {/* LED wall on the front face */}
          <polygon points={[pt(z.gx + 1, z.gy + 1.1, ELEV + 10), pt(z.gx + z.w - 1, z.gy + 1.1, ELEV + 10), pt(z.gx + z.w - 1, z.gy + 1.1, ELEV + z.height - 6), pt(z.gx + 1, z.gy + 1.1, ELEV + z.height - 6)].join(" ")} fill={z.color} opacity={0.75} />
          {/* booth */}
          <Box gx={z.gx + z.w / 2 - 0.8} gy={z.gy + 1.3} w={1.6} h={0.6} height={14} base={ELEV} color="#FFAD5B" />
          {/* speakers */}
          <Box gx={z.gx + 0.2} gy={z.gy + 1.2} w={0.6} h={0.6} height={30} base={ELEV} color="#171717" />
          <Box gx={z.gx + z.w - 0.8} gy={z.gy + 1.2} w={0.6} h={0.6} height={30} base={ELEV} color="#171717" />
          {/* beams */}
          <g className="fm-beam" pointerEvents="none">
            {[-2, -1, 1, 2].map((k) => {
              const end = iso(z.gx + z.w / 2 + k * 1.4, z.gy + z.h - 0.2);
              return <line key={k} x1={top.x} y1={top.y - ELEV - z.height} x2={end.x} y2={end.y} stroke={beam} strokeWidth={invasion ? 5 : 3} strokeLinecap="round" opacity={0.5} />;
            })}
          </g>
        </g>
      );
    }
    case "dancefloor": {
      const tiles: { x: number; y: number }[] = [];
      for (let x = 0; x < z.w; x++) for (let y = 0; y < z.h; y++) tiles.push({ x, y });
      return (
        <g pointerEvents="none">
          {tiles.map((t, i) => (
            <polygon
              key={i}
              className={(t.x + t.y) % 2 ? "fm-floor" : undefined}
              style={{ animationDelay: `${(i % 5) * -0.2}s` }}
              points={[pt(z.gx + t.x + 0.1, z.gy + t.y + 0.1, ELEV), pt(z.gx + t.x + 0.9, z.gy + t.y + 0.1, ELEV), pt(z.gx + t.x + 0.9, z.gy + t.y + 0.9, ELEV), pt(z.gx + t.x + 0.1, z.gy + t.y + 0.9, ELEV)].join(" ")}
              fill={(t.x + t.y) % 2 ? beam : "#B6F05C"}
              opacity={0.45}
            />
          ))}
        </g>
      );
    }
    case "vip":
      return (
        <g>
          <Box gx={z.gx + 0.3} gy={z.gy} w={z.w - 0.6} h={1.2} height={z.height} base={ELEV} color="#3a2a14" />
          <polyline points={[pt(z.gx + 0.3, z.gy + 1.2, ELEV + z.height + 10), pt(z.gx + z.w - 0.3, z.gy + 1.2, ELEV + z.height + 10)].join(" ")} stroke={z.color} strokeWidth={3} fill="none" />
        </g>
      );
    case "lounge":
      return (
        <g>
          <Box gx={z.gx + 0.4} gy={z.gy + 0.3} w={1.4} h={0.7} height={10} base={ELEV} color="#55BCEB" />
          <Box gx={z.gx + 2.2} gy={z.gy + 0.3} w={1.4} h={0.7} height={10} base={ELEV} color="#A276E9" />
          <Box gx={z.gx + 1.6} gy={z.gy + 1.6} w={0.8} h={0.8} height={6} base={ELEV} color="#F5F2EA" />
        </g>
      );
    case "bar":
      return <Box gx={z.gx + 0.2} gy={z.gy + 0.2} w={0.7} h={z.h - 0.4} height={z.height} base={ELEV} color="#FFAD5B" />;
    case "food":
      return (
        <g>
          <Box gx={z.gx + 0.2} gy={z.gy + 0.2} w={1.1} h={0.9} height={z.height} base={ELEV} color="#FF625C" />
          <Box gx={z.gx + 1.7} gy={z.gy + 0.2} w={1.1} h={0.9} height={z.height} base={ELEV} color="#B6F05C" />
        </g>
      );
    case "community":
      return <Box gx={z.gx + 1} gy={z.gy + 0.2} w={1} h={0.5} height={z.height + 14} base={ELEV} color="#A276E9" />;
    case "entrance":
      return (
        <g>
          <Box gx={z.gx + 0.2} gy={z.gy + 0.6} w={0.5} h={0.5} height={z.height} base={ELEV} color="#F5F2EA" />
          <Box gx={z.gx + z.w - 0.7} gy={z.gy + 0.6} w={0.5} h={0.5} height={z.height} base={ELEV} color="#F5F2EA" />
          <Box gx={z.gx + 0.2} gy={z.gy + 0.6} w={z.w - 0.4} h={0.5} height={8} base={ELEV + z.height} color="#FF625C" />
        </g>
      );
    case "portal": {
      const c = iso(z.gx + z.w / 2, z.gy + z.h / 2);
      return (
        <g pointerEvents="none">
          <ellipse cx={c.x} cy={c.y - ELEV} rx={70} ry={30} fill="#A276E9" fillOpacity={0.25} stroke="#A276E9" strokeWidth={4} strokeDasharray="14 8" className="fm-portal" />
          <ellipse cx={c.x} cy={c.y - ELEV} rx={40} ry={16} fill="#080808" stroke="#B6F05C" strokeWidth={2} />
        </g>
      );
    }
    default:
      return null;
  }
}

/* ---------------- avatars ---------------- */

const Sprite = memo(function Sprite({ look, dance, moving, emote, friend, scale = 0.17 }: { look: AlienLook; dance: DanceMove | null; moving?: boolean; emote?: Emote; friend?: boolean; scale?: number }) {
  const cls = moving ? "fm-walk" : dance === "bounce" ? "fm-bounce" : dance === "wiggle" ? "fm-wiggle" : dance === "spin" ? "fm-spin" : "fm-idle";
  const w = 200 * scale;
  const h = 220 * scale;
  return (
    <g>
      <ellipse cx={0} cy={0} rx={w * 0.32} ry={w * 0.12} fill="#000" opacity={0.4} />
      <g className={`fm-dance ${cls}`}>
        <g transform={`translate(${-w / 2} ${-h + 4}) scale(${scale})`}>
          <AlienG look={look} />
        </g>
      </g>
      {friend && <circle cx={w * 0.38} cy={-h + 8} r={5} fill="#55BCEB" stroke="#080808" strokeWidth={1.5} />}
      {emote && emote !== "none" && (
        <text x={0} y={-h - 4} textAnchor="middle" fontSize={16}>{EMOTE[emote]}</text>
      )}
    </g>
  );
});

function Crowd({ avatars, maxShown }: { avatars: RoomAvatar[]; maxShown: number }) {
  const placed = useMemo(() => {
    const byZone = new Map<ZoneId, RoomAvatar[]>();
    for (const a of avatars.slice(0, maxShown)) byZone.set(a.zone, [...(byZone.get(a.zone) ?? []), a]);
    const out: { a: RoomAvatar; x: number; y: number }[] = [];
    byZone.forEach((list, zid) => {
      const z = zoneById(zid);
      list.forEach((a, i) => {
        const s = spotIn({ ...z, gy: z.gy + (z.id === "main" || z.id === "second" || z.id === "vip" ? 1.4 : 0), h: z.h - (z.id === "main" || z.id === "second" || z.id === "vip" ? 1.4 : 0) }, i, hashN(a.id) % 97);
        const p = iso(s.gx, s.gy);
        out.push({ a, x: p.x, y: p.y - ELEV });
      });
    });
    return out.sort((p, q) => p.y - q.y);
  }, [avatars, maxShown]);
  return (
    <g pointerEvents="none">
      {placed.map(({ a, x, y }) => (
        <g key={a.id} transform={`translate(${x} ${y})`}>
          <Sprite look={a.look} dance={zoneById(a.zone).dance ? a.dance : null} emote={a.emote} friend={a.friend} />
        </g>
      ))}
    </g>
  );
}

/** The player's avatar. Walks with requestAnimationFrame and writes the transform directly (no React re-render per frame). */
function MyAvatar({ me, reduceMotion }: { me: MeOnMap; reduceMotion: boolean }) {
  const ref = useRef<SVGGElement>(null);
  const pos = useRef<{ gx: number; gy: number } | null>(null);
  const [moving, setMoving] = useState(false);
  const target = useMemo(() => {
    const z = zoneById(me.zone);
    const s = spotIn(z, 0, 991);
    return { gx: z.gx + z.w / 2 + (s.gx - (z.gx + z.w / 2)) * 0.35, gy: z.gy + z.h / 2 + 0.4 + (s.gy - (z.gy + z.h / 2)) * 0.35 };
  }, [me.zone]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = (p: { gx: number; gy: number }) => {
      const q = iso(p.gx, p.gy);
      el.setAttribute("transform", `translate(${q.x} ${q.y - ELEV})`);
    };
    const from = pos.current;
    if (!from || reduceMotion) {
      pos.current = target;
      place(target);
      return;
    }
    const fromZone = ZONES.find((z) => from.gx >= z.gx && from.gx <= z.gx + z.w && from.gy >= z.gy && from.gy <= z.gy + z.h) ?? zoneById("entrance");
    const path = [from, ...walkPath(fromZone, zoneById(me.zone)).slice(1, -1), target];
    const dur = Math.max(700, Math.min(2600, (pathLength(path) / 6) * 1000));
    const t0 = performance.now();
    let raf = 0;
    setMoving(true);
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const p = pointAt(path, e);
      pos.current = p;
      place(p);
      if (k < 1) raf = requestAnimationFrame(step);
      else setMoving(false);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, me.zone, reduceMotion]);

  const z = zoneById(me.zone);
  return (
    <g ref={ref} pointerEvents="none" data-testid="my-avatar" data-zone={me.zone}>
      <ellipse cx={0} cy={0} rx={24} ry={10} fill="none" stroke="#B6F05C" strokeWidth={2.5} opacity={me.visibility === "hidden" ? 0.4 : 1} />
      <g opacity={me.visibility === "hidden" ? 0.55 : 1}>
        <Sprite look={me.look} dance={z.dance ? me.dance : null} moving={moving} emote={me.emote} scale={0.22} />
      </g>
      <g transform="translate(0 -62)">
        <rect x={-34} y={-11} width={68} height={18} rx={9} fill="#B6F05C" stroke="#080808" strokeWidth={2} />
        <text x={0} y={2.5} textAnchor="middle" fontSize={10} fontWeight={900} fill="#080808">{me.visibility === "hidden" ? "YOU · HIDDEN" : "YOU"}</text>
      </g>
    </g>
  );
}

/* ---------------- map ---------------- */

export function FestivalMap({
  me,
  avatars,
  zoneCounts,
  floats,
  selectedZone,
  onZoneTap,
  beam,
  invasion,
  paused,
}: {
  me: MeOnMap | null;
  avatars: RoomAvatar[];
  zoneCounts: Partial<Record<ZoneId, number>>;
  floats: MapFloat[];
  selectedZone: ZoneId | null;
  onZoneTap: (z: ZoneId) => void;
  beam: string;
  invasion: boolean;
  paused?: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 375, h: 440 });
  const [reduceMotion, setReduce] = useState(false);
  const [vb, setVb] = useState<{ cx: number; cy: number; zoom: number } | null>(null);
  const drag = useRef<{ pointers: Map<number, { x: number; y: number }>; start: { x: number; y: number } | null; moved: boolean; pinch: number | null }>({ pointers: new Map(), start: null, moved: false, pinch: null });

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(m.matches);
    const on = () => setReduce(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Fit = whole map visible; on phones start zoomed in around the player's zone. */
  const fitZoom = useMemo(() => Math.min(size.w / MAP_BOUNDS.w, size.h / MAP_BOUNDS.h), [size]);
  const home = useCallback(
    (zone?: ZoneId) => {
      const narrow = size.w < 640;
      const z = zoneById(zone ?? me?.zone ?? "dancefloor");
      const c = iso(z.gx + z.w / 2, z.gy + z.h / 2);
      return narrow ? { cx: c.x, cy: c.y, zoom: Math.max(fitZoom * 2.3, 0.62) } : { cx: MAP_BOUNDS.x + MAP_BOUNDS.w / 2, cy: MAP_BOUNDS.y + MAP_BOUNDS.h / 2, zoom: fitZoom };
    },
    [size.w, fitZoom, me?.zone],
  );
  const view = vb ?? home();
  const clampZoom = (z: number) => Math.max(fitZoom * 0.9, Math.min(2.2, z));
  const vw = size.w / view.zoom;
  const vh = size.h / view.zoom;
  const viewBox = `${view.cx - vw / 2} ${view.cy - vh / 2} ${vw} ${vh}`;

  const zoomBy = useCallback(
    (f: number, at?: { x: number; y: number }) => {
      setVb((cur) => {
        const v = cur ?? home();
        const nz = clampZoom(v.zoom * f);
        if (!at) return { ...v, zoom: nz };
        // keep the point under the cursor fixed
        const wx = v.cx + (at.x - size.w / 2) / v.zoom;
        const wy = v.cy + (at.y - size.h / 2) / v.zoom;
        return { zoom: nz, cx: wx - (at.x - size.w / 2) / nz, cy: wy - (at.y - size.h / 2) / nz };
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [home, size, fitZoom],
  );

  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, { x: e.clientX - r.left, y: e.clientY - r.top });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  const onDown = (e: React.PointerEvent) => {
    const d = drag.current;
    d.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (d.pointers.size === 1) {
      d.start = { x: e.clientX, y: e.clientY };
      d.moved = false;
    }
    if (d.pointers.size === 2) {
      const [a, b] = [...d.pointers.values()];
      d.pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const prev = d.pointers.get(e.pointerId);
    if (!prev) return;
    d.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (d.pointers.size === 2 && d.pinch) {
      const [a, b] = [...d.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const r = svg.current!.getBoundingClientRect();
      zoomBy(dist / d.pinch, { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top });
      d.pinch = dist;
      d.moved = true;
      return;
    }
    if (d.start && Math.hypot(e.clientX - d.start.x, e.clientY - d.start.y) > 6) {
      if (!d.moved) (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      d.moved = true;
    }
    if (d.moved) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      setVb((cur) => {
        const v = cur ?? home();
        return { ...v, cx: Math.max(MAP_BOUNDS.x, Math.min(MAP_BOUNDS.x + MAP_BOUNDS.w, v.cx - dx / v.zoom)), cy: Math.max(MAP_BOUNDS.y, Math.min(MAP_BOUNDS.y + MAP_BOUNDS.h, v.cy - dy / v.zoom)) };
      });
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    d.pointers.delete(e.pointerId);
    if (d.pointers.size < 2) d.pinch = null;
  };
  const tapZone = (id: ZoneId) => {
    if (drag.current.moved) return;
    onZoneTap(id);
  };

  const ordered = useMemo(() => [...ZONES].sort((a, b) => a.gx + a.gy - (b.gx + b.gy)), []);
  const maxShown = size.w < 640 ? 36 : 60;

  return (
    <div ref={wrap} className={`relative h-full w-full overflow-hidden bg-[#110f18] ${paused ? "paused" : ""}`} data-testid="festival-map">
      <svg ref={svg} viewBox={viewBox} className="fm-svg block h-full w-full" role="group" aria-label="Isometric festival map. Drag to pan, pinch or use the buttons to zoom. Each zone is a button." onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp}>
        <defs>
          <pattern id="fm-dots" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.4" fill="#2b2838" />
          </pattern>
        </defs>
        <rect x={MAP_BOUNDS.x - 400} y={MAP_BOUNDS.y - 400} width={MAP_BOUNDS.w + 800} height={MAP_BOUNDS.h + 800} fill="url(#fm-dots)" />
        {/* ground grid */}
        <polygon points={[pt(-0.5, -0.5), pt(15, -0.5), pt(15, 15), pt(-0.5, 15)].join(" ")} fill="#171520" stroke="#2b2838" strokeWidth={2} />
        {/* plaza path */}
        <g stroke="#F5F2EA" strokeOpacity={0.14} strokeWidth={14} strokeLinecap="round" fill="none" pointerEvents="none">
          {ZONES.map((z) => {
            const a = iso(z.gx + z.w / 2, z.gy + z.h / 2);
            const p = iso(7.5, 8.5);
            return <line key={z.id} x1={a.x} y1={a.y} x2={p.x} y2={p.y} strokeDasharray="2 18" />;
          })}
        </g>
        {invasion && <rect className="fm-invasion" x={MAP_BOUNDS.x - 400} y={MAP_BOUNDS.y - 400} width={MAP_BOUNDS.w + 800} height={MAP_BOUNDS.h + 800} fill="#A276E9" pointerEvents="none" />}

        {ordered.map((z) => (
          <g
            key={z.id}
            role="button"
            tabIndex={0}
            aria-label={`${z.name}${zoneCounts[z.id] ? `, ${zoneCounts[z.id]} public avatars` : ""}${me?.zone === z.id ? ", you are here" : ""}`}
            data-zone={z.id}
            className="cursor-pointer outline-none [&:focus-visible>g>polygon:last-of-type]:stroke-[5]"
            onClick={() => tapZone(z.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onZoneTap(z.id);
              }
            }}
          >
            <Ground z={z} active={selectedZone === z.id || me?.zone === z.id} count={zoneCounts[z.id] ?? 0} />
            <Props z={z} beam={beam} invasion={invasion} />
          </g>
        ))}

        <Crowd avatars={avatars} maxShown={maxShown} />
        {me && <MyAvatar me={me} reduceMotion={reduceMotion} />}

        {/* reaction floats (capped by the parent) */}
        <g pointerEvents="none">
          {floats.map((f, i) => {
            const z = zoneById(f.zone);
            const c = iso(z.gx + z.w / 2 + ((i % 5) - 2) * 0.5, z.gy + z.h / 2);
            return (
              <text key={f.id} x={c.x} y={c.y - 30} textAnchor="middle" fontSize={26} className="fm-float" style={{ transformBox: "fill-box" }}>
                {REACTION_META[f.kind].emoji}
              </text>
            );
          })}
        </g>
      </svg>

      <div className="absolute right-2 top-2 flex flex-col gap-1.5">
        <button type="button" onClick={() => zoomBy(1.25)} aria-label="Zoom in" className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-ink/85 text-cream"><Plus className="size-5" /></button>
        <button type="button" onClick={() => zoomBy(1 / 1.25)} aria-label="Zoom out" className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-ink/85 text-cream"><Minus className="size-5" /></button>
        <button type="button" onClick={() => setVb({ cx: MAP_BOUNDS.x + MAP_BOUNDS.w / 2, cy: MAP_BOUNDS.y + MAP_BOUNDS.h / 2, zoom: fitZoom })} aria-label="Show whole map" className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-ink/85 text-cream"><Maximize2 className="size-5" /></button>
        {me && (
          <button type="button" onClick={() => setVb(home(me.zone))} aria-label="Center on my avatar" className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-ink/85 text-cream"><Crosshair className="size-5" /></button>
        )}
      </div>
    </div>
  );
}
