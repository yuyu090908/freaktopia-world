# FREAKTOPIA WORLD 7.0 · WORLD MAP

"THE PLANET IS ONE GIANT FESTIVAL." `/world` is a dark, real-geography globe where every festival is a miniature venue that grows with its level.

Status: **demo**. Events, rankings, DAO and LIVE numbers are sample data from the existing demo APIs. `MAP_DATA_MODE=production` returns `503 DATA_SOURCE_NOT_CONFIGURED` instead of demo data.

## Art direction

| Token | Value | Used for |
|---|---|---|
| Deep Space | `#070A12` | Sky behind the globe, page background |
| Ocean | `#0A1727` | Sea (terrain relief shows the sea floor) |
| Land | `#18232C` → `#1D2A35` by zoom | Land fill |
| Surface | `#171B25` / `#0D121B` | Panels, sheet, chips |
| Text | `#F5F2EA` | Text |
| Acid / Purple / Coral / Cyan | `#B6F05C` / `#A276E9` / `#FF625C` / `#55BCEB` | Festivals only: landmarks, auras, status |

Geography stays quiet: coastlines, dashed borders, lakes, rivers, urban areas, major roads and warm city lights. Only festivals and aliens are vivid.

## Map engine

MapLibre GL 5 (already a dependency; no new map library and no Three.js).

| Layer | Source | Licence |
|---|---|---|
| Land, borders, lakes, rivers, populated places, urban areas, roads | Natural Earth 1:50m / 1:10m, simplified by `scripts/build-map-data.py` into `public/data/world/*.geojson` | Public domain |
| Terrain relief (hillshade, land and sea floor) | AWS Terrain Tiles (terrarium) | Open data (Mapzen, SRTM, GMTED, ETOPO1). Attributed in the map |
| Street roads, road names, place labels, 3D buildings (z ≥ 7 / 13 / 14) | OpenFreeMap vector tiles | © OpenStreetMap contributors (ODbL), attributed. Optional: `NEXT_PUBLIC_MAP_TILES=off` or `?tiles=off` |

Remote sources are optional. If a host is unreachable the local geography still renders and errors stay out of the console. Roads and urban areas (2.3 MB) load lazily the first time the map passes zoom 3.

Renderers:

- **rich** (default on capable devices): globe projection, atmosphere, hillshade, perspective tilt, landmark animation
- **flat** (low-power devices: ≤ 4 cores, ≤ 2 GB memory or data saver): Mercator, no relief, no animation
- **lite** (no WebGL): an SVG map of the real Natural Earth coastlines with the same landmarks as buttons

You can force a renderer with `?renderer=rich|flat|lite`.

### Camera

- Start: the whole globe (Europe/Africa centred).
- Select a festival: fly to it with pitch and an offset, so it sits clear of the panel or sheet.
- Close: fly back to the view before selecting.
- Search suggestion: fly to the festival, or fit all matching festivals for a city, country, DJ, genre or venue.
- Filter change with up to 8 results: fit them.
- A deep link (`?event=`) starts at the world, then flies in.
- `prefers-reduced-motion` turns flights into jumps. The user can always drag, pinch, scroll or use the keyboard (arrows and +/−).

## Festival landmarks

All art is original SVG (`lib/map/landmarks.ts`). It uses thick outlines and FREAKTOPIA aliens with stalk eyes. One function builds every variant, so the map, list, panel and gallery share the same art.

| Genre | Landmark |
|---|---|
| Techno, Hardcore | Monster Stage (jaw arch with teeth and eyes) |
| House, Disco | Psychedelic Tent |
| Afro House, Amapiano | Cosmic Portal |
| Drum & Bass, Garage, Footwork, Hip-Hop | Giant Speaker Towers |
| Psytrance, Ambient | Alien Sculpture |
| Other | Neon Festival Gate |

| Level | Visual |
|---|---|
| 1 SEED | Small booth, DJ alien |
| 2 GATHERING | Speakers and bunting flags |
| 3 RAVE | Bigger stage and a crowd |
| 4 MEGA FEST | Giant alien behind the stage and a second-area tent |
| 5 FREAKTOPIA LEGEND | Halo arch and a bigger giant alien, with its own glow |

| Status | Overlay | Label |
|---|---|---|
| PLANNING | Scaffold, crane and crate over a faded booth | ✎ PLANNING |
| FUNDING | Glowing support ring plus a funding gauge | ◎ FUNDING 28% |
| CONFIRMED | Finished venue | ✓ CONFIRMED |
| LIVE | Light beams, a dancing crowd and a ping ring (demo events say DEMO LIVE) | ● DEMO LIVE |
| COMPLETED | Gold commemorative obelisk; colours muted | ★ COMPLETED |
| CANCELLED | Red-and-black tape cross; greyscale | ✕ CANCELLED |

Status is never shown by colour alone: each landmark has a chip with an icon and text, and its accessible name spells out level, status, rank and DAO. The cancelled state is supported in the map and the database; no sample event is cancelled, so you can see it in the gallery at `/world/levels`.

### Level of detail

| Zoom | Shown |
|---|---|
| < 2.6 | Small landmarks. Nearby festivals merge into an orb with a "+n" badge; tapping it zooms to fit them |
| 2.6–4.6 | Medium landmarks with a status chip. Grouping uses a larger radius |
| ≥ 4.6 | Full landmarks with names and animation. Nothing is grouped; festivals on the same spot fan out |

Markers are viewport-culled (and hidden on the far side of the globe). They are pooled by key and only re-drawn when their signature changes (level, status, rank, tier, selection). Animations are CSS only and run only at full detail or on the selected landmark. They are off in low-power mode and under reduced motion. `map.remove()` releases the WebGL context on unmount.

## Festival level (game level, not capacity)

`lib/map/growth.ts`. An event reaches a level when every requirement of that level is met:

| Level | Supporters | Secured funding | Staking participants | Venue contract | Approved prep items |
|---|---|---|---|---|---|
| 1 SEED | 0 | $0 | 0 | – | 0 |
| 2 GATHERING | 150 | $3,000 | 0 | – | 0 |
| 3 RAVE | 600 | $15,000 | 0 | required | 0 |
| 4 MEGA FEST | 2,500 | $60,000 | 10 | required | 1 |
| 5 FREAKTOPIA LEGEND | 9,000 | $220,000 | 20 | required | 2 |

- Staking counts **people**; the staked tokens are escrowed and never counted as funding.
- The level never implies more capacity. The panel says "A map game level, not venue capacity."
- The site's existing support level (`lib/levels.ts`, LV badges on event pages) is unchanged.
- Thresholds are data. Admins edit them at `/world/levels`. In the demo, edits are stored in the browser (zustand `mapGrowthConfig`); in production they go in `event_growth_levels`, versioned, admin-only, audited. Invalid edits (lower than the level below) are flagged and normalized.

## Interaction

- **Desktop (≥ 1024 px):** a 400 px right panel keeps the map visible. It shows the header (artwork with landmark, status, level, city, date, genres), key numbers, scrollable details and the actions.
- **Phone:** a bottom sheet. The peek state shows artwork, status, level, name, city/date, three key numbers and the main action. Swipe up or tap the handle or "More" to expand it; swipe down to collapse or close. Closing shows the whole map and returns the camera.
- **Details:** festival level with each requirement, supporters, confirmed funding, staking participants (separate from funding), tickets, DJ recruitment, after party, landmark (and whether its colours come from a DAO-approved stage design), DAO card, ranking card.
- **Actions by status:**

| Status | Actions |
|---|---|
| Live | ENTER FESTIVAL (DEMO LIVE) → `/live/[id]` (it says WATCH LIVE only for a real licensed stream), Buy ticket, View DAO, View event |
| Planning / Funding | Support event, View DAO, Apply as DJ, View event |
| Confirmed | Buy ticket (when tickets remain), View DAO, Apply as DJ, View event |
| Completed | View event |

Events that haven't started never get WATCH LIVE.

## LIVE, DAO, ranking

- **LIVE:** current DJ, stream state ("demo visualizer, no licensed stream is connected"), online viewers, checked-in guests and public avatars as separate tiles, with the note that they are never added together. Data comes from the 6.0 live API (`discoveryEvents`).
- **DAO:** status, members, staking participants, escrowed tokens, active proposals, open votes and the current vote. Purple community banners grow with members (tier 1–3); the panel says they are decoration, not progress. If a DAO stage design won its vote and was confirmed (`approvedStageDesign`), its palette recolours the landmark. BASSMUTANT's design proposal was rejected, so it keeps the default look.
- **Ranking:** TOP 1–3 of Most popular (all time) get crowns and a TOP badge. The top 3 Trending (7 days, with new supporters) get a ▲ TRENDING tag. The panel shows rank, category, period and update time, and links to `/rankings`.

## Discovery

- **Search** (city, country, festival, DJ, genre, venue) with grouped suggestions and keyboard navigation. Picking one flies to it.
- **Quick chips:** Live now, Upcoming, Confirmed, Funding, DJ wanted, DAO active, After party, Completed. The filter sheet adds festival level, date and genre. Filters combine with AND.
- **Completed** events are shown with the Completed filter or when searching.
- **URL:** `q`, `f` (flags), `lv`, `g`, `date`, `view=list`, `event`. Sharing a link restores the view.
- **Map/List** toggle at the bottom. Picking an item in the list returns to the map with that festival selected.
- **Controls** (right side, 44 px): zoom in, zoom out, reset to the whole world, legend, and My Location. My Location appears only if the browser already granted location permission; it is never requested on load, never stored and never counts as attendance.

## API

`GET /api/map` (`lib/map/api.ts`) returns one composed record per event (`MapEventDto`):

`id, name, city, country, venue, location {lat, lng, precision exact|city}, startsAt, endsAt, genres, lineup, palette, status, growth {supporters, stakers, fundingUsd, venueContract, approvals}, goalUsd, level, landmark {type, theme, approvedDesign}, ranking {rank, badge, period, trendingRank, asOf}, dao {…, staked, tier}, live {status, currentDj, onlineViewers, checkedIn, publicAvatars, demo}, tickets, djRecruiting, afterParty, updatedAt, isDemo`

Funding-stage events use the city centre (`precision: "city"`, shown as "approx.") until a venue is confirmed.

## Database

`db/migrations/0004_world_map.sql` (PostgreSQL 15+). Applied and checked on PostgreSQL 16:

- `event_locations` (lat/lng range checks, precision, ISO country)
- `event_map_status` (a cancellation needs a reason; a demo row can never be `live`)
- `event_growth_levels` (versioned; one active version; level 1 is free; thresholds can't decrease, enforced by a deferred trigger) plus `event_growth_level_audit`
- `event_map_visuals` (growth inputs in separate columns, so staking is never funding; a DAO theme requires an approved concept)
- `event_landmark_assets` (format, size, licence, author)
- `event_map_preferences` (no location column)
- view `world_map_events` (production rows only)

## Files

- `lib/map/`: `growth.ts`, `landmarks.ts`, `types.ts`, `view.ts`, `api.ts`
- `app/api/map/route.ts`, `app/world/WorldExplorer.tsx`, `app/world/levels/*`
- `components/world/`: `FestivalWorldMap.tsx`, `LiteWorldMap.tsx`, `EventPanel.tsx`
- `public/data/world/*.geojson`, `scripts/build-map-data.py`
- Tests: `tests/unit/world-map.test.ts`, `tests/integration/map-api.test.ts`, `tests/world.spec.ts`
- Screenshots: `docs/screenshots/world7/`

The old `components/map/WorldMap.tsx` stays in use for `/live` and `/rankings` map views.

## Not implemented

- Production data source and admin auth for the level rules (demo edits stay in the browser).
- Sprite atlas / WebP export of the landmarks (they are inline SVG strings today, about 2–8 KB each, generated on demand and cached per marker).
- 3D (glTF) landmarks. Buildings are 3D only where OpenStreetMap has them, at zoom 14 and above.
- Realtime map updates (the page loads `/api/map` once; LIVE numbers refresh on reload).
- Lighthouse was not measured for this release.
