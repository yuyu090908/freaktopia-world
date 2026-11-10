"use client";

import { Tx, useTx } from "@/components/i18n/Tx";
import { useTranslations } from "next-intl";
/**
 * Lightweight fallback without WebGL (or with ?renderer=lite): an equirectangular SVG of the real
 * Natural Earth coastlines with the same festival landmarks as plain buttons. No GPU needed.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { LEVEL_COLORS } from "@/lib/map/growth";
import { STATUS_META, landmarkSvg, orbSvg } from "@/lib/map/landmarks";
import { ariaFor, type WorldEvent } from "@/lib/map/view";

const W = 1000;
const H = 500;
const px = (lng: number) => ((lng + 180) / 360) * W;
const py = (lat: number) => ((90 - lat) / 180) * H;

type Geo = { features: { geometry: { type: string; coordinates: number[][][] | number[][][][] } }[] };

function toPath(g: Geo) {
  let d = "";
  for (const f of g.features) {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates as number[][][]] : (f.geometry.coordinates as number[][][][]);
    for (const poly of polys)
      for (const ring of poly) {
        d += ring.map(([x, y], i) => `${i ? "L" : "M"}${px(x).toFixed(1)} ${py(y).toFixed(1)}`).join("") + "Z";
      }
  }
  return d;
}

export function LiteWorldMap({ events, selectedId, onSelect, zoomRef }: { events: WorldEvent[]; selectedId: string | null; onSelect: (id: string | null) => void; zoomRef?: React.MutableRefObject<{ zoomIn: () => void; zoomOut: () => void; reset: () => void; flyToEvents: (ids: string[]) => void } | null> }) {
  const tu = useTranslations("world");
  const tx = useTx();
  const [land, setLand] = useState("");
  const [cam, setCam] = useState({ x: 0.5, y: 0.42, k: 1 });
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("/data/countries.geojson")
      .then((r) => r.json())
      .then((g: Geo) => alive && setLand(toPath(g)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!zoomRef) return;
    zoomRef.current = {
      zoomIn: () => setCam((c) => ({ ...c, k: Math.min(8, c.k * 1.6) })),
      zoomOut: () => setCam((c) => ({ ...c, k: Math.max(1, c.k / 1.6) })),
      reset: () => setCam({ x: 0.5, y: 0.42, k: 1 }),
      flyToEvents: (ids) => {
        const evs = events.filter((e) => ids.includes(e.id));
        if (!evs.length) return;
        const x = evs.reduce((a, e) => a + px(e.location.lng), 0) / evs.length / W;
        const y = evs.reduce((a, e) => a + py(e.location.lat), 0) / evs.length / H;
        setCam({ x, y, k: evs.length === 1 ? 5 : 3 });
      },
    };
  }, [zoomRef, events]);

  useEffect(() => {
    const e = events.find((x) => x.id === selectedId);
    if (e) setCam({ x: px(e.location.lng) / W, y: py(e.location.lat) / H, k: 4 });
  }, [selectedId, events]);

  const sorted = useMemo(() => [...events].sort((a, b) => b.location.lat - a.location.lat), [events]);
  const tier = cam.k >= 3 ? "mid" : "far";

  return (
    <div
      ref={box}
      className="wm-root absolute inset-0 isolate z-0 touch-none overflow-hidden bg-[#0A1727]"
      data-testid="world-map"
      data-renderer="lite"
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        const el = box.current;
        if (!d || !el || e.buttons === 0) return;
        const scale = Math.max(el.clientWidth, el.clientHeight * 2) * cam.k;
        setCam((c) => ({ ...c, x: d.cx - (e.clientX - d.x) / scale, y: d.cy - (e.clientY - d.y) / (scale / 2) }));
      }}
      onPointerUp={() => (drag.current = null)}
      onWheel={(e) => setCam((c) => ({ ...c, k: Math.max(1, Math.min(8, c.k * (e.deltaY < 0 ? 1.2 : 1 / 1.2))) }))}
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{ width: `max(100%, 200vh)`, aspectRatio: "2 / 1", transform: `translate(-50%, -50%) scale(${cam.k}) translate(${(0.5 - cam.x) * 100}%, ${(0.5 - cam.y) * 100}%)`, transformOrigin: "50% 50%" }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" aria-hidden>
          <rect width={W} height={H} fill="#0A1727" />
          <path d={land} fill="#18232C" stroke="#2A3B4C" strokeWidth={0.6 / cam.k} />
        </svg>
        {sorted.map((e) => {
          const sel = e.id === selectedId;
          const size = sel ? 90 : tier === "mid" ? 54 : 24;
          return (
            <button
              key={e.id}
              type="button"
              data-testid="landmark"
              aria-label={ariaFor(e, tu, tx)}
              aria-pressed={sel}
              onPointerDown={(ev) => ev.stopPropagation()}
              onClick={() => onSelect(e.id)}
              className="absolute -translate-x-1/2 -translate-y-[80%]"
              style={{ left: `${(px(e.location.lng) / W) * 100}%`, top: `${(py(e.location.lat) / H) * 100}%`, width: size / cam.k, height: size / cam.k, zIndex: sel ? 10 : 1 }}
            >
              <span
                className="block size-full"
                dangerouslySetInnerHTML={{
                  __html:
                    tier === "far" && !sel
                      ? orbSvg(e.level, e.status, LEVEL_COLORS[e.level])
                      : landmarkSvg({ type: e.landmark.type, level: e.level, status: e.status, palette: e.palette, fundingPct: e.goalUsd ? e.growth.fundingUsd / e.goalUsd : 0, animate: false }),
                }}
              />
              {e.dao && <span className="fk-dao sr-only">DAO</span>}
              <span className="sr-only"><Tx>{STATUS_META[e.status].label}</Tx></span>
            </button>
          );
        })}
      </div>
      <p className="pointer-events-none absolute bottom-1 left-2 text-[10px] text-mute">{tu("liteMapNoWebglNatural")}</p>
    </div>
  );
}
