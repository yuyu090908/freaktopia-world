# Event operations, staff matching and equipment sourcing

This feature lets an organizer plan an event, find gear, crew and DJs, hire them, and run the event with a team. It is built into existing places rather than a separate site:

- `/events` has a "Manage events" link. `/events/manage` lists your events and notifications. `/events/manage/new` is the planner. `/events/manage/[id]` is the event workspace.
- `/profile` links to `/profile/work`: one work profile per account (DJ, crew, gear owner, company), with listings, opportunities and your jobs.
- `/djs/[id]`: the existing booking sheet gains "Offer a gig from a managed event". This is a real direct offer. Demo DJs never reply.

Phases 1–3 are implemented. Phase 4 (payments, escrow, payouts) is **not** built: payments are records only.

## Event workspace

On desktop the six sections are a side navigation. On phones they are sticky, scrollable tabs (`?tab=` keeps the place).

| Section | Contents | Who sees it |
|---|---|---|
| Overview | readiness score, safety status (separate), conflicts, next tasks, key times, edit event | everyone on the team |
| Planning | requirements by category (planner suggestion vs. confirmed), quantities, "not needed", expert confirmation for safety items, add item | owner, manager, lead |
| Resources | items to source, matched candidates with reasons and exclusions, quote request, direct offer, open call, application comparison, hire, agreements, team reuse | recruiters, plus providers for their own agreements |
| Operations | chat (general + per-area threads), tasks, schedule, files, team, equipment handovers | everyone on the team (by area and role) |
| Budget | estimate / quoted / contracted / paid / remaining per category, overrun alert, cheaper alternatives, payment records | owner and manager only |
| Safety | go/no-go note, pre-event checklist (automatic and human-approved), expert-pending items, incidents, replacements | everyone; approvals by owner and manager |

## Size levels (L1–L6)

The level is detected from expected attendance and can be overridden (the override is stored and shown). The planner, the visible sections and the checklist only show what fits the level, so a private party does not see festival items.

| Level | Name | Attendance |
|---|---|---|
| L1 | Private party | up to 30 |
| L2 | Small party | up to 100 |
| L3 | Club event | up to 300 |
| L4 | Large event | up to 1,000 |
| L5 | Festival | up to 5,000 |
| L6 | Mega festival | above 5,000 |

(Thresholds: `SCALE_LEVELS` in `lib/ops/types.ts`.)

## Planner (rule-based, no AI)

`lib/ops/planner.ts` builds requirements from rules: level, indoor/outdoor, template, attendance, DJs, streaming, ticketing, and what you already own or the venue provides. Every suggested item carries the "Suggestion (rule-based)" badge until a person changes or confirms it. No AI model is connected and nothing claims to be AI.

Safety-relevant items (security, first aid, power, rigging, permits, insurance, the evacuation plan) cannot be removed. Lowering their quantity needs the name of the qualified person who confirmed it, and that name is recorded.

## Matching

`lib/ops/matching.ts` scores eligible listings on fit, availability, reliability (reviews and completed jobs), cost against the category budget, distance, logistics (delivery, setup, operator), scale suitability and verified credentials. The UI shows the score parts.

These are hard exclusions, shown with their reason:

- inactive
- unavailable on the dates
- fully booked
- not suitable for the size
- required credential not verified

Self-declared credentials stay "pending" until a reviewer listed in `OPS_ADMIN_EMAILS` verifies them.

## Recruiting and agreements

- **Open call:** anyone with a matching listing can apply.
- **Direct offer** and **quote request:** sent to one listing.
- **Packages:** one listing can cover several items, such as gear plus crew.
- Applications (price, message, optional PDF or image) are compared in one table before hiring.
- Hiring needs an explicit confirmation. It creates a booking on hold and a proposed agreement. The booking is confirmed only when the provider accepts.
- Changes and cancellations are versioned and logged. A cancellation opens an incident.
- Reviews open only after completed work. One review per side, separate from popularity rankings.

## Safety

- The checklist mixes automatic checks (all agreements accepted, all gear and crew booked) with items a person must approve with a reference, such as a permit number or document. Approval needs a ticked confirmation and is logged with name and time.
- The platform never decides go/no-go. Readiness is a separate score from safety approval.
- Incidents (equipment failure, staff shortage, load-in delay, power, weather, venue, cancellation) can be reported by anyone on the team. High and critical incidents notify the managers.
- Replacements are suggestions only. Nobody is contacted until the organizer confirms. Unverified providers are excluded from safety-relevant replacements, and so is the provider that cancelled.
- Equipment hand-out and return are recorded. A damaged, missing or short return opens an incident automatically.

## Data, permissions and security

- **Storage:** `lib/ops/store.ts`. The memory store is used without `DATABASE_URL`; the Postgres store `createPgOpsStore` uses migration `db/migrations/0007_event_ops.sql`. The migration has 22 additive `ops_*` tables, is re-runnable, and needs `0005` for `users`. No existing table is changed.
- **Roles:** RBAC per event (owner, manager, lead, staff, vendor) in `lib/ops/permissions.ts`.
  - Outsiders get 404, not 403, so event ids can't be probed.
  - Staff see no money.
  - Budget and contracts are hidden from staff.
  - Leads manage tasks in their own area. Staff see their own tasks and the general ones.
  - Files are restricted by audience (team, leads, managers).
- **Double booking:** prevented inside a transaction that holds an advisory lock on the listing (Postgres) while free quantity is checked. In the integration test on both stores, of two concurrent hires for the last unit, exactly one succeeds.
- **Concurrent edits:** use optimistic versions; a stale write returns 409.
- **Notifications:** deduplicated by a unique key per user.
- **API (`/api/ops/...`):**
  - Every POST checks same-origin, which acts as CSRF protection.
  - Requests are rate limited: read, write, invite and chat each have their own limit.
  - Request bodies have size limits, and all input is validated with zod.
  - Uploads are limited to 5 MB and to PDF or images. Downloads are served with `nosniff`, CSP sandbox and `no-store`.
  - Only verified accounts can create, apply or be invited.
- **Row-level security:** policies exist on the tables. The app connects as the owner role and enforces access in the service layer.

## Demo data

On the memory store only, `lib/ops/seed.ts` adds 15 fictional providers (sound, lighting, staging, power, security, medics, rental, photo, VJ, crew) and a performer listing for each demo DJ. They are all marked DEMO in the UI, never reply, and cannot be hired. They are never written to Postgres.

## Not implemented

- Payments, escrow and payouts (Phase 4): need regulatory checks first. Only "paid" records exist.
- Identity and business verification: no KYC provider is connected, so these stay "not verified".
- Photos for listings and handovers.
- Realtime chat: chat polls every 15 s.
- Email or push for notifications: in-app only.
- Event-team reuse sends quote requests to people you worked with. It does not re-hire them automatically.
- Credential verification is manual, by the admins listed in `OPS_ADMIN_EMAILS`.
