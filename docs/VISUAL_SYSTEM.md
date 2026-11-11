# Visual system & image integration (9.4)

Spec: FREAKTOPIA WORLD GLOBAL VISUAL SYSTEM & IMAGE INTEGRATION (2026-11-11).

## Image registry (`lib/art.ts`)
All official images are static imports, so next/image serves AVIF/WebP with fixed sizes (no CLS) and lazy loads everything except `priority` images.

| Registry | Fields | Contents |
|---|---|---|
| `CITY_ART` | id, names[], city, country, poster (4:5), scene (wide crop), theme, accent, focal, usagePriority | Berlin, Ibiza, Bangkok, Tokyo, Amsterdam, Miami, Rio de Janeiro, Dubai, Cape Town, Sydney |
| `TICKET_ART` | src, label, tier | BASIC, SILVER, GOLD, VIP, LEGEND (top 64% of the art only; the dummy date / QR / ID panel is cropped off) |
| `GENRE_ART` | per-genre panel | existing collage panels |
| `ART` | existing hero / panels / maps | from the 2026-11-09 uploads |

Every image has alt text from the i18n dictionaries; important info (name, price, date, count, buttons) is HTML, never only in the image.

## Assignment rules (no AI, no randomness)
`coverFor(id, hint)`: organizer image → city scene (`cityArt(city)`) → genre panel → stable hash fallback from the event pool. `distinctCovers(list)` swaps covers so neighbouring cards never repeat the same image. Unit tests: `tests/unit/art-rules.test.ts`.

## Where images are used
- **Home:** hero (existing), DISCOVER CITIES (10 city cards: poster, name, theme, upcoming event count, top genres, "see events" → `/world?city=…`; cities without events say so and link to "create event"), EXPLORE cards in mixed sizes (4 wide feature cards), CREATE section with an image.
- **World:** the 3D globe is unchanged. The city preview shows the city's scene image in its header (only for the 10 cities with art).
- **Events:** a large featured card (only without filters), 16:9 cards, no adjacent duplicates.
- **Tickets:** only the kinds the event sells (main → BASIC, after party → SILVER, all night → GOLD, VIP → VIP). Phone: swipe carousel; ≥768 px: grid. The selected grade has a lime border and a "selected" badge. A note says the art is a design sample and the real ticket QR is on the issued ticket page.
- **DJ Arena:** header art changed to the universe panel.

## Image audit
- **Used:** 10 city posters (+ 10 scene crops), 4 ticket designs.
- **Duplicate:** LEGEND was uploaded twice (same bytes); one copy kept.
- **Supplied but unused:** LEGEND ticket (no sample event sells a legend grade; we do not force 5 grades). UI mockup images from 2026-11-09 are reference only.
- **Missing (not created, no invented paths):** city art for New York, Mexico City, Iceland, Egypt, Bali, Las Vegas (the 15-city table had these; Miami and Cape Town were supplied instead); dedicated DJ Arena, Live Festival, Venue Marketplace, After Party and AI Planner images. Existing collage panels are used where they fit, and Venue cards keep their SVG illustration so no illustration looks like a real venue photo.

## Not done
- Small images in the menu tiles.
- Profile / personal world, AI planner and venue page image layouts.
- A full migration of every colour to the spec's tokens (the existing palette is close; new parts use the spec accents).
- Ticket names and perks are English sample data (already so before 9.4).

## Home background video (9.4.1)
- Source: the two official FREAKTOPIA clips (10 s each, 1080p, with audio) from 2026-11-09. They are joined with a 0.6 s cross-fade; the last 2 s of the second clip (a baked-in "FREAKTOPIA WORLD" title card) are cut so the picture never competes with the HTML title. Sound removed.
- Files: `public/video/hero-wide.mp4` (1280×720, H.264, 17.4 s, 3.5 MB, for ≥768 px) and `public/video/hero-tall.mp4` (4:5 centre crop 576×720, 1.6 MB, for phones). Originals were 25 MB each. A VP9 WebM was tried and came out larger, so only MP4 is shipped.
- Poster: the first frame (`assets/art/hero-video-wide.webp` / `-tall.webp`) through next/image with priority, so the first paint and the LCP are an image and nothing jumps when the video starts (fixed 4:5 / 16:9 box).
- `app/HeroVideo.tsx`: not loaded at all for "reduce motion", Data Saver or 2G (poster only); muted, inline, looping; pauses when scrolled out of view or the tab is hidden; a visible pause/play button (translated label, `aria-pressed`). The video is `aria-hidden`; the poster carries the alt text.
- Readability: dark gradient scrims (bottom on phones, left + bottom on wider screens) and a text shadow under the HTML title; buttons stay HTML.
- The illustrated key art that used to be the hero (`hero-wide.webp`, `hero-poster.webp`) is no longer shown on the home page; the files are kept.
- `/video/*` is cached for a day with background revalidation.
