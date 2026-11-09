# Test report (2026-11-09)

## Playwright
13 of 13 user flows pass on the mobile 390px project:
- home → world → pin → sheet → event
- map filters
- support and simulator level-up
- demo ticket purchase
- 7-step event creation with a persisted draft
- avatar → profile
- DJ application → organizer dashboard
- audition vote, like and comment
- live consent and zone move
- venue listing
- after party linked to its event
- header search
- sticky CTA and ≥44px tap targets

## Crawl
I crawled 99 pages at 375, 390, 430, 768 and 1440px. Results: 0 broken links, 0 horizontal overflow, 0 console errors.

## Lighthouse (mobile), after the key-art redesign (two runs per page)
These were measured in a cloud container with **software GPU rendering (SwiftShader)**. Scores vary by about ±8 between runs, and real devices have not been tested.

| Page | Perf | A11y | Best practices | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| / | 85–93 | 100 | 100 | 100 | 3.0–3.7s | 140–230ms | 0 |
| /events | 80–92 | 100 | 100 | 100 | 3.3–4.5s | 90–230ms | 0 |
| /events/void-jelly-rave | 89–91 | 100 | 100 | 100 | 3.2–3.5s | 180ms | 0 |
| /events/…/tickets | 96 | 100 | 100 | 100 | 2.8s | 70–80ms | 0 |
| /world (map) | 71–72 | 100 | 100 | 100 | 2.6–2.8s | ~1.3s | 0 |
| /djs | 87–91 | 100 | 100 | 100 | 3.3–3.9s | 110–140ms | 0 |
| /live | 93–94 | 100 | 100 | 100 | 3.0s | 90–130ms | 0 |
| /avatar | 93–96 | 100 | 100 | 100 | 2.8–3.2s | 60–80ms | 0 |
| /profile | 96 | 100 | 100 | 100 | 2.7s | 60–80ms | 0 |
| /venues | 87–95 | 98* | 100 | 100 | 2.8–3.9s | 90–120ms | 0 |

\* After the measurement I fixed the /venues heading-order issue that cost 2 points. That page has not been re-measured.

/world stays below 90. Its Total Blocking Time comes from WebGL running on the software GPU.

Screenshots are in `docs/screenshots/` at 390px, plus 1440px for home and world.
