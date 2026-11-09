# WORLD RANKING & Festival Discovery Engine (FREAKTOPIA WORLD 4.0)

## Summary
- **New pages:**
  - `/rankings`: the WORLD RANKING itself
  - `/rankings/compare`: side-by-side festival comparison
  - `/alerts`: in-app alert inbox and alert settings
- **Event detail additions:** a ranking panel, a follow button, and `?action=support|follow` deep links.
- **Rankings are computed on the server:** the engine aggregates raw activity records itself (supports, tickets, check-ins, presence, payments) instead of reading pre-computed totals.
- **No database exists yet.** In demo mode, the server generates deterministic sample records and runs the real engine on them.
- **Demo vs. production:** `RANKING_DATA_MODE=production` switches to the production source. Until a database is connected, that source returns `503 DATA_SOURCE_NOT_CONFIGURED`, and the API **never** falls back to demo data.

## Ranking rules (lib/ranking/engine.ts)
| Category | Score | Notes |
|---|---|---|
| Most popular | Unique valid supporters | One per user (earliest support wins). Bots, held accounts and burst IPs are excluded. Wallets never count as people. Period ≠ all → new supporters in the period. |
| Most attended | De-duplicated check-ins of valid tickets | Live or completed events only. |
| Trending | `log10(1+new) × 1 + min(3, new/(base+50)) × 6` | Needs base+new ≥ 30 and new ≥ 5. "All time" uses 7 days. |
| Most funded | Captured payments converted to USD | Pending, refunded and expired payments are excluded. Totals are kept per currency, and the FX rate with its as-of time is returned. |
| Live now | Fresh presence pings (15-minute TTL) | Requires `status=live` **and** presence evidence. A check-in alone never counts as "present". |
| DJ wanted | Supporters | Only upcoming events that are recruiting. |
| After party | After-party tickets sold | — |
| Tickets sold | Valid sold tickets | Refunded, void and fraud tickets are excluded. Ticket ids are de-duplicated. |
| For you | Personal match score | Follow ×5, genre ×3, city ×2, DJ ×2, plus a small popularity term. Private, never cached publicly. |

- **Tie-break (fixed):** score ↓ → supporters ↓ → earlier start → id ↑.
- **Configuration:** all coefficients, minimum samples, presence TTL and burst thresholds live in `lib/ranking/config.ts`, together with the calculation version `rk-1.0.0`.
- **Rank movement:** the ranking for the same query one week earlier is compared with the current one.

### Community metrics (kept separate)
- `supporters_count`
- `interested_count`
- `tickets_sold`
- `checked_in_count`
- `currently_present_count`
- `public_avatar_count`: counts only users who are present, have opted in to showing their avatar, and have a public profile.

## API
All endpoints validate input with zod and return errors as `{ error: { code, message } }`. Each one is rate limited per client (in memory, per instance). Public GET responses send `Cache-Control: s-maxage=300`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/rankings` | – | `category, period, q, country, city, genre, status, price, level, dj, ap, page, pageSize` (max 50) |
| GET | `/api/rankings/top` | – | First 3 of any query |
| GET | `/api/rankings/trending` | – | Trending (defaults to 7d) |
| GET | `/api/rankings/map` | – | Top-N pins with rank, coordinates and an `approximate` flag |
| POST | `/api/rankings/compare` | – | `{ eventIds: [2..3] }`, returns rows and a share URL |
| GET | `/api/events/:id/ranking-history?days=14` | – | Daily rank per category |
| POST / DELETE | `/api/events/:id/follow` | user | 401 + `loginUrl` (returns to `?action=follow`) until auth exists |
| GET | `/api/users/me/ranking-preferences` | user | 401 until auth exists |
| POST | `/api/admin/rankings/recalculate` | admin | Clears snapshots and writes an audit entry (`Bearer RANKING_ADMIN_TOKEN`) |
| GET | `/api/admin/rankings/audit` | admin | Per-event exclusion counts and the audit log |

## Database changes
`db/migrations/0001_world_ranking.sql` (PostgreSQL). It has not been applied anywhere, because there is no database yet.

- **Dedup indexes on the raw tables:**
  - `event_supporters (event_id, user_id)`
  - `event_attendance (event_id, ticket_id)`
- **New raw tables:** `event_interests`, `event_presence`, `fx_rates` (rate history).
- **Ranking tables:**
  - `ranking_categories`, `ranking_periods`, `ranking_config_versions`
  - `event_metric_snapshots`, `event_ranking_snapshots`, `event_ranking_history`
  - `event_ranking_audit_logs`
- **User tables:**
  - `user_event_follows`, `user_ranking_preferences`
  - `ranking_rewards`, `user_ranking_rewards`
  - `event_comparisons`
  - `event_alert_subscriptions` (consent + channel), `user_notifications`

The migration also sets up:
- foreign keys to the existing `users`, `events`, `tickets`, `event_supporters`, `event_attendance` and `payments` tables
- `timestamptz` everywhere
- indexes for leaderboard reads

## Files
- `lib/ranking/`: the ranking code.
  - `types.ts`, `config.ts`, `engine.ts`: types, tunables and the pure engine
  - `source.ts`: data-source boundary, demo/production switch
  - `demo-source.ts`: deterministic demo records
  - `service.ts`: snapshots, cache, history, map, compare
  - `query.ts`: zod validation and URL sync
  - `guard.ts`: rate limit, auth stub, audit log, admin check
  - `meta.ts`, `rewards.ts`
- `lib/alerts.ts`: alert types and derivation.
- `app/api/**`: the endpoints listed above.
- `app/rankings/`: `page.tsx`, `RankingsView.tsx`, `RankingMap.tsx`, `compare/`.
- `app/alerts/`.
- `components/ranking/`: `RankingArt` (original SVG podium), `RankingCards` (TOP 1 / TOP 2–3 / list card + actions), `FollowButton`, `EventRankingPanel`.
- Edited files:
  - `components/map/WorldMap.tsx` (rank chips on pins)
  - `app/events/[id]/EventDetail.tsx`
  - `lib/store.ts` (follows, compare, alerts, personalization)
  - `lib/data.ts` (3 completed demo events)
  - header bell, navigation, home tile

## Tests
- **Unit (`tests/unit`, 26 tests):**
  - rank order, ties and determinism
  - duplicate and wallet handling, bot/held/burst exclusion
  - refunded, void and fraud tickets; duplicate scans
  - growth rate, smoothing and cap
  - period windows, currency conversion, presence TTL
  - filters and URL round-trip
- **Integration (`tests/integration`, 20 tests):**
  - API against event data
  - exclusions and FX
  - filters and paging, validation, rate limit
  - FOR YOU caching
  - production mode → 503
  - top, trending, map, compare (including errors), history
  - follow/preferences auth, admin token
  - alerts and their settings
- **E2E (`tests/rankings.spec.ts`, 12 tests):**
  - `/rankings` with no horizontal overflow at 375, 390, 430, 768 and 1440 px
  - category switch with URL restore
  - search and bottom-sheet filters
  - card → event detail
  - follow → alerts
  - compare and share
  - map pins → sheet → event
  - ≥44 px tap targets
- **Existing flows (`tests/flows.spec.ts`):** all 13 still pass.

Run the tests with `npm test` (vitest) and `npm run test:e2e` (Playwright).

## Not implemented yet (needs a backend)
- **Production data source:** a real implementation of `productionSource` (Postgres queries) and a snapshot cron job.
- **Login and server-side follows/preferences:** follows, preferences and alerts are stored in the browser only.
- **Push and email notifications:** the alert types and consent model are in place; only in-app alerts exist.
- **Bot detection:** only the burst rule is implemented. Device fingerprinting and CAPTCHA are missing, and there is no admin UI for holding or releasing accounts.
- **Persistence:** the rate limiter and audit log are in memory per server instance. Production needs Redis and the audit table.
- **Live FX feed:** demo rates are fixed.
- **Rewards:** granted from this browser's activity only (no server-side grants). NFT minting is not implemented.

## Settings needed for production
- `RANKING_DATA_MODE=production`
- `DATABASE_URL`, then apply `db/migrations/0001_world_ranking.sql` and implement `productionSource`.
- `RANKING_ADMIN_TOKEN` for the admin endpoints.
- A scheduled job every `refreshSeconds` (300 s) that writes `event_metric_snapshots` and `event_ranking_snapshots`, plus a daily `event_ranking_history` job.
- An FX rate provider writing to `fx_rates`.
- An auth provider: replace `getSessionUser` in `lib/ranking/guard.ts`.
- Redis or Upstash for rate limiting across instances.
