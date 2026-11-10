# FREAKTOPIA WORLD: Phase 1 prototype

> THE WORLD IS YOUR DANCEFLOOR.

This is a mobile-first frontend with an interactive demo for a global party platform. Everything in Phase 1 runs in the browser on demo data. **There are no real payments, NFT minting, wallets, streaming, or AI calls.**

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm run build && npm run start
npm run typecheck
npx playwright install chromium   # first time only (outside this container)
npm test             # vitest: ranking engine unit tests + API integration tests
npm run test:e2e     # Playwright: user flows + WORLD RANKING (375–1440px)
```

Requirements: Node 20 or later.

## Stack
- Next.js 15 (App Router, static generation), React 19, TypeScript, Tailwind CSS v4
- Zustand with `persist` (localStorage key `freaktopia-demo-v1`), React Hook Form with Zod
- MapLibre GL 5 (globe projection). The world map uses bundled Natural Earth GeoJSON (`public/data/world`, built by `scripts/build-map-data.py`), so the geography needs no tile server or API key. Terrain relief comes from AWS Terrain Tiles and street detail from OpenFreeMap (© OpenStreetMap); both are optional and the map still renders if they are unreachable (`NEXT_PUBLIC_MAP_TILES=off` turns OpenFreeMap off).
- Key art (logo, hero posters, illustrated maps, scene panels) is supplied by the FREAKTOPIA team. It is cropped and stored in `assets/art/*.webp`, mapped in `lib/art.ts`, and served through `next/image` (AVIF/WebP, responsive sizes).
- Avatars, LV1–5 stage evolution, venue art and map pins are original inline SVG (`components/art/`, `components/map/markers.ts`).
- The space backdrop (stars and purple smoke) is pure CSS (`body::before` in `app/globals.css`), and cards use the `.neon` outline style.

## Pages
| Route | What it does |
|---|---|
| `/` | Hero, featured events, quick-start strip |
| `/world` | WORLD MAP 7.0: a dark real-geography globe (Natural Earth + terrain relief + city lights) where every festival is a miniature landmark that grows with its level and shows its status in text and icon. Search with suggestions, URL-synced filters, Map/List, desktop side panel, mobile swipe sheet, LIVE / DAO / ranking / tickets / DJ links. See `docs/WORLD_MAP.md` |
| `/world/levels` | Demo admin for the festival growth level thresholds, plus the landmark gallery (all types, levels and statuses) |
| `/events`, `/events/[id]` | Browse and filter events. The detail page shows stage evolution, support, and the level simulator |
| `/events/[id]/tickets` | Ticket selection and **demo** purchase |
| `/events/create` | 7-step event wizard. The draft autosaves |
| `/tickets`, `/tickets/[orderId]` | My tickets and the demo QR pass |
| `/djs`, `/djs/[id]`, `/djs/[id]/audition`, `/djs/apply` | DJ Arena: profiles, auditions (vote, like, comment), and applications |
| `/venues`, `/venues/[id]`, `/venues/new`, `/venues/planner` | Venue market, listing wizard, and planner |
| `/after-party`, `/after-party/[id]`, `/after-party/new` | After parties linked to a main event |
| `/rankings`, `/rankings/compare` | WORLD RANKING: 8 public categories plus FOR YOU, search, URL-synced filters, TOP 3, map view, compare and follow. See `docs/WORLD_RANKING.md` |
| `/dao`, `/dao/[eventId]` + `/discussion`, `/proposals`, `/proposals/[proposalId]`, `/votes`, `/stage-designer`, `/gallery`, `/treasury`, `/roadmap`, `/members`, `/settings` | FESTIVAL DAO: stake-to-join event DAOs, discussion, proposal lifecycle, one-account-one-vote voting, AI Stage Designer, treasury, build game. **Demo: no blockchain or payment connected.** See `docs/FESTIVAL_DAO.md` |
| `/alerts` | In-app alerts for followed events, with per-type settings |
| `/live` | LIVE discovery: featured festival with honest status (no real stream is connected, so the demo shows as **DEMO LIVE**), category chips, search, sort and the live world map. See `docs/LIVE_FESTIVAL.md` |
| `/live/[eventId]` | Festival room with tabs Watch / Map / Schedule / Community / More: demo DJ player, isometric 10-zone festival map with avatars, timetable in venue or your time zone, chat, reactions, energy game, quests, door check-in demo, after party portal, DAO and ranking. **Demo: no stream, payment or door system connected.** |
| `/avatar` | Alien builder playground (signed-in users are told their account alien is their identity) |
| `/signup`, `/login`, `/forgot-password`, `/verify-email` | Accounts: email + password, email confirmation, password reset, Google. **Demo without keys:** `/auth/mailbox` shows the emails and `/auth/google-demo` simulates Google. The 8.0 `/auth/*` URLs redirect here. See `docs/I18N_AUTH_ALIEN.md` |
| `/onboarding` | Resumable onboarding: capsule Reveal (name, family, Alien ID `FREAK-00001284`) → display name → favourite genres → ENTER WORLD. The Reveal is shown once |
| `/settings`, `/profile/alien` | Profile, privacy (public / friends / private, map presence, LIVE avatar), sign-in methods, wallet linking; alien outfit and accessories (no reroll) |
| `/profile` | Profile, XP and level, history |
| `/dashboard?role=` | Fan, organizer, DJ and venue dashboards |
| `/quests`, `/nft` | Game quests and the collectibles preview (concept only, no minting) |
| `/about`, `/how-it-works`, `/help`, `/contact`, `/terms`, `/privacy` | Info pages |

## Demo vs. production
- Every demo-only action is marked with a **DEMO** badge or notice.
- All state is stored in the visitor's localStorage. The profile page has a reset button that clears it.
- Data source: `lib/data.ts`, with 12 DJs, 10 venues, 18 events and 5 after parties. The demo "today" date is 2026-11-09.

### Not implemented (production work)
- Payments: Stripe or Stripe Connect for tickets, venue booking, and crowdfunding escrow
- Real Google OAuth credentials, an email provider and a Postgres database for accounts (code is ready; see the environment table below)
- Live streaming and audition audio or video
- Wallets and NFT minting (collectibles exist as UI only). The FESTIVAL DAO uses a throwaway demo wallet that only signs in; staking is a demo ledger
- Production data for the world map (`MAP_DATA_MODE=production` returns 503 until `db/migrations/0004_world_map.sql` is wired up) and a server-side admin for the level rules
- Production realtime transport for the live room (the demo polls an in-memory API; see `docs/LIVE_FESTIVAL.md`), real stream provider (Mux or LiveKit) and door-staff accounts
- AI features (recommendations, matching)
- Translating server-generated DAO notification and next-step texts (the UI itself is 100 % translated; see `docs/I18N_AUTH_ALIEN.md`, Coverage)
- A public profile page and a friends system (privacy choices are stored for them)
- Moderation, reporting, notifications, email

## 8.0: 12 languages, accounts, alien identity
- Languages: `en` (fallback), `ja`, `ko`, `zh-CN`, `ru`, `th`, `es`, `pt`, `fr`, `de`, `vi`, `id`. URLs `/{locale}/…`; unprefixed URLs still work. `node scripts/check-i18n.mjs` reports missing keys.
- Accounts: email sign-up with confirmation, sign-in, reset, Google, logout, wallet linking to an existing account. scrypt passwords, hashed session tokens, CSRF and rate limits, no account enumeration, audit log.
- One permanent alien per confirmed account (SLIME / FUZZ / MUTANT / JELLY), shown on WORLD MAP (opt-in, at the event landmark only), in LIVE and in the DAO. Avatars never add voting power.

| Environment variable | Without it |
|---|---|
| `DATABASE_URL` (+ `db/migrations/0005_identity_i18n.sql`, `0006_identity_onboarding.sql`) | In-memory **DEMO** store, demo mailbox and Google simulator |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in is simulated (demo) or reported as not configured (production) |
| `RESEND_API_KEY`, `MAIL_FROM` | Emails go to the demo mailbox (demo) or sign-up reports email isn't configured (production) |
| `DEEPL_API_KEY` | "See translation" says translation isn't connected |
| `APP_URL` | Base URL for email links and the OAuth redirect |

Full details: `docs/I18N_AUTH_ALIEN.md`.

## 8.1: every screen translated, resumable onboarding, Alien ID
- All UI text in `app/` and `components/` uses translation keys: 2,962 keys × 12 languages. `node scripts/find-hardcoded.mjs` finds hardcoded UI strings (`--list`, `--json`, `--strict` for CI); current result 0 hardcoded, 100 % coverage. `node scripts/check-i18n.mjs` finds missing keys.
- The language switcher keeps the page, URL filters, search text and the map camera; a signed-in account's language wins on any device.
- New URLs `/signup`, `/login`, `/forgot-password`, `/verify-email`, `/onboarding`, `/profile`, `/settings` (old ones redirect with 308).
- Onboarding signup → verify → alien → Reveal → name → genres → ENTER WORLD, stored on the server so it resumes anywhere; the Reveal never plays twice.
- Alien ID `FREAK-00001284` (server sequence, unique, permanent). Alien generation stays server-side, CSPRNG, once per user, idempotent under concurrency.
- Machine translation of user content is cached and always labelled; without `DEEPL_API_KEY` nothing is presented as translated.
- `db/migrations/0006_identity_onboarding.sql`: additive and re-runnable (public ids back-filled, onboarding progress, translation cache, RLS).

## 8.2: event operations, staff matching, equipment sourcing
- Plan an event at `/events/manage/new`. Size levels L1–L6 come from attendance and can be overridden. A **rule-based** planner suggests requirements and is labelled as a suggestion; no AI model is connected.
- The event workspace `/events/manage/[id]` has Overview, Planning, Resources, Operations, Budget and Safety. On desktop they are a side navigation; on phones they are tabs. Each person sees only what their role and the event size allow.
- Matching scores candidates on 8 criteria and applies hard exclusions, such as unavailable, fully booked, or an unverified credential for safety jobs. Recruiting supports open calls, direct offers, quote requests and packages; you compare applications before hiring.
- Contracts, bookings, payment records and safety approvals all need an explicit confirmation and are logged. Double booking is blocked on the server.
- Work profiles live at `/profile/work`: one profile per account for every role (DJ, crew, gear owner, company), with listings, opportunities and your jobs. Reviews come only from completed agreements and are separate from rankings.
- `/djs/[id]` adds "Offer a gig from a managed event" to the existing booking sheet.
- `db/migrations/0007_event_ops.sql` adds 22 `ops_*` tables. It is additive and re-runnable.
- **Payments (Phase 4) are not built.** "Paid" is a record only. Identity and business KYC are not connected.
- Details are in `docs/EVENT_OPS.md`.

## 9.0: Personal Party Universe
- Every account can grow an organizer **party world** at `/u/[FREAK-…]/world`, linked from the public profile `/u/[FREAK-…]` and from `/profile`. It has a 3D view (three.js, loaded on demand) and a Lite SVG view, chosen automatically and switchable.
- **Attendance** is RSVP → QR pass → door check-in (`/events/manage/[id]?tab=door`, camera scan or code entry).
  - RSVPs never count, and a second scan never counts twice.
  - Manual confirm and revoke need a reason and are audited.
  - A party is verified only after it ends, with at least 3 QR check-ins from people outside the team.
- **Dashboard and growth:** the dashboard (events, attendance, unique, returning, rating, guests kept separate), Party Impact (an estimate, size only 10 %, "not enough data" below the minimum) and growth stages 0–5 use verified parties only.
- **Memories** at `/u/[FREAK-…]/world/[eventId]`: reviews from checked-in people only; official and attendee media are separate, and authors control visibility and deletion.
- **Follow, privacy and admin:**
  - Follow with a single new-party note, mute and block. There are no DMs.
  - Privacy is opt-in, and a person can delete their party data at `/profile/parties`.
  - The admin anomaly view is at `/world/audit`.
- `db/migrations/0008_party_universe.sql` adds 10 `ops_*` tables. It is additive and re-runnable.
- **9.1 additions:**
  - Free tickets: a capacity per party, then a waitlist with no pass. A cancel or a higher capacity promotes the next person, who gets an in-app note.
  - Recording links (YouTube, SoundCloud, Mixcloud, Vimeo, Twitch; https only) per party. They are links only, never embedded or generated.
  - Highlights: up to 6 photos or videos picked by the organizer from media that is already public. Nothing is AI-generated.
  - Opt-in email for new parties through the existing mail pipeline (Resend when configured, the demo mailbox in demo mode).
  - Door scanning works without `BarcodeDetector` (iPhone Safari, Firefox) through jsQR.
  - `db/migrations/0009_party_tickets.sql` adds `ops_party_settings` and the `waitlist` status. It is additive and re-runnable.
- **Not built:** paid tickets or payments, AI highlights, and push notifications.
- Details are in `docs/PARTY_UNIVERSE.md`.

## 9.2: Mobile menu ("cosmic control panel")
- The menu (☰ in the header) is redesigned. It has no new pages and no new routes, and every existing page is still in it.
- **Quick access, 2×2:** World, Events, Create event (the one pink action panel) and My World.
- **Five panels, one column on phones and two from 768 px:**
  - EXPLORE (lime)
  - CREATE (pink)
  - PLAY (cyan)
  - MY WORLD (purple): my world, tickets, dashboard, alerts
  - INFORMATION (orange)
  - Terms and privacy are small links at the bottom.
- **Panel style:** each panel has a coloured heading with an icon and a left rail. Rows have white text, a coloured icon and a chevron. The current page gets an accent border and a soft glow. A row shrinks slightly when pressed.
- **Status labels:**
  - Demo and preview pages carry a small badge (planner: demo; quests and NFT: preview).
  - "My World" opens the person's own party world when signed in. Signed out, it goes to My parties, which asks to sign in, and the row says so.
- **Opening and closing:**
  - The sheet slides in and out (about 200 ms, instant with reduced motion) over a dimmed backdrop.
  - It closes by the close button, a backdrop tap or Escape.
  - Focus moves to the close button and returns to the menu button.
  - The page behind can't scroll, and the menu scrolls on its own. Safe areas are respected.
- **Unchanged:** the desktop header and bottom tab bar. The closing slide applies to every bottom sheet on the site.
- `tests/menu.spec.ts`, 10 tests:
  - groups, quick access and the current page;
  - every link returns 200, and each page appears once;
  - WCAG AA contrast of rows and headings;
  - close by button, backdrop and Escape, with focus return, scroll lock, menu-only scrolling, and a link that navigates;
  - no cut labels, no sideways scroll and 44 px targets in en/ja/de/th/ru at 320, 375, 390, 430, 768 and 1440 px;
  - a signed-in My World that opens the person's own world.

## Backend plan (Phase 2)
1. **Auth and DB:** Supabase (Postgres, Auth, RLS) or Postgres with Auth.js. Replace `lib/data.ts` getters with server queries. Keep the same types as in `lib/types.ts`.
2. **Store migration:** Move the Zustand actions (`supportEvent`, `publishEvent`, `addOrder`, `addApplication`…) into Server Actions or API routes. Keep Zustand for UI state only.
3. **Payments:** Stripe Checkout for tickets. Hold crowdfunding through Stripe Connect with manual capture or escrow, and release it once the event level is reached. Handle state changes through webhooks.
4. **Levels:** Compute supporters and funding server-side (`lib/levels.ts` thresholds) and push updates through Supabase Realtime.
5. **Live map:** Opt-in presence per zone through a Realtime channel with short TTL. Store no raw GPS.
6. **Media:** Object storage plus CDN for venue photos and DJ mixes. Streaming through a managed provider such as Mux or LiveKit.
7. **Web3 (optional):** Collectibles as an opt-in layer with a custodial-wallet option. The core needs no web3.

## Tests
- `tests/flows.spec.ts`: 13 Playwright flows. All pass.
- `tests/rankings.spec.ts`: 12 Playwright tests for WORLD RANKING. All pass.
- `tests/dao.spec.ts`: 12 Playwright tests for the FESTIVAL DAO (join, post, upload, propose, vote, double vote, compare, integrations, 375–1440 px). All pass.
- `tests/live.spec.ts`: 21 Playwright tests for the LIVE FESTIVAL (15 flows, upcoming-event check, 375–1440 px layout and tap targets).
- `tests/world.spec.ts`: 19 Playwright tests for the WORLD MAP 7.0 (search, filters + URL, Map/List, LIVE, DAO, ranking, mobile sheet, camera, clusters, lite renderer, level admin, 375–1440 px).
- `tests/identity.spec.ts`: 27 Playwright tests for 8.0/8.1 (12-language switching, switcher keeps URL params and map camera, account language on another device, SEO alternates, missing keys, per-language page check, sign-up, Google demo, logout, reset, Reveal, Alien ID, onboarding resume, same alien after re-login, map/LIVE/DAO identity, 375–1440 px with CJK/Thai/Cyrillic/Vietnamese fonts).
- `tests/ops.spec.ts`: 7 Playwright flows for event operations at 390 px: small event, 2,000-person festival, quote request to a sound company, DJ application + equipment rental + double booking + budget overrun, staff shortage, permissions, and phone layout + language switching. `tests/integration/ops-service.test.ts` runs the same service on the memory and the Postgres store (10 scenarios each).
- `tests/party.spec.ts`: 3 Playwright flows for the party universe. The first is the demo world: Lite planet links aligned with the drawing, tap to select then open, memories, back to the world, 3D canvas, and Japanese. The second is a full door flow: publish, follow, RSVP and QR pass at 390 px, RSVPs not counted, scan, duplicate, unknown code, manual confirm with a required reason, review, attendee photo upload with only-me visibility and deletion, team cannot review, the follower notified of the next party, privacy switch, delete my data, and desktop world and profile. The third covers capacity 1: a second person is waitlisted with no pass code, the first cancels and the second is promoted with a pass and a note; it also covers a recording link and a highlight on the memories page, a refused bad link, and the email opt-in arriving in the demo mailbox. `tests/unit/party-qr.test.ts` renders a pass and decodes it with jsQR. `tests/integration/party-service.test.ts` runs the party service on memory and Postgres, and `tests/unit/party-stats.test.ts` covers definitions, Party Impact, growth, tiers and anomalies.
- `tests/unit` and `tests/integration`: i18n dictionaries and formatting, alien generation, the account service (memory and Postgres), vitest tests for the world map (growth levels, landmarks, search, URL state, `/api/map`), the ranking engine, ranking API, DAO domain logic, DAO API, live domain logic (time zones, energy, quests, check-in) and live API.
- See `docs/TEST_REPORT.md` for screenshots and Lighthouse results.
