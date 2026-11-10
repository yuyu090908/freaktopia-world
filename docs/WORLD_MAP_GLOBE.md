# WORLD MAP 9.3: neon party planet

/world is the same interactive MapLibre GL globe as before (no new 3D engine and no image instead of the globe), restyled and extended.

## What is on the globe
- **Regions and colours** (`lib/map/regions.ts`): na #00DFFF, sa #FF35AD, eu #A347FF, as #FFD23F, me #FF8A24, af #39FF70, oc #358BFF, an #A6F6FF. The display region (colour, focus) is kept separate from the geographic continent (`REGION_GEO`): the Middle East has its own colour but is still Asia.
- **Geography**: Natural Earth 1:50m admin-0 countries (public domain) built by `scripts/build-map-data.py` into `public/data/world/countries.geojson` and `country-labels.geojson`. Disputed borders follow the Natural Earth default point of view. Country names show only from zoom ≈2.9 and only when remote glyphs are reachable (they are off with `?tiles=off`).
- **Space** (`components/world/SpaceBackdrop.tsx`): nebula, two star layers, two far planets, meteors, a halo that follows the globe, and four FREAKTOPIA aliens (the same DJ aliens as the rest of the site). All `aria-hidden`, no pointer events, never at a real location. Phones show two aliens and no far planets; aliens hide when the globe fills the screen.
- **Party cities** (`lib/map/cities.ts`): at world zoom (z < 2.6) events are drawn as one stage per city at the average of the events' real coordinates. Berlin, Ibiza, Bangkok, New York, Dubai, Rio, Sydney, Tokyo and London have their own stage art; every other city gets a stage in its region colour. Cities that overlap on screen merge into a cluster ("BERLIN +2 · 3 events") that zooms in when tapped. From z 2.6 the existing per-event landmarks take over.
- **Activity**: icon size grows slowly with the number of shown events (capped at ×1.45) and 1–3 rings mark 1, 2 or 3+ events. This is a count, not popularity or quality (the legend says so). Cities with a demo-live event get a slow red pulse. Order inside a city: live, soonest upcoming, featured, then the rest.

## City festival preview
Tap a city (or pick a city in search): PC right panel / phone bottom sheet with upcoming, demo live, DJ wanted, funding, DAO and after-party counts **from the events currently shown** (filters apply), the city's events (tap one to open it), community parties from published party worlds (`/api/party/upcoming`) with a link to the organizer's PERSONAL WORLD, and "See events" (list view filtered to the city). `?city=City|Country` is in the URL.

## Region focus
Filters → Region focus (7 regions) or search a region name (localized or English). Filters the events by country region, turns the globe toward it, and is kept in the URL as `?rg=`.

## Organizer link
WORLD MAP → city → community party → organizer's party world uses existing party worlds (`/u/{handle}/world`), nothing duplicated. Sample festivals show their fictional organizer with "Sample organizer: no party world yet" and no link.

## Performance and fallbacks
- Low-power devices (≤4 cores, ≤2 GB, Save-Data): drawing resolution capped at 1.5×, no meteors or alien animation, no hillshade or pitch. Others: up to 2×.
- Slow auto-rotation only until the first touch, drag, wheel or key, never with reduced motion, and paused when zoomed in.
- Markers on the far side of the globe are hidden (`opacityWhenCovered: 0` + horizon culling).
- No WebGL or `?renderer=lite`: the 2D lite map; `?renderer=flat`: flat map; list view always available.

## Known limits
- The sample data has no events in Dubai, Rio or Sydney, so those stages are drawn only once events exist there.
- Only checked in headless Chromium (SwiftShader) at 390 and 1440 px, not on real phones; no Lighthouse run for this change.
- The community-party list on /api/party/upcoming is capped at 12 parties across all cities.
