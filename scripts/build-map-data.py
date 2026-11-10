"""Build compact world-map layers from Natural Earth (public domain, naturalearthdata.com).

Usage: python3 scripts/build-map-data.py <dir with Natural Earth geojson files>
Writes public/data/world/*.geojson with rounded coordinates and only the properties the map uses.
"""
import json, math, os, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else "/tmp/ne"
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "data", "world")
os.makedirs(OUT, exist_ok=True)


def load(name):
    with open(os.path.join(SRC, name + ".geojson"), encoding="utf-8") as f:
        return json.load(f)


def rnd(coords, p):
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], p), round(coords[1], p)]
    out = [rnd(c, p) for c in coords]
    # drop consecutive duplicates in rings/lines
    if out and isinstance(out[0][0], (int, float)):
        ded = [out[0]]
        for c in out[1:]:
            if c != ded[-1]:
                ded.append(c)
        out = ded
    return out


def simplify_line(pts, tol):
    """Douglas-Peucker on a list of [x, y]."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]
        bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        n = math.hypot(dx, dy) or 1e-12
        best, idx = 0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / n
            if d > best:
                best, idx = d, i
        if best > tol and idx > 0:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]


def simplify_ring(ring, tol):
    """Closed ring: simplify the two halves separately (DP needs distinct endpoints)."""
    if len(ring) < 8:
        return ring
    m = len(ring) // 2
    a = simplify_line(ring[: m + 1], tol)
    b = simplify_line(ring[m:], tol)
    out = a + b[1:]
    return out if len(out) >= 4 else ring


def simp(geom, tol, p):
    t, c = geom["type"], geom["coordinates"]
    if t == "LineString":
        c = simplify_line(c, tol)
    elif t == "MultiLineString":
        c = [x for x in (simplify_line(x, tol) for x in c) if len(x) >= 2]
    elif t == "Polygon":
        c = [x for x in (simplify_ring(x, tol) for x in c) if len(x) >= 4]
    elif t == "MultiPolygon":
        c = [[simplify_ring(r, tol) for r in poly] for poly in c]
        c = [[r for r in poly if len(r) >= 4] for poly in c]
        c = [poly for poly in c if poly]
    return {"type": t, "coordinates": rnd(c, p)} if c else None


def write(name, feats):
    fc = {"type": "FeatureCollection", "features": feats}
    path = os.path.join(OUT, name + ".geojson")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(fc, f, separators=(",", ":"), ensure_ascii=False)
    print(name, len(feats), os.path.getsize(path))


def feats(fc, keep=lambda p: True, props=lambda p: {}, tol=0.0, p=2):
    out = []
    for f in fc["features"]:
        if not f.get("geometry") or not keep(f["properties"]):
            continue
        g = simp(f["geometry"], tol, p) if tol else {"type": f["geometry"]["type"], "coordinates": rnd(f["geometry"]["coordinates"], p)}
        if g:
            out.append({"type": "Feature", "properties": props(f["properties"]), "geometry": g})
    return out


write("land", feats(load("ne_50m_land"), tol=0.02, p=2))
write("borders", feats(load("ne_50m_admin_0_boundary_lines_land"), tol=0.03, p=2))
write("lakes", feats(load("ne_50m_lakes"), keep=lambda q: (q.get("scalerank") or 9) <= 3, tol=0.03, p=2))
write("rivers", feats(load("ne_50m_rivers_lake_centerlines"), keep=lambda q: (q.get("scalerank") or 9) <= 5, tol=0.04, p=2))
write("places", feats(load("ne_50m_populated_places_simple"), keep=lambda q: (q.get("pop_max") or 0) >= 400_000,
                      props=lambda q: {"name": q.get("name"), "country": q.get("adm0name"), "pop": q.get("pop_max"), "capital": 1 if q.get("adm0cap") else 0}, p=3))
write("roads", feats(load("ne_10m_roads"), keep=lambda q: q.get("type") == "Major Highway" and (q.get("scalerank") or 9) <= 6,
                     props=lambda q: {"r": q.get("scalerank")}, tol=0.02, p=2))
write("urban", feats(load("ne_10m_urban_areas"), keep=lambda q: (q.get("area_sqkm") or 0) >= 60, tol=0.01, p=3))


# ---- 9.3 neon globe: countries with a display region, and label points --------------------------------
# Display regions are a design grouping (colours), kept apart from the geographic continent ("geo"):
# the Middle East is drawn in its own colour although it is part of Asia (and Egypt stays in Africa).
# Borders follow Natural Earth's default point of view for disputed areas.
MIDDLE_EAST_EXTRA = {"IRN"}
CAUCASUS = {"GEO", "ARM", "AZE"}
CONTINENT_REGION = {"North America": "na", "South America": "sa", "Europe": "eu", "Africa": "af", "Oceania": "oc", "Antarctica": "an"}
UN_REGION = {"Africa": "af", "Asia": "as", "Americas": "sa", "Europe": "eu", "Oceania": "oc", "Antarctica": "an"}


def display_region(q):
    a3, cont, sub = q.get("ADM0_A3"), q.get("CONTINENT"), q.get("SUBREGION")
    if cont == "Asia":
        if a3 in MIDDLE_EAST_EXTRA or (sub == "Western Asia" and a3 not in CAUCASUS):
            return "me"
        return "as"
    if cont in CONTINENT_REGION:
        return CONTINENT_REGION[cont]
    return UN_REGION.get(q.get("REGION_UN"), "as")  # small island states ("Seven seas")


def geo_continent(q):
    cont = q.get("CONTINENT")
    return cont if cont != "Seven seas (open ocean)" else q.get("REGION_UN")


countries = load("ne_50m_admin_0_countries")
write("countries", feats(countries, props=lambda q: {"r": display_region(q), "a3": q.get("ADM0_A3")}, tol=0.02, p=2))
LANGS = ["en", "ja", "ko", "zh", "ru", "es", "pt", "fr", "de", "vi", "id"]
labels = []
for f in countries["features"]:
    q = f["properties"]
    if (q.get("LABELRANK") or 9) > 6 or q.get("LABEL_X") is None:
        continue
    props = {"r": display_region(q), "geo": geo_continent(q), "rank": q.get("LABELRANK"), "a3": q.get("ADM0_A3")}
    for l in LANGS:
        props["n_" + l] = q.get("NAME_" + l.upper()) or q.get("NAME_EN")
    labels.append({"type": "Feature", "properties": props, "geometry": {"type": "Point", "coordinates": [round(q["LABEL_X"], 2), round(q["LABEL_Y"], 2)]}})
write("country-labels", labels)
