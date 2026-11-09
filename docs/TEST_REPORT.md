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

## Lighthouse (mobile, median of 3 runs)
These were measured in a cloud container with **software GPU rendering (SwiftShader)**. WebGL and heavy-SVG pages score low because of it, and real devices will probably score higher. The numbers have not been verified on a real device.

| Page | Perf | A11y | Best practices | SEO | LCP | CLS |
|---|---|---|---|---|---|---|
| / | 86–89 | 100 | 100 | 100 | 3.0s | 0 |
| /events/void-jelly-rave | 90–93 | 100 | 100 | 100 | 2.9s | 0 |
| /events/…/tickets | 96–97 | 100 | 100 | 100 | 2.6s | 0 |
| /profile | 94–95 | 100 | 100 | 100 | 2.6s | 0 |
| /world (map) | 50–54 | 100 | 100 | 100 | ~5s | 0.004 |
| /avatar | ~67 | 100 | 100 | 100 | 3.1s | 0 |
| /live | ~65 | 100 | 100 | 100 | – | 0 |
| /djs | ~67 | 100 | 100 | 100 | – | 0 |

The **90+ performance target is met on 3 of the 8 pages measured**. On the low-scoring pages, Total Blocking Time is the main cost (1.7–4s), and the traces show it as GPU raster and WebGL tasks.

Next steps:
- Lazy-init the map after first paint.
- Rasterize the large SVG scenes to AVIF.
- Reduce the number of animated aliens.
- Re-measure on a real device.

Screenshots are in `docs/screenshots/` at 390px, plus 1440px for home and world.
