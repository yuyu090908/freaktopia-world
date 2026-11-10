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
