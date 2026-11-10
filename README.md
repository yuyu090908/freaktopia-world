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
| `/auth/signup`, `/auth/signin`, `/auth/verify`, `/auth/reset` | 8.0 accounts: email + password, email confirmation, password reset, Google. **Demo without keys:** `/auth/mailbox` shows the emails and `/auth/google-demo` simulates Google. See `docs/I18N_AUTH_ALIEN.md` |
| `/welcome` | Alien Reveal after the first confirmed sign-in, then display name |
| `/profile/settings`, `/profile/alien` | Profile, privacy (public / friends / private, map presence, LIVE avatar), sign-in methods, wallet linking; alien outfit and accessories (no reroll) |
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
- Moving the remaining English-first page bodies into the 12-language dictionaries (see `docs/I18N_AUTH_ALIEN.md`, Coverage)
- Moderation, reporting, notifications, email

## 8.0: 12 languages, accounts, alien identity
- Languages: `en` (fallback), `ja`, `ko`, `zh-CN`, `ru`, `th`, `es`, `pt`, `fr`, `de`, `vi`, `id`. URLs `/{locale}/…`; unprefixed URLs still work. `node scripts/check-i18n.mjs` reports missing keys.
- Accounts: email sign-up with confirmation, sign-in, reset, Google, logout, wallet linking to an existing account. scrypt passwords, hashed session tokens, CSRF and rate limits, no account enumeration, audit log.
- One permanent alien per confirmed account (SLIME / FUZZ / MUTANT / JELLY), shown on WORLD MAP (opt-in, at the event landmark only), in LIVE and in the DAO. Avatars never add voting power.

| Environment variable | Without it |
|---|---|
| `DATABASE_URL` (+ `db/migrations/0005_identity_i18n.sql`) | In-memory **DEMO** store, demo mailbox and Google simulator |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in is simulated (demo) or reported as not configured (production) |
| `RESEND_API_KEY`, `MAIL_FROM` | Emails go to the demo mailbox (demo) or sign-up reports email isn't configured (production) |
| `DEEPL_API_KEY` | "See translation" says translation isn't connected |
| `APP_URL` | Base URL for email links and the OAuth redirect |

Full details: `docs/I18N_AUTH_ALIEN.md`.

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
- `tests/identity.spec.ts`: Playwright tests for 8.0 (12-language switching, language persistence, SEO alternates, missing keys, sign-up, Google demo, logout, reset, Reveal, same alien after re-login, map/LIVE/DAO identity, 375–1440 px with CJK/Thai/Cyrillic/Vietnamese fonts).
- `tests/unit` and `tests/integration`: i18n dictionaries and formatting, alien generation, the account service (memory and Postgres), vitest tests for the world map (growth levels, landmarks, search, URL state, `/api/map`), the ranking engine, ranking API, DAO domain logic, DAO API, live domain logic (time zones, energy, quests, check-in) and live API.
- See `docs/TEST_REPORT.md` for screenshots and Lighthouse results.
