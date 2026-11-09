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
- MapLibre GL. The world map uses bundled Natural Earth GeoJSON (`public/`), so it needs no tile server or API key.
- Key art (logo, hero posters, illustrated maps, scene panels) is supplied by the FREAKTOPIA team. It is cropped and stored in `assets/art/*.webp`, mapped in `lib/art.ts`, and served through `next/image` (AVIF/WebP, responsive sizes).
- Avatars, LV1–5 stage evolution, venue art and map pins are original inline SVG (`components/art/`, `components/map/markers.ts`).
- The space backdrop (stars and purple smoke) is pure CSS (`body::before` in `app/globals.css`), and cards use the `.neon` outline style.

## Pages
| Route | What it does |
|---|---|
| `/` | Hero, featured events, quick-start strip |
| `/world` | World map. Level pins LV1–5, filters, bottom sheet, and decluttered or grouped pins |
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
| `/live` | Live festival map. Location is opt-in and zone-level only, with no precise tracking |
| `/avatar` | Alien builder: SLIME BEAT, COSMIC FUZZ, VINYL MUTANT, JELLY RAVER |
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
- Accounts and auth, plus a server-side database
- Live streaming and audition audio or video
- Wallets and NFT minting (collectibles exist as UI only). The FESTIVAL DAO uses a throwaway demo wallet that only signs in; staking is a demo ledger
- Real-time live map with consented, zone-level presence
- AI features (recommendations, matching)
- Japanese and English locale toggle (copy is English-first, with Japanese line-breaking support)
- Moderation, reporting, notifications, email

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
- `tests/unit` and `tests/integration`: 89 vitest tests for the ranking engine, ranking API, DAO domain logic and DAO API. All pass.
- See `docs/TEST_REPORT.md` for screenshots and Lighthouse results.
