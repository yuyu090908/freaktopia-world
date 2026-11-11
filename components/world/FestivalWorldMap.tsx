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
import { EXTERNAL_MARKER_LABEL, LANDMARK_LABEL, STATUS_META, externalMarkerKind, externalMarkerSvg, landmarkSvg, orbSvg } from "@/lib/map/landmarks";
import { ariaFor, type WorldEvent } from "@/lib/map/view";
import { OCEAN, REGION_COLOR, mix, type RegionKey } from "@/lib/map/regions";
import { buildCities, cityScale, citySvg, type PartyCity } from "@/lib/map/cities";
import { SpaceBackdrop } from "./SpaceBackdrop";

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
  /** Zoom into a party city (its festivals spread out), keeping it clear of the preview panel. */
  flyToCity?: (lng: number, lat: number) => void;
  /** Back to the view before a city was opened. */
  restoreView?: () => void;
}

interface Props {
  events: WorldEvent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Animations and globe/terrain effects; off on low-power devices and with reduced motion. */
  rich: boolean;
  /** Globe projection (every WebGL device unless ?renderer=flat). Without it the map is flat Mercator. */
  globe: boolean;
  /** Language for country labels. */
  locale: string;
  /** Low-power device: lower drawing resolution and fewer decorations. */
  lowPower?: boolean;
  /** Very slow rotation until the person touches the globe (never with reduced motion). */
  autoSpin?: boolean;
  /** Landmark idle/live animations (off for low power and reduced motion). */
  animate: boolean;
  reducedMotion: boolean;
  padding: CameraPadding;
  remoteTiles: boolean;
  onReady?: () => void;
  onZoom?: (z: number) => void;
  /** The signed-in user's alien, drawn beside events they joined. Only passed when they opted in (privacy: map presence). */
  me?: { svg: string; label: string; ids: Set<string> } | null;
  /** City preview open ("City|Country"); its stage is highlighted on the globe. */
  selectedCity?: string | null;
  /** Tapping a party city at world zoom opens its preview. */
  onSelectCity?: (key: string) => void;
}

/* ---------------- style ---------------- */

const C = {
  space: "#05030D",
  ocean: OCEAN.deep,
  lake: OCEAN.glow,
  river: "#1C4F86",
  urban: "#2A2350",
  road: "#5A4E8A",
  light: "#FFF4C7",
};

export const LOD_FAR = 2.6;
export const LOD_NEAR = 4.6;

/** How far each region's fill is darkened toward the ocean. Yellow and orange turn olive quickly, so they stay brighter. */
const FILL_DARKEN: Record<RegionKey, number> = { na: 0.38, sa: 0.38, eu: 0.34, as: 0.2, me: 0.26, af: 0.4, oc: 0.36, an: 0.5 };

const regionMatch = (pick: (k: RegionKey) => string) =>
  ["match", ["get", "r"], ...(Object.keys(REGION_COLOR) as RegionKey[]).flatMap((k) => [k, pick(k)]), pick("as")] as unknown as string;

/**
 * Neon party planet: every display region glows in its own colour (a darker fill, a blurred inner glow and a bright
 * border line), over a deep navy ocean. Geography is Natural Earth, unchanged; only the colours are ours.
 */
function baseStyle(rich: boolean, remote: boolean, globe: boolean, locale: string): StyleSpecification {
  const nameField = ["coalesce", ["get", `n_${({ "zh-CN": "zh", th: "en" } as Record<string, string>)[locale] ?? locale}`], ["get", "n_en"]];
  const style: StyleSpecification = {
    version: 8,
    projection: { type: globe ? "globe" : "mercator" },
    sky: {
      "sky-color": C.space,
      "horizon-color": "#3B2C8C",
      "fog-color": "#1A1240",
      "sky-horizon-blend": 0.7,
      "horizon-fog-blend": 0.5,
      "fog-ground-blend": 0.9,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 4, 0.75, 7, 0],
    },
    sources: {
      countries: { type: "geojson", data: "/data/world/countries.geojson", maxzoom: 7, tolerance: 0.5, buffer: 32 },
      lakes: { type: "geojson", data: "/data/world/lakes.geojson", maxzoom: 7 },
      rivers: { type: "geojson", data: "/data/world/rivers.geojson", maxzoom: 7 },
      places: { type: "geojson", data: "/data/world/places.geojson" },
    },
    layers: [
      { id: "ocean", type: "background", paint: { "background-color": C.ocean } },
      {
        id: "land",
        type: "fill",
        source: "countries",
        paint: {
          "fill-color": regionMatch((k) => mix(REGION_COLOR[k], OCEAN.deep, FILL_DARKEN[k])),
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 1, 0.95, 6, 0.8],
          "fill-antialias": true,
        },
      },
      // Inner glow: a wide blurred line in the region colour makes each country brighter toward its edges.
      {
        id: "land-glow",
        type: "line",
        source: "countries",
        paint: {
          "line-color": regionMatch((k) => REGION_COLOR[k]),
          "line-width": ["interpolate", ["linear"], ["zoom"], 0, 3, 3, 7, 6, 14],
          "line-blur": ["interpolate", ["linear"], ["zoom"], 0, 3, 6, 10],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.7, 6, 0.35],
        },
      },
      { id: "lakes", type: "fill", source: "lakes", paint: { "fill-color": C.lake } },
      { id: "rivers", type: "line", source: "rivers", minzoom: 2.5, paint: { "line-color": C.river, "line-width": ["interpolate", ["linear"], ["zoom"], 2.5, 0.4, 7, 1.4], "line-opacity": 0.7 } },
      // Borders and coasts: thin bright neon lines, lighter than the fill.
      {
        id: "borders",
        type: "line",
        source: "countries",
        paint: {
          "line-color": regionMatch((k) => mix(REGION_COLOR[k], "#FFFFFF", 0.45)),
          "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.35, 3, 0.8, 7, 1.6],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.65, 3, 0.9],
        },
      },
      {
        id: "city-glow",
        type: "circle",
        source: "places",
        paint: {
          "circle-color": C.light,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, ["interpolate", ["linear"], ["get", "pop"], 4e5, 1.5, 2e7, 6], 6, ["interpolate", ["linear"], ["get", "pop"], 4e5, 6, 2e7, 24]],
          "circle-blur": 1,
          "circle-opacity": ["interpolate", ["linear"], ["zoom"], 1, 0.22, 6, 0.12],
        },
      },
      {
        id: "city-core",
        type: "circle",
        source: "places",
        paint: {
          "circle-color": "#FFFFFF",
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 0.6, 6, 2.2],
          "circle-opacity": ["interpolate", ["linear"], ["get", "pop"], 4e5, 0.4, 1e7, 0.9],
        },
      },
    ],
  };
  if (remote) {
    // Country names only when zoomed in, bigger countries first (LABELRANK). Needs the remote glyph server.
    style.glyphs = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
    style.sources.countryLabels = { type: "geojson", data: "/data/world/country-labels.geojson" };
    style.layers.push({
      id: "country-labels",
      type: "symbol",
      source: "countryLabels",
      minzoom: 2.9,
      filter: ["<=", ["get", "rank"], ["step", ["zoom"], 2, 3.6, 4, 4.4, 6]],
      layout: { "text-field": nameField as unknown as string, "text-font": ["Noto Sans Bold"], "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10, 6, 14], "text-letter-spacing": 0.08, "text-transform": "uppercase", "text-max-width": 8 }, // i18n-ignore — font stack
      paint: { "text-color": regionMatch((k) => mix(REGION_COLOR[k], "#FFFFFF", 0.55)), "text-halo-color": OCEAN.deep, "text-halo-width": 1.4, "text-opacity": 0.85 },
    });
  }
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
      paint: { "hillshade-shadow-color": "#05030D", "hillshade-highlight-color": "#FFFFFF", "hillshade-accent-color": "#1A1240", "hillshade-exaggeration": ["interpolate", ["linear"], ["zoom"], 1, 0.35, 8, 0.3], "hillshade-illumination-direction": 315 },
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
  cityEvents: (count: number) => string;
  cityAria: (city: string, country: string, count: number, live: number) => string;
  cityCluster: (cities: string, count: number) => string;
  live: string;
}

/** External events: a shaped pin with the source name, no level, ranking or status of FREAKTOPIA's own. */
function externalHtml(e: WorldEvent, tier: Tier, selected: boolean) {
  const x = e.external!;
  const art = externalMarkerSvg(externalMarkerKind(x.category), e.location.precision === "city");
  const name = tier === "near" || selected ? `<span class="wm-name">${esc(e.name)}</span>` : "";
  const chip = tier !== "far" || selected ? `<span class="wm-chip" style="--c:#66DFFF"><b aria-hidden="true">↗</b>${esc(x.sourceName)}</span>` : "";
  return `<span class="wm-art">${art}</span>${chip}${name}`;
}

function eventHtml(e: WorldEvent, tier: Tier, selected: boolean, animate: boolean, L: MarkerText) {
  if (e.external) return externalHtml(e, tier, selected);
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

const FestivalWorldMap = forwardRef<FestivalWorldMapHandle, Props>(function FestivalWorldMap({ events, selectedId, onSelect, rich, globe, locale, lowPower = false, autoSpin = false, animate, reducedMotion, padding, remoteTiles, onReady, onZoom, me = null, selectedCity = null, onSelectCity }, ref) {
  const tu = useTranslations("world");
  const tx = useTx();
  const markerText = useRef<MarkerText>(null as unknown as MarkerText);
  markerText.current = { top: (rank) => tu("markerTop", { rank }), trending: tu("markerTrending"), trendingTitle: tu("markerTrendingTitle"), funding: (pct) => tu("markerFunding", { pct }),
    status: tx,
    cityEvents: (count) => tu("cityEvents", { count }),
    cityAria: (city, country, count, live) => tu("cityAria", { city, country, count, live }),
    cityCluster: (cities, count) => tu("cityClusterAria", { cities, count }),
    live: tu("cityLiveBadge"),
  };
  const aria = (e: WorldEvent) => ariaFor(e, tu, tx);
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef(new Map<string, { m: maplibregl.Marker; box: HTMLDivElement; el: HTMLButtonElement; sig: string }>());
  const latest = useRef({ events, selectedId, onSelect, padding, rich, animate, reducedMotion, me, selectedCity, onSelectCity });
  latest.current = { events, selectedId, onSelect, padding, rich, animate, reducedMotion, me, selectedCity, onSelectCity };
  const prevCam = useRef<{ center: maplibregl.LngLat; zoom: number; pitch: number; bearing: number } | null>(null);
  const home = useRef<{ center: [number, number]; zoom: number }>({ center: [20, 22], zoom: 1.4 });
  const loaded = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const spin = useRef({ on: false, raf: 0, last: 0, lastRender: 0 });
  const stopSpin = () => {
    spin.current.on = false;
    cancelAnimationFrame(spin.current.raf);
  };

  const flyToSelected = (map: maplibregl.Map) => {
    stopSpin();
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

  /** One pooled DOM marker. maplibre owns the wrapper's classes and transform; our button lives inside it. */
  const makeMarker = (map: maplibregl.Map, key: string, lng: number, lat: number) => {
    const wrap = document.createElement("div");
    const el = document.createElement("button");
    el.type = "button";
    wrap.appendChild(el);
    const m = new maplibregl.Marker({ element: wrap, anchor: "bottom", subpixelPositioning: true, opacityWhenCovered: "0" }).setLngLat([lng, lat]).addTo(map);
    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const r = markers.current.get(key);
      const city = r?.el.dataset.city;
      if (city) {
        stopSpin();
        latest.current.onSelectCity?.(city);
        return;
      }
      const ids = (r?.el.dataset.ids ?? "").split(",").filter(Boolean);
      if (ids.length > 1) zoomToIds(ids);
      else latest.current.onSelect(ids[0] ?? null);
    });
    const rec = { m, box: wrap, el, sig: "" };
    markers.current.set(key, rec);
    return rec;
  };

  /** Rebuild groups for the current viewport and reconcile the marker pool. */
  const render = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const { events: evs, selectedId: sel, animate: anim, me: mine, selectedCity: selCity } = latest.current;
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
    const hidden = (lng: number, lat: number) => {
      if (globe && angularDistance(center.lng, center.lat, lng, lat) > cap) return null;
      const p = map.project([lng, lat]);
      return p.x < -pad || p.y < -pad || p.x > w + pad || p.y > h + pad ? null : p; // viewport culling
    };
    // World zoom: festivals are shown as party cities (one stage per city), grouped again when cities overlap on screen.
    const cityEvents: WorldEvent[] = [];
    for (const e of sorted) {
      if (tier === "far" && e.id !== sel) {
        cityEvents.push(e);
        continue;
      }
      const p = hidden(e.location.lng, e.location.lat);
      if (!p) continue;
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
      if (!rec) rec = makeMarker(map, key, g.lead.location.lng, g.lead.location.lat);
      if (rec.sig !== sig) {
        rec.sig = sig;
        const el = rec.el;
        el.dataset.ids = g.members.map((m) => m.id).join(",");
        el.dataset.testid = single ? "landmark" : "landmark-cluster";
        if (single) {
          el.className = `wm-mk wm-${tier}${selected ? " wm-sel" : ""} wm-st-${g.lead.status}${g.lead.live ? " wm-live" : ""}`;
          el.setAttribute("aria-label", aria(g.lead));
          el.setAttribute("aria-pressed", String(selected));
          el.title = `${g.lead.name} · ${g.lead.external ? `${tx(EXTERNAL_MARKER_LABEL[externalMarkerKind(g.lead.external.category)])} · ${g.lead.external.sourceName}` : tx(LANDMARK_LABEL[g.lead.landmark.type])}`;
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
          el.innerHTML = `<span class="wm-art">${lead.external && tier !== "far" ? externalMarkerSvg(externalMarkerKind(lead.external.category), lead.location.precision === "city") : tier === "far" ? orbSvg(lead.level, lead.status, LEVEL_COLORS[lead.level]) : landmarkSvg({ type: lead.landmark.type, level: lead.level, status: lead.status, palette: lead.palette, daoTier: 0, animate: false })}</span><span class="wm-count">+${g.members.length - 1}</span>${dao ? `<span class="fk-dao wm-dao" aria-hidden="true">DAO</span>` : ""}${live ? `<span class="wm-chip" style="--c:#FF625C"><b aria-hidden="true">●</b>DEMO LIVE</span>` : ""}`;
        }
      }
      rec.m.setLngLat([g.lead.location.lng, g.lead.location.lat]);
      rec.m.setOffset(single ? offsets.get(g.lead.id) ?? [0, 0] : [0, 0]);
      rec.box.style.zIndex = String(selected ? 1000 : Math.round(priority(g.lead) / 10) + (g.y > 0 ? Math.round(g.y / 10) : 0));
    }
    if (tier === "far") {
      const compact = w < 768;
      // Labels are wider than the stages, so cities merge sooner sideways than vertically.
      const [RX, RY] = compact ? [74, 52] : [92, 60];
      const placed: { lead: PartyCity; cities: PartyCity[]; x: number; y: number }[] = [];
      for (const c of buildCities(cityEvents)) {
        const p = hidden(c.lng, c.lat);
        if (!p) continue;
        const hit = c.key === selCity ? undefined : placed.find((g) => g.lead.key !== selCity && Math.abs(g.x - p.x) < RX && Math.abs(g.y - p.y) < RY);
        if (hit) hit.cities.push(c);
        else placed.push({ lead: c, cities: [c], x: p.x, y: p.y });
      }
      const L = markerText.current;
      for (const g of placed) {
        const single = g.cities.length === 1;
        const c = g.lead;
        const total = g.cities.reduce((a, x) => a + x.counts.total, 0);
        const live = g.cities.reduce((a, x) => a + x.counts.live, 0);
        const ids = g.cities.flatMap((x) => x.events.map((e) => e.id));
        const dao = g.cities.some((x) => x.counts.dao > 0);
        const key = single ? `city:${c.key}` : `cc:${g.cities.map((x) => x.key).sort().join("|")}`;
        seen.add(key);
        const on = single && c.key === selCity;
        const sig = `${total}|${live}|${dao}|${on}|${anim}|${compact}`;
        let rec = markers.current.get(key);
        if (!rec) rec = makeMarker(map, key, c.lng, c.lat);
        if (rec.sig !== sig) {
          rec.sig = sig;
          const el = rec.el;
          el.dataset.ids = ids.join(",");
          el.dataset.testid = single ? "city-marker" : "landmark-cluster";
          if (single) el.dataset.city = c.key;
          else delete el.dataset.city;
          el.className = `wm-mk wm-city wm-far${single ? "" : " wm-city-group"}${on ? " wm-city-sel" : ""}${live ? " wm-city-on" : ""}`;
          el.setAttribute("aria-label", single ? L.cityAria(c.city, c.country, total, live) : L.cityCluster(g.cities.map((x) => x.city).join(", "), total));
          if (single) el.setAttribute("aria-pressed", String(on));
          else el.removeAttribute("aria-pressed");
          el.title = single ? `${c.city}, ${c.country}` : g.cities.map((x) => x.city).join(" · ");
          const scale = cityScale(total) * (compact ? 0.85 : 1);
          const name = single ? c.city : `${c.city} +${g.cities.length - 1}`;
          el.innerHTML =
            `<span class="wm-art" style="--s:${scale.toFixed(2)}">${citySvg({ signature: c.signature, region: c.region, live: live > 0, count: total, animate: anim })}</span>` +
            (dao ? `<span class="fk-dao wm-dao" aria-hidden="true">DAO</span>` : "") +
            (live ? `<span class="wm-chip wm-city-live-chip" style="--c:#FF625C"><b aria-hidden="true">●</b>${esc(L.live)}</span>` : "") +
            `<span class="wm-city-label"><b>${esc(name)}</b><span>${esc(L.cityEvents(total))}</span></span>`;
        }
        rec.m.setLngLat([c.lng, c.lat]);
        rec.m.setOffset([0, 0]);
        rec.box.style.zIndex = String(on ? 1000 : Math.round(c.priority / 10) + (g.y > 0 ? Math.round(g.y / 10) : 0));
      }
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
    stopSpin();
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
    zoomIn: () => (stopSpin(), mapRef.current?.zoomIn({ duration: duration(300) })),
    zoomOut: () => (stopSpin(), mapRef.current?.zoomOut({ duration: duration(300) })),
    reset: () => {
      stopSpin();
      prevCam.current = null;
      mapRef.current?.flyTo({ center: home.current.center, zoom: home.current.zoom, pitch: 0, bearing: 0, duration: duration(1400), essential: true, padding: { top: 0, right: 0, bottom: 0, left: 0 } });
    },
    flyToEvents: zoomToIds,
    flyToPoint: (lng, lat, zoom = 7) => (stopSpin(), mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: duration(1400), essential: true })),
    restoreView: () => {
      const c = prevCam.current;
      prevCam.current = null;
      if (c) mapRef.current?.flyTo({ ...c, padding: { top: 0, right: 0, bottom: 0, left: 0 }, duration: duration(1300), essential: true });
    },
    flyToCity: (lng, lat) => {
      stopSpin();
      const map = mapRef.current;
      if (!map) return;
      if (!prevCam.current) prevCam.current = { center: map.getCenter(), zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() };
      map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 4.2), pitch: 0, bearing: 0, padding: latest.current.padding, duration: duration(1600), essential: true });
    },
  }));

  /* init */
  useEffect(() => {
    if (!box.current) return;
    const wide = box.current.clientWidth >= 768;
    // The globe reads smaller than Mercator at the same zoom, so it starts closer.
    home.current = globe ? (wide ? { center: [12, 28], zoom: 2.25 } : { center: [14, 26], zoom: 1.35 }) : wide ? { center: [18, 24], zoom: 1.75 } : { center: [40, 22], zoom: 0.95 };
    const map = new maplibregl.Map({
      container: box.current,
      style: baseStyle(rich, remoteTiles, globe, locale),
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
      // Low-power phones draw at a lower resolution (crisp enough for a glowing globe, much less GPU work).
      pixelRatio: lowPower ? Math.min(devicePixelRatio || 1, 1.5) : Math.min(devicePixelRatio || 1, 2),
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

    // Globe position on screen → CSS variables for the halo, the sun reflection and the floating aliens.
    const spec = document.createElement("div");
    spec.className = "wm-spec";
    if (globe) map.getCanvasContainer().appendChild(spec);
    let geoRaf = 0;
    const placeGlobe = () => {
      geoRaf = 0;
      const wrap = wrapRef.current;
      if (!wrap || !globe || map.getProjection()?.type !== "globe") {
        wrap?.style.setProperty("--gh", "0");
        wrap?.style.setProperty("--ga", "0");
        return;
      }
      const c = map.getCenter();
      const p0 = map.project(c);
      // Two points 30° and 60° east along a great circle through the centre. Under the perspective camera they land at
      // k·sinθ/(D − cosθ) from the centre (D = camera distance in globe radii); solving for D and k gives the visible
      // edge of the planet at k/√(D²−1).
      const lat = (c.lat * Math.PI) / 180;
      const at = (d: number) => {
        const lat2 = Math.asin(Math.sin(lat) * Math.cos(d));
        const lng2 = c.lng + (Math.atan2(Math.sin(d) * Math.cos(lat), Math.cos(d) - Math.sin(lat) * Math.sin(lat2)) * 180) / Math.PI;
        const q = map.project([lng2, (lat2 * 180) / Math.PI]);
        return Math.hypot(q.x - p0.x, q.y - p0.y);
      };
      const [t1, t2] = [Math.PI / 6, Math.PI / 3];
      const s1 = at(t1);
      const ratio = s1 / at(t2);
      const D = (ratio * Math.cos(t1) * Math.sin(t2) - Math.sin(t1) * Math.cos(t2)) / (ratio * Math.sin(t2) - Math.sin(t1));
      const r = D > 1.01 && Number.isFinite(D) ? (s1 * (D - Math.cos(t1))) / Math.sin(t1) / Math.sqrt(D * D - 1) : s1 / Math.sin(t1);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const flat = map.getPitch() > 5;
      wrap.style.setProperty("--gx", `${p0.x.toFixed(1)}px`);
      wrap.style.setProperty("--gy", `${p0.y.toFixed(1)}px`);
      wrap.style.setProperty("--gr", `${r.toFixed(1)}px`);
      wrap.style.setProperty("--gh", flat || r > Math.max(w, h) * 1.2 ? "0" : "1");
      // Aliens only while the whole planet is in view, so they never sit on top of events.
      wrap.style.setProperty("--ga", !flat && r * 2.1 < Math.min(w * 1.05, h) ? "1" : "0");
    };
    const queueGlobe = () => {
      if (!geoRaf) geoRaf = requestAnimationFrame(placeGlobe);
    };
    map.on("move", queueGlobe);
    map.on("resize", queueGlobe);

    // Very slow spin while nobody is touching the globe; any input stops it for good.
    const userStop = () => stopSpin();
    for (const ev of ["mousedown", "touchstart", "wheel", "dragstart", "keydown"] as const) map.on(ev, userStop);
    box.current?.addEventListener("pointerdown", userStop, { capture: true });
    const startSpin = () => {
      if (!autoSpin || !globe || latest.current.selectedId) return;
      spin.current.on = true;
      spin.current.last = performance.now();
      const step = (t: number) => {
        if (!spin.current.on) return;
        const dt = Math.min(64, t - spin.current.last);
        spin.current.last = t;
        if (!document.hidden && !map.isMoving() && map.getZoom() < 3) {
          const c = map.getCenter();
          map.setCenter([c.lng + dt * 0.0016, c.lat]); // about 1.6° a second: one turn in ~4 minutes
        }
        spin.current.raf = requestAnimationFrame(step);
      };
      spin.current.raf = requestAnimationFrame(step);
    };

    map.on("load", () => {
      placeGlobe();
      setTimeout(startSpin, 2500);
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
      // While spinning, markers follow the globe on their own; re-grouping a few times a second is enough.
      if (spin.current.on) {
        const t = performance.now();
        if (t - spin.current.lastRender < 400) return;
        spin.current.lastRender = t;
      }
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
      stopSpin();
      cancelAnimationFrame(geoRaf);
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
  }, [events, selectedId, me, selectedCity, render]);

  /* camera on select / close */
  const lastSel = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const before = lastSel.current;
    lastSel.current = selectedId;
    // Before the first load the init effect's load handler flies to the selection.
    if (!loaded.current) return;
    if (selectedId) stopSpin();
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

  const compact = typeof window !== "undefined" && window.innerWidth < 768;
  // maplibre sets position:relative on its container, so the sizing lives on a wrapper.
  return (
    <div ref={wrapRef} className={`absolute inset-0 isolate z-0${globe ? " wm-globe" : ""}${compact ? " wm-compact" : ""}`}>
      {globe && <SpaceBackdrop calm={lowPower || reducedMotion} compact={compact} />}
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
