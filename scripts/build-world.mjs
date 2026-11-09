import { readFileSync, writeFileSync } from "node:fs";
import { feature, mesh } from "topojson-client";
const topo = JSON.parse(readFileSync("node_modules/world-atlas/countries-110m.json", "utf8"));
const land = feature(topo, topo.objects.countries);
const borders = mesh(topo, topo.objects.countries, (a, b) => a !== b);
// Fix rings that cross the antimeridian (Russia, Fiji): clamp to the dominant side.
function fixRing(ring) {
  const jumps = ring.some((p, i) => i && Math.abs(p[0] - ring[i - 1][0]) > 180);
  if (!jumps) return ring;
  const pos = ring.filter((p) => p[0] > 0).length >= ring.length / 2;
  return ring.map(([x, y]) => [pos ? (x < 0 ? 180 : x) : (x > 0 ? -180 : x), y]);
}
function fixGeom(g) {
  if (g.type === "Polygon") g.coordinates = g.coordinates.map(fixRing);
  if (g.type === "MultiPolygon") g.coordinates = g.coordinates.map((poly) => poly.map(fixRing));
}
const round = (c) => Array.isArray(c[0]) ? c.map(round) : [Math.round(c[0]*100)/100, Math.round(c[1]*100)/100];
land.features = land.features.filter((f) => f.properties?.name !== "Antarctica");
for (const f of land.features) fixGeom(f.geometry);
for (const f of land.features) f.geometry.coordinates = round(f.geometry.coordinates);
borders.coordinates = round(borders.coordinates.map(fixRing));
writeFileSync("public/data/countries.geojson", JSON.stringify(land));
writeFileSync("public/data/borders.geojson", JSON.stringify({type:"Feature",properties:{},geometry:borders}));
