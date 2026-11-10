"use client";

import { useTx } from "@/components/i18n/Tx";
import { useTranslations } from "next-intl";
/**
 * FREAKTOPIA WORLD 7.0 map engine (MapLibre GL).
 *
 * Real geography only: Natural Earth land/borders/lakes/rivers/cities/roads/urban areas served
 * from /data/world (public domain), AWS Terrain Tiles (terrarium DEM) for relief, and optional
 * OpenFreeMap (© OpenStreetMap) vector tiles for street-level roads, labels and 3D buildings.
 * Festivals are DOM landmarks on top, grouped in screen space with three levels of detail.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import maplibregl, { type LngLatBoundsLike, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LEVEL_COLORS } from "@/lib/map/growth";
import { LANDMARK_LABEL, STATUS_META, landmarkSvg, orbSvg } from "@/lib/map/landmarks";
import { ariaFor, type WorldEvent } from "@/lib/map/view";

export interface CameraPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface FestivalWorldMapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  flyToEvents: (ids: string[]) => void;
  flyToPoint: (lng: number, lat: number, zoom?: number) => void;
}

interface Props {
  events: WorldEvent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Animations and globe/terrain effects; off on low-power devices and with reduced motion. */
  rich: boolean;
  /** Landmark idle/live animations (off for low power and reduced motion). */
  animate: boolean;
  reducedMotion: boolean;
  padding: CameraPadding;
  remoteTiles: boolean;
  onReady?: () => void;
  onZoom?: (z: number) => void;
  /** The signed-in user's alien, drawn beside events they joined. Only passed when they opted in (privacy: map presence). */
  me?: { svg: string; label: string; ids: Set<string> } | null;
}

/* ---------------- style ---------------- */

const C = {
  space: "#070A12",
  ocean: "#0A1727",
  oceanDeep: "#081322",
  land: "#18232C",
  landHi: "#1D2A35",
  coast: "#2A3B4C",
  border: "#3A4656",
  lake: "#0C1B2D",
  river: "#123049",
  urban: "#25303C",
  road: "#3B4757",
  light: "#FFD9A0",
};

export const LOD_FAR = 2.6;
export const LOD_NEAR = 4.6;

function baseStyle(rich: boolean, remote: boolean): StyleSpecification {
  const style: StyleSpecification = {
    version: 8,
    projection: { type: rich ? "globe" : "mercator" },
    sky: {
      "sky-color": C.space,
      "horizon-color": "#1A2B47",
      "fog-color": "#0B1626",
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.6,
      "fog-ground-blend": 0.9,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.85, 5, 0.6, 8, 0],
    },
    sources: {
      land: { type: "geojson", data: "/data/world/land.geojson", maxzoom: 7, tolerance: 0.6, buffer: 32 },
      borders: { type: "geojson", data: "/data/world/borders.geojson", maxzoom: 7, tolerance: 0.6 },
      lakes: { type: "geojson", data: "/data/world/lakes.geojson", maxzoom: 7 },
      rivers: { type: "geojson", data: "/data/world/rivers.geojson", maxzoom: 7 },
      places: { type: "geojson", data: "/data/world/places.geojson" },
    },
    layers: [
      { id: "ocean", type: "background", paint: { "background-color": C.ocean } },
      {
        id: "land",
        type: "fill",
        source: "land",
        paint: { "fill-color": ["interpolate", ["linear"], ["zoom"], 1, C.land, 6, C.landHi], "fill-antialias": true },
      },
      { id: "coast-glow", type: "line", source: "land", paint: { "line-color": "#55BCEB", "line-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.1, 6, 0.04], "line-width": ["interpolate", ["linear"], ["zoom"], 0, 2, 6, 6], "line-blur": 4 } },
      { id: "coast", type: "line", source: "land", paint: { "line-color": C.coast, "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.5, 6, 1.2] } },
      { id: "lakes", type: "fill", source: "lakes", paint: { "fill-color": C.lake } },
      { id: "rivers", type: "line", source: "rivers", minzoom: 2.5, paint: { "line-color": C.river, "line-width": ["interpolate", ["linear"], ["zoom"], 2.5, 0.4, 7, 1.4], "line-opacity": 0.8 } },
      { id: "borders", type: "line", source: "borders", paint: { "line-color": C.border, "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.4, 6, 1], "line-dasharray": [3, 2], "line-opacity": 0.75 } },
      {
        id: "city-glow",
        type: "circle",
        source: "places",
        paint: {
          "circle-color": C.light,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, ["interpolate", ["linear"], ["get", "pop"], 4e5, 1.5, 2e7, 7], 6, ["interpolate", ["linear"], ["get", "pop"], 4e5, 6, 2e7, 26]],
          "circle-blur": 1,
          "circle-opacity": ["interpolate", ["linear"], ["zoom"], 1, 0.16, 6, 0.1],
        },
      },
      {
        id: "city-core",
        type: "circle",
        source: "places",
        paint: {
          "circle-color": "#FFF1D6",
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 0.6, 6, 2.2],
          "circle-opacity": ["interpolate", ["linear"], ["get", "pop"], 4e5, 0.35, 1e7, 0.8],
        },
      },
    ],
  };
  if (rich) {
    style.sources.dem = {
      type: "raster-dem",
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      encoding: "terrarium",
      tileSize: 256,
      maxzoom: 11,
      attribution: "Terrain: <a href='https://registry.opendata.aws/terrain-tiles/' target='_blank' rel='noopener'>AWS Terrain Tiles</a> (Mapzen, SRTM, GMTED, ETOPO1)",
    };
    // Relief over land and sea floor, kept quiet so festivals stay the brightest thing.
    style.layers.splice(4, 0, {
      id: "relief",
      type: "hillshade",
      source: "dem",
      paint: { "hillshade-shadow-color": "#000000", "hillshade-highlight-color": "#5A7390", "hillshade-accent-color": "#0B1420", "hillshade-exaggeration": ["interpolate", ["linear"], ["zoom"], 1, 0.55, 8, 0.35], "hillshade-illumination-direction": 315 },
    });
  }
  if (remote) {
    style.glyphs = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
    style.sources.osm = { type: "vector", url: "https://tiles.openfreemap.org/planet", attribution: "<a href='https://openfreemap.org' target='_blank' rel='noopener'>OpenFreeMap</a> © <a href='https://www.openstreetmap.org/copyright' target='_blank' rel='noopener'>OpenStreetMap</a> contributors" };
    style.layers.push(
      { id: "osm-roads", type: "line", source: "osm", "source-layer": "transportation", minzoom: 7, filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary", "minor"]]], paint: { "line-color": C.road, "line-opacity": 0.55, "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 7, 0.3, 16, 6] } },
      { id: "osm-buildings", type: "fill-extrusion", source: "osm", "source-layer": "building", minzoom: 14, paint: { "fill-extrusion-color": "#1F2A36", "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6], "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0], "fill-extrusion-opacity": 0.75 } },
      { id: "osm-roadnames", type: "symbol", source: "osm", "source-layer": "transportation_name", minzoom: 13, layout: { "symbol-placement": "line", "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 10 }, paint: { "text-color": "#7D8898", "text-halo-color": C.ocean, "text-halo-width": 1 } }, // i18n-ignore — font stack
      { id: "osm-places", type: "symbol", source: "osm", "source-layer": "place", minzoom: 4, filter: ["in", ["get", "class"], ["literal", ["city", "town"]]], layout: { "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]], "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 4, 10, 10, 13], "text-letter-spacing": 0.08, "text-transform": "uppercase" }, paint: { "text-color": "#9AA6B5", "text-halo-color": C.space, "text-halo-width": 1.2, "text-opacity": 0.8 } }, // i18n-ignore — font stack
    );
  }
  // Festival aura sits on the ground under the landmarks.
  style.sources.aura = { type: "geojson", data: { type: "FeatureCollection", features: [] } };
  style.layers.push({
    id: "aura",
    type: "circle",
    source: "aura",
    paint: {
      "circle-color": ["get", "color"],
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, ["*", 6, ["get", "w"]], 4, ["*", 18, ["get", "w"]], 8, ["*", 48, ["get", "w"]]],
      "circle-blur": 1,
      "circle-opacity": ["*", 0.5, ["get", "o"]],
      "circle-pitch-alignment": "map",
    },
  });
  return style;
}

const LAZY_LAYERS = (map: maplibregl.Map) => {
  if (map.getSource("urban")) return;
  map.addSource("urban", { type: "geojson", data: "/data/world/urban.geojson", maxzoom: 9 });
  map.addSource("roads", { type: "geojson", data: "/data/world/roads.geojson", maxzoom: 9 });
  const before = map.getLayer("borders") ? "borders" : undefined;
  map.addLayer({ id: "urban", type: "fill", source: "urban", minzoom: 3, paint: { "fill-color": C.urban, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0, 4, 0.9] } }, before);
  map.addLayer({ id: "roads", type: "line", source: "roads", minzoom: 3.5, maxzoom: 10, paint: { "line-color": "#4A5A6E", "line-opacity": ["interpolate", ["linear"], ["zoom"], 3.5, 0, 5, 0.75], "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.5, 8, 1.8] } }, before);
};

/* ---------------- markers ---------------- */

type Tier = "far" | "mid" | "near";
const tierFor = (z: number): Tier => (z < LOD_FAR ? "far" : z < LOD_NEAR ? "mid" : "near");
const RADIUS: Record<Tier, number> = { far: 34, mid: 64, near: 92 };

const priority = (e: WorldEvent) => (e.live ? 1000 : 0) + (e.ranking.badge ? 400 - (e.ranking.rank ?? 0) * 10 : 0) + e.level * 50 + (e.status === "completed" ? -300 : 0);

interface MarkerText {
  top: (rank: number) => string;
  trending: string;
  trendingTitle: string;
  funding: (pct: number) => string;
  status: (english: string) => string;
}

function eventHtml(e: WorldEvent, tier: Tier, selected: boolean, animate: boolean, L: MarkerText) {
  const s = STATUS_META[e.status];
  const pct = e.goalUsd ? e.growth.fundingUsd / e.goalUsd : 0;
  // Single festivals are always drawn as landmarks; only groups collapse into orbs.
  const art = landmarkSvg({ type: e.landmark.type, level: e.level, status: e.status, palette: e.palette, fundingPct: pct, daoTier: tier === "far" ? 0 : e.dao?.tier ?? 0, rank: null, animate: animate && (tier === "near" || selected) });
  const rank = e.ranking.badge ? `<span class="wm-rank wm-rank-${e.ranking.rank}">${esc(L.top(e.ranking.rank ?? 0))}</span>` : "";
  const trend = e.ranking.trendingRank && tier !== "far" ? `<span class="wm-trend" title="${esc(L.trendingTitle)}">▲ ${esc(L.trending)}</span>` : "";
  const name = tier === "near" || selected ? `<span class="wm-name">${esc(e.name)}</span>` : "";
  const chip = tier !== "far" || selected ? `<span class="wm-chip" style="--c:${s.color}"><b aria-hidden="true">${s.glyph}</b>${esc(e.status === "funding" ? L.funding(Math.round(Math.min(1, pct) * 100)) : L.status(s.label))}</span>` : "";
  const dao = e.dao ? `<span class="fk-dao wm-dao" aria-hidden="true">DAO</span>` : "";
  return `<span class="wm-art">${art}</span>${rank}${trend}${dao}${chip}${name}`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

interface Group {
  key: string;
  lead: WorldEvent;
  members: WorldEvent[];
  x: number;
  y: number;
}

/* ---------------- component ---------------- */

const FestivalWorldMap = forwardRef<FestivalWorldMapHandle, Props>(function FestivalWorldMap({ events, selectedId, onSelect, rich, animate, reducedMotion, padding, remoteTiles, onReady, onZoom, me = null }, ref) {
  const tu = useTranslations("world");
  const tx = useTx();
  const markerText = useRef<MarkerText>(null as unknown as MarkerText);
  markerText.current = { top: (rank) => tu("markerTop", { rank }), trending: tu("markerTrending"), trendingTitle: tu("markerTrendingTitle"), funding: (pct) => tu("markerFunding", { pct }), status: tx };
  const aria = (e: WorldEvent) => ariaFor(e, tu, tx);
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef(new Map<string, { m: maplibregl.Marker; box: HTMLDivElement; el: HTMLButtonElement; sig: string }>());
  const latest = useRef({ events, selectedId, onSelect, padding, rich, animate, reducedMotion, me });
  latest.current = { events, selectedId, onSelect, padding, rich, animate, reducedMotion, me };
  const prevCam = useRef<{ center: maplibregl.LngLat; zoom: number; pitch: number; bearing: number } | null>(null);
  const home = useRef<{ center: [number, number]; zoom: number }>({ center: [20, 22], zoom: 1.4 });
  const loaded = useRef(false);

  const flyToSelected = (map: maplibregl.Map) => {
    const e = latest.current.events.find((x) => x.id === latest.current.selectedId);
    if (!e) return;
    map.flyTo({
      center: [e.location.lng, e.location.lat],
      zoom: Math.max(map.getZoom(), e.location.precision === "city" ? 6.2 : 7.2),
      pitch: latest.current.rich ? 48 : 0,
      bearing: latest.current.rich ? -10 : 0,
      padding: latest.current.padding,
      duration: duration(2000),
      curve: 1.5,
      essential: true,
    });
  };

  const duration = (ms: number) => (latest.current.reducedMotion ? 0 : ms);

  /** Rebuild groups for the current viewport and reconcile the marker pool. */
  const render = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const { events: evs, selectedId: sel, animate: anim, me: mine } = latest.current;
    const z = map.getZoom();
    const tier = tierFor(z);
    const w = map.getContainer().clientWidth;
    const h = map.getContainer().clientHeight;
    const pad = 80;
    const groups: Group[] = [];
    const sorted = [...evs].sort((a, b) => priority(b) - priority(a));
    const center = map.getCenter();
    const globe = map.getProjection()?.type === "globe";
    // Visible cap of the globe shrinks as we zoom in; beyond it project() folds points onto the horizon.
    const cap = Math.min(85, 3 * (180 / Math.pow(2, z)) + 6 + map.getPitch() * 0.4);
    for (const e of sorted) {
      if (globe && angularDistance(center.lng, center.lat, e.location.lng, e.location.lat) > cap) continue;
      const p = map.project([e.location.lng, e.location.lat]);
      if (p.x < -pad || p.y < -pad || p.x > w + pad || p.y > h + pad) continue; // viewport culling
      if (e.id === sel) {
        groups.push({ key: e.id, lead: e, members: [e], x: p.x, y: p.y });
        continue;
      }
      // At city zoom nothing is grouped any more: festivals on the same spot fan out instead.
      const r = RADIUS[tier];
      const g = tier === "near" ? undefined : groups.find((g) => g.lead.id !== sel && Math.abs(g.x - p.x) < r && Math.abs(g.y - p.y) < r * 0.8);
      if (g) g.members.push(e);
      else groups.push({ key: e.id, lead: e, members: [e], x: p.x, y: p.y });
    }

    // Fan-out offsets for overlapping single landmarks (near tier).
    const offsets = new Map<string, [number, number]>();
    if (tier === "near") {
      const placed: Group[] = [];
      for (const g of groups) {
        const hits = placed.filter((o) => Math.abs(o.x - g.x) < 70 && Math.abs(o.y - g.y) < 50);
        // Fan out sideways and step down a little so the name labels don't collide.
        if (hits.length) offsets.set(g.lead.id, [(hits.length % 2 ? 1 : -1) * Math.ceil(hits.length / 2) * 112, 44 * Math.ceil(hits.length / 2)]);
        placed.push(g);
      }
    }

    const seen = new Set<string>();
    for (const g of groups) {
      const single = g.members.length === 1;
      const key = single ? `e:${g.lead.id}` : `c:${g.members.map((m) => m.id).sort().join("|")}`;
      seen.add(key);
      const selected = g.lead.id === sel;
      const here = single && tier !== "far" && Boolean(mine?.ids.has(g.lead.id));
      const sig = single ? `${here}|${tier}|${selected}|${g.lead.level}|${g.lead.status}|${g.lead.dao?.tier}|${g.lead.ranking.rank}|${anim}|${g.lead.palette.join()}|${Math.round((g.lead.growth.fundingUsd / g.lead.goalUsd) * 50)}` : `${tier}|${g.members.length}|${g.lead.id}`;
      let rec = markers.current.get(key);
      if (!rec) {
        // maplibre owns the wrapper's classes and transform; our button lives inside it.
        const wrap = document.createElement("div");
        const el = document.createElement("button");
        el.type = "button";
        wrap.appendChild(el);
        const m = new maplibregl.Marker({ element: wrap, anchor: "bottom", subpixelPositioning: true }).setLngLat([g.lead.location.lng, g.lead.location.lat]).addTo(map);
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const r = markers.current.get(key);
          const ids = (r?.el.dataset.ids ?? "").split(",").filter(Boolean);
          if (ids.length > 1) zoomToIds(ids);
          else latest.current.onSelect(ids[0] ?? null);
        });
        rec = { m, box: wrap, el, sig: "" };
        markers.current.set(key, rec);
      }
      if (rec.sig !== sig) {
        rec.sig = sig;
        const el = rec.el;
        el.dataset.ids = g.members.map((m) => m.id).join(",");
        el.dataset.testid = single ? "landmark" : "landmark-cluster";
        if (single) {
          el.className = `wm-mk wm-${tier}${selected ? " wm-sel" : ""} wm-st-${g.lead.status}${g.lead.live ? " wm-live" : ""}`;
          el.setAttribute("aria-label", aria(g.lead));
          el.setAttribute("aria-pressed", String(selected));
          el.title = `${g.lead.name} · ${tx(LANDMARK_LABEL[g.lead.landmark.type])}`;
          el.innerHTML = eventHtml(g.lead, tier, selected, anim, markerText.current) + (here && mine ? `<span class="wm-me" data-testid="map-my-alien" title="${mine.label}">${mine.svg}</span>` : "");
          if (here && mine) el.setAttribute("aria-label", `${aria(g.lead)}. ${mine.label}`);
        } else {
          const live = g.members.some((m) => m.live);
          const dao = g.members.some((m) => m.dao);
          el.className = `wm-mk wm-cluster wm-${tier}${live ? " wm-live" : ""}`;
          el.removeAttribute("aria-pressed");
          const cities = [...new Set(g.members.map((m) => m.city))];
          el.setAttribute("aria-label", `${g.members.length} festivals near ${cities.slice(0, 3).join(", ")}${live ? " (one is demo live)" : ""}. Zoom in`);
          el.title = g.members.map((m) => m.name).join(" · ");
          const lead = g.lead;
          el.innerHTML = `<span class="wm-art">${tier === "far" ? orbSvg(lead.level, lead.status, LEVEL_COLORS[lead.level]) : landmarkSvg({ type: lead.landmark.type, level: lead.level, status: lead.status, palette: lead.palette, daoTier: 0, animate: false })}</span><span class="wm-count">+${g.members.length - 1}</span>${dao ? `<span class="fk-dao wm-dao" aria-hidden="true">DAO</span>` : ""}${live ? `<span class="wm-chip" style="--c:#FF625C"><b aria-hidden="true">●</b>DEMO LIVE</span>` : ""}`;
        }
      }
      rec.m.setLngLat([g.lead.location.lng, g.lead.location.lat]);
      rec.m.setOffset(single ? offsets.get(g.lead.id) ?? [0, 0] : [0, 0]);
      rec.box.style.zIndex = String(selected ? 1000 : Math.round(priority(g.lead) / 10) + (g.y > 0 ? Math.round(g.y / 10) : 0));
    }
    for (const [k, r] of markers.current) {
      if (!seen.has(k)) {
        r.m.remove();
        markers.current.delete(k);
      }
    }

    const aura = map.getSource("aura") as maplibregl.GeoJSONSource | undefined;
    aura?.setData({
      type: "FeatureCollection",
      features: evs.map((e) => ({
        type: "Feature",
        properties: { color: e.status === "live" ? "#FF625C" : e.status === "cancelled" || e.status === "completed" ? "#6B7380" : LEVEL_COLORS[e.level], w: 0.6 + e.level * 0.25, o: e.status === "planning" ? 0.4 : e.status === "completed" ? 0.3 : 1 },
        geometry: { type: "Point", coordinates: [e.location.lng, e.location.lat] },
      })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoomToIds = useCallback((ids: string[]) => {
    const map = mapRef.current;
    if (!map) return;
    const evs = latest.current.events.filter((e) => ids.includes(e.id));
    if (!evs.length) return;
    if (evs.length === 1) {
      map.flyTo({ center: [evs[0].location.lng, evs[0].location.lat], zoom: Math.max(map.getZoom(), 5), duration: duration(1400), essential: true, padding: latest.current.padding });
      return;
    }
    const b = new maplibregl.LngLatBounds();
    for (const e of evs) b.extend([e.location.lng, e.location.lat]);
    const p = latest.current.padding;
    map.fitBounds(b as LngLatBoundsLike, { padding: { top: p.top + 90, bottom: p.bottom + 90, left: p.left + 70, right: p.right + 70 }, maxZoom: 6.5, duration: duration(1400), essential: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn({ duration: duration(300) }),
    zoomOut: () => mapRef.current?.zoomOut({ duration: duration(300) }),
    reset: () => {
      prevCam.current = null;
      mapRef.current?.flyTo({ center: home.current.center, zoom: home.current.zoom, pitch: 0, bearing: 0, duration: duration(1400), essential: true, padding: { top: 0, right: 0, bottom: 0, left: 0 } });
    },
    flyToEvents: zoomToIds,
    flyToPoint: (lng, lat, zoom = 7) => mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: duration(1400), essential: true }),
  }));

  /* init */
  useEffect(() => {
    if (!box.current) return;
    const wide = box.current.clientWidth >= 768;
    // The globe reads smaller than Mercator at the same zoom, so it starts closer.
    home.current = rich ? (wide ? { center: [12, 28], zoom: 2.25 } : { center: [14, 26], zoom: 1.35 }) : wide ? { center: [18, 24], zoom: 1.75 } : { center: [40, 22], zoom: 0.95 };
    const map = new maplibregl.Map({
      container: box.current,
      style: baseStyle(rich, remoteTiles),
      center: home.current.center,
      zoom: home.current.zoom,
      minZoom: 0.6,
      maxZoom: 17,
      maxPitch: rich ? 60 : 0,
      renderWorldCopies: false,
      attributionControl: false,
      dragRotate: rich,
      pitchWithRotate: rich,
      fadeDuration: reducedMotion ? 0 : 200,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "Geography: <a href='https://www.naturalearthdata.com' target='_blank' rel='noopener'>Natural Earth</a> (public domain)" }), "bottom-left");
    map.touchZoomRotate.disableRotation();
    map.keyboard.enable();
    // Remote tiles (terrain/OSM) are optional: if a host is unreachable the local geography still renders.
    map.on("error", () => {});
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(render);
    };
    let lastTier = tierFor(map.getZoom());
    map.on("load", () => {
      loaded.current = true;
      markCamera();
      render();
      // Start the attribution collapsed to its (i) button so it never covers controls on phones.
      box.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
      // Deep link (?event=…): start at the world, then fly in; closing returns to the world view.
      if (latest.current.selectedId) {
        lastSel.current = latest.current.selectedId;
        prevCam.current = { center: map.getCenter(), zoom: map.getZoom(), pitch: 0, bearing: 0 };
        flyToSelected(map);
      }
      onReady?.();
      box.current?.setAttribute("data-ready", "true");
    });
    // Exposed for QA/E2E: the current camera, rounded.
    const markCamera = () => {
      const c = map.getCenter();
      box.current?.setAttribute("data-camera", `${c.lng.toFixed(2)},${c.lat.toFixed(2)},${map.getZoom().toFixed(2)}`);
    };
    map.on("moveend", () => {
      schedule();
      markCamera();
    });
    map.on("zoom", () => {
      const t = tierFor(map.getZoom());
      if (t !== lastTier) {
        lastTier = t;
        schedule();
      }
      if (map.getZoom() >= 3) LAZY_LAYERS(map);
      onZoom?.(map.getZoom());
    });
    map.on("click", () => latest.current.onSelect(null));
    map.on("idle", () => box.current?.setAttribute("data-idle", "true"));
    map.on("movestart", () => box.current?.setAttribute("data-idle", "false"));
    const pool = markers.current;
    return () => {
      loaded.current = false;
      cancelAnimationFrame(raf);
      for (const r of pool.values()) r.m.remove();
      pool.clear();
      map.remove(); // releases the WebGL context and GPU buffers
      mapRef.current = null;
    };
    // The map is created once; rich/remote changes remount the component via key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* data / selection changes */
  useEffect(() => {
    const map = mapRef.current;
    if (map?.loaded() || map?.isStyleLoaded()) render();
  }, [events, selectedId, me, render]);

  /* camera on select / close */
  const lastSel = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const before = lastSel.current;
    lastSel.current = selectedId;
    // Before the first load the init effect's load handler flies to the selection.
    if (!loaded.current) return;
    if (selectedId && selectedId !== before) {
      if (!before) prevCam.current = { center: map.getCenter(), zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() };
      flyToSelected(map);
    } else if (!selectedId && before && prevCam.current) {
      const c = prevCam.current;
      prevCam.current = null;
      map.flyTo({ ...c, padding: { top: 0, right: 0, bottom: 0, left: 0 }, duration: duration(1300), essential: true });
    }
  }, [selectedId]);

  /* keep the selected landmark clear of the panel/sheet when its size changes */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId || !loaded.current) return;
    // A flight in progress is re-aimed with the new padding instead of being cancelled by easeTo.
    if (map.isMoving()) flyToSelected(map);
    else map.easeTo({ padding, duration: duration(250) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [padding.bottom, padding.right]);

  // maplibre sets position:relative on its container, so the sizing lives on a wrapper.
  return (
    <div className="absolute inset-0 isolate z-0">
      <div ref={box} className="wm-root size-full" data-testid="world-map" role="application" aria-label={tu("worldFestivalMapUseArrow")} />
    </div>
  );
});

function angularDistance(lng1: number, lat1: number, lng2: number, lat2: number) {
  const r = Math.PI / 180;
  const c = Math.sin(lat1 * r) * Math.sin(lat2 * r) + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lng2 - lng1) * r);
  return Math.acos(Math.max(-1, Math.min(1, c))) / r;
}

export default FestivalWorldMap;
