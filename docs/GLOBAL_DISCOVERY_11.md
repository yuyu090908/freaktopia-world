# FREAKTOPIA WORLD 11.0: Global festival & DJ discovery

**Status: the engine is built, but no outside source is connected.** No API key exists, and the terms and approvals below have not been confirmed. Until they are, WORLD and EVENTS show only FREAKTOPIA's own events. Nothing is filled in with sample "world" events. World discovery is **not complete** until real data is flowing.

## 1. Audit (before 11.0)

- **WORLD and EVENTS** already shared one list: `/api/map` and EVENTS both read the sample events plus the published community parties. Their filters were already in the URL (10.0).
- There was **no model for outside events**, no adapter, no source admin, and no time-zone-aware date filter. The date filters were "30 days", "3 months" and "2027".
- **Reachability from this container:** `app.ticketmaster.com` and `rest.bandsintown.com` are blocked by the network policy (curl returned 000). Nothing has been fetched from either service, even once.

## 2. Design

```
source API ──adapter──▶ UnifiedEvent ──validate/sanitise/classify/locate──▶ dedupe ──▶ cache (ops store)
                                                                                       │
          WORLD (/api/map, external pins) ◀── publicEvents() ──▶ EVENTS (World events section, /api/discovery/events)
```

- **`lib/discovery/types.ts`: one model, `UnifiedEvent`.** Every event carries:
  - `sourceType`, `sourceName`, `sourceEventId` and `sourceUrl`
  - `lastSyncedAt`, `lastVerifiedAt` and `verificationStatus`
  - `externalStatus`, `venueTimezone`, `timeTbd` and `locationPrecision`
  - `lineup`, with **source-scoped artist ids**
- **Adapters (`lib/discovery/adapters/`):**
  - `ticketmaster.ts`: Discovery API v2, Dance/Electronic only. It validates with zod, keeps only https URLs to Ticketmaster hosts, and treats text as plain text.
  - `bandsintown.ts`: **off** until written approval.
  - `internal.ts`: FREAKTOPIA's own events, used for duplicate checks.
  - Partners use the existing EVENT CREATE; there is no second registration system.
- **Category (`classify.ts`):**
  - `major_festival` is set **only when the source classifies the event as a festival**. It is never inferred from name, size or popularity.
  - `club_event` is set only when the source names the venue type.
  - `dj_show` means electronic music with a named artist.
  - Everything else is `general_music`.
- **Location (`geo.ts`):**
  1. The venue's own coordinates.
  2. Otherwise, a known city centre, marked "approximate". It is drawn with a dashed stem, never as a venue pin.
  3. Otherwise, the event goes in the list only. It is never drawn on the globe.

  Coordinates are never guessed, by AI or by free-text geocoding.
- **Dates (`time.ts`):** "today", "this weekend" (Friday to Sunday) and "next 7/30 days" are worked out in the **venue's time zone**. FREAKTOPIA events use their city's zone.
- **Duplicates (`dedupe.ts`):**
  - Two listings are merged only when they have the same title, the same local day, the same city, and also the same venue or a shared artist.
  - Different nights are never merged.
  - When two listings are merged, the more trusted source wins: partner, then FREAKTOPIA, then external.
  - Weaker matches are listed for an admin to review; they are not merged.
- **Sync (`service.ts`):**
  - Each fetch has a timeout and retries on 429/5xx with backoff, and there is a pause between pages.
  - API keys are masked in errors.
  - Changes to date, venue, lineup, status or tickets are recorded.
  - An admin's "hidden" flag survives a refresh.
  - Events the source no longer returns are removed.
  - Cancelled and finished events are never public.
  - Postponed events stay listed, with no ticket link.
- **Refresh:**
  - Default intervals are 2h for events within 48h, 8h within 30 days, and 24h for later events. Admins can set each from 1 to 168h.
  - A daily Vercel cron (`vercel.json` → `/api/discovery/cron`, which needs `CRON_SECRET`) runs the sync.
  - Reads also refresh a stale source in the background. Hobby crons can only run once a day, so this is how the shorter intervals are met.
  - If a sync fails, the last good cache stays, with its "last verified" time.
- **Storage:** the existing ops store, with three new tables in `db/migrations/0011_global_discovery.sql` (additive, re-runnable, RLS on). It uses PostgreSQL when `DATABASE_URL` is set, and memory otherwise. No new database or auth system was added.

## 3. What the user sees

- **WORLD:**
  - **Pins for outside events:** the pin's shape shows the kind, not only its colour: star = major festival, disc = DJ show, square = club, triangle = other music. Each pin carries a source chip. The legend explains the shapes and the dashed "approximate" stem.
  - **Event panel:**
    - It shows the source badge, kind, local date and time (or "time to be announced"), source and event ID, verification, and **last verified**.
    - It shows a "stale" note after 24h, the status if not "scheduled", the venue, an approximate-location note, lineup, and the price range "according to the source".
    - The only buttons are **VIEW OFFICIAL EVENT** and **GET TICKETS**. Both open the source's site in a new tab with `rel="noopener noreferrer"`.
    - There are **no FREAKTOPIA ticket, support, DAO or DJ-apply buttons**, and no level.
  - **City clusters** at world zoom ("IBIZA 24 EVENTS") count outside events like the others.
- **EVENTS:**
  - A **World events** section uses the same search, city, genre, date and kind filters. Each card shows the source, local time, venue (approximate if so), lineup and "last verified".
  - Each card has official, tickets and "view on map" links.
  - **Artist search:** typing a name lists matching artists **by source id**, with the source, the number of upcoming events and their cities. Two artists with the same name stay two entries, and picking one filters by that id.
  - With no source connected, the section says so in one line.
- **Shared filters:**
  - Kind: Major festivals, DJ shows, Club events, FREAKTOPIA only. Several kinds match any of them.
  - Dates: Today, This weekend, Next 7 days, Next 30 days, 3 months, 2027.
  - Filters carry between pages through the URL: "Same search in EVENTS" on WORLD, and "Same search on the map" on EVENTS.
- **Admin (`/admin/sources`, OPS_ADMIN_EMAILS only; linked from `/world/audit`):**
  - **Sources:** each source's real state (not configured / not approved / connected / paused / error), the env var **names** needed to turn it on, the terms link, last sync, last success, event count, regions and the last error.
  - **Controls:** sync now, pause/resume, refresh intervals, and delete cached data (asks for `DELETE`).
  - **Quality:** possible duplicates, cancelled/postponed, time TBA, no venue, no location, approximate location, hidden (with hide/show), and recent changes.

## 4. How to switch sources on

**Ticketmaster.** Set these in Vercel (Production), server-side only, never `NEXT_PUBLIC_`:

| Env var | Value |
|---|---|
| `TICKETMASTER_API_KEY` | Consumer key from developer.ticketmaster.com (free account, "My Apps") |
| `TICKETMASTER_TERMS_ACCEPTED` | `1`, **only after** the project owner has read the API terms and is satisfied that this use is allowed: commercial use, caching/storage, images, attribution and regions |
| `TICKETMASTER_COUNTRIES` | Optional, e.g. `US,GB,DE,NL,ES`. Empty means all markets the key returns |
| `CRON_SECRET` | Any long random string (Vercel Cron sends it automatically) |
| `DATABASE_URL` | Needed to keep the cache between requests on Vercel. Apply `db/migrations/0011_global_discovery.sql` first. Without it, the cache lives in memory per server instance |

- With only the key set, the source shows **Not approved** and nothing is fetched.
- Once both are set, an admin can press **Sync now** on `/admin/sources`, or wait for the cron.
- Images from Ticketmaster are not shown yet: the terms on images have not been confirmed.

**Bandsintown.** It needs Bandsintown's **written approval** for a platform listing many artists. After approval, set `BANDSINTOWN_APP_ID`, `BANDSINTOWN_APPROVED=1` and `BANDSINTOWN_ARTISTS` (a comma-separated list). With only an app id set, it stays **Not approved** and makes no request.

No scraping is used, and no unapproved API is used for a production feature.

## 5. Security

- Keys are read only on the server, and no key is ever sent to the browser. Errors are masked (`apikey=***`).
- Only https URLs to an allowlist of the source's hosts are kept. URLs with credentials, `javascript:` URLs and lookalike hosts are dropped.
- Titles and descriptions are reduced to plain text: scripts and tags are removed, and entities are decoded. React escapes them again on render.
- `/api/discovery/events` validates its query with zod and is rate-limited (120 per minute per client).
- The admin API needs a signed-in admin, a same-origin request (CSRF) and a rate limit (30 per minute).
- The cron needs `Bearer CRON_SECRET`.

## 6. Tests

See `docs/TEST_REPORT.md` → "11.0". Source mapping is tested only on **mock data** (`tests/fixtures/ticketmaster-mock.json`, `map-external-mock.json`; marked MOCK). The app never serves these files.

## 7. Not done yet

- **Real data:** no event from Ticketmaster or Bandsintown has been fetched. The adapters are written against the documented response format and tested on mock data only, so the first real sync may surface differences.
- **Following, saving and notifications for outside events:** not built. SAVED EVENTS and notifications cover FREAKTOPIA events only. Change records are stored, ready for notifications.
- **Recommendations:** rule-based recommendations ("because you follow X") are not built.
- **"Famous DJs":** there is no verified popularity data, so this filter is **DJ shows** (electronic events with a named artist). It does not rank fame.
- **Partner verification** (`partner_verified`): the field exists, but there is no partner review flow yet.
- **External images:** not shown until the Ticketmaster image terms are confirmed.
- **Counts:** WORLD and EVENTS still count FREAKTOPIA events the same way. Outside events have their own count, and on EVENTS they are not added to the main total.
- **Not measured:** Lighthouse, real devices, and the deployed site (blocked from this container).
