"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { EventLevel, FreakEvent } from "@/lib/types";
import { MARKER_SIZE, markerSvg } from "./markers";

export interface MapPoint {
  event: FreakEvent;
  level: EventLevel;
  /** Optional chip on the pin, e.g. ranking position "#1". */
  label?: string;
  /** "rank" (default) reads the label as a ranking position; "status" reads it as a status chip. */
  labelKind?: "rank" | "status";
  /** Location is city-level only (venue not confirmed). */
  approximate?: boolean;
  /** Event has an active community DAO (shows a small DAO badge). */
  dao?: boolean;
}

/** Graticule lines every 30° for a bit of "world game" atmosphere. */
function graticule() {
  const features: GeoJSON.Feature[] = [];
  for (let lng = -180; lng <= 180; lng += 30) {
    features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: Array.from({ length: 33 }, (_, i) => [lng, -80 + i * 5]) } });
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: Array.from({ length: 73 }, (_, i) => [-180 + i * 5, lat]) } });
  }
  return { type: "FeatureCollection", features } as GeoJSON.FeatureCollection;
}

const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    countries: { type: "geojson", data: "/data/countries.geojson", attribution: "Natural Earth" },
    borders: { type: "geojson", data: "/data/borders.geojson" },
    grid: { type: "geojson", data: graticule() },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#0b1030" } },
    { id: "grid", type: "line", source: "grid", paint: { "line-color": "#A276E9", "line-opacity": 0.28, "line-width": 1, "line-dasharray": [2, 3] } },
    { id: "glow", type: "line", source: "countries", paint: { "line-color": "#A276E9", "line-width": 14, "line-opacity": 0.35, "line-blur": 10 } },
    { id: "land-shadow", type: "line", source: "countries", paint: { "line-color": "#000", "line-width": 7, "line-opacity": 0.9, "line-translate": [2, 4] } },
    { id: "land", type: "fill", source: "countries", paint: { "fill-color": "#9BDC4C" } },
    { id: "borders", type: "line", source: "borders", paint: { "line-color": "#2f6a1b", "line-width": 0.8, "line-opacity": 0.9 } },
    { id: "coast", type: "line", source: "countries", paint: { "line-color": "#080808", "line-width": ["interpolate", ["linear"], ["zoom"], 0, 1.6, 5, 3] } },
  ],
};

export default function WorldMap({
  points,
  selectedId,
  onSelect,
  focus,
}: {
  points: MapPoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Bump to fit the map to the current points. */
  focus: number;
}) {
  const tu = useTranslations("world");
  const tuRef = useRef(tu);
  tuRef.current = tu;
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef(new Map<string, { marker: maplibregl.Marker; node: HTMLButtonElement; level: number; group: string[] }>());
  const declutterRef = useRef<() => void>(() => {});
  const selectRef = useRef(onSelect);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  selectRef.current = onSelect;

  useEffect(() => {
    if (!el.current) return;
    const mobile = window.innerWidth < 768;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const m = new maplibregl.Map({
      container: el.current,
      style: STYLE,
      center: [10, 22],
      zoom: Math.log2(window.innerWidth / 512) + (mobile ? 0.15 : 0.35),
      minZoom: -1,
      maxZoom: 7,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      fadeDuration: reduce ? 0 : 200,
      renderWorldCopies: false,
    });
    m.touchZoomRotate.disableRotation();
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.current = m;
    m.on("moveend", () => declutterRef.current());
    m.on("load", () => declutterRef.current());
    return () => {
      markers.current.forEach(({ marker }) => marker.remove());
      markers.current.clear();
      m.remove();
      map.current = null;
    };
  }, []);

  // Sync markers with points
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const keep = new Set(points.map((p) => p.event.id));
    markers.current.forEach((v, id) => {
      if (!keep.has(id)) {
        v.marker.remove();
        markers.current.delete(id);
      }
    });
    points.forEach(({ event, level, label, labelKind = "rank", approximate, dao }) => {
      const existing = markers.current.get(event.id);
      if (existing && existing.node.dataset.level === String(level) && existing.node.dataset.label === (label ?? "") && existing.node.dataset.dao === (dao ? "1" : "")) return;
      existing?.marker.remove();
      const size = MARKER_SIZE[level];
      const node = document.createElement("button");
      node.type = "button";
      node.dataset.level = String(level);
      node.dataset.label = label ?? "";
      node.dataset.dao = dao ? "1" : "";
      node.className = "fk-marker";
      const t = tuRef.current;
      const prefix = label ? `${labelKind === "rank" ? t("mapAriaRank", { n: label.replace("#", "") }) : label}: ` : "";
      const parts = [t("mapAriaBase", { name: event.name, city: event.city, level })];
      if (event.status === "live") parts.push(t("mapAriaDemoLive"));
      if (approximate) parts.push(t("mapAriaApprox"));
      if (dao) parts.push(t("mapAriaDao"));
      node.dataset.aria = prefix + parts.join(", ");
      node.setAttribute("aria-label", node.dataset.aria);
      node.style.width = `${Math.max(44, size)}px`;
      node.style.height = `${Math.max(44, size * 1.16)}px`;
      node.innerHTML = `${event.status === "live" ? '<span class="fk-live"></span>' : ""}<span class="fk-pin" style="width:${size}px;height:${size * 1.16}px">${markerSvg(level)}</span>${label ? `<span class="fk-rank">${label}</span>` : ""}${dao ? '<span class="fk-dao" aria-hidden="true">DAO</span>' : ""}`;
      node.addEventListener("click", (e) => {
        e.stopPropagation();
        const entry = markers.current.get(event.id);
        // A pin that stands for several nearby events zooms in to separate them.
        if (entry && entry.group.length > 1 && m.getZoom() < 6.5) {
          const b = new maplibregl.LngLatBounds();
          entry.group.forEach((id) => b.extend(markers.current.get(id)!.marker.getLngLat()));
          m.fitBounds(b, { padding: 120, maxZoom: Math.min(7, m.getZoom() + 3) });
          return;
        }
        selectRef.current(event.id);
      });
      const marker = new maplibregl.Marker({ element: node, anchor: "bottom" }).setLngLat([event.lng, event.lat]).addTo(m);
      markers.current.set(event.id, { marker, node, level, group: [event.id] });
    });
    declutterRef.current();
  }, [points]);

  // Screen-space decluttering: overlapping pins collapse into the highest-level one with a "+n" badge.
  declutterRef.current = () => {
    const m = map.current;
    if (!m) return;
    const items = [...markers.current.entries()]
      .map(([id, v]) => ({ id, v, pt: m.project(v.marker.getLngLat()) }))
      .sort((a, b) => b.v.level - a.v.level);
    const kept: typeof items = [];
    items.forEach((it) => {
      it.v.group = [it.id];
      const host = kept.find((k) => Math.hypot(k.pt.x - it.pt.x, k.pt.y - it.pt.y) < 40);
      if (host && it.id !== selectedRef.current) {
        host.v.group.push(it.id);
        it.v.node.style.display = "none";
      } else {
        kept.push(it);
        it.v.node.style.display = "";
      }
    });
    markers.current.forEach(({ node, group }) => {
      let badge = node.querySelector<HTMLSpanElement>(".fk-count");
      if (group.length > 1) {
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "fk-count";
          node.appendChild(badge);
        }
        badge.textContent = `+${group.length - 1}`;
        node.setAttribute("aria-label", `${node.dataset.aria ?? ""} ${tuRef.current("mapAriaNearby", { n: group.length - 1 })}`);
      } else if (badge) {
        badge.remove();
        node.setAttribute("aria-label", node.dataset.aria ?? "");
      }
    });
  };

  // Selection highlight + camera
  useEffect(() => {
    markers.current.forEach(({ node }, id) => {
      node.classList.toggle("is-selected", id === selectedId);
      node.style.zIndex = id === selectedId ? "5" : "";
    });
    declutterRef.current();
    const m = map.current;
    const p = points.find((x) => x.event.id === selectedId);
    if (m && p) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      m.easeTo({
        center: [p.event.lng, p.event.lat],
        zoom: Math.max(m.getZoom(), 3),
        offset: [0, -Math.min(180, window.innerHeight * 0.2)],
        duration: reduce ? 0 : 700,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Fit to results when requested
  useEffect(() => {
    const m = map.current;
    if (!m || !focus || !points.length) return;
    if (points.length === 1) {
      m.easeTo({ center: [points[0].event.lng, points[0].event.lat], zoom: 4 });
      return;
    }
    const b = new maplibregl.LngLatBounds();
    points.forEach((p) => b.extend([p.event.lng, p.event.lat]));
    m.fitBounds(b, { padding: { top: 160, bottom: 140, left: 40, right: 40 }, maxZoom: 5 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  return (
    <>
      <div className="absolute inset-0">
        <div ref={el} className="h-full w-full" role="region" aria-label={tu("worldMapOfDemoEvents")} />
      </div>
      <style>{`
        .fk-marker{display:flex;align-items:flex-end;justify-content:center;background:none;border:0;padding:0;cursor:pointer;}
        .fk-pin{display:block;transition:transform .15s ease;transform-origin:50% 100%;filter:drop-shadow(0 3px 0 rgba(0,0,0,.6));}
        .fk-marker:hover .fk-pin,.fk-marker.is-selected .fk-pin{transform:scale(1.25);}
        .fk-marker:focus-visible{outline:3px solid #B6F05C;outline-offset:2px;border-radius:12px}
        .fk-count{position:absolute;top:-6px;right:-8px;min-width:24px;height:24px;padding:0 5px;border-radius:999px;background:#F5F2EA;color:#080808;border:2.5px solid #080808;font:800 12px/19px var(--font-sans);}
        .fk-dao{position:absolute;top:-8px;right:-12px;height:20px;padding:0 5px;border-radius:999px;background:#A276E9;color:#080808;border:2px solid #080808;font:900 10px/16px var(--font-sans);box-shadow:0 2px 0 #080808;pointer-events:none}
        .fk-rank{position:absolute;top:-8px;left:-10px;min-width:28px;height:24px;padding:0 6px;border-radius:999px;background:#B6F05C;color:#080808;border:2.5px solid #080808;font:900 12px/19px var(--font-sans);box-shadow:0 2px 0 #080808}
        .fk-live{position:absolute;left:50%;bottom:0;width:18px;height:8px;margin-left:-9px;border-radius:50%;background:#FF625C;animation:fk-pulse 1.6s ease-out infinite}
        @keyframes fk-pulse{from{transform:scale(1);opacity:.9}to{transform:scale(4);opacity:0}}
        .maplibregl-ctrl-group{background:#0d0b12!important;border:1.5px solid rgba(162,118,233,.6);border-radius:16px!important;box-shadow:0 0 18px -4px rgba(162,118,233,.6)!important;overflow:hidden}
        .maplibregl-ctrl-group button{width:44px!important;height:44px!important}
        .maplibregl-ctrl-group button .maplibregl-ctrl-icon{filter:invert(1)}
        .maplibregl-ctrl-attrib{background:rgba(8,8,8,.7)!important;color:#b9b5ab}
        .maplibregl-ctrl-attrib a{color:#b9b5ab}
      `}</style>
    </>
  );
}
