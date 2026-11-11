# FREAK ID & PARTY REWARDS

Spec: "FREAK ID & PARTY REWARDS" (2026-11-11). This document has the audit, the classification the spec asks for, what Phase 1 delivers, and what is not built yet.

## 1. Audit of what already exists

| Area | What is there | Where |
|---|---|---|
| Accounts / user ID | E-mail + password and magic link, sessions in httpOnly cookies, PostgreSQL or in-memory DEMO store | `lib/auth/*`, `db/migrations/0005`, `0006` |
| Profile / avatar | Profile record, privacy switches, one alien per account with public ID `FREAK-xxxxxxxx` | `lib/auth`, `lib/alien`, `/profile`, `/avatar` |
| Wallets | Wallet linking by signature only (no transactions, no approvals) | `lib/auth/wallet.ts` |
| Event attendance | Per (event, person) attendance with RSVP, waitlist, door QR check-in, manual confirm with reason, revoke, history | `lib/party/*`, `ops_attendance` (`0008`, `0009`) |
| "Held" proof | Event ended, not cancelled, ≥ 3 QR check-ins from people outside the team; team never counted; re-scans logged as duplicates | `lib/party/stats.ts` |
| Audit log / anomalies | `ops_party_audit`, anomaly signals, admin page `/world/audit` (OPS_ADMIN_EMAILS) | `lib/party/service.ts` |
| Personal world | Organizer worlds that grow from verified parties; attendee history at `/profile/parties` | `/u/[id]/world`, `/profile/parties` |
| Tickets / checkout | **Demo only**: sample events, orders saved in the browser, no payment, 5 % illustrative fee | `components/event/TicketSelector.tsx`, `lib/store.ts` |
| Free party passes | RSVP QR passes for community parties (the real entry credential) | `lib/party/service.ts` |
| NFT | `/nft` is a demo collectibles market; no minting, no contract | `app/nft` |
| Quests | Demo quests (`/quests`, browser) and LIVE quests where on-site quests need a check-in | `app/quests`, `lib/live/quests.ts` |
| Rankings | Popularity ranking of events (not people) | `lib/ranking` |
| DAO | Demo staking/voting with sybil checks; production chain not connected | `lib/dao` |
| Payments | **None.** No payment provider is connected anywhere. | — |

## 2. Classification

**Reuse as is**
- Accounts, sessions, alien public ID → FREAK ID (no new account, no new ID).
- Verified attendance and the "held" rules → the only source for the event count.
- `ops_party_audit` → audit log for rule changes and exclusions.
- Admin list `OPS_ADMIN_EMAILS` → who may change loyalty rules.
- Personal world and `/profile/parties` → linked from FREAK ID.
- City posters (9.4) → later for the passport.

**Extend**
- `/profile` → FREAK ID card at the top.
- Demo checkout → server-side fee quote with rank discount, re-checked right before the order, snapshot saved on the order.
- Order page → shows the fee snapshot.
- `/world/audit` → link to loyalty management.
- Ticket grade art → the 5 holographic passes.

**New (Phase 1)**
- `lib/loyalty/rules.ts` (ranks, fee maths), `lib/loyalty/service.ts`, `/api/loyalty/*`.
- Tables `ops_loyalty_rules`, `ops_loyalty_exclusions` (`db/migrations/0010_freak_loyalty.sql`, additive).
- `/admin/loyalty` (one admin page).

**Not built because it would duplicate something**
- A `LoyaltyAccounts` table: the rank is computed from attendance every time, so there is no second count to drift.
- A separate `AttendanceRecords` table: `ops_attendance` already is that record.
- A second quest system, a second world, a second admin area.

**Needs legal / external checks before production**
- Payment provider and refunds (no paid tickets exist yet; Phase 2 depends on it).
- Chain choice, wallet provider (embedded wallets), NFT contracts and audits.
- Whether NFT tickets and transferable passes are regulated in each country (consumer law, secondary ticket sales, securities).
- Personal data on chain (must stay off chain), cross-border data for the passport.
- Profitability of the discount table, especially LEGEND 100 %.
- Tax treatment of discounts and rewards.

## 3. Phase 1: FREAK ID & LOYALTY (built)

- **FREAK ID** (`/profile`): alien, name, FREAK ID, rank, progress to the next rank, fee discount, verified events, cities, countries, pending check-ins (event not verified yet), events under review with a link to ask for a review, announced rule changes, rank table, verified history with cities, links to the personal world and party history. Signed-out visitors see what FREAK ID is and the rank table.
- **Counting:** only the person's own door check-in, one per event, at events verified as held, minus events an admin left out after an audit. RSVPs, purchases, other people's tickets, team members and cancelled events never count.
- **Ranks (default, editable):** ROOKIE 0–2 / 0 %, EXPLORER 3–5 / 20 %, RAVER 6–14 / 40 %, ELITE 15–29 / 60 %, LEGEND 30+ / 100 %.
- **LEGEND 100 %** is off until an admin switches on "Allow a 100 % discount". Until then LEGEND gets the best discount below 100 % (60 %) and the UI says so.
- **Discount on the platform fee only.** Ticket price, payment-provider fees and taxes are never discounted. Maths in cents. Examples verified by tests: $100 ELITE → fee $5, discount $3, final $2; $120 ELITE → $6 / $3.60 / $2.40.
- **Checkout:** the breakdown comes from `POST /api/loyalty/quote` (rank from the session, never from the browser). Before the order is stored it is quoted again; if the amount changed, the person sees the new amount and confirms again. The order keeps rank, %, fee, discount, total, rules version and time. Signed out and unconfirmed e-mail get ROOKIE pricing. The page says that buying alone does not count and how many verified events are left after attending.
- **Admin (`/admin/loyalty`):** fee rate, discount cap, minimum fee, 100 % switch, thresholds and discounts per rank, members per rank (real accounts only, zeros when there is no data), exclusions with reason, audit log. A change that takes anything away needs a notice and starts ≥ 30 days later; members see the notice on their FREAK ID. Rules must stay consistent (higher rank → more events and at least the same discount).
- **Double discount:** a single discount is computed per order on the server; the stored snapshot is final for that order.

## 4. Not built yet (later phases)

- Phase 2: ENTRY NFT / MEMORY NFT, minting, wallet onboarding, transfer rules, mint retries. **Simulated nowhere**: nothing in the app claims an NFT exists. Blocked by: no payment provider, no chain or contract decided.
- Paid tickets: there is still no real payment. The checkout remains a demo; the fee snapshot is stored with the demo order in the browser.
- Phase 3: rewards, organizer REWARDS tab, redemption codes, inventory.
- Phase 4: Universe Passport, attendance quests, world decorations per rank.
- Phase 5: analytics.
- Admin analytics such as repeat rate or total discount given: not shown, because there are no real paid orders to count.

## 5. Ticket grade art

The five holographic passes are used in order: PASS ONE → BASIC, TWO → SILVER, THREE → GOLD, FOUR → VIP, FIVE → LEGEND (`assets/art/tickets/holo-*.webp`). The dummy date and QR code on each are blurred, the outer background is cropped. The design names printed on them (AURORA DROP, SPECTRUM NIGHT …) remain as design names. Only the grades an event sells are shown. The 9.4 tier art files are kept in the repository but no longer used.
