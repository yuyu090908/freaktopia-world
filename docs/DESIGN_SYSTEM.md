# FREAKTOPIA design system 2026

This file is the source of truth for tokens, type, spacing, components and page rules. The tokens live in `app/globals.css` (`@theme`). The components live in `components/ui`, `components/cards` and `components/layout`.

## Colour tokens

| Token | Value | Use |
|---|---|---|
| `ink` | `#0B0910` | Page background |
| `surface` | `#15111D` | Secondary background, inputs, sections |
| `surface-2` | `#211B2B` | Cards |
| `line` | `#3B3048` | Borders and dividers |
| `cream` | `#FFFFFF` | Main text |
| `mute` | `#BDB5C8` | Secondary text (AA on `ink`, `surface` and `surface-2`) |
| `acid` | `#C1FF53` | **Primary action only**, plus the active nav item and focus |
| `pink` | `#FF79CD` | Accent |
| `blue` | `#66DFFF` | Accent (cyan); also the "funding" status |
| `purple` | `#B78BFF` | Accent; also "DJ wanted" |
| `danger` / `coral` | `#FF6474` | Status: live, errors, destructive |
| `success` | `#58DB9B` | Status: confirmed, success |

Status colours (`danger`, `success`) are never used as an action colour. A LIVE badge is red, and a button is never red unless it is destructive.

## Type scale

| Role | Size |
|---|---|
| Page heading (`PageTitle` h1) | 28px on mobile, 40px from `sm` |
| Section heading (`SectionHeader` h2) | 22px on mobile, 28px from `sm` |
| Card title | 16–20px (event card 18px, row 16px) |
| Body | 16px on mobile, 14–15px on desktop |
| Auxiliary | 12–14px |

Japanese headings keep `word-break: keep-all`. The hero title uses `auto-phrase` where the browser supports it.

## Spacing, radius and targets

- Spacing uses a 4px grid (Tailwind's default scale).
- Cards use a radius of 16–20px: `rounded-[20px]` for cards and `rounded-[16px]` for rows and KPI cards.
- Every tap target is at least 44×44px.
  - Inputs are 44–52px tall. The search field is 52px.
  - When a card is a link, the title's link is stretched over the whole card (`after:absolute after:inset-0`). The whole card is then the target, and there is one link per card for screen readers.
- Safe areas: the header pads `safe-area-inset-top` and the bottom nav pads `safe-area-inset-bottom`.

## Buttons (`components/ui/primitives.tsx`)

| Role | Variant | Look |
|---|---|---|
| Primary | `primary` | Lime fill. **One per screen.** |
| Secondary | `secondary` | Card fill with a border |
| Destructive | `destructive` | Danger outline |
| Text | `text` | Inline lime text link |

The older variants (`coral`, `purple`, `blue`, `ghost`) are kept for screens that are not redesigned yet. New code uses the four roles above.

## Components

| Component | File | Notes |
|---|---|---|
| AppHeader | `components/layout/Header.tsx` | Desktop links: WORLD, EVENTS, LIVE, RANKINGS, DJ. The active link is underlined, not filled, so CREATE EVENT stays the only primary. |
| MobileBottomNav | `components/layout/MobileBottomNav.tsx` + `nav.ts` | HOME / WORLD / EVENTS / TICKETS / MY. Each route appears once. MY is also active on `/dashboard`, `/settings` and `/u/*`. |
| MobileMenu | `components/layout/MenuDrawer.tsx` | Every page once, grouped |
| PageHeader | `PageTitle` in `primitives.tsx` | |
| SearchBar | `components/ui/SearchBar.tsx` | 52px, 16px text, clear button |
| FilterChips | `components/ui/FilterChips.tsx` | Filters in use, each removable, plus "clear all" |
| FilterSheet / FilterGroup | `components/ui/FilterSheet.tsx` | Changes are a draft until **Apply**. **Clear** resets the draft. The Apply button shows the result count. |
| BottomSheet | `components/ui/BottomSheet.tsx` | Bottom sheet on phones, modal on desktop |
| EventCard / EventRow | `components/cards/Cards.tsx` | See the card order below |
| VenueCard, DJCard | `components/cards/Cards.tsx` | |
| RankingRow | `components/ranking/RankingCards.tsx` | Rank 4 and below |
| TicketCard | `components/cards/TicketCard.tsx` | Validity, entry QR and NFT status, stated as they are |
| StatCard / StatGrid | `components/ui/StatCard.tsx` | Value, unit, definition and "as of" time, or DEMO for fixed sample figures. Two columns on phones. |
| StatusBadge | `components/ui/StatusBadge.tsx` | live / demo_live / confirmed / funding / completed / cancelled |
| EmptyState, ErrorState, LoadingSkeleton | `components/ui/States.tsx` | |
| FormField | `Field` in `components/forms/Fields.tsx` | Inline errors with `role="alert"` |
| DashboardShell | `components/layout/DashboardShell.tsx` | One frame for every role, with WAI-ARIA tabs (arrow keys) |
| ConfirmDialog | `components/ui/ConfirmDialog.tsx` | Dialog built on BottomSheet (bottom sheet on phones, modal on desktop). Cancel is secondary and the confirm button is destructive. Used for "reset demo data" on MY. Other destructive actions still use their own inline confirmations. |
| Tabs | `components/ui/Tabs.tsx` | WAI-ARIA tabs (left and right arrow keys), 44px tall. Used on MY (FREAK ID / Activity / Settings). |

## Event rules (`lib/event-status.ts`, `lib/clock.ts`)

- **Status follows the clock.**
  - An event whose end time has passed is *completed*. It is never upcoming or live.
  - A sample event is never plain LIVE, only "DEMO LIVE".
  - The deployed site uses real time. `NEXT_PUBLIC_DEMO_CLOCK` pins the clock for tests only.
- **Card order:** image → name → date → city/venue → genres → status → price or support → details.
- **Price** shows only while tickets are on sale: a confirmed event with places left.
- **Support rate** shows only while the event is collecting support (funding).
- **Completed events** are listed apart on EVENTS and are never counted as upcoming.

## Filters

- **Within a group, the options combine with OR.** This applies to statuses, genres and sizes.
- **Across groups, the filters combine with AND.** The feature filters (DJ wanted, DAO, after party) combine with AND.
- The filter sheet says this in each group, so users know which logic applies.
- WORLD shows four quick chips (Live, Upcoming, DJ wanted, Funding). Everything else is under Filters.
- Community parties have no sample level, price or DJ call data. A filter on any of those therefore leaves them out, and no value is guessed for them.

## WORLD map overlay

The search, quick chips and count rows sit over the map. They wrap to more rows when a region or "clear" is shown, so the zoom controls and the legend are placed under the overlay's measured height (`ResizeObserver`), not at a fixed offset. Nothing in the overlay may cover the map controls at any width.
