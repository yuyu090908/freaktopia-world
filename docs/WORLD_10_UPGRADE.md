# FREAKTOPIA WORLD 10.0: UI/UX and frontend upgrade

10.0 builds on the UI/UX redesign 2026 (`docs/UIUX_REDESIGN_2026.md`). The 10.0 spec overlaps a lot with that work, so I compared the two and implemented **only what was still missing**. I did not add new libraries, and no feature was built just for the UI.

## Technical audit (summary)

- **Framework and routing:** Next.js 15 App Router and React 19. Locales use URL prefixes (`/ja/...`) through middleware.
- **CSS:** Tailwind v4, with tokens in `app/globals.css` (`@theme`) and documented in `docs/DESIGN_SYSTEM.md`.
- **State:** zustand (`useDemo`, the demo store). Server data comes from route handlers under `app/api/*`.
- **Auth:** email/password and a Google demo (`docs/I18N_AUTH_ALIEN.md`).
- **i18n:** next-intl with 12 locales.
- **Tests:** Playwright and vitest.
- **WORLD:** MapLibre GL (WebGL globe).

## A. Problems found (before 10.0)

| Priority | Page | Problem | Cause |
|---|---|---|---|
| P1 | All pages | Slow first paint on phones: lab FCP was 2.1s and LCP 4.5–6.8s | The Japanese, Korean and Chinese font CSS (~90 KB gzipped, hundreds of `@font-face` blocks) was render-blocking **on every page in every language** |
| P1 | WORLD | LCP 6.8s | Nothing but a grey skeleton was drawn until the 1 MB map engine had loaded and run |
| P1 | LIVE | The 1 MB map engine loaded on page open, although the map is far below the fold | The map was imported as soon as the page mounted |
| P1 | RANKINGS | The list appeared only after hydration and a client fetch (RANKINGS LCP render delay 3–4s) | The first page of results was fetched on the client only |
| P1 | EVENTS | Filters were lost on reload, on a shared link and when coming back from an event | Filters lived only in component state |
| P2 | Header | The language, login, search and menu buttons shrank to 40–42px at 320–430px | Flex items were allowed to shrink |
| P2 | Header | The language button's spoken name did not contain its visible text "EN" (WCAG 2.5.3, flagged by Lighthouse) | `aria-label` replaced the visible label |
| P2 | RANKINGS | The List/Map toggle was 40px tall | |
| P2 | Contact | Error messages were English in every language, and focus did not move to the field with the error | Hard-coded strings |
| P2 | Forms | Unsaved input in DJ apply, after party and contact was lost without warning | No leave warning (event create and venue listing already keep a draft) |
| P2 | LIVE | With nothing streaming, the empty state had no link onward | |
| P2 | Menu | Groups did not match how people use the site | Explore / Create / Play / My World |
| P3 | Tokens | Surface, card, border and secondary text differed slightly from the 10.0 values | |

Items the 10.0 spec asks for that **already existed** and were only verified:
- WORLD city bottom sheet (`CityPreview`)
- Hiding events on the far side of the globe, clustering and pinch zoom
- Map/list state in the URL
- LIVE room with the player first, tabs, and a mini player while chatting
- Keyboard-aware bottom nav (`KeyboardWatcher`)
- Event create draft
- One Dashboard Shell

## B. What was implemented

1. **Fonts:** script fonts for ja, ko, zh-CN, th, ru and vi now load on demand for the active language only, after first paint (`components/i18n/LocaleFont.tsx`).
   - Render-blocking CSS went from 6 files to 2 on every page.
   - The CSS font stacks now have fallbacks, so an unloaded font can never invalidate the stack.
2. **WORLD:** the real space backdrop is drawn at once while the globe loads.
3. **LIVE:** the map engine loads only when the map is about to scroll into view (`lib/useNearViewport.ts`).
   - With nothing streaming, the empty state links to upcoming events.
4. **RANKINGS:** the title and art are rendered on the server, and the first page of the list is computed on the server and sent in the HTML.
   - The client fetches again only when the query changes or the user refreshes.
5. **EVENTS:** filters and sort are in the URL (`readEventsUrl` / `writeEventsUrl`). Reload, sharing and the back button keep them.
   - The URL follows typing after 300ms.
   - The count flashes when it changes, and the effect is off with reduced motion. WORLD's count does the same.
6. **Forms:** `useLeaveWarning` asks before leaving with unsaved input (DJ apply, after party, contact). The contact form's errors are translated, and focus moves to the first field with an error.
7. **Header:** all buttons are at least 44×44px. The language button's name starts with its visible text.
8. **Menu:** grouped as DISCOVER / JOIN / CREATE / MANAGE / INFO. Settings is now reachable from the menu. Each page still appears once.
9. **Tokens:** surface `#17121F`, card `#241C2E`, border `#40334E`, secondary text `#C0B8CB`. The FREAK ID card uses the tokens instead of fixed colours.

## C. Changed files

- **Pages:**
  - `app/layout.tsx`
  - `app/events/EventsBrowser.tsx`
  - `app/live/LiveDiscovery.tsx`
  - `app/rankings/page.tsx`
  - `app/rankings/RankingsView.tsx`
  - `app/world/WorldExplorer.tsx`
  - `app/contact/ContactForm.tsx`
  - `app/djs/apply/DJApplyForm.tsx`
  - `app/after-party/new/AfterPartyForm.tsx`
- **Components:**
  - `components/i18n/LocaleFont.tsx` (new)
  - `components/i18n/fonts/*` (new)
  - `components/i18n/LanguageSwitcher.tsx`
  - `components/layout/Header.tsx`
  - `components/layout/nav.ts`
  - `components/auth/AccountButton.tsx`
  - `components/world/SpaceBackdrop.tsx` (`SpaceSky`)
  - `components/profile/FreakIdCard.tsx`
- **Libraries:**
  - `lib/useNearViewport.ts` (new)
  - `lib/useLeaveWarning.ts` (new)
  - `lib/filters.ts`
  - `lib/ranking/query.ts` (`apiParams` moved here)
- **Styles:** `app/globals.css` (tokens, font fallbacks, `count-flash`).
- **i18n:** 7 new keys in all 12 locales.
- **Tests:**
  - `tests/redesign.spec.ts` (+3)
  - `tests/identity.spec.ts`
  - `tests/menu.spec.ts`

## D. Verification

See `docs/TEST_REPORT.md` → "WORLD 10.0".

## E. Performance (lab, before → after)

These were measured with Lighthouse 12.6.1, mobile preset, simulated throttling, on a local production build in a cloud container with software GPU rendering, using the real clock. These are **lab figures, not field Core Web Vitals**. INP cannot be measured in the lab, so TBT is shown. The deployed site could not be reached from the container.

| Page | FCP | LCP | TBT | CLS | Perf |
|---|---|---|---|---|---|
| / | 2.6s → 1.5s | 4.6–4.8s → 3.5–3.7s | 70–290 → 120–250ms | 0 → 0 | 72–80 → 86–88 |
| /events | 2.1s → 1.4s | 4.6s → 3.2–3.3s | 260–280 → 170–270ms | 0 → 0 | 76–77 → 87–91 |
| /world | 2.1s → 1.4s | 6.7–6.8s → 3.5–3.7s | 6.2–8.1s → 7.4–7.5s | 0 → 0 | 40–41 → 55–59 |
| /live | 2.1s → 1.4s | 4.3–4.4s → 2.7–3.2s | 1.1–1.3s → 250–380ms | 0 → 0 | 58–59 → 83–91 |
| /rankings | 2.1s → 1.4s | 4.5–4.6s → 4.2–4.3s | 390–410 → 220–270ms | 0 → 0 | 72 → 80–82 |
| /ja | not measured | 3.3–3.5s | 190–450ms | 0 | 81–88 |

**Not met in this lab run:**
- **LCP target (≤ 2.5s):** missed on every page.
  - The largest remaining part is "render delay": the app's JavaScript runs before the largest element is painted under 4× CPU throttling.
  - With RANKINGS rendered on the server, its largest element is now a text block. Unthrottled it paints at 0.5s, but the simulation still adds the JavaScript before it.
- **WORLD TBT (7s):** this is the WebGL globe running on a software GPU. Real phones have a GPU, but this has not been measured on one.
- **Next improvements:**
  - Split the globe's marker and label building into smaller tasks.
  - Defer the home hero video further.
  - Measure on the deployed site and on real phones (field CWV).

## F. Not connected / not done

- **Services:** no real stream, payment, NFT or chain, email delivery or Google sign-in is connected. The UI says so wherever these appear.
- **Not measured:** the deployed site and real phones. The container's network policy blocks the Vercel host.
- **Mobile header:** the notifications bell is shown from `sm` (≥640px). On phones it is not in the header, because five buttons do not fit next to the logo at 320px. Notifications are in the menu under MANAGE.
- **Search:** WORLD, EVENTS and RANKINGS each keep their own search field. All three are 48–52px with a clear button and URL sync, but they are not yet one shared component.
- **Form submit state:** the demo forms submit synchronously, so there is no "sending" state yet. It should be added when a real backend is connected.
- **Accessibility on LIVE:** map markers on LIVE overlap at world zoom (`target-size`). This is not fixed yet.
- **Dashboard:** "+12% vs previous event" comparisons are not shown, because there is no real previous-event data.

## G. Next candidates (by priority)

1. Field CWV on the deployed site (Vercel Speed Insights or RUM). Then reduce JavaScript before the LCP: split client components on home and events, and move more static content to the server.
2. WORLD: split the globe's main-thread work, and use a lighter first view on low-end phones.
3. A shared SearchBar with suggestions for WORLD, EVENTS and RANKINGS.
4. LIVE map markers: spacing and labels at world zoom.
5. Sending, success and failure states when forms get a real backend.
