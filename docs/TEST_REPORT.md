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

## 8.0: languages, accounts, alien identity (2026-11-10)

Production build (`npm run build && npm run start`), demo configuration (no `DATABASE_URL`, Google, email or DeepL keys).

| Suite | Result |
|---|---|
| `node scripts/check-i18n.mjs` | 11 translations × 506 keys: 0 missing, 0 extra, 0 empty, 0 placeholder mismatches |
| vitest (unit + integration, with `TEST_DATABASE_URL` on local PostgreSQL 16 + migration 0005) | 177 / 177 passed (the account service runs on both the memory and the Postgres store) |
| `tsc --noEmit` | clean |
| Playwright, full suite (95 tests, 2 workers) | 93 passed, 2 failed. Fixed: `identity.spec` picked the accessory the alien already wore (test bug); `rankings.spec` typed before hydration now that pages render per request (test waits for hydration). Re-run of both specs: 30 / 30 passed |

Required 8.0 checks (`tests/identity.spec.ts` unless noted):

| # | Check | Where |
|---|---|---|
| 1 | Switching through all 12 languages in place, URL prefix swapped | `languages › 1` |
| 2 | Language kept across navigation (prefixed and unprefixed), canonical + hreflang | `languages › 2` |
| 3 | Language kept after login (restored from the profile) | `3/11/12` |
| 4 | Missing keys | `check-i18n.mjs`, `tests/unit/i18n.test.ts`, `languages › 4` |
| 5 | Date and currency formatting, venue time zone | `tests/unit/i18n.test.ts` |
| 6 | Email sign-up | `6/10/13/14` |
| 7 | Google login (demo simulator, labelled) | `7/8` |
| 8 | Logout | `7/8` |
| 9 | Password reset | `9` |
| 10 | First alien generation | `6/10/13/14` |
| 11 | Re-login keeps the same alien | `3/11/12`, `auth-service.test.ts` |
| 12 | No duplicate alien (incl. concurrent calls) | `3/11/12`, `auth-service.test.ts` |
| 13 | Reveal (and reduced motion) | `6/10/13/14`, `reveal respects reduced motion` |
| 14 | Profile | `6/10/13/14` |
| 15 | Map (opt-in, joined events only) | `15` |
| 16 | LIVE | `16` |
| 17 | DAO (avatar, voter badge, no extra power; unverified → 403) | `17`, `dao-api.test.ts` |
| 18 | 375 / 390 / 430 / 768 / 1440 px, CJK / Thai / Cyrillic / Vietnamese fonts loaded, no horizontal scroll | `18.` |

Not measured this round: Lighthouse.

## 8.1: every screen translated, resumable onboarding, Alien ID (2026-11-10)

Production build (`npm run build && npm run start`), demo configuration (no `DATABASE_URL`, Google, email or DeepL keys). Postgres checks run against a local PostgreSQL 16 with migrations 0005 and 0006 applied twice (both are re-runnable).

| Suite | Result |
|---|---|
| `node scripts/find-hardcoded.mjs` | 165 files scanned, **0 hardcoded UI strings**, 2,679 translated call sites, **coverage 100.0 %** |
| `node scripts/check-i18n.mjs` | 11 translations × 2,962 keys: 0 missing, 0 extra, 0 empty, 0 placeholder mismatches |
| vitest (unit + integration, memory and Postgres store) | 187 / 187 passed |
| `tsc --noEmit` | clean |
| Playwright, full suite (104 tests, 2 workers, mobile-390 project with per-test viewports) | 102 / 102 passed on the full run, then the 2 tests added afterwards (switcher keeps URL and camera; account language on another device) and the full `identity.spec` (27 / 27) passed on re-runs |

Fixed during this round: the page rename had also rewritten four API paths in the sign-up/sign-in/reset forms (`/api/auth/…`), which broke sign-up; the connection-status box showed a hardcoded "Email" label (found by the new per-language page test); two English labels changed case through the shared label dictionary ("CANCELLED", "Live Now"), now English always shows the source label.

8.1 checks:

| Check | Where |
|---|---|
| Hardcoded / missing translation detection | `scripts/find-hardcoded.mjs`, `scripts/check-i18n.mjs`, `tests/unit/i18n.test.ts` (ICU with every placeholder and rich tag), `identity.spec › 8.1 per-language pages` (ja, ko, zh-CN, ru, th) |
| Switcher keeps page, URL params, search text, map camera | `identity.spec › 8.1 switching keeps…` |
| Account language wins on another device | `identity.spec › 8.1 a signed-in account's language wins…` |
| Alien ID format `FREAK-00001284`, unique | `tests/unit/identity-8-1.test.ts`, `auth-service.test.ts`, `identity.spec › 8.1 Alien ID` |
| Concurrent first-time generation creates one alien | `auth-service.test.ts` (10 parallel calls, memory and Postgres), `identity.spec › 8.1 Alien ID` (parallel `/api/me`) |
| Onboarding resume, Reveal never shown again | `auth-service.test.ts`, `tests/unit/identity-8-1.test.ts` (`laterStep`), `identity.spec › 8.1 onboarding resumes…` |
| Reveal: capsule, skip, reduced motion | `identity.spec › 6/10/13/14`, `reveal respects reduced motion` |
| Translation cache, labelled results | `tests/unit/identity-8-1.test.ts` |
| LIVE / MAP / DAO use the account alien; no GPS; no extra voting power | `identity.spec › 15`, `16`, `17`, `dao-api.test.ts` |
| 375 / 390 / 430 / 768 / 1440 px, incl. `/login`, `/forgot-password`, `/onboarding`, `/settings` | `identity.spec › 18.` |

Not measured this round: Lighthouse.

## 8.2: event operations, staff matching, equipment sourcing (2026-11-10)

The production build was tested with `npm run build && npm run start`, in demo configuration: no `DATABASE_URL`, so the ops memory store with its DEMO seed is used. The Postgres checks ran against local PostgreSQL 16. A fresh database got migrations 0005, 0006 and 0007, and 0007 was then applied a second time to confirm it can be re-run.

| Suite | Result |
|---|---|
| `node scripts/check-i18n.mjs` | 11 translations × 3,592 keys: 0 missing |
| `node scripts/find-hardcoded.mjs` | 182 files, **0 hardcoded UI strings**, coverage 100.0 % |
| `tsc --noEmit` | clean |
| vitest (unit + integration; memory and Postgres store) | 207 / 207 passed |
| `tests/integration/ops-service.test.ts` | 20 / 20 (10 scenarios × memory and Postgres) |
| `tests/ops.spec.ts` (390 px phone context) | 7 / 7, passed twice in a row against the same server |
| Playwright full suite (111 tests, 2 workers, fresh server) | **111 / 111 passed** (an earlier 4-worker run had 4 timing failures in older specs, which passed when re-run alone, and 2 name collisions in `ops.spec`, which are now fixed with per-run names) |

STEP 5 scenarios and where they are tested:

| Scenario | Playwright (`tests/ops.spec.ts`) | Integration (`ops-service.test.ts`) |
|---|---|---|
| Small event: L1, only small-event items, safety separate from readiness | small event | small event |
| 2,000-person festival: L5, safety items need verified credentials, expert confirmation, approval with confirmation | festival | festival, stale version → 409 |
| Quote request to a sound company (DEMO + real), quote with file, hire with confirmation, provider accepts | quote request | quote → hire → accept, payments, change log |
| DJ application to an open call, compared and hired | DJ application | DJ open call |
| Equipment rental, booking conflict (UI exclusion + API 409 `BOOKING_CONFLICT`) | DJ application… | concurrent double booking: exactly one of two succeeds |
| Staff shortage: warning, incident by staff, licensed-only replacements, contact needs approval | staff shortage | staff shortage + cancellation |
| Budget overrun → cheaper alternatives (safety same-spec only) | DJ application… | budget overrun |
| Out-of-permission access: 404 outsiders, staff see no money, can't recruit, contracts hidden, CSRF 403, 401 | permissions | permissions, cross-event incident reference refused |
| Phone use (390 px, no horizontal scroll on every tab) | every test + phone layout | – |
| Language switching (ja, de on the workspace) | phone layout | – |

Fixed during this round:

- The Operations tab crashed in Chromium. `scrollIntoView` now returns a Promise there, and the chat's effect returned that Promise as its cleanup.
- Staff could not link an incident to the item it affects. The view now has `incidentTargets`, which carry ids and names only. The server rejects references to other events.
- The planner and list grids sized themselves to the template chip row on phones.
- Candidates and alternatives now show the provider's name.

Not measured this round: Lighthouse.

## 9.0: Personal Party Universe (2026-11-10)

### Automated
- **vitest: 224 of 224 pass.** This includes the Postgres run on a fresh database with migrations 0005–0008. `0008_party_universe.sql` was applied twice to confirm it can be re-run.
  - `tests/unit/party-stats.test.ts`, 6 tests:
    - the verified-party rule;
    - the total, unique and returning definitions;
    - Party Impact: no score without enough data, size only 10 %, small and loved beats big and lukewarm, Bayesian satisfaction;
    - growth stages;
    - themes and visit tiers;
    - all anomaly signals.
  - `tests/integration/party-service.test.ts`: the party service on the memory store and on Postgres:
    - an RSVP is not attendance;
    - double scan;
    - team exclusion;
    - manual confirm and revoke with reasons;
    - reviews limited to attendees;
    - media visibility;
    - follow, notify, block;
    - privacy and deletion;
    - the demo world.
- **Playwright: 113 of 113 pass** (2 workers, production build, in-memory demo configuration). The 2 new tests are in `tests/party.spec.ts`; README › Tests lists what they cover.
  - The first full run had 8 failures. A new "Party universes" pill on the WORLD map was smaller than 44 px and pushed the map controls down. I moved it into the map legend, and the affected specs (world, identity, dao, party: 60 tests) then passed. The other 53 tests had already passed in the full run.
- **i18n:** 311 new keys, translated into all 11 languages. `check-i18n`: 3903/3903 keys in every locale. `find-hardcoded`: 0 hardcoded UI strings.
- **TypeScript:** `tsc --noEmit` is clean.

### Screens checked by hand
- At 390 px and 1440 px, in English and Japanese:
  - the demo world in 3D and Lite;
  - a selected planet card;
  - the memories page;
  - the dashboard, impact, community, growth and history sections.
- Screenshots: `docs/screenshots/party-ja-390-3d.png`, `party-ja-390-lite.png`, `party-ja-1440-3d.png`, `party-ja-390-memories.png`.
- WebGL in this container is software-rendered (SwiftShader). Real phones have not been tested, and 3D frame rates were not measured.
- **Lighthouse was not run for the new pages.** No performance score is claimed.
