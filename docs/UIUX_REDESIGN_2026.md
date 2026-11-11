# UI/UX redesign 2026

This redesign started with an audit of the running app. Each issue it found was fixed where it was caused, not hidden with CSS. The tokens, components and page rules are in `docs/DESIGN_SYSTEM.md`.

## 1. Audit (before)

I audited a local production build (`next build && next start`) at 320, 390 and 1440px. The deployed Vercel site could not be reached from the cloud container because its network policy blocks the host, so **the live site itself was not audited**.

| Check | Result before | Cause | Fix |
|---|---|---|---|
| WORLD and EVENTS show the same count | **No.** WORLD showed 17 and EVENTS showed 18 (EVENTS showed only samples) | WORLD read `/api/map` (samples only). EVENTS read sample data plus community parties. One community party had no coordinates. | `/api/map` now adds published community parties (`source: "community"`). Coordinates fall back to the city centre (`findCity`). Both pages show the total and the breakdown "Community X · Sample Y". An E2E test compares the two counts. |
| LIVE renders | Yes, but a finished event was shown as **LIVE** | `DEMO_NOW` was a fixed date, so status never followed the clock | `lib/clock.ts` and `lib/event-status.ts`: status follows the real time, a finished event is *completed*, and a sample event is only ever "DEMO LIVE". With nothing on, LIVE shows an empty state and no fake streams. |
| RANKINGS renders | A console error: `MISSING_MESSAGE ranking.categoryRanking` | A key was missing in every locale | Added the key in all 12 languages. New `scripts/check-i18n-usage.mjs` checks each `t()` call against its own namespace. |
| Demo data is marked | Partly | | DEMO badges on sample cards and KPIs, "DEMO LIVE", and ticket cards that say "Demo order: not valid for entry", "QR: decorative sample only" and "NFT: not issued (not connected)". |
| Past events shown as upcoming | **Yes** (BASSMUTANT on 9 Nov) | Same frozen clock | Past events are listed apart under "Completed" on EVENTS and are never counted as upcoming. |
| Dead buttons or links | Funding events showed a ticket price and a **buy button that led to a sale that should not exist** | The price and the ticket button did not check the status | Prices and ticket buttons show only while tickets are on sale (`ticketsOnSale`). The tickets page of an event that is not on sale explains why. The crawl found 0 broken links. |
| Mobile overflow or overlap | No sideways scroll. **The map's zoom buttons were covered** by the count row when a filter or region was active. Card title links were 34px tall. Date filter labels were untranslated English. | Map controls sat at a fixed `top: 132px` while the overlay above them grows. Card links covered only the title. | Map controls and the legend are placed under the overlay's measured height (`ResizeObserver`). Card titles are stretched links over the whole card. The date labels are translated. |

## 2. Changes per page

- **All pages:** new colour tokens, type scale (page heading 28/40px, section 22/28px), card radius 16–20px, and button roles (primary, secondary, destructive, text) with one primary per screen. The desktop header has WORLD, EVENTS, LIVE, RANKINGS and DJ, with the active link underlined. The mobile bottom nav is HOME / WORLD / EVENTS / TICKETS / MY.
- **HOME:** order brand → explore → create → featured → cities → DJs and community → how it works. Hero CTAs: EXPLORE EVENTS (primary) and CREATE EVENT (secondary).
- **WORLD:**
  - Search on top, then four quick chips (Live, Upcoming, DJ wanted, Funding).
  - Everything else is in the filter sheet, which says which logic applies: statuses combine with OR, other conditions with AND.
  - Same source and count as EVENTS. Community parties open their organizer's page and show no invented level, price or funding.
  - The zoom controls are never covered.
- **EVENTS:**
  - Title, search, Filters button, chips for the filters in use, count and sort.
  - The filter sheet keeps changes as a draft until Apply (which shows the result count). Clear resets the draft.
  - Card order: image → name → date → city/venue → genres → status → price or support.
  - Completed events are in their own section.
- **Event detail and tickets:** the price and ticket button show only while tickets are on sale. Support shows only while the event is collecting support. DJ apply shows only when DJs are wanted.
- **LIVE:** the heading and kicker say "DEMO LIVE" for the simulation. With nothing on, an empty state says no stream is connected.
- **RANKINGS:** the top 3 stay as panels. From rank 4 the list uses `RankingRow`: one stretched link and a toggle for the details. No new metrics were added.
- **Dashboard:** one `DashboardShell` (WAI-ARIA tabs) for every role. KPIs are `StatCard`s with a unit, "what this counts" and an "as of" time, or DEMO for fixed sample figures. Two columns on phones.
- **Event create:** 5 steps (basics, place and time, size and budget, tickets and recruiting, review and publish). The draft is kept, errors appear inline, past dates are refused, and the review step has a preview. The AI Planner link is kept.
- **Tickets:** `TicketCard` shows name, date, venue, grade, validity, the entry QR and the NFT status as they are: demo, decorative and not connected. Community party passes link to My parties.
- **MY (FREAK ID):** tabs for FREAK ID, Activity and Settings. "Reset all demo data" now asks first in a `ConfirmDialog`.

## 3. New shared components

`StatusBadge`, `SearchBar`, `FilterChips`, `FilterSheet` / `FilterGroup`, `StatCard` / `StatGrid`, `DashboardShell`, `TicketCard`, `RankingRow`, `ConfirmDialog` and `Tabs`. `EventCard` and `EventRow` were rebuilt. The existing `BottomSheet`, `EmptyState`, `ErrorState`, `LoadingSkeleton`, `Field` and the header, bottom nav and menu are reused. See `docs/DESIGN_SYSTEM.md`.

## 4. Mobile

- Widths from 320 to 1440px have no sideways scroll; an E2E test checks this.
- The bottom nav, chips, filter buttons, tabs and the map's region and "clear" buttons are at least 44px. Whole cards are tap targets.
- Body text is 16px on phones and the search field is 52px. Safe areas are padded.

## 5. Tests

See `docs/TEST_REPORT.md` → "UI/UX redesign 2026". In short: vitest 232/232, Playwright 151/152 (one timing-dependent map test under load; it passes on its own), and all 12 locales complete. Lighthouse figures are lab numbers from a local build, not field data, and LCP ≤ 2.5s is not met in that setup.

## 6. Not done yet

- On phones, LIVE discovery is not reworked into player-first tabs (the event live room already puts the player first).
- WORLD's city view is the existing city preview, not a new city bottom sheet.
- The AI Planner is linked from event create, not built into its steps.
- `ConfirmDialog` is used only for the demo-data reset. Other destructive actions keep their inline confirmations.
- The deployed site was not audited or measured, because the container cannot reach it.
- No real stream, payment, NFT or chain is connected. The UI says so wherever these appear.
- Performance targets (LCP ≤ 2.5s, INP ≤ 200ms) are not met in the lab run, and WORLD and LIVE have high TBT from the WebGL map. They have not been measured on production or on real phones.
- LIVE accessibility is 96: map markers overlap at world zoom, and the language button's name does not include its visible text.
